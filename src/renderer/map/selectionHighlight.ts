/**
 * @file selectionHighlight.ts
 * @module renderer/map/selectionHighlight
 * @description Builds the OpenLayers style used to highlight selected features in the map viewport with the project's Selection Colour: polygons and point markers are filled with it, lines are stroked with it. The highlight is drawn on top of each layer's own symbology by MapController's selection overlay layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link MapController}
 * @see {@link selectionColourSignal}
 * @see {@link DEFAULT_SELECTION_COLOUR}
 */

import Style, { type StyleFunction } from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import CircleStyle from "ol/style/Circle";
import type { FeatureLike } from "ol/Feature";

/**
 * @constant {number} SELECTION_HIGHLIGHT_LINE_WIDTH
 * @description Stroke width in CSS pixels used to highlight selected line features.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const SELECTION_HIGHLIGHT_LINE_WIDTH = 4;

/**
 * @constant {number} SELECTION_HIGHLIGHT_POINT_RADIUS
 * @description Marker radius in CSS pixels used to highlight selected point features.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const SELECTION_HIGHLIGHT_POINT_RADIUS = 7;

/**
 * @typedef {'point' | 'line' | 'polygon' | 'other'} SelectionGeometryFamily
 * @description Coarse geometry family used to pick the highlight treatment.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export type SelectionGeometryFamily = "point" | "line" | "polygon" | "other";

/**
 * @function resolveSelectionGeometryFamily
 * @description Maps an OpenLayers geometry type name to its highlight family.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | undefined} geometryType - OpenLayers geometry type (e.g. `Point`, `MultiLineString`, `Polygon`).
 * @returns {SelectionGeometryFamily} The highlight family.
 */
export function resolveSelectionGeometryFamily(
  geometryType: string | undefined
): SelectionGeometryFamily {
  switch (geometryType) {
    case "Point":
    case "MultiPoint":
      return "point";
    case "LineString":
    case "MultiLineString":
    case "LinearRing":
      return "line";
    case "Polygon":
    case "MultiPolygon":
    case "Circle":
      return "polygon";
    default:
      return "other";
  }
}

/**
 * @function createSelectionHighlightStyleFunction
 * @description Creates a StyleFunction that highlights a feature with the Selection Colour according to its geometry family: a fill for polygons, a stroke for lines, and a filled circle marker for points. Geometry collections and unknown types receive fill, stroke and marker together so every part is visible. Styles are cached per family.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} selectionColour - CSS colour (alpha allowed) used for the highlight.
 * @returns {StyleFunction} Style function for the selection overlay layer.
 */
export function createSelectionHighlightStyleFunction(
  selectionColour: string
): StyleFunction {
  const fill = new Fill({ color: selectionColour });
  const stroke = new Stroke({
    color: selectionColour,
    width: SELECTION_HIGHLIGHT_LINE_WIDTH,
  });
  const marker = new CircleStyle({
    radius: SELECTION_HIGHLIGHT_POINT_RADIUS,
    fill: new Fill({ color: selectionColour }),
  });

  const styles: Record<SelectionGeometryFamily, Style> = {
    polygon: new Style({ fill }),
    line: new Style({ stroke }),
    point: new Style({ image: marker }),
    other: new Style({ fill, stroke, image: marker }),
  };

  return (feature: FeatureLike): Style => {
    const geometry = feature.getGeometry();
    const family = resolveSelectionGeometryFamily(geometry?.getType());
    return styles[family];
  };
}
