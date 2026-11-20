/**
 * @file vertexSelection.test.ts
 * @module tests/renderer/map/vertexSelection.test
 * @description Tests for vertex selection in Vertex Editor Mode: vertex keys (feature id + vertex path) round-trip, vertex enumeration (a polygon ring's closing coordinate is not a separate vertex), Select by Click's topmost vertex hit within the 3 px tolerance, and the region overlap test used by Select by Rectangle and Select by Lasso, for points, lines, polygons with holes, multipart geometries and geometry collections.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link findTopmostVertexAt}
 * @see {@link findVerticesInRegion}
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
  vertexKey,
  parseVertexKey,
  listVertices,
  listVertexKeys,
  findTopmostVertexAt,
  findVerticesInRegion,
} from "../../../src/renderer/map/vertexSelection";
import {
  createRectangleRegion,
  createSelectionRegion,
} from "../../../src/renderer/map/selectionRegion";

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

/** A square polygon [0,0]–[10,10] with a hole [4,4]–[6,6]. */
const SQUARE_WITH_HOLE = new Polygon([
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
  [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4],
  ],
]);

describe("vertex keys", () => {
  it("round-trips numeric and string feature ids with their paths", () => {
    assert.deepEqual(parseVertexKey(vertexKey(5, [1, 2])), {
      featureId: 5,
      path: [1, 2],
    });
    assert.deepEqual(parseVertexKey(vertexKey("a:b|c", [0])), {
      featureId: "a:b|c",
      path: [0],
    });
    assert.notEqual(vertexKey(5, [0]), vertexKey("5", [0]));
  });

  it("rejects malformed keys", () => {
    assert.equal(parseVertexKey("nonsense"), null);
    assert.equal(parseVertexKey(JSON.stringify([1, ["x"]])), null);
  });
});

describe("listVertices", () => {
  it("lists a point's single vertex with an empty path", () => {
    assert.deepEqual(listVertices(new Point([3, 4])), [
      { path: [], coordinate: [3, 4] },
    ]);
  });

  it("skips each polygon ring's closing coordinate", () => {
    const paths = listVertices(SQUARE_WITH_HOLE).map((v) => v.path);
    assert.deepEqual(paths, [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
  });

  it("prefixes multipart and collection vertices with the part index", () => {
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
    assert.deepEqual(
      listVertices(multi).map((v) => v.path),
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [1, 2],
      ]
    );
    const collection = new GeometryCollection([
      new Point([0, 0]),
      new LineString([
        [1, 1],
        [2, 2],
      ]),
    ]);
    assert.deepEqual(
      listVertices(collection).map((v) => v.path),
      [[0], [1, 0], [1, 1]]
    );
    const multiPolygon = new MultiPolygon([SQUARE_WITH_HOLE.getCoordinates()]);
    assert.deepEqual(listVertices(multiPolygon)[5].path, [0, 1, 1]);
    assert.equal(
      listVertices(
        new MultiPoint([
          [0, 0],
          [1, 1],
        ])
      ).length,
      2
    );
  });

  it("lists every vertex key of a set of features", () => {
    const keys = listVertexKeys([
      feature(1, new Point([0, 0])),
      feature(
        2,
        new LineString([
          [0, 0],
          [1, 1],
        ])
      ),
      new Feature(new Point([9, 9])),
    ]);
    assert.deepEqual(keys, [
      vertexKey(1, []),
      vertexKey(2, [0]),
      vertexKey(2, [1]),
    ]);
  });
});

describe("findTopmostVertexAt", () => {
  it("hits the nearest vertex within 3 px and misses beyond", () => {
    const line = feature(
      1,
      new LineString([
        [0, 0],
        [10, 0],
        [20, 0],
      ])
    );
    assert.equal(findTopmostVertexAt([line], [11, 1], 1), vertexKey(1, [1]));
    assert.equal(findTopmostVertexAt([line], [15, 0], 1), null);
    // At 0.5 map units per pixel, 3 px is 1.5 map units.
    assert.equal(findTopmostVertexAt([line], [11, 1], 0.5), vertexKey(1, [1]));
    assert.equal(findTopmostVertexAt([line], [12, 0], 0.5), null);
  });

  it("does not select a polygon vertex by clicking inside the polygon", () => {
    const polygon = feature(7, SQUARE_WITH_HOLE);
    assert.equal(findTopmostVertexAt([polygon], [2, 2], 0.5), null);
    assert.equal(
      findTopmostVertexAt([polygon], [6.5, 6.5], 0.5),
      vertexKey(7, [1, 2])
    );
  });

  it("prefers the topmost feature in drawing order", () => {
    const below = feature("below", new Point([0, 0]));
    const above = feature("above", new Point([1, 0]));
    // `above` was created later, so it is drawn on top.
    assert.equal(
      findTopmostVertexAt([above, below], [0, 0], 1),
      vertexKey("above", [])
    );
  });

  it("finds vertices in multipart geometries", () => {
    const multi = feature(
      3,
      new MultiPolygon([
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
        [
          [
            [50, 50],
            [51, 50],
            [51, 51],
            [50, 50],
          ],
        ],
      ])
    );
    assert.equal(
      findTopmostVertexAt([multi], [51, 51], 1),
      vertexKey(3, [1, 0, 2])
    );
  });
});

describe("findVerticesInRegion", () => {
  it("selects only the vertices inside a rectangle, holes included", () => {
    const polygon = feature(1, SQUARE_WITH_HOLE);
    const keys = findVerticesInRegion(
      [polygon],
      createRectangleRegion([3, 3, 11, 11])
    );
    assert.deepEqual(keys, [
      vertexKey(1, [0, 2]),
      vertexKey(1, [1, 0]),
      vertexKey(1, [1, 1]),
      vertexKey(1, [1, 2]),
      vertexKey(1, [1, 3]),
    ]);
  });

  it("selects a point and a line's vertices, not segments merely crossing", () => {
    const point = feature("p", new Point([5, 5]));
    const line = feature(
      "l",
      new LineString([
        [-5, 5],
        [15, 5],
      ])
    );
    const keys = findVerticesInRegion(
      [point, line],
      createRectangleRegion([0, 0, 10, 10])
    );
    assert.deepEqual(keys, [vertexKey("p", [])]);
  });

  it("follows the lasso fill rule", () => {
    // A figure traced twice around [0,0]–[10,10]: Even-Odd encloses nothing, Non-Zero everything.
    const twice = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const point = feature(1, new Point([5, 5]));
    assert.deepEqual(
      findVerticesInRegion([point], createSelectionRegion(twice, "evenodd")),
      []
    );
    assert.deepEqual(
      findVerticesInRegion([point], createSelectionRegion(twice, "nonzero")),
      [vertexKey(1, [])]
    );
  });

  it("selects vertices of each part of a multipart geometry", () => {
    const multi = feature(
      9,
      new MultiPoint([
        [1, 1],
        [20, 20],
        [2, 2],
      ])
    );
    assert.deepEqual(
      findVerticesInRegion([multi], createRectangleRegion([0, 0, 10, 10])),
      [vertexKey(9, [0]), vertexKey(9, [2])]
    );
  });
});
