/**
 * @file getScale.ts
 * @module renderer/map/getScale
 * @description Calculates the unitless cartographic scale denominator from physical screen DPI and the OpenLayers view point resolution sampled where the project's Scale Calculation method says (top, middle or bottom of the map, their average, or the equator).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link View}
 */

import type View from 'ol/View.js';
import type { Size } from 'ol/size.js';
import { getPointResolution, transform } from 'ol/proj.js';
import type { ScaleCalculationMethod } from '@shared/types';

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
 * @property {ScaleCalculationMethod} [method='middle'] - Where the scale is measured: top, middle or bottom of the map, the average of the three, or at the equator.
 * @property {Size} [size] - Viewport size in pixels, needed by the top / bottom / average methods to locate the map edges; without it those methods fall back to the middle.
 */
export interface GetScaleOptions {
  dpi?: number;
  method?: ScaleCalculationMethod;
  size?: Size;
}

/**
 * @function resolveScaleSampleCoordinates
 * @description Picks the map coordinates at which the point resolution is sampled for a Scale Calculation method: the view centre for `middle`, the top / bottom centre of the viewport for `top` / `bottom`, all three for `average`, and the centre meridian at latitude 0 for `equator`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {View} view - Active OpenLayers View.
 * @param {ScaleCalculationMethod} method - Scale Calculation method.
 * @param {Size} [size] - Viewport size in pixels.
 * @returns {number[][]} One or more sample coordinates in view CRS units.
 */
export function resolveScaleSampleCoordinates(
  view: View,
  method: ScaleCalculationMethod,
  size?: Size
): number[][] {
  const center = view.getCenter() || [0, 0];
  if (method === 'equator') {
    const equator = transform([0, 0], 'EPSG:4326', view.getProjection());
    return [[center[0], equator[1]]];
  }
  if (method === 'middle' || !size || size[0] <= 0 || size[1] <= 0) {
    return [center];
  }
  const extent = view.calculateExtent(size);
  const top = [center[0], extent[3]];
  const bottom = [center[0], extent[1]];
  if (method === 'top') return [top];
  if (method === 'bottom') return [bottom];
  return [top, center, bottom];
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
 * @description Computes the active cartographic scale denominator for an OpenLayers view from the point resolution at the location chosen by the Scale Calculation method (middle of the map by default) and the screen DPI.
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
  const method: ScaleCalculationMethod = options?.method ?? 'middle';
  const samples = resolveScaleSampleCoordinates(view, method, options?.size);

  const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
  const dpi = options?.dpi ?? (STANDARD_CSS_DPI * dpr);

  const denominators = samples.map((coordinate) =>
    computeScaleDenominator(getPointResolution(viewCrs, resolution, coordinate, 'm'), dpi)
  );
  if (denominators.length === 1) {
    return denominators[0];
  }
  return Math.round(denominators.reduce((sum, d) => sum + d, 0) / denominators.length);
}
