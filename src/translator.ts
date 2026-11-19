import Gio from "gi://Gio";

import * as Models from "./models";
import type {Language} from "./languages";
import {server} from "./llama-server";
import {buildRequest, cleanReply, splitCasing, type Context} from "./prompts";
import {plainText, prepareCue, type Cue} from "./srt";

// How many subtitles on each side are shown to the model as context.
const CONTEXT_LINES = 2;

export class TranslationCancelled extends Error {}

/**
 * A translation in progress. It keeps what has been translated so far, so a
 * translation that was stopped or failed can be resumed.
 */
export type Job = {
  cues: Cue[];
  translated: Cue[];
  language: Language;
};

export function isComplete(job: Job): boolean {
  return job.translated.length >= job.cues.length;
}

export type Options = {
  model: Models.CatalogModel;
  /** Show the model the neighbouring subtitles. */
  useContext: boolean;
  cancellable: Gio.Cancellable;
  onProgress?: (done: number, total: number) => void;
};

function contextFor(cues: Cue[], position: number): Context {
  const texts = (from: number, to: number) =>
    cues.slice(Math.max(from, 0), to).map(plainText).filter(Boolean);
  return {
    before: texts(position - CONTEXT_LINES, position),
    after: texts(position + 1, position + 1 + CONTEXT_LINES),
  };
}

async function translateText(
  text: string,
  language: Language,
  context: Context | undefined,
  {model, cancellable}: Options,
): Promise<string> {
  const {source, restore} = splitCasing(text);
  const reply = await server.chat(
    buildRequest(model.promptStyle, source, language, context),
    cancellable,
  );
  const translated = cleanReply(reply);
  // An empty reply would leave a blank subtitle; keep the original instead.
  return translated ? restore(translated, language.code) : text;
}

/**
 * Translates the remaining subtitles of `job`, adding them to
 * `job.translated` as it goes. Throws `TranslationCancelled` when stopped.
 */
export async function run(job: Job, options: Options): Promise<void> {
  const {cancellable, onProgress} = options;
  const total = job.cues.length;

  try {
    await server.ensureRunning(Models.modelPath(options.model));

    while (job.translated.length < total) {
      if (cancellable.is_cancelled()) throw new TranslationCancelled();

      const position = job.translated.length;
      const cue = job.cues[position] as Cue;
      const unit = prepareCue(cue.lines);
      const context = options.useContext
        ? contextFor(job.cues, position)
        : undefined;

      const translated: string[] = [];
      for (const segment of unit.segments) {
        translated.push(
          await translateText(segment, job.language, context, options),
        );
      }

      job.translated.push({...cue, lines: unit.assemble(translated)});
      onProgress?.(job.translated.length, total);
    }
  } catch (e) {
    if (cancellable.is_cancelled()) throw new TranslationCancelled();
    throw e;
  }
}
