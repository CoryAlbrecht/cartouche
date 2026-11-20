/**
 * @file vertexDeletion.test.ts
 * @module tests/renderer/map/vertexDeletion.test
 * @description Tests for deleting selected vertices in Vertex Editor Mode: an ordinary delete, a line reduced below 2 vertices, an interior ring reduced below 3 (ring removed, polygon kept), an exterior ring reduced (polygon part removed), the last part removed (feature deleted), a multipart feature losing one part, geometry collections, Z coordinates, and the per-feature plan built from a vertex selection (unchanged features left out, stale keys ignored, never an invalid geometry).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link deleteVerticesFromGeometry}
 * @see {@link planVertexDeletion}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import MultiPoint from "ol/geom/MultiPoint.js";
import LineString from "ol/geom/LineString.js";
import MultiLineString from "ol/geom/MultiLineString.js";
import Polygon from "ol/geom/Polygon.js";
import MultiPolygon from "ol/geom/MultiPolygon.js";
import GeometryCollection from "ol/geom/GeometryCollection.js";
import type { Geometry } from "ol/geom.js";
import {
  deleteVerticesFromGeometry,
  planVertexDeletion,
} from "../../../src/renderer/map/vertexDeletion";
import { vertexKey } from "../../../src/renderer/map/vertexSelection";

/**
 * @function coords
 * @description The coordinates of a geometry result (null stays null) for structural comparison.
 * @param {Geometry | null} geometry - Result geometry.
 * @returns {unknown} Its coordinates, or null.
 */
function coords(geometry: Geometry | null): unknown {
  if (geometry === null) return null;
  return (
      "getCoordinates" in geometry
        && typeof geometry.getCoordinates === "function"
    ) ?
      geometry.getCoordinates()
    : undefined;
}

/** Exterior square ring [0,0]–[10,10] (closed). */
const OUTER = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];
/** Hole [4,4]–[6,6] (closed). */
const HOLE = [
  [4, 4],
  [6, 4],
  [6, 6],
  [4, 6],
  [4, 4],
];

