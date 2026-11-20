/**
 * @file selectionRegion.test.ts
 * @module tests/renderer/map/selectionRegion.test
 * @description Tests for the Selection Region overlap test shared by Select by Rectangle (and later Select by Lasso and vertex selection): points inside, outside and on the boundary, a line crossing the region with no vertex inside, a polygon containing the whole region, a polygon whose hole contains the region, multi-geometries, a rotated rectangle, and the bbox-prefiltered feature search.
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
