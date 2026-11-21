/**
 * @file mapCursor.ts
 * @module renderer/map/mapCursor
 * @description Pure Map Cursor resolution: maps the active map tool, the Selection Target and whether a primary drag is in progress to the CSS `cursor` value shown over the map viewport. Free of asset imports so it can be unit-tested headlessly; the bundled cursor SVG URLs are injected as {@link MapCursorImages}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link resolveMapCursor}
 */

import type { ActiveTool, SelectionTarget } from "../state/gisSignals";

/**
 * @typedef {Object} MapCursorImages
 * @description URLs of the six custom Selection Tool cursor images, one per Selection Tool × Selection Target.
 * @property {string} selectClick - Select by Click, features (arrow + click badge).
 * @property {string} selectClickVertices - Select by Click, vertices (arrow + click badge + vertex badge).
 * @property {string} selectRectangle - Select by Rectangle, features (crosshair + dashed-rectangle badge).
 * @property {string} selectRectangleVertices - Select by Rectangle, vertices (+ vertex badge).
 * @property {string} selectLasso - Select by Lasso, features (crosshair + lasso badge).
 * @property {string} selectLassoVertices - Select by Lasso, vertices (+ vertex badge).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MapCursorImages {
  selectClick: string;
  selectClickVertices: string;
  selectRectangle: string;
  selectRectangleVertices: string;
  selectLasso: string;
  selectLassoVertices: string;
}

/**
 * @description Hotspot of the arrow-based cursor images (the arrow tip), in image pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {readonly [number, number]}
 */
export const ARROW_CURSOR_HOTSPOT: readonly [number, number] = [4, 3];

/**
 * @description Hotspot of the crosshair-based cursor images (the crosshair centre), in image pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {readonly [number, number]}
 */
export const CROSSHAIR_CURSOR_HOTSPOT: readonly [number, number] = [11, 11];

/**
 * @description Builds a CSS `cursor` value for a custom image with a hotspot and keyword fallback, or only the fallback when no image is available.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {string | undefined} url - Cursor image URL, if any.
 * @param {readonly [number, number]} hotspot - Hotspot x/y in image pixels.
 * @param {string} fallback - Keyword cursor used when the image cannot load.
 * @returns {string} CSS cursor value.
 */
function imageCursor(
  url: string | undefined,
  hotspot: readonly [number, number],
  fallback: string
): string {
  if (!url) return fallback;
  return `url("${url}") ${hotspot[0]} ${hotspot[1]}, ${fallback}`;
}

/**
 * @description Resolves the Map Cursor for a map tool. Pan shows `grab`, or `grabbing`
 * during a primary drag; the digitizing tools show `crosshair`; each Selection Tool
 * shows its custom cursor, with the vertex variant while the Selection Target is
 * vertices, unchanged by dragging. Independent of whether the Active Layer is selectable.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {ActiveTool} tool - Active map tool.
 * @param {SelectionTarget} target - Current Selection Target.
 * @param {boolean} isDragging - Whether a primary drag is in progress.
 * @param {MapCursorImages} [images] - Custom cursor image URLs; keyword fallbacks are used without them.
 * @returns {string} CSS `cursor` value.
 */
export function resolveMapCursor(
  tool: ActiveTool,
  target: SelectionTarget,
  isDragging: boolean,
  images?: MapCursorImages
): string {
  const vertices = target === "vertices";
  switch (tool) {
    case "pan":
      return isDragging ? "grabbing" : "grab";
    case "point":
    case "line":
    case "polygon":
      return "crosshair";
    case "select_click":
      return imageCursor(
        vertices ? images?.selectClickVertices : images?.selectClick,
        ARROW_CURSOR_HOTSPOT,
        "default"
      );
    case "select_rectangle":
      return imageCursor(
        vertices ? images?.selectRectangleVertices : images?.selectRectangle,
        CROSSHAIR_CURSOR_HOTSPOT,
        "crosshair"
      );
    case "select_lasso":
      return imageCursor(
        vertices ? images?.selectLassoVertices : images?.selectLasso,
        CROSSHAIR_CURSOR_HOTSPOT,
        "crosshair"
      );
    default:
      return "default";
  }
}
