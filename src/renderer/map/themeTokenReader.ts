/**
 * @file themeTokenReader.ts
 * @module renderer/map/themeTokenReader
 * @description Resolves Theme tokens for code that draws on the map canvas, which cannot read CSS variables itself (the Selection Shape of Select by Lasso, the Vertex Markers). Token constants are written in one format, a `var(--name)` reference ({@link ThemeTokenReference}): the Theme token guard in the style tests counts a token as read only where a `var(--…)` use appears in CSS or in the TypeScript sources, so a bare `--name` constant would leave a token used only from canvas code reported as unread. {@link readThemeTokens} extracts the custom property name from each reference and resolves it on an element (the map's target, so a scoped Theme applies). No colour literals live in TypeScript.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link readSelectionShapeColour}
 * @see {@link readVertexMarkerColours}
 */

/**
 * @typedef {string} ThemeTokenReference
 * @description A Theme token written as a CSS `var()` reference, e.g. `var(--cartouche-map-selection-shape)`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export type ThemeTokenReference = `var(--${string})`;

/**
 * @function themeTokenName
 * @description The custom property name inside a `var(--name)` reference.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {ThemeTokenReference} reference - A `var(--name)` reference.
 * @returns {string} The custom property name (`--name`).
 */
export function themeTokenName(reference: ThemeTokenReference): string {
  return /^var\((--[\w-]+)\)$/.exec(reference)?.[1] ?? reference;
}

/**
 * @function readThemeTokens
 * @description Resolves several Theme tokens on an element with one computed-style lookup.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @template K
 * @param {Element | null | undefined} element - Element to resolve the tokens on (the map's target).
 * @param {Record<K, ThemeTokenReference>} references - The tokens to read, by result key.
 * @returns {Record<K, string>} Each token's trimmed value; empty strings without an element, without `getComputedStyle`, or for an undefined token.
 */
export function readThemeTokens<K extends string>(
  element: Element | null | undefined,
  references: Record<K, ThemeTokenReference>
): Record<K, string> {
  const style =
    element && typeof getComputedStyle === "function" ?
      getComputedStyle(element)
    : null;
  const result = {} as Record<K, string>;
  for (const key of Object.keys(references) as K[]) {
    result[key] =
      style?.getPropertyValue(themeTokenName(references[key])).trim() ?? "";
  }
  return result;
}
