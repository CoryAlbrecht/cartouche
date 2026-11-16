/**
 * @file gradientStops.ts
 * @module shared/colors/gradientStops
 * @description Gradient stop data helpers with no UI dependency: the GradientStop type, the DEFAULT_GRADIENT_STOPS black-to-green default, parsing '<color> <percent>' stop strings into GradientStop objects with stable ids, serializing them uniformly in one colour format, and building the colour-stop list of a CSS linear-gradient(). Used by GradientPickerWidget, GradientPickerDialog and GradientButton.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link GradientPickerWidget}
 * @see {@link GradientPickerDialog}
 * @see {@link GradientButton}
 */

import { type ColorFormat, type RgbColor, clamp, parseCssColor, formatCssColor } from './colorConversions';

/**
 * @typedef {Object} GradientStop
 * @property {string} id - Stable unique identifier for keying and selection.
 * @property {string} color - CSS color string representation of the stop.
 * @property {number} offset - Horizontal gradient position percentage in range [0, 100].
 */
export interface GradientStop {
  id: string;
  color: string;
  offset: number;
}

/**
 * @description The default gradient, black (`#000000ff`) at 0% to green (`#00ff00ff`) at 100%, with the stable ids `stop-0` and `stop-100`. Callers that are given no stops fall back to it explicitly; parseGradientStops never supplies it. Frozen, so a caller cannot change it for everyone else.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @type {ReadonlyArray<Readonly<GradientStop>>}
 * @see {@link parseGradientStops}
 */
export const DEFAULT_GRADIENT_STOPS: ReadonlyArray<Readonly<GradientStop>> = Object.freeze([
  Object.freeze({ id: 'stop-0', color: '#000000ff', offset: 0 }),
  Object.freeze({ id: 'stop-100', color: '#00ff00ff', offset: 100 }),
]);

/**
 * @description Parses an array of raw '<color> <percent>' CSS gradient stop strings into structured GradientStop objects. Ids are `stop-<offset>`, with a `-<n>` suffix for repeated offsets; offsets are rounded to one decimal and clamped to [0, 100]; a stop without an offset is placed by its index, evenly spaced. Missing or empty input yields no stops: the caller decides on a fallback such as DEFAULT_GRADIENT_STOPS.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {string[]} [rawStops] - Optional raw stop strings array.
 * @returns {GradientStop[]} Parsed gradient stop definitions sorted by offset ascending, or an empty array for missing or empty input.
 * @see {@link DEFAULT_GRADIENT_STOPS}
 */
export function parseGradientStops(rawStops?: string[]): GradientStop[] {
  if (!rawStops || rawStops.length === 0) {
    return [];
  }

  const offsetCounts = new Map<number, number>();

  const parsed = rawStops.map((stopStr, idx) => {
    const trimmed = stopStr.trim();
    const match = trimmed.match(/^(.*?)\s+([\d.]+)\s*%?\s*$/);
    let color: string;
    let rawOffset: number;
    if (match) {
      color = match[1].trim();
      rawOffset = parseFloat(match[2]);
    } else {
      color = trimmed;
      rawOffset = rawStops.length > 1 ? (idx / (rawStops.length - 1)) * 100 : 0;
    }
    const offset = clamp(Math.round(rawOffset * 10) / 10, 0, 100);
    const count = offsetCounts.get(offset) || 0;
    offsetCounts.set(offset, count + 1);
    const id = count === 0 ? `stop-${offset}` : `stop-${offset}-${count}`;
    return { id, color, offset };
  });

  return parsed.sort((a, b) => a.offset - b.offset);
}

/**
 * @description Serializes an array of GradientStop objects into CSS-compatible '<color> <percent>' strings uniformly formatted in the given format.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {readonly GradientStop[]} stops - Array of gradient stop definitions.
 * @param {ColorFormat} format - Target color format.
 * @returns {string[]} Formatted CSS gradient stop strings.
 */
export function serializeGradientStops(
  stops: readonly GradientStop[],
  format: ColorFormat
): string[] {
  return stops
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((stop) => {
      const parsed = parseCssColor(stop.color);
      const srgb: RgbColor = parsed?.srgb ?? { r: 0, g: 0, b: 0, alpha: 1 };
      const formattedColor = formatCssColor(srgb, format);
      const formattedOffset = `${Math.round(stop.offset * 10) / 10}%`;
      return `${formattedColor} ${formattedOffset}`;
    });
}

/**
 * @description Builds the comma-separated colour-stop list of a CSS `linear-gradient()` from GradientStop objects, sorted by offset (e.g. `#ff0000ff 0%, #0000ffff 100%`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {readonly GradientStop[]} stops - Gradient stop definitions.
 * @returns {string} CSS colour-stop list.
 */
export function gradientStopsToCss(stops: readonly GradientStop[]): string {
  return stops
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${s.offset}%`)
    .join(', ');
}
