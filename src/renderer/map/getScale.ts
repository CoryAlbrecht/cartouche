/**
 * @file getScale.ts
 * @module renderer/map/getScale
 * @description Calculates unitless cartographic scale denominator from physical screen DPI and OpenLayers view point resolution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @see {@link View}
 */

import type View from 'ol/View.js';
import { getPointResolution } from 'ol/proj.js';

/**
 * Standard CSS baseline dots per inch.
 * @constant {number}
 */
export const STANDARD_CSS_DPI = 96;

/**
 * Meters per inch conversion constant (0.0254 m = 1 inch).
 * @constant {number}
 */
export const METERS_PER_INCH = 0.0254;

/**
 * @typedef {Object} GetScaleOptions
 * @property {number} [dpi] - Custom physical screen DPI override.
 */
export interface GetScaleOptions {
  dpi?: number;
}

/**
 * @function computeScaleDenominator
 * @description Computes the unitless representative fraction divisor (S in 1 : S) given real-world ground resolution and display DPI.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {number} pointResolutionMetersPerPx - Real-world ground distance in meters represented by 1 display pixel.
 * @param {number} [dpi=96] - Screen dots per inch.
 * @returns {number} Unitless cartographic scale denominator rounded to integer.
 */
export function computeScaleDenominator(
  pointResolutionMetersPerPx: number,
  dpi: number = STANDARD_CSS_DPI
): number {
  if (!isFinite(pointResolutionMetersPerPx) || pointResolutionMetersPerPx <= 0) {
    return 1;
  }
  const effectiveDpi = isFinite(dpi) && dpi > 0 ? dpi : STANDARD_CSS_DPI;
  const denominator = (pointResolutionMetersPerPx * effectiveDpi) / METERS_PER_INCH;
  return Math.round(denominator);
}

/**
 * @function getScale
 * @description Computes the active cartographic scale denominator for an OpenLayers view based on center-point resolution and screen DPI.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {View} view - Active OpenLayers View instance.
 * @param {GetScaleOptions} [options] - Calculation options including optional DPI override.
 * @returns {number} Unitless cartographic scale denominator.
 */
export function getScale(view: View, options?: GetScaleOptions): number {
  const resolution = view.getResolution();
  if (resolution === undefined || !isFinite(resolution)) {
    return 1;
  }

  const viewCrs = view.getProjection();
  const center = view.getCenter() || [0, 0];
  const pointResolution = getPointResolution(viewCrs, resolution, center, 'm');

  const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
  const dpi = options?.dpi ?? (STANDARD_CSS_DPI * dpr);

  return computeScaleDenominator(pointResolution, dpi);
}
