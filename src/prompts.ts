// Prompts and sampling settings, following each model card. This module has
// no GNOME imports so it can be unit-tested under Node.

import type {Language} from "./languages";

/** How a model expects to be prompted. */
export type PromptStyle = "index-translate" | "hy-mt";

/** Neighbouring subtitles, given to the model to help it understand a line. */
export type Context = {before: string[]; after: string[]};

// A subtitle cue never needs more than this; it also stops runaway output.
const MAX_OUTPUT_TOKENS = 256;

function hasContext(context: Context | undefined): context is Context {
  return !!context && context.before.length + context.after.length > 0;
}

// Index-Translate is trained on Chinese instructions that name languages in
// Chinese. Context goes into its "instTrans" constrained-translation format
// as a soft constraint.
function indexTranslatePrompt(
  text: string,
  target: Language,
  context?: Context,
): string {
  if (!hasContext(context)) {
    return `请将以下文本翻译为${target.chineseName}，直接输出翻译结果，不要进行任何解释。\n\n${text}`;
  }

  const quote = (lines: string[]) => lines.map(l => `「${l}」`).join("");
  const parts = [
    context.before.length > 0 ? `上文：${quote(context.before)}` : "",
    context.after.length > 0 ? `下文：${quote(context.after)}` : "",
  ].filter(Boolean);

  return [
    `请将以下字幕翻译成${target.chineseName}，并且严格遵循所有约束要求。`,
    "",
    "【源文】",
    text,
    "",
    "【约束要求】",
    `1. 【注意】源文是连续字幕中的一句，请结合上下文理解其含义，只翻译源文，不要翻译上下文。${parts.join("；")}`,
    "",
    "只输出译文，不要有任何额外说明。",
  ].join("\n");
}

// Hy-MT takes English instructions and has a template for background
// information.
function hyMtPrompt(text: string, target: Language, context?: Context): string {
  const name = target.code === "pt-BR" ? "Brazilian Portuguese" : target.name;

  if (!hasContext(context)) {
    return `Translate the following text into ${name}. Note that you should only output the translated result without any additional explanation:\n\n${text}`;
  }

  const background = [
    "The source text is one line of a film's subtitles. Do not translate the surrounding lines.",
    ...(context.before.length > 0
      ? ["Lines before it:", ...context.before]
      : []),
    ...(context.after.length > 0 ? ["Lines after it:", ...context.after] : []),
  ];

  return [
    "[Background Information]",
    ...background,
    "",
    `Please translate the following text into ${name}, taking the provided background information into consideration.`,
    "",
    "[Source Text]",
    text,
  ].join("\n");
}

/** Builds the chat completion request body. Neither model takes a system prompt. */
export function buildRequest(
  style: PromptStyle,
  text: string,
  target: Language,
  context?: Context,
): Record<string, unknown> {
  switch (style) {
    case "index-translate":
      return {
        messages: [
          {role: "user", content: indexTranslatePrompt(text, target, context)},
        ],
        temperature: 0,
        chat_template_kwargs: {enable_thinking: false},
        max_tokens: MAX_OUTPUT_TOKENS,
      };
    case "hy-mt":
      return {
        messages: [{role: "user", content: hyMtPrompt(text, target, context)}],
        temperature: 0.7,
        top_p: 0.6,
        top_k: 20,
        repeat_penalty: 1.05,
        max_tokens: MAX_OUTPUT_TOKENS,
      };
  }
}

/** Tidies the model's reply into a single line of subtitle text. */
export function cleanReply(reply: string): string {
  // Safety net in case a thinking block slips through.
  const answer = reply.includes("</think>")
    ? (reply.split("</think>")[1] ?? "")
    : reply;
  return answer.replace("<think>", "").replace(/\s+/g, " ").trim();
}

/**
 * Models often leave ALL-CAPS text (common in subtitles for the deaf and hard
 * of hearing) untranslated, so it is translated in lowercase and the casing
 * restored afterwards.
 */
export function splitCasing(text: string): {
  source: string;
  restore: (translated: string, locale: string) => string;
} {
  const allCaps = text === text.toUpperCase() && text !== text.toLowerCase();
  return {
    source: allCaps ? text.toLowerCase() : text,
    restore: (translated, locale) =>
      allCaps ? translated.toLocaleUpperCase(locale) : translated,
  };
}
