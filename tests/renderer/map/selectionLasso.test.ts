/**
 * @file selectionLasso.test.ts
 * @module tests/renderer/map/selectionLasso.test
 * @description Tests for the Select by Lasso Selection Shape helpers: resolving the Lasso Fill Rule preference (Even-Odd by default), painting the lasso on the canvas with that fill rule (2 px dashed 6/4 outline at full opacity, fill at 0.25), and the lasso sketch style that paints only the sketch polygon.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link paintSelectionShape}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import LineString from "ol/geom/LineString.js";
import Polygon from "ol/geom/Polygon.js";
import Style from "ol/style/Style.js";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  readLassoFillRule,
  resolveLassoFillRule,
  paintSelectionShape,
  createLassoShapeStyle,
  readSelectionShapeColour,
  type SelectionShapePaint,
} from "../../../src/renderer/map/selectionLasso";

/**
 * @function recordingContext
 * @description A canvas 2D context stand-in that records path, fill and stroke calls with the fill/stroke state at the time of each call.
 * @returns {{ context: CanvasRenderingContext2D, calls: Array<Record<string, unknown>> }} Context and call log.
 */
function recordingContext(): {
  context: CanvasRenderingContext2D;
  calls: Array<Record<string, unknown>>;
} {
  const calls: Array<Record<string, unknown>> = [];
  const state: {
    globalAlpha: number;
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    dash: number[];
  } = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    dash: [],
  };
  const context = {
    save: () => calls.push({ op: "save" }),
    restore: () => calls.push({ op: "restore" }),
    beginPath: () => calls.push({ op: "beginPath" }),
    moveTo: (x: number, y: number) => calls.push({ op: "moveTo", x, y }),
    lineTo: (x: number, y: number) => calls.push({ op: "lineTo", x, y }),
    closePath: () => calls.push({ op: "closePath" }),
    setLineDash: (dash: number[]) => {
      state.dash = dash;
    },
    fill: (rule?: string) =>
      calls.push({
        op: "fill",
        rule,
        alpha: state.globalAlpha,
        colour: state.fillStyle,
      }),
    stroke: () =>
      calls.push({
        op: "stroke",
        alpha: state.globalAlpha,
        colour: state.strokeStyle,
        width: state.lineWidth,
        dash: state.dash,
      }),
  };
  for (const key of [
    "globalAlpha",
    "fillStyle",
    "strokeStyle",
    "lineWidth",
  ] as const) {
    Object.defineProperty(context, key, {
      get: () => state[key],
      set: (value) => {
        Object.assign(state, { [key]: value });
      },
    });
  }
  return { context: fromPartial<CanvasRenderingContext2D>(context), calls };
}

describe("resolveLassoFillRule / readLassoFillRule", () => {
  it("is Non-Zero only for 'nonzero', Even-Odd otherwise", () => {
    assert.equal(resolveLassoFillRule("nonzero"), "nonzero");
    assert.equal(resolveLassoFillRule("evenodd"), "evenodd");
    assert.equal(resolveLassoFillRule(undefined), "evenodd");
    assert.equal(resolveLassoFillRule("bogus"), "evenodd");
  });

  it("reads mapTools.selection.lassoFillRule from a preference map", () => {
    assert.equal(
      readLassoFillRule({
        "mapTools.selection.lassoFillRule": fromPartial({ value: "nonzero" }),
      }),
      "nonzero"
    );
    assert.equal(readLassoFillRule({}), "evenodd");
  });
});

describe("paintSelectionShape", () => {
  const ring = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 0],
  ];

  it("fills the traced path with the given fill rule at 0.25 opacity", () => {
    for (const fillRule of ["evenodd", "nonzero"] as const) {
      const { context, calls } = recordingContext();
      paintSelectionShape(context, [ring], { colour: "#abcdef", fillRule }, 1);
      const fill = calls.find((c) => c.op === "fill");
      assert.deepEqual(fill, {
        op: "fill",
        rule: fillRule,
        alpha: 0.25,
        colour: "#abcdef",
      });
    }
  });

  it("strokes a full-opacity 2 px outline dashed 6 on / 4 off, scaled by the pixel ratio", () => {
    const { context, calls } = recordingContext();
    paintSelectionShape(
      context,
      [ring],
      { colour: "#abcdef", fillRule: "evenodd" },
      2
    );
    const stroke = calls.find((c) => c.op === "stroke");
    assert.deepEqual(stroke, {
      op: "stroke",
      alpha: 1,
      colour: "#abcdef",
      width: 4,
      dash: [12, 8],
    });
  });

  it("traces each ring as a closed subpath and restores the context", () => {
    const { context, calls } = recordingContext();
    paintSelectionShape(
      context,
      [ring],
      { colour: "#abcdef", fillRule: "evenodd" },
      1
    );
    assert.deepEqual(
      calls.filter((c) =>
        ["moveTo", "lineTo", "closePath"].includes(String(c.op))
      ),
      [
        { op: "moveTo", x: 0, y: 0 },
        { op: "lineTo", x: 10, y: 0 },
        { op: "lineTo", x: 10, y: 10 },
        { op: "lineTo", x: 0, y: 0 },
        { op: "closePath" },
      ]
    );
    assert.equal(calls[0].op, "save");
    assert.equal(calls.at(-1)?.op, "restore");
  });
});

describe("createLassoShapeStyle", () => {
  it("paints only the sketch polygon, with the paint current at render time", () => {
    let paint: SelectionShapePaint = { colour: "#111111", fillRule: "evenodd" };
    const style = createLassoShapeStyle(() => paint);
    const polygon = new Feature(
      new Polygon([
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ])
    );
    const result = style(polygon, 1);
    assert.equal(result instanceof Style, true);
    const renderer = result instanceof Style ? result.getRenderer() : null;
    assert.equal(typeof renderer, "function");

    const { context, calls } = recordingContext();
    paint = { colour: "#222222", fillRule: "nonzero" };
    renderer!(
      [
        [
          [0, 0],
          [5, 0],
          [5, 5],
          [0, 0],
        ],
      ],
      fromPartial({ context, pixelRatio: 1 })
    );
    const fill = calls.find((c) => c.op === "fill");
    assert.equal(fill?.rule, "nonzero");
    assert.equal(fill?.colour, "#222222");

    assert.equal(style(new Feature(new Point([0, 0])), 1), undefined);
    assert.equal(
      style(
        new Feature(
          new LineString([
            [0, 0],
            [1, 1],
          ])
        ),
        1
      ),
      undefined
    );
  });
});

describe("readSelectionShapeColour", () => {
  it("is empty when there is no element to read the Theme token from", () => {
    assert.equal(readSelectionShapeColour(null), "");
  });
});
