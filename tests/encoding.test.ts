import {describe, expect, it} from "vitest";

import {decodeText} from "../src/encoding";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("decodeText", () => {
  it("reads UTF-8", () => {
    expect(decodeText(new TextEncoder().encode("Olá, você"))).toBe("Olá, você");
  });

  it("drops a UTF-8 byte order mark", () => {
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, 0x4f, 0x69))).toBe("Oi");
  });

  it("reads UTF-16 with a byte order mark", () => {
    expect(decodeText(bytes(0xff, 0xfe, 0x4f, 0x00, 0x69, 0x00))).toBe("Oi");
    expect(decodeText(bytes(0xfe, 0xff, 0x00, 0x4f, 0x00, 0x69))).toBe("Oi");
  });

  it("reads Western European files that are not UTF-8", () => {
    // "Olá, você não está aqui." in windows-1252
    const text = "Olá, você não está aqui. Ça va très bien, merci beaucoup.";
    const latin1 = Uint8Array.from(text, c => c.charCodeAt(0));
    expect(decodeText(latin1)).toBe(text);
  });

  it("reads Cyrillic files that are not UTF-8", () => {
    // "Привет, как дела? Всё хорошо, спасибо большое." in windows-1251
    const text = "Привет, как дела? Всё хорошо, спасибо большое.";
    const cp1251 = Uint8Array.from(text, c => {
      const code = c.charCodeAt(0);
      if (code < 0x80) return code;
      if (c === "ё") return 0xb8;
      if (c === "Ё") return 0xa8;
      return code - 0x410 + 0xc0;
    });
    expect(decodeText(cp1251)).toBe(text);
  });

  it("never throws on arbitrary bytes", () => {
    expect(() => decodeText(bytes(0x80, 0x81, 0xff, 0x00, 0x9d))).not.toThrow();
  });
});
