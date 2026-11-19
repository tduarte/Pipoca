import {gettext} from "gettext";

export const _ = gettext;

/**
 * Fills the `%s` (or `%1$s`, `%2$s`…) placeholders of a translated string.
 * Translators can reorder the numbered form.
 */
export function fmt(template: string, ...args: (string | number)[]): string {
  let next = 0;
  return template.replace(/%(?:(\d+)\$)?s/g, (_match, position?: string) => {
    const index = position ? Number(position) - 1 : next++;
    return String(args[index] ?? "");
  });
}
