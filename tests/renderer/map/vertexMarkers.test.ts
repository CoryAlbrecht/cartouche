/**
 * @file vertexMarkers.test.ts
 * @module tests/renderer/map/vertexMarkers.test
 * @description Tests for the vertex markers drawn over the Active Layer in Vertex Editor Mode: every vertex gets a marker in the Theme's vertex marker colours, selected vertices get a second, larger marker in the Selection Colour, and the selection is grouped per feature; the Theme tokens are read from the map element.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link createVertexMarkerStyleFunction}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Feature from "ol/Feature.js";
import Polygon from "ol/geom/Polygon.js";
import MultiPoint from "ol/geom/MultiPoint.js";
import type Style from "ol/style/Style.js";
import RegularShape from "ol/style/RegularShape.js";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  createVertexMarkerStyleFunction,
  groupVertexKeysByFeature,
  readVertexMarkerColours,
} from "../../../src/renderer/map/vertexMarkers";
import { vertexKey } from "../../../src/renderer/map/vertexSelection";

const COLOURS = {
  outline: "black",
  fill: "white",
  selection: "rgba(255,255,0,0.6)",
};

/**
 * @function triangle
 * @description A triangle feature with id 1.
 * @returns {Feature} Feature.
 */
function triangle(): Feature {
  const f = new Feature(
    new Polygon([
      [
        [0, 0],
        [10, 0],
        [0, 10],
        [0, 0],
      ],
    ])
  );
  f.setId(1);
  return f;
}

/**
 * @function markerCoordinates
 * @description The coordinates of a marker style's MultiPoint geometry.
 * @param {Style} style - Marker style.
 * @param {Feature} feature - Styled feature.
 * @returns {number[][]} Marker positions.
 */
function markerCoordinates(style: Style, feature: Feature): number[][] {
  const geometry = style.getGeometryFunction()(feature);
  assert.ok(geometry instanceof MultiPoint);
  return geometry.getCoordinates();
}

/**
 * @function stylesOf
 * @description Normalises a style function result to an array.
 * @param {Style | Style[] | void} result - Style function result.
 * @returns {Style[]} Styles.
 */
function stylesOf(result: Style | Style[] | void): Style[] {
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

describe("createVertexMarkerStyleFunction", () => {
  it("marks every vertex once, without the ring's closing coordinate", () => {
    const style = createVertexMarkerStyleFunction(COLOURS, new Map());
    const feature = triangle();
    const styles = stylesOf(style(feature, 1));
    assert.equal(styles.length, 1);
    assert.deepEqual(markerCoordinates(styles[0], feature), [
      [0, 0],
      [10, 0],
      [0, 10],
    ]);
    const image = styles[0].getImage();
    assert.ok(image instanceof RegularShape);
    assert.equal(image.getFill()?.getColor(), "white");
    assert.equal(image.getStroke()?.getColor(), "black");
  });

  it("adds a Selection Colour marker over the selected vertices", () => {
    const selected = groupVertexKeysByFeature([
      vertexKey(1, [0, 1]),
      vertexKey(2, [0]),
    ]);
    const style = createVertexMarkerStyleFunction(COLOURS, selected);
    const feature = triangle();
    const styles = stylesOf(style(feature, 1));
    assert.equal(styles.length, 2);
    assert.deepEqual(markerCoordinates(styles[1], feature), [[10, 0]]);
    const image = styles[1].getImage();
    const base = styles[0].getImage();
    assert.ok(image instanceof RegularShape && base instanceof RegularShape);
    assert.equal(image.getFill()?.getColor(), COLOURS.selection);
    assert.ok(image.getRadius() > base.getRadius());
  });

  it("draws nothing for a feature without geometry or id", () => {
    const style = createVertexMarkerStyleFunction(COLOURS, new Map());
    assert.deepEqual(style(new Feature(), 1), []);
  });
});

describe("groupVertexKeysByFeature", () => {
  it("groups joined vertex paths per feature id and skips malformed keys", () => {
    const groups = groupVertexKeysByFeature([
      vertexKey(1, [0, 1]),
      vertexKey(1, [1, 2]),
      vertexKey("a", []),
      "junk",
    ]);
    assert.deepEqual([...groups.keys()], [1, "a"]);
    assert.deepEqual([...groups.get(1)!], ["0,1", "1,2"]);
    assert.deepEqual([...groups.get("a")!], [""]);
  });
});

describe("readVertexMarkerColours", () => {
  it("reads both Theme tokens from the element, empty without one", () => {
    const original = globalThis.getComputedStyle;
    Object.assign(globalThis, {
      getComputedStyle: () => ({
        getPropertyValue: (name: string) =>
          name === "--cartouche-map-vertex-marker" ? " #111111 "
          : name === "--cartouche-map-vertex-marker-fill" ? "#eeeeee"
          : "",
      }),
    });
    try {
      assert.deepEqual(readVertexMarkerColours(fromPartial<Element>({})), {
        outline: "#111111",
        fill: "#eeeeee",
      });
      assert.deepEqual(readVertexMarkerColours(null), {
        outline: "",
        fill: "",
      });
    } finally {
      Object.assign(globalThis, { getComputedStyle: original });
    }
  });
});
