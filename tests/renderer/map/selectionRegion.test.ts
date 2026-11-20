/**
 * @file selectionRegion.test.ts
 * @module tests/renderer/map/selectionRegion.test
 * @description Tests for the Selection Region overlap test shared by Select by Rectangle, Select by Lasso (and later vertex selection): points inside, outside and on the boundary, a line crossing the region with no vertex inside, a polygon containing the whole region, a polygon whose hole contains the region, multi-geometries, a rotated rectangle, the bbox-prefiltered feature search, and lasso outlines under both Lasso Fill Rules (auto-closed open stroke, simple loop, figure 8, one-stroke pentagram whose centre only Non-Zero encloses).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link geometryOverlapsRegion}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import MultiPoint from "ol/geom/MultiPoint.js";
import LineString from "ol/geom/LineString.js";
import Polygon from "ol/geom/Polygon.js";
import MultiPolygon from "ol/geom/MultiPolygon.js";
import GeometryCollection from "ol/geom/GeometryCollection.js";
import VectorSource from "ol/source/Vector.js";
import {
  createSelectionRegion,
  createRectangleRegion,
  geometryOverlapsRegion,
  findFeaturesOverlappingRegion,
  regionContainsCoordinate,
} from "../../../src/renderer/map/selectionRegion";

/** The rectangle [0,0]–[10,10]. */
const RECT = createRectangleRegion([0, 0, 10, 10]);

describe("geometryOverlapsRegion (rectangle)", () => {
  it("selects a point inside and not one outside", () => {
    assert.equal(geometryOverlapsRegion(new Point([5, 5]), RECT), true);
    assert.equal(geometryOverlapsRegion(new Point([15, 5]), RECT), false);
    assert.equal(geometryOverlapsRegion(new Point([-1, -1]), RECT), false);
  });

  it("counts a point on the rectangle's edge as overlapping", () => {
    assert.equal(geometryOverlapsRegion(new Point([10, 5]), RECT), true);
  });

  it("selects a line crossing the rectangle with no vertex inside", () => {
    const line = new LineString([
      [-5, 5],
      [15, 5],
    ]);
    assert.equal(geometryOverlapsRegion(line, RECT), true);
  });

  it("does not select a line passing beside the rectangle within its bbox prefilter", () => {
    // Diagonal line whose bbox overlaps the rectangle's but which misses it.
    const line = new LineString([
      [-10, 8],
      [2, 30],
    ]);
    assert.equal(geometryOverlapsRegion(line, RECT), false);
  });

  it("selects a polygon containing the whole rectangle", () => {
    const polygon = new Polygon([
      [
        [-100, -100],
        [100, -100],
        [100, 100],
        [-100, 100],
        [-100, -100],
      ],
    ]);
    assert.equal(geometryOverlapsRegion(polygon, RECT), true);
  });

  it("does not select a polygon whose hole contains the whole rectangle", () => {
    const donut = new Polygon([
      [
        [-100, -100],
        [100, -100],
        [100, 100],
        [-100, 100],
        [-100, -100],
      ],
      [
        [-50, -50],
        [-50, 50],
        [50, 50],
        [50, -50],
        [-50, -50],
      ],
    ]);
    assert.equal(geometryOverlapsRegion(donut, RECT), false);
  });

  it("selects a polygon inside the rectangle and one partly overlapping it", () => {
    const inside = new Polygon([
      [
        [2, 2],
        [4, 2],
        [4, 4],
        [2, 2],
      ],
    ]);
    const partly = new Polygon([
      [
        [8, 8],
        [20, 8],
        [20, 20],
        [8, 8],
      ],
    ]);
    assert.equal(geometryOverlapsRegion(inside, RECT), true);
    assert.equal(geometryOverlapsRegion(partly, RECT), true);
  });

  it("selects a multi-geometry when any part overlaps", () => {
    assert.equal(
      geometryOverlapsRegion(
        new MultiPoint([
          [50, 50],
          [5, 5],
        ]),
        RECT
      ),
      true
    );
    assert.equal(
      geometryOverlapsRegion(
        new MultiPolygon([
          [
            [
              [20, 20],
              [30, 20],
              [30, 30],
              [20, 20],
            ],
          ],
        ]),
        RECT
      ),
      false
    );
    assert.equal(
      geometryOverlapsRegion(
        new GeometryCollection([new Point([50, 50]), new Point([1, 1])]),
        RECT
      ),
      true
    );
  });
});

describe("geometryOverlapsRegion (rotated rectangle)", () => {
  // A diamond: the rectangle of a rotated view, centred on the origin.
  const diamond = createSelectionRegion([
    [0, -10],
    [10, 0],
    [0, 10],
    [-10, 0],
    [0, -10],
  ]);

  it("tests against the rotated outline, not its bounding box", () => {
    assert.equal(geometryOverlapsRegion(new Point([1, 1]), diamond), true);
    assert.equal(geometryOverlapsRegion(new Point([9, 9]), diamond), false);
  });
});

describe("findFeaturesOverlappingRegion", () => {
  it("returns the ids of the source's features overlapping the region", () => {
    const source = new VectorSource();
    const inside = new Feature(new Point([5, 5]));
    inside.setId(1);
    const outside = new Feature(new Point([50, 50]));
    outside.setId(2);
    const crossing = new Feature(
      new LineString([
        [-5, 5],
        [15, 5],
      ])
    );
    crossing.setId(3);
    const noId = new Feature(new Point([6, 6]));
    source.addFeatures([inside, outside, crossing, noId]);
    assert.deepEqual(
      findFeaturesOverlappingRegion(source, RECT).sort(),
      [1, 3]
    );
  });
});

