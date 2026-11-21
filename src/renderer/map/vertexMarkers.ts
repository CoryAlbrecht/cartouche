/**
 * @file vertexMarkers.ts
 * @module renderer/map/vertexMarkers
 * @description How the Active Layer's vertices are shown in Vertex Editor Mode. {@link createVertexMarkerStyleFunction} is the style of an overlay layer that shares the Active Layer's source: for each feature it draws a small square marker on every vertex (outline `--cartouche-map-vertex-marker`, fill `--cartouche-map-vertex-marker-fill`) and, over the selected vertices, a larger marker filled with the project's Selection Colour. The canvas cannot read CSS variables, so {@link readVertexMarkerColours} resolves the two Theme tokens on the map element (no colour literals in TypeScript).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link listVertices}
 * @see {@link selectedVertexKeysSignal}
 * @see {@link createFeatureDisplayPredicate}
 */

import type { FeatureLike } from "ol/Feature.js";
import type { Geometry } from "ol/geom.js";
import MultiPoint from "ol/geom/MultiPoint.js";
import Fill from "ol/style/Fill.js";
import RegularShape from "ol/style/RegularShape.js";
import Stroke from "ol/style/Stroke.js";
import Style, { type StyleFunction } from "ol/style/Style.js";
import {
  listVertices,
  parseVertexKey,
  type VertexKey,
} from "./vertexSelection";
import { readThemeTokens, type ThemeTokenReference } from "./themeTokenReader";
import type { FeatureDisplayPredicate } from "./temporalPredicate";

/**
 * @description Theme token holding the vertex marker outline colour, as a {@link ThemeTokenReference} (see {@link readThemeTokens} for why the `var()` form).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {ThemeTokenReference}
 */
export const VERTEX_MARKER_TOKEN: ThemeTokenReference =
  "var(--cartouche-map-vertex-marker)";

/**
 * @description Theme token holding the fill colour of an unselected vertex marker, as a {@link ThemeTokenReference}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {ThemeTokenReference}
 */
export const VERTEX_MARKER_FILL_TOKEN: ThemeTokenReference =
  "var(--cartouche-map-vertex-marker-fill)";

/**
 * @description Half the side of an unselected vertex marker square, in CSS pixels (its corner radius as an OpenLayers RegularShape).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
export const VERTEX_MARKER_RADIUS = 5;

/**
 * @description Corner radius of a selected vertex marker square, in CSS pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
export const SELECTED_VERTEX_MARKER_RADIUS = 7;

/**
 * @typedef {Object} VertexMarkerColours
 * @description Colours of the vertex markers.
 * @property {string} outline - Marker outline (Theme token `--cartouche-map-vertex-marker`).
 * @property {string} fill - Unselected marker fill (Theme token `--cartouche-map-vertex-marker-fill`).
 * @property {string} selection - Selected marker fill (the project's Selection Colour).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface VertexMarkerColours {
  outline: string;
  fill: string;
  selection: string;
}

/**
 * @function readVertexMarkerColours
 * @description Resolves the Vertex Marker Theme tokens on an element (the map's target, so a scoped Theme applies) with {@link readThemeTokens}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Element | null | undefined} element - Element to resolve the tokens on.
 * @returns {{outline: string, fill: string}} The colours, empty strings without an element or defined token.
 */
export function readVertexMarkerColours(element: Element | null | undefined): {
  outline: string;
  fill: string;
} {
  return readThemeTokens(element, {
    outline: VERTEX_MARKER_TOKEN,
    fill: VERTEX_MARKER_FILL_TOKEN,
  });
}

/**
 * @function groupVertexKeysByFeature
 * @description Groups a vertex selection per feature id, each vertex path joined with commas, for fast lookup while styling. Malformed keys are skipped.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Iterable<VertexKey>} keys - Selected vertices.
 * @returns {Map<string | number, Set<string>>} Joined paths per feature id.
 */
export function groupVertexKeysByFeature(
  keys: Iterable<VertexKey>
): Map<string | number, Set<string>> {
  const groups = new Map<string | number, Set<string>>();
  for (const key of keys) {
    const ref = parseVertexKey(key);
    if (!ref) continue;
    const paths = groups.get(ref.featureId) ?? new Set<string>();
    paths.add(ref.path.join(","));
    groups.set(ref.featureId, paths);
  }
  return groups;
}

/**
 * @function squareMarker
 * @description A square vertex marker.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {number} radius - Corner radius in pixels.
 * @param {string} fill - Fill colour.
 * @param {string} outline - Outline colour.
 * @returns {RegularShape} The marker image.
 */
function squareMarker(
  radius: number,
  fill: string,
  outline: string
): RegularShape {
  return new RegularShape({
    points: 4,
    radius,
    angle: Math.PI / 4,
    fill: new Fill({ color: fill }),
    stroke: new Stroke({ color: outline, width: 1 }),
  });
}

/**
 * @function createVertexMarkerStyleFunction
 * @description Creates the style function of the vertex marker overlay: for a feature with an id and geometry that is displayed now (features the Time Filter hides get no markers), one Style placing an unselected marker on every vertex (a MultiPoint geometry function over {@link listVertices}), plus, when some of its vertices are selected, one Style placing a larger Selection Colour marker on those. Marker images are shared by all features.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {VertexMarkerColours} colours - Marker colours.
 * @param {ReadonlyMap<string | number, ReadonlySet<string>>} selected - Selected joined vertex paths per feature id ({@link groupVertexKeysByFeature}).
 * @param {FeatureDisplayPredicate} [isDisplayed] - Whether a feature is displayed now ({@link createFeatureDisplayPredicate}); every feature counts as displayed when omitted.
 * @returns {StyleFunction} Style function for the overlay layer.
 */
export function createVertexMarkerStyleFunction(
  colours: VertexMarkerColours,
  selected: ReadonlyMap<string | number, ReadonlySet<string>>,
  isDisplayed?: FeatureDisplayPredicate
): StyleFunction {
  const marker = squareMarker(
    VERTEX_MARKER_RADIUS,
    colours.fill,
    colours.outline
  );
  const selectedMarker = squareMarker(
    SELECTED_VERTEX_MARKER_RADIUS,
    colours.selection,
    colours.outline
  );
  return (feature: FeatureLike): Style[] => {
    const geometry = feature.getGeometry() as Geometry | undefined;
    const id = feature.getId();
    if (!geometry || id === undefined) return [];
    if (isDisplayed && !isDisplayed(feature)) return [];
    const vertices = listVertices(geometry);
    const styles = [
      new Style({
        image: marker,
        geometry: new MultiPoint(vertices.map((v) => v.coordinate)),
      }),
    ];
    const paths = selected.get(id);
    if (paths && paths.size > 0) {
      const chosen = vertices.filter((v) => paths.has(v.path.join(",")));
      if (chosen.length > 0) {
        styles.push(
          new Style({
            image: selectedMarker,
            geometry: new MultiPoint(chosen.map((v) => v.coordinate)),
          })
        );
      }
    }
    return styles;
  };
}
