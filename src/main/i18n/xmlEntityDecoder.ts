/**
 * @file xmlEntityDecoder.ts
 * @module main/i18n/xmlEntityDecoder
 * @description Decodes standard XML entities and numeric character references while preserving inline markup tags.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 */

/**
 * Regular expression matching standard XML entities and numeric character references.
 * Matches:
 *  - group 1: named entities (amp, lt, gt, quot, apos)
 *  - group 2: hexadecimal character references (e.g. &#x41;, &#X41;)
 *  - group 3: decimal character references (e.g. &#65;)
 */
const ENTITY_REGEX = /&(?:(amp|lt|gt|quot|apos)|#[xX]([0-9a-fA-F]+)|#([0-9]+));/g;

/**
 * Standard XML predefined entity lookup table.
 */
const PREDEFINED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
};

/**
 * @description Validates whether a numeric value is a valid Unicode scalar value (non-surrogate, <= 0x10FFFF).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {number} codePoint - Numeric code point to validate.
 * @returns {boolean} True if the code point is a valid Unicode scalar value.
 */
function isValidCodePoint(codePoint: number): boolean {
  return (
    Number.isInteger(codePoint) &&
    codePoint >= 0 &&
    codePoint <= 0x10ffff &&
    (codePoint < 0xd800 || codePoint > 0xdfff)
  );
}

/**
 * @description Decodes standard XML entities (&amp;, &lt;, &gt;, &quot;, &apos;) and numeric character references
 * (decimal &#...; and hexadecimal &#x...;) into their corresponding Unicode characters.
 * Preserves embedded markup tags such as `<kbd>...</kbd>` completely intact.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {string} text - Raw XML string with entity escapes.
 * @returns {string} String with XML entities and character references decoded.
 */
export function decodeXmlEntities(text: string): string {
  if (!text || !text.includes('&')) {
    return text;
  }

  return text.replace(ENTITY_REGEX, (match, named, hex, dec) => {
    if (named && PREDEFINED_ENTITIES[named] !== undefined) {
      return PREDEFINED_ENTITIES[named];
    }

    if (hex !== undefined || dec !== undefined) {
      const codePoint = parseInt(hex ?? dec, hex !== undefined ? 16 : 10);
      if (isValidCodePoint(codePoint)) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return match;
        }
      }
      return match;
    }

    return match;
  });
}
