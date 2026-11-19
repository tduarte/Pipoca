// Subtitle files are often not UTF-8, especially older ones. This module has
// no GNOME imports so it can be unit-tested under Node.

import chardet from "chardet";

function tryDecode(bytes: Uint8Array, encoding: string): string | null {
  try {
    type Label = ConstructorParameters<typeof TextDecoder>[0];
    return new TextDecoder(encoding as Label, {fatal: true}).decode(bytes);
  } catch {
    return null;
  }
}

/** Decodes a subtitle file, detecting its text encoding when it isn't UTF-8. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  const utf8 = tryDecode(bytes, "utf-8");
  if (utf8 !== null) return utf8;

  const guesses = chardet
    .analyse(bytes)
    .map(match => match.name)
    .filter(name => !/^utf-?8$/i.test(name));
  for (const encoding of guesses) {
    const text = tryDecode(bytes, encoding);
    if (text !== null) return text;
  }

  // Every byte is valid in windows-1252, so this never fails.
  return new TextDecoder("windows-1252").decode(bytes);
}
