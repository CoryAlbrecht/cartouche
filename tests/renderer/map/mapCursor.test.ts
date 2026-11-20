/**
 * @file mapCursor.test.ts
 * @module tests/renderer/map/mapCursor
 * @description Unit tests for Map Cursor resolution: every map tool × Selection Target × drag state maps to the CSS cursor value of the #378 table, with keyword fallbacks when no custom cursor images are supplied.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveMapCursor,
  type MapCursorImages,
} from "../../../src/renderer/map/mapCursor";
import type { ActiveTool } from "../../../src/renderer/state/gisSignals";

/** Fake asset URLs standing in for the six bundled cursor SVGs. */
const IMAGES: MapCursorImages = {
  selectClick: "click.svg",
  selectClickVertices: "click-v.svg",
  selectRectangle: "rect.svg",
  selectRectangleVertices: "rect-v.svg",
  selectLasso: "lasso.svg",
  selectLassoVertices: "lasso-v.svg",
};

const CLICK = 'url("click.svg") 4 3, default';
const CLICK_V = 'url("click-v.svg") 4 3, default';
const RECT = 'url("rect.svg") 11 11, crosshair';
const RECT_V = 'url("rect-v.svg") 11 11, crosshair';
const LASSO = 'url("lasso.svg") 11 11, crosshair';
const LASSO_V = 'url("lasso-v.svg") 11 11, crosshair';

describe("resolveMapCursor", () => {
  const rows: Array<[ActiveTool, string, string, string]> = [
    // tool, features, vertices, while dragging (features)
    ["pan", "grab", "grab", "grabbing"],
    ["point", "crosshair", "crosshair", "crosshair"],
    ["line", "crosshair", "crosshair", "crosshair"],
    ["polygon", "crosshair", "crosshair", "crosshair"],
    ["select_click", CLICK, CLICK_V, CLICK],
    ["select_rectangle", RECT, RECT_V, RECT],
    ["select_lasso", LASSO, LASSO_V, LASSO],
  ];

  for (const [tool, features, vertices, dragging] of rows) {
    it(`${tool}: features → ${features}`, () => {
      assert.equal(resolveMapCursor(tool, "features", false, IMAGES), features);
    });
    it(`${tool}: vertices → ${vertices}`, () => {
      assert.equal(resolveMapCursor(tool, "vertices", false, IMAGES), vertices);
    });
    it(`${tool}: while dragging → ${dragging}`, () => {
      assert.equal(resolveMapCursor(tool, "features", true, IMAGES), dragging);
    });
  }

  it("pan shows grabbing while dragging in Vertex Editor Mode too", () => {
    assert.equal(resolveMapCursor("pan", "vertices", true, IMAGES), "grabbing");
  });

  it("dragging leaves a vertex Selection Tool cursor unchanged", () => {
    assert.equal(
      resolveMapCursor("select_lasso", "vertices", true, IMAGES),
      LASSO_V
    );
  });

  it("falls back to keywords when no cursor images are supplied", () => {
    assert.equal(
      resolveMapCursor("select_click", "features", false),
      "default"
    );
    assert.equal(
      resolveMapCursor("select_click", "vertices", false),
      "default"
    );
    assert.equal(
      resolveMapCursor("select_rectangle", "features", false),
      "crosshair"
    );
    assert.equal(
      resolveMapCursor("select_lasso", "vertices", false),
      "crosshair"
    );
  });
});
