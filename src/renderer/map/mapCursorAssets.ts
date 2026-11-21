/**
 * @file mapCursorAssets.ts
 * @module renderer/map/mapCursorAssets
 * @description Bundled Map Cursor images: imports the six Selection Tool cursor SVGs from `assets/svg/cursors/` through Vite (asset URL, or an inlined `data:` URI for small files) and exposes them as {@link MapCursorImages}. Kept apart from the pure resolver so headless tests never load `.svg` modules.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link resolveMapCursor}
 */

import type { MapCursorImages } from "./mapCursor";
import selectClickCursor from "../../../assets/svg/cursors/select-click-cursor.svg";
import selectClickVerticesCursor from "../../../assets/svg/cursors/select-click-vertices-cursor.svg";
import selectRectangleCursor from "../../../assets/svg/cursors/select-rectangle-cursor.svg";
import selectRectangleVerticesCursor from "../../../assets/svg/cursors/select-rectangle-vertices-cursor.svg";
import selectLassoCursor from "../../../assets/svg/cursors/select-lasso-cursor.svg";
import selectLassoVerticesCursor from "../../../assets/svg/cursors/select-lasso-vertices-cursor.svg";

/**
 * @description URLs of the bundled Selection Tool cursor images, one per Selection Tool × Selection Target.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {MapCursorImages}
 */
export const MAP_CURSOR_IMAGES: MapCursorImages = {
  selectClick: selectClickCursor,
  selectClickVertices: selectClickVerticesCursor,
  selectRectangle: selectRectangleCursor,
  selectRectangleVertices: selectRectangleVerticesCursor,
  selectLasso: selectLassoCursor,
  selectLassoVertices: selectLassoVerticesCursor,
};
