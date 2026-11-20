/**
 * @file selectionHitTest.ts
 * @module renderer/map/selectionHitTest
 * @description Pure topmost-hit resolution for Select by Click: given candidate features of the Active Layer, finds the one drawn topmost whose geometry lies under the pointer, within the 3 px hit tolerance. Works on geometry in map units (no canvas), so it runs headlessly; the pixel tolerance is converted with the view resolution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link findTopmostFeatureAt}
 */

import type Feature from "ol/Feature.js";
import type { Geometry } from "ol/geom.js";
import type { Coordinate } from "ol/coordinate.js";
import { getUid } from "ol/util.js";

/**
 * @description Select by Click's hit tolerance in CSS pixels: a feature is hit when the pointer is at most this far from its geometry (or its symbol).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
export const SELECTION_HIT_TOLERANCE_PX = 3;

/**
 * @callback SymbolReachResolver
 * @description Returns how far, in CSS pixels, a feature's rendered symbol reaches beyond its geometry (a point marker's radius, half a line's stroke width), so a click on the visible symbol counts as a hit.
 * @param {Feature} feature - Candidate feature.
 * @returns {number} Reach in pixels (0 when unknown).
 */
export type SymbolReachResolver = (feature: Feature) => number;

/**
 * @typedef {Object} TopmostHitOptions
 * @property {number} [tolerancePx] - Hit tolerance in pixels; defaults to {@link SELECTION_HIT_TOLERANCE_PX}.
 * @property {SymbolReachResolver} [symbolReachPx] - Per-feature symbol reach added to the tolerance; defaults to 0.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface TopmostHitOptions {
  tolerancePx?: number;
  symbolReachPx?: SymbolReachResolver;
}

/**
 * @function compareDrawingOrder
 * @description Orders features as OpenLayers' default vector render order draws them (ascending object UID, i.e. the order they were created), so the last in the sorted list is drawn on top.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Feature} a - First feature.
 * @param {Feature} b - Second feature.
 * @returns {number} Negative when `a` is drawn below `b`.
 */
export function compareDrawingOrder(a: Feature, b: Feature): number {
  return Number(getUid(a)) - Number(getUid(b));
}

/**
 * @function geometryCoversCoordinate
 * @description Whether an areal geometry (polygon, multipolygon, or a collection containing one) contains the coordinate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Geometry} geometry - Geometry to test.
 * @param {Coordinate} coordinate - Pointer coordinate in map units.
 * @returns {boolean} True when the coordinate is inside an areal part.
 */
function geometryCoversCoordinate(
  geometry: Geometry,
  coordinate: Coordinate
): boolean {
  const type = geometry.getType();
  if (type === "Polygon" || type === "MultiPolygon" || type === "Circle") {
    return geometry.intersectsCoordinate(coordinate);
  }
  if (type === "GeometryCollection") {
    const parts = (
      geometry as unknown as { getGeometries(): Geometry[] }
    ).getGeometries();
    return parts.some((part) => geometryCoversCoordinate(part, coordinate));
  }
  return false;
}

/**
 * @function isFeatureHit
 * @description Whether the pointer hits a feature: inside an areal geometry, or within the reach (tolerance plus symbol reach, in map units) of its nearest point.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Feature} feature - Candidate feature.
 * @param {Coordinate} coordinate - Pointer coordinate in map units.
 * @param {number} reach - Maximum distance in map units.
 * @returns {boolean} True when hit.
 */
function isFeatureHit(
  feature: Feature,
  coordinate: Coordinate,
  reach: number
): boolean {
  const geometry = feature.getGeometry();
  if (!geometry) return false;
  if (geometryCoversCoordinate(geometry, coordinate)) return true;
  const closest = geometry.getClosestPoint(coordinate);
  const dx = closest[0] - coordinate[0];
  const dy = closest[1] - coordinate[1];
  return Math.hypot(dx, dy) <= reach;
}

/**
 * @function findTopmostFeatureAt
 * @description Select by Click's topmost-hit resolution: returns the feature drawn topmost (see {@link compareDrawingOrder}) among `features` that the pointer hits, or null. A feature is hit when the pointer is inside an areal geometry, or within `tolerancePx` plus its symbol reach of the geometry, converted to map units with `resolution`. The order of `features` does not matter.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {readonly Feature[]} features - Candidate features (e.g. the Active Layer's features near the pointer).
 * @param {Coordinate} coordinate - Pointer coordinate in map units (display CRS).
 * @param {number} resolution - View resolution in map units per pixel.
 * @param {TopmostHitOptions} [options] - Tolerance and symbol reach.
 * @returns {Feature | null} The topmost hit feature, or null when nothing is hit.
 */
export function findTopmostFeatureAt(
  features: readonly Feature[],
  coordinate: Coordinate,
  resolution: number,
  options: TopmostHitOptions = {}
): Feature | null {
  const tolerancePx = options.tolerancePx ?? SELECTION_HIT_TOLERANCE_PX;
  const topFirst = [...features].sort((a, b) => compareDrawingOrder(b, a));
  for (const feature of topFirst) {
    const reachPx = tolerancePx + (options.symbolReachPx?.(feature) ?? 0);
    if (isFeatureHit(feature, coordinate, reachPx * resolution)) {
      return feature;
    }
  }
  return null;
}
