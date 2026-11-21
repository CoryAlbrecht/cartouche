/**
 * @file vertexEditing.test.ts
 * @module tests/renderer/map/vertexEditing.test
 * @description Tests for committing a vertex deletion as one atomic edit: the layer's source is updated (changed geometries replaced, emptied features removed), every affected feature goes to the edit cache in a single staging call (geometry as ISO WKB in the layer's data CRS, deletions flagged), and nothing is staged when no selected vertex exists.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link commitVertexDeletion}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import LineString from "ol/geom/LineString.js";
import VectorSource from "ol/source/Vector.js";
import WKB from "ol/format/WKB.js";
import type { Geometry } from "ol/geom.js";
import type { StagedFeatureEdit } from "../../../src/shared/types/project";
import { commitVertexDeletion } from "../../../src/renderer/map/vertexEditing";
import { vertexKey } from "../../../src/renderer/map/vertexSelection";

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

/**
 * @function readWkb
 * @description Decodes staged WKB bytes into coordinates.
 * @param {Uint8Array | undefined} wkb - WKB bytes.
 * @param {Object} [options] - Read projections.
 * @returns {number[][]} The line's coordinates.
 */
function readWkb(
  wkb: Uint8Array | undefined,
  options: { dataProjection?: string; featureProjection?: string } = {}
): number[][] {
  assert.ok(wkb, "edit carries WKB");
  const geometry = new WKB().readGeometry(wkb.slice().buffer, options);
  assert.ok(geometry instanceof LineString, "staged a line");
  return geometry.getCoordinates();
}

/**
 * @function lineCoordinates
 * @description The coordinates of a source feature's line geometry.
 * @param {VectorSource} source - Source.
 * @param {number} id - Feature id.
 * @returns {number[][]} Coordinates.
 */
function lineCoordinates(source: VectorSource, id: number): number[][] {
  const geometry = source.getFeatureById(id)?.getGeometry();
  assert.ok(geometry instanceof LineString, "feature keeps a line");
  return geometry.getCoordinates();
}

const SAME_CRS = {
  dataProjection: "EPSG:3857",
  featureProjection: "EPSG:3857",
};

describe("commitVertexDeletion", () => {
  it("updates the source and stages all affected features in one call", () => {
    const line = feature(
      1,
      new LineString([
        [0, 0],
        [1, 1],
        [2, 0],
      ])
    );
    const point = feature(2, new Point([5, 5]));
    const other = feature(3, new Point([9, 9]));
    const source = new VectorSource({ features: [line, point, other] });
    const calls: StagedFeatureEdit[][] = [];

    const commit = commitVertexDeletion({
      source,
      keys: [vertexKey(1, [1]), vertexKey(2, [])],
      projections: SAME_CRS,
      stage: (edits) => {
        calls.push(edits);
      },
    });

    assert.equal(calls.length, 1, "one staging call");
    assert.deepEqual(
      calls[0].map((e) => [e.id, Boolean(e.deleted)]),
      [
        [1, false],
        [2, true],
      ]
    );
    assert.deepEqual(readWkb(calls[0][0].wkb), [
      [0, 0],
      [2, 0],
    ]);
    assert.deepEqual(commit?.changedIds, [1]);
    assert.deepEqual(commit?.deletedIds, [2]);
    assert.equal(source.getFeatureById(2) === null, true);
    assert.equal(source.getFeatureById(3) === other, true);
    assert.deepEqual(lineCoordinates(source, 1), [
      [0, 0],
      [2, 0],
    ]);
  });

  it("writes geometry in the layer's data CRS", () => {
    const line = feature(
      1,
      new LineString([
        [0, 0],
        [111319.49, 0],
        [222638.98, 0],
      ])
    );
    const source = new VectorSource({ features: [line] });
    let staged: StagedFeatureEdit[] = [];
    commitVertexDeletion({
      source,
      keys: [vertexKey(1, [1])],
      projections: {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      },
      stage: (edits) => {
        staged = edits;
      },
    });
    const coords = readWkb(staged[0].wkb);
    assert.equal(coords.length, 2);
    assert.ok(Math.abs(coords[1][0] - 2) < 1e-6, `lon ${coords[1][0]}`);
  });

  it("stages nothing when no selected vertex exists", () => {
    const source = new VectorSource({
      features: [feature(1, new Point([0, 0]))],
    });
    let calls = 0;
    const commit = commitVertexDeletion({
      source,
      keys: [vertexKey(1, [4]), vertexKey(42, [])],
      projections: SAME_CRS,
      stage: () => {
        calls++;
      },
    });
    assert.equal(commit, null);
    assert.equal(calls, 0);
  });
});
