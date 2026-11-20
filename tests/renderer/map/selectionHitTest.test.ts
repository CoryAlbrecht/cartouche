/**
 * @file selectionHitTest.test.ts
 * @module tests/renderer/map/selectionHitTest.test
 * @description Tests for Select by Click's topmost-hit resolution: among overlapping features the one drawn last wins, lines and points are hit within the 3 px hit tolerance (plus the reach of their symbol) and missed beyond it, and polygons are hit anywhere inside.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link findTopmostFeatureAt}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import LineString from "ol/geom/LineString.js";
import Polygon from "ol/geom/Polygon.js";
import {
  findTopmostFeatureAt,
  SELECTION_HIT_TOLERANCE_PX,
} from "../../../src/renderer/map/selectionHitTest";

/** Map units per pixel used throughout: 1 px = 10 map units. */
const RESOLUTION = 10;

/**
 * @function square
 * @description Builds a square polygon feature.
 * @param {string} id - Feature id.
 * @param {number} min - Lower-left x and y.
 * @param {number} max - Upper-right x and y.
 * @returns {Feature} Polygon feature.
 */
function square(id: string, min: number, max: number): Feature {
  const f = new Feature(
    new Polygon([
      [
        [min, min],
        [max, min],
        [max, max],
        [min, max],
        [min, min],
      ],
    ])
  );
  f.setId(id);
  return f;
}

/**
 * @function horizontalLine
 * @description Builds a horizontal line feature along y = 0 from x = 0 to x = 1000.
 * @param {string} id - Feature id.
 * @returns {Feature} Line feature.
 */
function horizontalLine(id: string): Feature {
  const f = new Feature(
    new LineString([
      [0, 0],
      [1000, 0],
    ])
  );
  f.setId(id);
  return f;
}

describe("findTopmostFeatureAt", () => {
  it("uses a 3 px hit tolerance", () => {
    assert.equal(SELECTION_HIT_TOLERANCE_PX, 3);
  });

  it("returns the feature drawn last where features overlap", () => {
    const bottom = square("bottom", 0, 100);
    const top = square("top", 50, 150);
    const hit = findTopmostFeatureAt([top, bottom], [75, 75], RESOLUTION);
    assert.equal(hit?.getId(), "top");
  });

  it("returns the lower feature where only it is under the pointer", () => {
    const bottom = square("bottom", 0, 100);
    const top = square("top", 50, 150);
    const hit = findTopmostFeatureAt([bottom, top], [25, 25], RESOLUTION);
    assert.equal(hit?.getId(), "bottom");
  });

  it("hits a thin line within 3 px of the pointer", () => {
    const line = horizontalLine("line");
    const hit = findTopmostFeatureAt(
      [line],
      [500, 2.9 * RESOLUTION],
      RESOLUTION
    );
    assert.equal(hit?.getId(), "line");
  });

  it("misses a thin line more than 3 px from the pointer", () => {
    const line = horizontalLine("line");
    const hit = findTopmostFeatureAt(
      [line],
      [500, 3.1 * RESOLUTION],
      RESOLUTION
    );
    assert.equal(hit, null);
  });

  it("hits a point within its symbol reach plus the tolerance", () => {
    const point = new Feature(new Point([0, 0]));
    point.setId("p");
    const options = { symbolReachPx: () => 5 };
    assert.equal(
      findTopmostFeatureAt(
        [point],
        [7.9 * RESOLUTION, 0],
        RESOLUTION,
        options
      )?.getId(),
      "p"
    );
    assert.equal(
      findTopmostFeatureAt([point], [8.1 * RESOLUTION, 0], RESOLUTION, options),
      null
    );
  });

  it("prefers a line drawn above a polygon it crosses", () => {
    const polygon = square("polygon", -100, 100);
    const line = horizontalLine("line");
    const hit = findTopmostFeatureAt([polygon, line], [50, 10], RESOLUTION);
    assert.equal(hit?.getId(), "line");
  });

  it("returns null when nothing is near the pointer or there are no features", () => {
    assert.equal(
      findTopmostFeatureAt([square("a", 0, 100)], [500, 500], RESOLUTION),
      null
    );
    assert.equal(findTopmostFeatureAt([], [0, 0], RESOLUTION), null);
  });

  it("ignores features without geometry", () => {
    const empty = new Feature();
    empty.setId("empty");
    assert.equal(findTopmostFeatureAt([empty], [0, 0], RESOLUTION), null);
  });
});
