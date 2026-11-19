import {describe, expect, it} from "vitest";

import basic from "./fixtures/basic.srt?raw";
import {
  buildSrt,
  parseSrt,
  plainText,
  prepareCue,
  splitFormatting,
  translatedFileName,
  wrapLines,
} from "../src/srt";

describe("parseSrt", () => {
  it("reads a simple file", () => {
    const cues = parseSrt(basic);
    expect(cues).toHaveLength(3);
    expect(cues[0]).toEqual({
      index: 1,
      timing: "00:00:01,000 --> 00:00:03,000",
      lines: ["Hello world"],
    });
  });

  it("keeps the lines of a cue separate", () => {
    const [cue] = parseSrt(
      "1\n00:00:01,000 --> 00:00:02,000\n- Hi.\n- Hello.\n",
    );
    expect(cue?.lines).toEqual(["- Hi.", "- Hello."]);
  });

  it("handles Windows line endings, a byte order mark and extra blank lines", () => {
    const cues = parseSrt(
      "﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nOne\r\n\r\n\r\n \r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nTwo\r\n",
    );
    expect(cues.map(c => c.index)).toEqual([1, 2]);
    expect(cues.map(c => c.lines)).toEqual([["One"], ["Two"]]);
  });

  it("keeps position data on the timing line", () => {
    const [cue] = parseSrt(
      "1\n00:00:01,000 --> 00:00:02,000 X1:10 X2:20 Y1:30 Y2:40\nText\n",
    );
    expect(cue?.timing).toBe(
      "00:00:01,000 --> 00:00:02,000 X1:10 X2:20 Y1:30 Y2:40",
    );
  });

  it("numbers cues itself when the file doesn't", () => {
    const cues = parseSrt(
      "00:00:01,000 --> 00:00:02,000\nOne\n\n00:00:03,000 --> 00:00:04,000\nTwo\n",
    );
    expect(cues.map(c => c.index)).toEqual([1, 2]);
  });

  it("keeps cues without text and ignores everything else", () => {
    const cues = parseSrt(
      "junk\n\n1\n00:00:01,000 --> 00:00:02,000\n\n2\n00:00:03,000 --> 00:00:04,000\nTwo\n",
    );
    expect(cues.map(c => c.lines)).toEqual([[], ["Two"]]);
  });

  it("round-trips through buildSrt", () => {
    expect(buildSrt(parseSrt(basic))).toBe(basic);
  });
});

describe("plainText", () => {
  it("drops tags and joins lines", () => {
    expect(
      plainText({
        index: 1,
        timing: "",
        lines: ["{\\an8}<i>Where are", "you <b>going</b>?</i>"],
      }),
    ).toBe("Where are you going?");
  });
});

describe("splitFormatting", () => {
  it("leaves plain text alone", () => {
    expect(splitFormatting("Hello")).toEqual({
      prefix: "",
      suffix: "",
      text: "Hello",
    });
  });

  it("sets aside position tags and wrapping tags", () => {
    expect(splitFormatting("{\\an8}<i>Hello</i>")).toEqual({
      prefix: "{\\an8}<i>",
      suffix: "</i>",
      text: "Hello",
    });
  });

  it("handles nested wrapping tags with attributes", () => {
    expect(splitFormatting('<font color="#ffff00"><b>Hi</b></font>')).toEqual({
      prefix: '<font color="#ffff00"><b>',
      suffix: "</b></font>",
      text: "Hi",
    });
  });

  it("does not treat two separate tags as one wrapper", () => {
    const text = "<i>One</i> and <i>two</i>";
    expect(splitFormatting(text)).toEqual({prefix: "", suffix: "", text});
  });
});

describe("wrapLines", () => {
  it("keeps short text on one line", () => {
    expect(wrapLines("Short line")).toEqual(["Short line"]);
  });

  it("breaks long text into two balanced lines", () => {
    const lines = wrapLines(
      "This sentence is clearly too long to sit on a single subtitle line",
    );
    expect(lines).toHaveLength(2);
    expect(lines.join(" ")).toBe(
      "This sentence is clearly too long to sit on a single subtitle line",
    );
    const [first = "", second = ""] = lines;
    expect(Math.abs(first.length - second.length)).toBeLessThan(10);
  });

  it("leaves text without spaces alone", () => {
    const text =
      "これはスペースのない非常に長い字幕の行ですこれはスペースのない非常に長い字幕の行です";
    expect(wrapLines(text)).toEqual([text]);
  });

  it("never returns empty lines", () => {
    for (const text of [
      "a b",
      "word ".repeat(30).trim(),
      "x".repeat(50) + " y",
    ]) {
      expect(wrapLines(text, 2, 10).every(line => line.length > 0)).toBe(true);
    }
  });
});

describe("prepareCue", () => {
  it("translates a sentence split over two lines as one piece", () => {
    const unit = prepareCue(["I never thought I would", "see you here again."]);
    expect(unit.segments).toEqual([
      "I never thought I would see you here again.",
    ]);
    expect(
      unit.assemble(["Nunca pensei que voltaria a ver você aqui de novo."]),
    ).toEqual(["Nunca pensei que voltaria", "a ver você aqui de novo."]);
  });

  it("keeps each speaker on their own line", () => {
    const unit = prepareCue(["- Where is he?", "- I don't know."]);
    expect(unit.segments).toEqual(["- Where is he?", "- I don't know."]);
    expect(unit.assemble(["- Onde ele está?", "Não sei."])).toEqual([
      "- Onde ele está?",
      "- Não sei.",
    ]);
  });

  it("puts formatting back around the translation", () => {
    const unit = prepareCue(["{\\an8}<i>Previously...</i>"]);
    expect(unit.segments).toEqual(["Previously..."]);
    expect(unit.assemble(["Anteriormente..."])).toEqual([
      "{\\an8}<i>Anteriormente...</i>",
    ]);
  });

  it("treats italics repeated on every line as one block", () => {
    const unit = prepareCue([
      "<i>I never thought I would</i>",
      "<i>see you here again.</i>",
    ]);
    expect(unit.segments).toEqual([
      "I never thought I would see you here again.",
    ]);
    expect(
      unit.assemble(["Nunca pensei que voltaria a ver você aqui de novo."]),
    ).toEqual(["<i>Nunca pensei que voltaria", "a ver você aqui de novo.</i>"]);
  });

  it("does not send cues without words to the model", () => {
    for (const lines of [["♪"], ["..."], ["<i>♪ ♪</i>"], ["- 1, 2, 3!"], []]) {
      const unit = prepareCue(lines);
      expect(unit.segments).toEqual([]);
      expect(unit.assemble([])).toEqual(lines);
    }
  });
});

describe("translatedFileName", () => {
  it("adds the language code before the extension", () => {
    expect(translatedFileName("movie.srt", "pt-BR")).toBe("movie.pt-BR.srt");
    expect(translatedFileName("Movie.2024.SRT", "en")).toBe(
      "Movie.2024.en.srt",
    );
    expect(translatedFileName("movie", "fr")).toBe("movie.fr.srt");
  });
});