describe("deleteVerticesFromGeometry", () => {
  it("removes a line vertex in an ordinary delete", () => {
    const line = new LineString([
      [0, 0],
      [1, 1],
      [2, 0],
    ]);
    const result = deleteVerticesFromGeometry(line, [[1]]);
    assert.deepEqual(coords(result), [
      [0, 0],
      [2, 0],
    ]);
    assert.deepEqual(
      coords(line),
      [
        [0, 0],
        [1, 1],
        [2, 0],
      ],
      "input untouched"
    );
  });

  it("deletes a line left with fewer than 2 vertices", () => {
    const line = new LineString([
      [0, 0],
      [1, 1],
      [2, 0],
    ]);
    assert.equal(deleteVerticesFromGeometry(line, [[0], [2]]), null);
  });

  it("removes a polygon vertex and keeps the ring closed", () => {
    const polygon = new Polygon([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 12],
        [0, 10],
        [0, 0],
      ],
    ]);
    assert.deepEqual(coords(deleteVerticesFromGeometry(polygon, [[0, 3]])), [
      OUTER,
    ]);
  });

  it("re-closes a ring whose first vertex is deleted", () => {
    const polygon = new Polygon([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ]);
    assert.deepEqual(coords(deleteVerticesFromGeometry(polygon, [[0, 0]])), [
      [
        [10, 0],
        [10, 10],
        [0, 10],
        [10, 0],
      ],
    ]);
  });

  it("removes an interior ring reduced below 3 vertices and keeps the polygon", () => {
    const polygon = new Polygon([OUTER, HOLE]);
    const result = deleteVerticesFromGeometry(polygon, [
      [1, 0],
      [1, 1],
    ]);
    assert.deepEqual(coords(result), [OUTER]);
  });

  it("deletes a polygon whose exterior ring is reduced below 3 vertices", () => {
    const polygon = new Polygon([OUTER, HOLE]);
    assert.equal(
      deleteVerticesFromGeometry(polygon, [
        [0, 0],
        [0, 1],
      ]),
      null
    );
  });

  it("counts distinct vertices, so a ring of repeated points is removed", () => {
    const polygon = new Polygon([
      OUTER,
      [
        [4, 4],
        [6, 4],
        [4, 4],
        [6, 6],
        [4, 4],
      ],
    ]);
    // Removing [6,6] leaves [4,4],[6,4],[4,4]: only 2 distinct vertices.
    assert.deepEqual(coords(deleteVerticesFromGeometry(polygon, [[1, 3]])), [
      OUTER,
    ]);
  });

  it("removes one polygon of a multipolygon whose exterior ring is reduced", () => {
    const other = [
      [20, 20],
      [30, 20],
      [30, 30],
      [20, 20],
    ];
    const multi = new MultiPolygon([[OUTER, HOLE], [other]]);
    const result = deleteVerticesFromGeometry(multi, [
      [0, 0, 0],
      [0, 0, 1],
    ]);
    assert.ok(result instanceof MultiPolygon);
    assert.deepEqual(coords(result), [[other]]);
  });

  it("removes one part of a multilinestring and deletes it when the last part goes", () => {
    const multi = new MultiLineString([
      [
        [0, 0],
        [1, 1],
      ],
      [
        [5, 5],
        [6, 6],
        [7, 7],
      ],
    ]);
    assert.deepEqual(coords(deleteVerticesFromGeometry(multi, [[0, 1]])), [
      [
        [5, 5],
        [6, 6],
        [7, 7],
      ],
    ]);
    assert.equal(
      deleteVerticesFromGeometry(multi, [
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
      null
    );
  });

  it("removes multipoint points and deletes a point or an emptied multipoint", () => {
    const multi = new MultiPoint([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    assert.deepEqual(coords(deleteVerticesFromGeometry(multi, [[1]])), [
      [0, 0],
      [2, 2],
    ]);
    assert.equal(deleteVerticesFromGeometry(multi, [[0], [1], [2]]), null);
    assert.equal(deleteVerticesFromGeometry(new Point([1, 2]), [[]]), null);
  });

  it("removes a geometry collection's emptied member and keeps the rest", () => {
    const collection = new GeometryCollection([
      new Point([0, 0]),
      new LineString([
        [1, 1],
        [2, 2],
        [3, 3],
      ]),
    ]);
    const result = deleteVerticesFromGeometry(collection, [[0], [1, 2]]);
    assert.ok(result instanceof GeometryCollection);
    const parts = result.getGeometries();
    assert.equal(parts.length, 1);
    assert.deepEqual(coords(parts[0]), [
      [1, 1],
      [2, 2],
    ]);
    assert.equal(
      deleteVerticesFromGeometry(collection, [[0], [1, 0], [1, 1]]),
      null
    );
  });

  it("keeps Z coordinates and layout", () => {
    const line = new LineString(
      [
        [0, 0, 5],
        [1, 1, 6],
        [2, 0, 7],
      ],
      "XYZ"
    );
    const result = deleteVerticesFromGeometry(line, [[1]]);
    assert.ok(result instanceof LineString);
    assert.equal(result.getLayout(), "XYZ");
    assert.deepEqual(result.getCoordinates(), [
      [0, 0, 5],
      [2, 0, 7],
    ]);
  });

  it("returns the input itself when no path matches a vertex", () => {
    const line = new LineString([
      [0, 0],
      [1, 1],
    ]);
    assert.equal(
      deleteVerticesFromGeometry(line, [[7], [0, 3]]) === line,
      true
    );
  });
});

describe("planVertexDeletion", () => {
  /**
   * @function feature
   * @description Creates a feature with an id and geometry.
   * @param {string | number} id - Feature id.
   * @param {Geometry} geometry - Geometry.
   * @returns {Feature} The feature.
   */
  function feature(id: string | number, geometry: Geometry): Feature {
    const f = new Feature(geometry);
    f.setId(id);
    return f;
  }

  it("groups the selection per feature into changed and deleted features", () => {
    const line = feature(
      1,
      new LineString([
        [0, 0],
        [1, 1],
        [2, 0],
      ])
    );
    const point = feature("p", new Point([5, 5]));
    const untouched = feature(
      3,
      new LineString([
        [0, 0],
        [1, 1],
      ])
    );
    const byId = new Map<string | number, Feature>([
      [1, line],
      ["p", point],
      [3, untouched],
    ]);
    const plan = planVertexDeletion(
      [vertexKey(1, [1]), vertexKey("p", []), vertexKey(99, [0]), "garbage"],
      (id) => byId.get(id) ?? null
    );
    assert.deepEqual(
      plan.changed.map((c) => [c.feature.getId(), coords(c.geometry)]),
      [
        [
          1,
          [
            [0, 0],
            [2, 0],
          ],
        ],
      ]
    );
    assert.deepEqual(
      plan.deleted.map((f) => f.getId()),
      ["p"]
    );
    assert.deepEqual(coords(line.getGeometry()!), [
      [0, 0],
      [1, 1],
      [2, 0],
    ]);
  });

  it("is empty when no selected vertex exists any more", () => {
    const plan = planVertexDeletion([vertexKey(1, [5])], () =>
      feature(
        1,
        new LineString([
          [0, 0],
          [1, 1],
        ])
      )
    );
    assert.equal(plan.changed.length + plan.deleted.length, 0);
  });
});