/**
 * @function pentagramOutline
 * @description A one-stroke five-pointed star of radius 10 centred on the origin (vertices visited 0, 2, 4, 1, 3), left open: its centre pentagon is circled twice.
 * @returns {number[][]} Open outline.
 */
function pentagramOutline(): number[][] {
  const tips = [0, 1, 2, 3, 4].map((i) => {
    const angle = Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [10 * Math.cos(angle), 10 * Math.sin(angle)];
  });
  return [0, 2, 4, 1, 3].map((i) => tips[i]);
}

/** A figure 8 (bow tie): two triangular loops, wound in opposite directions, meeting at [5,5]. */
const FIGURE_8 = [
  [0, 0],
  [10, 10],
  [10, 0],
  [0, 10],
];

describe("createSelectionRegion / regionContainsCoordinate (lasso outlines)", () => {
  it("closes an open stroke with a straight segment back to the start", () => {
    const region = createSelectionRegion([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    assert.deepEqual(region.ring.at(-1), [0, 0]);
    assert.equal(region.ring.length, 5);
    assert.equal(regionContainsCoordinate(region, [5, 5]), true);
    assert.equal(regionContainsCoordinate(region, [5, 15]), false);
  });

  it("does not add a closing segment to an already closed outline", () => {
    const region = createSelectionRegion([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ]);
    assert.equal(region.ring.length, 4);
  });

  it("encloses a simple loop's interior under both fill rules", () => {
    for (const rule of ["evenodd", "nonzero"] as const) {
      const loop = createSelectionRegion(
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        rule
      );
      assert.equal(regionContainsCoordinate(loop, [5, 5]), true, rule);
      assert.equal(regionContainsCoordinate(loop, [12, 5]), false, rule);
    }
  });

  it("encloses both loops of a figure 8 under both fill rules", () => {
    for (const rule of ["evenodd", "nonzero"] as const) {
      const eight = createSelectionRegion(FIGURE_8, rule);
      assert.equal(regionContainsCoordinate(eight, [2, 5]), true, rule);
      assert.equal(regionContainsCoordinate(eight, [8, 5]), true, rule);
      assert.equal(regionContainsCoordinate(eight, [5, 1]), false, rule);
      assert.equal(regionContainsCoordinate(eight, [5, 9]), false, rule);
    }
  });

  it("leaves a pentagram's centre outside under Even-Odd and inside under Non-Zero", () => {
    const evenOdd = createSelectionRegion(pentagramOutline(), "evenodd");
    const nonZero = createSelectionRegion(pentagramOutline(), "nonzero");
    assert.equal(regionContainsCoordinate(evenOdd, [0, 0]), false);
    assert.equal(regionContainsCoordinate(nonZero, [0, 0]), true);
    // The top tip is circled once: inside under both.
    assert.equal(regionContainsCoordinate(evenOdd, [0, 8]), true);
    assert.equal(regionContainsCoordinate(nonZero, [0, 8]), true);
    // Between two tips is outside under both.
    assert.equal(regionContainsCoordinate(evenOdd, [0, -9]), false);
    assert.equal(regionContainsCoordinate(nonZero, [0, -9]), false);
  });
});

describe("geometryOverlapsRegion (pentagram lasso)", () => {
  const evenOdd = createSelectionRegion(pentagramOutline(), "evenodd");
  const nonZero = createSelectionRegion(pentagramOutline(), "nonzero");
  // The centre pentagon's inradius is 10·cos(72°) ≈ 3.09.
  const centrePoint = new Point([0, 0]);
  const centreLine = new LineString([
    [-1, 0],
    [1, 0],
  ]);
  const centrePolygon = new Polygon([
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ],
  ]);

  it("selects a point, line and polygon lying only in the centre under Non-Zero, not under Even-Odd", () => {
    for (const geometry of [centrePoint, centreLine, centrePolygon]) {
      const type = geometry.getType();
      assert.equal(geometryOverlapsRegion(geometry, nonZero), true, type);
      assert.equal(geometryOverlapsRegion(geometry, evenOdd), false, type);
    }
  });

  it("selects geometries in a tip, and a line crossing the outline, under both rules", () => {
    const tipPoint = new Point([0, 8]);
    const crossingLine = new LineString([
      [-1, 0],
      [-1, 20],
    ]);
    for (const region of [evenOdd, nonZero]) {
      assert.equal(geometryOverlapsRegion(tipPoint, region), true);
      assert.equal(geometryOverlapsRegion(crossingLine, region), true);
    }
  });

  it("selects a polygon containing the whole star under both rules", () => {
    const around = new Polygon([
      [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
        [-20, -20],
      ],
    ]);
    assert.equal(geometryOverlapsRegion(around, evenOdd), true);
    assert.equal(geometryOverlapsRegion(around, nonZero), true);
  });

  it("does not select a point between the tips under either rule", () => {
    const between = new Point([0, -9]);
    assert.equal(geometryOverlapsRegion(between, evenOdd), false);
    assert.equal(geometryOverlapsRegion(between, nonZero), false);
  });
});
