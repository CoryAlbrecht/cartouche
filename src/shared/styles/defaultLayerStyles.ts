/**
 * @file defaultLayerStyles.ts
 * @module shared/styles/defaultLayerStyles
 * @description Shared default OpenLayers vector layer styling rules and lookup helpers for Polygon, LineString, and Point feature geometries.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */

/**
 * @description Standard default styling rules for spatial vector layers by geometry type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {Record<string, Record<string, any>>}
 */
export const defaultLayerStyles: Record<string, Record<string, any>> = {
  Polygon: {
    'fill-color': '#1e293b',
    'stroke-color': '#1b446c',
    'stroke-width': 4
  },
  LineString: {
    'stroke-color': '#0284c7',
    'stroke-width': 2
  },
  Point: {
    'circle-radius': 8,
    'circle-fill-color': '#0369a1'
  }
};

/**
 * @description Generates default OpenLayers flat styling expression based on geometry type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-08
 * @since 0.1.0-dev
 * @param {string} [geometryKind] - Optional geometry kind string ('Point' | 'LineString' | 'Polygon' | 'Raster').
 * @returns {Record<string, any>} Flat style object definition.
 */
export function getDefaultLayerStyle(geometryKind?: string): Record<string, any> {
  const gKind = (geometryKind || 'Point').toLowerCase();
  if (gKind.includes('polygon')) {
    return defaultLayerStyles.Polygon;
  }
  if (gKind.includes('line')) {
    return defaultLayerStyles.LineString;
  }
  return defaultLayerStyles.Point;
}
