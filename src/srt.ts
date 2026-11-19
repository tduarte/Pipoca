// SRT parsing, formatting and layout. This module has no GNOME imports so it
// can be unit-tested under Node.

export type Cue = {
  index: number;
  /** The timing line exactly as found in the file. */
  timing: string;
  lines: string[];
};

const TIMING_LINE =
  /^\s*\d{1,3}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,3}:\d{2}:\d{2}[,.]\d{1,3}/;

export function parseSrt(content: string): Cue[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  const cues: Cue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const timing = lines[i] as string;
    if (!TIMING_LINE.test(timing)) continue;

    const previous = lines[i - 1]?.trim() ?? "";
    const index = /^\d+$/.test(previous)
      ? Number.parseInt(previous, 10)
      : cues.length + 1;

    const text: string[] = [];
    while (i + 1 < lines.length && (lines[i + 1] as string).trim() !== "") {
      text.push((lines[++i] as string).trim());
    }

    cues.push({index, timing: timing.trim(), lines: text});
  }

  return cues;
}

export function buildSrt(cues: Cue[]): string {
  return cues
    .map(cue => `${cue.index}\n${cue.timing}\n${cue.lines.join("\n")}\n`)
    .join("\n");
}

/** The cue's words on one line, without any formatting tags. */
export function plainText(cue: Cue): string {
  return cue.lines
    .join(" ")
    .replace(/\{\\[^}]*\}|<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Formatting = {prefix: string; suffix: string; text: string};

const WRAPPING_TAG = /^<(i|b|u|s|font)(\s[^>]*)?>([\s\S]*)<\/\1>$/i;

/**
 * Splits off position tags (`{\an8}`) and tags that wrap the whole text
 * (`<i>…</i>`), so that only the words are sent to the model.
 */
export function splitFormatting(text: string): Formatting {
  let prefix = "";
  let suffix = "";
  let rest = text.trim();

  for (;;) {
    const position = rest.match(/^\{\\[^}]*\}/);
    if (position) {
      prefix += position[0];
      rest = rest.slice(position[0].length).trim();
      continue;
    }

    const wrap = rest.match(WRAPPING_TAG);
    const tag = wrap?.[1];
    const inner = wrap?.[3];
    // `<i>a</i> b <i>c</i>` is not wrapped by a single pair of tags.
    if (!tag || inner === undefined) break;
    if (inner.toLowerCase().includes(`</${tag.toLowerCase()}>`)) break;

    const open = rest.slice(0, rest.length - inner.length - tag.length - 3);
    prefix += open;
    suffix = `</${tag}>${suffix}`;
    rest = inner.trim();
  }

  return {prefix, suffix, text: rest};
}

const MAX_LINE_LENGTH = 42;

/**
 * Breaks `text` into lines of similar length, the way subtitles are usually
 * laid out. Text that fits on one line, or has no spaces to break at, is left
 * alone.
 */
export function wrapLines(
  text: string,
  maxLines = 2,
  maxLength = MAX_LINE_LENGTH,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const joined = words.join(" ");
  if (joined.length <= maxLength || words.length < 2) return [joined];

  const count = Math.min(
    Math.max(maxLines, 2),
    Math.ceil(joined.length / maxLength),
    words.length,
  );
  const lines: string[] = [];
  let remaining = words;

  for (let left = count; left > 1; left--) {
    const target = remaining.join(" ").length / left;
    let best = 1;
    let bestDistance = Infinity;
    let length = 0;
    // Leave at least one word for each of the lines that follow.
    for (let n = 1; n <= remaining.length - (left - 1); n++) {
      length += (remaining[n - 1] as string).length + (n > 1 ? 1 : 0);
      const distance = Math.abs(length - target);
      if (distance < bestDistance) {
        best = n;
        bestDistance = distance;
      }
    }
    lines.push(remaining.slice(0, best).join(" "));
    remaining = remaining.slice(best);
  }
  lines.push(remaining.join(" "));

  return lines;
}

const DIALOGUE_DASH = /^[-–—]\s*\S/;
const HAS_WORDS = /\p{L}/u;

export type TranslationUnit = {
  /** The pieces of text to translate, in order. */
  segments: string[];
  /** Rebuilds the cue's lines from the translated segments. */
  assemble: (translated: string[]) => string[];
};

/**
 * Works out what to send to the model for a cue and how to lay out the
 * result:
 *
 * - formatting that covers the whole cue is set aside and put back afterwards;
 * - two-speaker cues ("- Hi." / "- Hello.") are translated line by line so
 *   each speaker keeps their own line;
 * - other multi-line cues are one sentence broken for display, so they are
 *   translated as a whole and broken again afterwards.
 */
export function prepareCue(lines: string[]): TranslationUnit {
  const original = lines.map(line => line.trim()).filter(Boolean);
  // `<i>one</i>` / `<i>two</i>` is a single italic block split over two lines.
  const merged = original
    .join("\n")
    .replace(/<\/(i|b|u|s)>(\s*\n\s*)<\1>/gi, "$2");
  const {prefix, suffix, text} = splitFormatting(merged);

  if (!HAS_WORDS.test(text.replace(/<[^>]*>/g, ""))) {
    return {segments: [], assemble: () => original};
  }

  const decorate = (result: string[]): string[] =>
    result.map(
      (line, i) =>
        (i === 0 ? prefix : "") +
        line +
        (i === result.length - 1 ? suffix : ""),
    );

  const textLines = text.split("\n").map(line => line.trim());

  if (textLines.length > 1 && textLines.every(l => DIALOGUE_DASH.test(l))) {
    return {
      segments: textLines,
      assemble: translated =>
        decorate(
          translated.map((line, i) => {
            const clean = line.replace(/\s+/g, " ").trim();
            // Keep the speaker dash even if the model dropped it.
            if (DIALOGUE_DASH.test(clean) || clean === "") return clean;
            const dash = (textLines[i] as string).match(/^[-–—]\s*/);
            return `${dash?.[0] ?? "- "}${clean}`;
          }),
        ),
    };
  }

  return {
    segments: [textLines.join(" ")],
    assemble: translated =>
      decorate(wrapLines(translated.join(" "), textLines.length)),
  };
}

/** `movie.srt` translated to Brazilian Portuguese becomes `movie.pt-BR.srt`. */
export function translatedFileName(name: string, languageCode: string): string {
  const base = name.replace(/\.srt$/i, "");
  return `${base}.${languageCode}.srt`;
}
