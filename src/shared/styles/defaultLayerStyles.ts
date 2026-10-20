/**
 * @file defaultLayerStyles.ts
 * @module shared/styles/defaultLayerStyles
 * @description Shared default OpenLayers vector layer styling rules and lookup helpers for Polygon, LineString, Point, and Unknown feature geometries.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */

/**
 * @description Standard default styling rules for spatial vector layers by geometry type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @type {Record<string, Record<string, any>>}
 */
export const defaultLayerStyles: Record<string, Record<string, any>> = {
  Polygon: {
    "fill-color": "#1e293b",
    "stroke-width": 0,
    "stroke-color": "transparent",
  },
  LineString: { "stroke-color": "#0284c7", "stroke-width": 1 },
  Point: { "circle-radius": 8, "circle-fill-color": "#0369a1" },
  Unknown: {
    "fill-color": "#1e293b",
    "stroke-color": "#0284c7",
    "stroke-width": 2,
    "circle-radius": 8,
    "circle-fill-color": "#0369a1",
  },
};

/**
 * @description Generates default OpenLayers flat styling expression based on geometry type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {string} [geometryKind] - Optional geometry kind string ('Point' | 'LineString' | 'Polygon' | 'Raster' | 'Unknown').
 * @returns {Record<string, any>} Flat style object definition.
 */
export function getDefaultLayerStyle(
  geometryKind?: string
): Record<string, any> {
  const gKind = (geometryKind || "Unknown").toLowerCase();
  if (gKind.includes("polygon")) {
    return defaultLayerStyles.Polygon;
  }
  if (gKind.includes("line")) {
    return defaultLayerStyles.LineString;
  }
  if (gKind.includes("point")) {
    return defaultLayerStyles.Point;
  }
  return defaultLayerStyles.Unknown;
}
