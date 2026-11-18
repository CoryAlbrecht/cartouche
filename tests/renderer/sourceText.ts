/**
 * @file sourceText.ts
 * @module tests/renderer/sourceText
 * @description Shared helpers for tests that scan source code as text (e.g. for colour literals), so comment prose such as `// Ticket #335` is never mistaken for code. Not a test file itself.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 */

/** A colour literal in source: hex (`#rgb` … `#rrggbbaa`) or `rgb(` / `rgba(`. */
export const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

/** Characters after which a `/` starts a regular expression literal rather than a division. */
const REGEX_PRECEDERS = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  "}",
  ";",
  "+",
  "-",
  "*",
  "%",
  "<",
  ">",
  "~",
  "^",
]);

/**
 * @function stripSourceComments
 * @description Removes block comments (`/* … *\/`, including JSDoc) and line comments (`// …`) from TypeScript or JavaScript source with a small scanner, keeping string, template and regular expression literals intact, so `//` or `/*` inside them (URLs, globs, patterns) is never taken for a comment. Line breaks are kept, so line positions are unchanged. Template literals are read up to the closing backtick; a backtick inside `${…}` is not supported.
 * @param {string} source - Source text.
 * @returns {string} The source without comments.
 */
export function stripSourceComments(source: string): string {
  let out = "";
  let i = 0;
  let lastSignificant = "";
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
      continue;
    }
    if (
      ch === "'"
      || ch === '"'
      || ch === "`"
      || (ch === "/" && REGEX_PRECEDERS.has(lastSignificant))
    ) {
      const start = i;
      let inClass = false;
      i++;
      while (i < source.length) {
        const c = source[i];
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (ch === "/") {
          if (c === "\n") break;
          if (c === "[") inClass = true;
          else if (c === "]") inClass = false;
          else if (c === "/" && !inClass) break;
        } else if (c === ch || (c === "\n" && ch !== "`")) {
          break;
        }
        i++;
      }
      i++;
      out += source.slice(start, i);
      lastSignificant = ch === "/" ? ")" : '"';
      continue;
    }
    out += ch;
    if (!/\s/.test(ch)) lastSignificant = /[\w$)\]]/.test(ch) ? ")" : ch;
    i++;
  }
  return out;
}
