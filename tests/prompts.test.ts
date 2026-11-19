import {describe, expect, it} from "vitest";

import {languages} from "../src/languages";
import {buildRequest, cleanReply, splitCasing} from "../src/prompts";

const language = (code: string) => {
  const found = languages.find(l => l.code === code);
  if (!found) throw new Error(`No language ${code}`);
  return found;
};

const prompt = (request: Record<string, unknown>) =>
  (request.messages as {content: string}[])[0]?.content ?? "";

describe("buildRequest", () => {
  it("uses the Index-Translate model card prompt", () => {
    const request = buildRequest("index-translate", "Hello", language("pt-BR"));
    expect(prompt(request)).toBe(
      "请将以下文本翻译为巴西葡萄牙语，直接输出翻译结果，不要进行任何解释。\n\nHello",
    );
    expect(request.temperature).toBe(0);
    expect(request.chat_template_kwargs).toEqual({enable_thinking: false});
  });

  it("uses the Hy-MT model card prompt and sampling", () => {
    const request = buildRequest("hy-mt", "Hello", language("pt-BR"));
    expect(prompt(request)).toBe(
      "Translate the following text into Brazilian Portuguese. Note that you should only output the translated result without any additional explanation:\n\nHello",
    );
    expect(request).toMatchObject({temperature: 0.7, top_p: 0.6, top_k: 20});
  });

  it("adds surrounding lines when given", () => {
    const context = {before: ["Where is he?"], after: ["Let's go."]};
    const index = prompt(
      buildRequest("index-translate", "I don't know.", language("fr"), context),
    );
    expect(index).toContain("【源文】\nI don't know.");
    expect(index).toContain("上文：「Where is he?」；下文：「Let's go.」");
    expect(index).toContain("法语");

    const hy = prompt(
      buildRequest("hy-mt", "I don't know.", language("fr"), context),
    );
    expect(hy).toContain("[Background Information]");
    expect(hy).toContain("Lines before it:\nWhere is he?");
    expect(hy).toContain("[Source Text]\nI don't know.");
  });

  it("falls back to the plain prompt when there are no surrounding lines", () => {
    const empty = {before: [], after: []};
    expect(buildRequest("hy-mt", "Hi", language("fr"), empty)).toEqual(
      buildRequest("hy-mt", "Hi", language("fr")),
    );
  });

  it("has a Chinese name for every language", () => {
    for (const {chineseName} of languages) expect(chineseName).not.toBe("");
  });
});

describe("cleanReply", () => {
  it("trims and flattens the reply", () => {
    expect(cleanReply("  Olá\n\nmundo \n")).toBe("Olá mundo");
  });

  it("removes a thinking block", () => {
    expect(cleanReply("<think>hmm</think>Olá")).toBe("Olá");
    expect(cleanReply("<think>Olá")).toBe("Olá");
  });
});

describe("splitCasing", () => {
  it("translates all-caps text in lowercase and restores the casing", () => {
    const {source, restore} = splitCasing("DOOR CREAKS");
    expect(source).toBe("door creaks");
    expect(restore("porta range", "pt-BR")).toBe("PORTA RANGE");
  });

  it("leaves mixed-case text and text without letters alone", () => {
    expect(splitCasing("Hello").source).toBe("Hello");
    expect(splitCasing("Hello").restore("Olá", "pt")).toBe("Olá");
    expect(splitCasing("123...").source).toBe("123...");
  });
});
