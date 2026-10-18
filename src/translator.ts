import Gio from "gi://Gio";

import * as Models from "./models";
import {server} from "./llama-server";

export type Language = {code: string; flag: string; name: string};

type Subtitle = {index: number; start: string; end: string; text: string};

function parseSrt(content: string): Subtitle[] {
  const parts = content.split(/\r?\n\r?\n/);
  const subs: Subtitle[] = [];

  for (const part of parts) {
    const lines = part.split(/\r?\n/).filter(Boolean);
    if (lines.length >= 3) {
      const [indexLine, ...rest] = lines as [string, ...string[]];
      const index = Number.parseInt(indexLine, 10);
      const slice = rest as [string, ...string[]];
      const times = slice[0];
      const textLines = slice.slice(1);

      const timeSplit = times.split(" --> ");
      if (timeSplit.length !== 2) continue;
      const [start, end] = timeSplit as [string, string];
      subs.push({index, start, end, text: textLines.join(" ")});
    }
  }

  return subs;
}

function buildSrt(subs: Subtitle[]): string {
  return subs
    .map((s) => `${s.index}\n${s.start} --> ${s.end}\n${s.text}\n`)
    .join("\n");
}

// A subtitle cue never needs more than this; it also stops runaway output.
const MAX_OUTPUT_TOKENS = 256;

// Index-Translate is trained on Chinese instructions that name languages in
// Chinese; these match the official client's mapping.
const CHINESE_LANGUAGE_NAMES: Record<string, string> = {
  ar: "阿拉伯语",
  bn: "孟加拉语",
  zh: "中文",
  nl: "荷兰语",
  en: "英语",
  fr: "法语",
  de: "德语",
  el: "希腊语",
  hi: "印地语",
  it: "意大利语",
  ja: "日语",
  ko: "韩语",
  pl: "波兰语",
  pt: "葡萄牙语",
  "pt-BR": "巴西葡萄牙语",
  ru: "俄语",
  es: "西班牙语",
  th: "泰语",
  tr: "土耳其语",
  uk: "乌克兰语",
  vi: "越南语",
};

// Prompts and sampling follow each model card. Neither model takes a system prompt.
function buildRequest(model: Models.CatalogModel, text: string, target: Language): object {
  switch (model.promptStyle) {
    case "index-translate": {
      const name = CHINESE_LANGUAGE_NAMES[target.code] ?? target.name;
      return {
        messages: [{role: "user", content: `请将以下文本翻译为${name}，直接输出翻译结果，不要进行任何解释。\n\n${text}`}],
        temperature: 0,
        chat_template_kwargs: {enable_thinking: false},
      };
    }
    case "hy-mt": {
      const name = target.code === "pt-BR" ? "Brazilian Portuguese" : target.name;
      return {
        messages: [
          {
            role: "user",
            content: `Translate the following text into ${name}. Note that you should only output the translated result without any additional explanation:\n\n${text}`,
          },
        ],
        temperature: 0.7,
        top_p: 0.6,
        top_k: 20,
        repeat_penalty: 1.05,
      };
    }
  }
}

async function translateText(
  model: Models.CatalogModel,
  text: string,
  target: Language,
  cancellable: Gio.Cancellable,
): Promise<string> {
  // Models often leave ALL-CAPS text (common in SDH subtitles) untranslated,
  // so translate it in lowercase and restore the casing afterwards.
  const allCaps = text === text.toUpperCase() && text !== text.toLowerCase();
  const source = allCaps ? text.toLowerCase() : text;

  let out = await server.chat({...buildRequest(model, source, target), max_tokens: MAX_OUTPUT_TOKENS}, cancellable);
  // Safety net in case a thinking block slips through.
  if (out.includes("</think>")) out = out.split("</think>")[1] ?? "";
  // A blank line would end the cue early and corrupt the SRT file.
  out = out.replace("<think>", "").trim().replace(/(\r?\n)+/g, "\n");
  return allCaps ? out.toLocaleUpperCase(target.code) : out;
}

export class TranslationCancellation {
  private _cancelled = false;
  readonly cancellable = new Gio.Cancellable();
  
  cancel() {
    this._cancelled = true;
    this.cancellable.cancel();
  }
  
  get isCancelled() {
    return this._cancelled;
  }
}

export async function translateSrtFile(
  filePath: string,
  targetLanguage: Language,
  model: Models.CatalogModel,
  onProgress?: (done: number, total: number) => void,
  cancellation = new TranslationCancellation(),
): Promise<string> {
  await server.ensureRunning(Models.modelPath(model));

  const file = Gio.File.new_for_path(filePath);
  const [, contents] = file.load_contents(null);
  const content = new TextDecoder().decode(contents);
  const subs = parseSrt(content);

  const total = subs.length;
  const translated: Subtitle[] = [];

  for (const [i, s] of subs.entries()) {
    if (cancellation.isCancelled) {
      throw new Error("Translation was cancelled");
    }
    let out: string;
    try {
      out = await translateText(model, s.text, targetLanguage, cancellation.cancellable);
    } catch (e) {
      if (cancellation.isCancelled) throw new Error("Translation was cancelled");
      throw e;
    }
    translated.push({index: s.index, start: s.start, end: s.end, text: out});
    onProgress?.(i + 1, total);
  }

  return buildSrt(translated);
}
