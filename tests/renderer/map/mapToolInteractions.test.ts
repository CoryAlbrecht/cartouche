/**
 * @file mapToolInteractions.test.ts
 * @module tests/renderer/map/mapToolInteractions.test
 * @description Tests for the tool-driven map interactions: which default navigation gestures each map tool leaves on (Selection Tools turn off drag-pan and Shift+drag zoom), how Select by Click resolves a click to the Active Layer's topmost feature, how a gesture's hits are published to the shared feature selection, how Select by Rectangle selects the features overlapping its rectangle and which drags start a Selection Shape, and how the tool's handler is swapped as the active tool changes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link MapToolInteractions}
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fromPartial } from "@total-typescript/shoehorn";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import Polygon from "ol/geom/Polygon.js";
import VectorSource from "ol/source/Vector.js";
import CircleStyle from "ol/style/Circle.js";
import Stroke from "ol/style/Stroke.js";
import Style from "ol/style/Style.js";
import { selectedFeatureIdsSignal } from "../../../src/renderer/state/gisSignals";
import {
  isSelectionTool,
  resolveNavigationForTool,
  resolveClickHits,
  publishFeatureSelection,
  selectByClickAt,
  symbolReachFromStyles,
  selectFeaturesInRegion,
  isSelectionShapeDragStart,
  MapToolInteractions,
  type MapToolContext,
  type MapToolHandler,
} from "../../../src/renderer/map/mapToolInteractions";
import { createRectangleRegion } from "../../../src/renderer/map/selectionRegion";

const NONE = { shift: false, ctrl: false };

/**
 * @function polygonFeature
 * @description Builds a square polygon feature with a numeric id.
 * @param {number} id - Feature id.
 * @param {number} min - Lower-left x and y.
 * @param {number} max - Upper-right x and y.
 * @returns {Feature} Polygon feature.
 */
function polygonFeature(id: number, min: number, max: number): Feature {
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

describe("isSelectionTool / resolveNavigationForTool", () => {
  it("recognises the three Selection Tools", () => {
    assert.equal(isSelectionTool("select_click"), true);
    assert.equal(isSelectionTool("select_rectangle"), true);
    assert.equal(isSelectionTool("select_lasso"), true);
    assert.equal(isSelectionTool("pan"), false);
    assert.equal(isSelectionTool("point"), false);
  });

  it("turns off drag-pan, Shift+drag zoom and double-click zoom while a Selection Tool is active", () => {
    for (const tool of [
      "select_click",
      "select_rectangle",
      "select_lasso",
    ] as const) {
      assert.deepEqual(resolveNavigationForTool(tool), {
        dragPan: false,
        dragZoom: false,
        doubleClickZoom: false,
      });
    }
  });

  it("leaves drag-pan, Shift+drag zoom and double-click zoom on for Pan and the other tools", () => {
    for (const tool of ["pan", "point", "line", "polygon"] as const) {
      assert.deepEqual(resolveNavigationForTool(tool), {
        dragPan: true,
        dragZoom: true,
        doubleClickZoom: true,
      });
    }
  });
});

describe("resolveClickHits", () => {
  it("returns the id of the topmost Active Layer feature under the pointer", () => {
    const source = new VectorSource();
    source.addFeatures([polygonFeature(1, 0, 100), polygonFeature(2, 50, 150)]);
    assert.deepEqual(resolveClickHits({ source }, [75, 75], 1), [2]);
    assert.deepEqual(resolveClickHits({ source }, [25, 25], 1), [1]);
  });

  it("returns no hits on empty map", () => {
    const source = new VectorSource();
    source.addFeature(polygonFeature(1, 0, 100));
    assert.deepEqual(resolveClickHits({ source }, [500, 500], 1), []);
  });

  it("returns no hits without a valid Active Layer", () => {
    assert.deepEqual(resolveClickHits(null, [0, 0], 1), []);
  });

  it("counts a point's symbol reach as part of the hit area", () => {
    const source = new VectorSource();
    const point = new Feature(new Point([0, 0]));
    point.setId(7);
    source.addFeature(point);
    const layer = { source, symbolReachPx: () => 10 };
    assert.deepEqual(resolveClickHits(layer, [12, 0], 1), [7]);
    assert.deepEqual(resolveClickHits({ source }, [12, 0], 1), []);
  });
});

describe("symbolReachFromStyles", () => {
  it("is the largest point radius or half stroke width of the styles", () => {
    const styles = [
      new Style({ image: new CircleStyle({ radius: 6 }) }),
      new Style({ stroke: new Stroke({ width: 4 }) }),
    ];
    assert.equal(symbolReachFromStyles(styles), 6);
    assert.equal(
      symbolReachFromStyles([new Style({ stroke: new Stroke({ width: 20 }) })]),
      10
    );
    assert.equal(symbolReachFromStyles(undefined), 0);
  });
});

describe("publishFeatureSelection", () => {
  beforeEach(() => {
    selectedFeatureIdsSignal.value = new Set([1, 2]);
  });

  it("replaces, adds or toggles the shared feature selection", () => {
    publishFeatureSelection([3], NONE);
    assert.deepEqual([...selectedFeatureIdsSignal.value], [3]);
    publishFeatureSelection([4], { shift: true, ctrl: false });
    assert.deepEqual([...selectedFeatureIdsSignal.value].sort(), [3, 4]);
    publishFeatureSelection([3], { shift: false, ctrl: true });
    assert.deepEqual([...selectedFeatureIdsSignal.value], [4]);
  });

  it("clears the selection on a plain click on empty map", () => {
    publishFeatureSelection([], NONE);
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });

  it("does not republish the selection when a modified click hits nothing", () => {
    const before = selectedFeatureIdsSignal.value;
    publishFeatureSelection([], { shift: true, ctrl: false });
    publishFeatureSelection([], { shift: false, ctrl: true });
    assert.equal(selectedFeatureIdsSignal.value, before);
  });
});

describe("MapToolInteractions", () => {
  /**
   * @function fakeContext
   * @description Builds a tool context whose navigation calls are recorded.
   * @param {Array<object>} navigation - Receives each applied navigation state.
   * @returns {MapToolContext} Context.
   */
  function fakeContext(navigation: object[]): MapToolContext {
    return {
      map: fromPartial<MapToolContext["map"]>({}),
      getSelectableLayer: () => null,
      setNavigation: (state) => navigation.push(state),
    };
  }

  it("applies the tool's navigation and swaps the tool handler on each tool change", () => {
    const navigation: object[] = [];
    const log: string[] = [];
    const handler: MapToolHandler = () => {
      log.push("activate");
      return () => log.push("deactivate");
    };
    const interactions = new MapToolInteractions(fakeContext(navigation), {
      select_click: handler,
    });

    interactions.setTool("select_click");
    assert.deepEqual(navigation.at(-1), {
      dragPan: false,
      dragZoom: false,
      doubleClickZoom: false,
    });
    assert.deepEqual(log, ["activate"]);

    interactions.setTool("select_click");
    assert.deepEqual(log, ["activate"], "same tool does not reactivate");

    interactions.setTool("pan");
    assert.deepEqual(navigation.at(-1), {
      dragPan: true,
      dragZoom: true,
      doubleClickZoom: true,
    });
    assert.deepEqual(log, ["activate", "deactivate"]);

    interactions.setTool("select_click");
    interactions.dispose();
    assert.deepEqual(log, ["activate", "deactivate", "activate", "deactivate"]);
  });
});

describe("selectByClickAt", () => {
  beforeEach(() => {
    selectedFeatureIdsSignal.value = new Set([1]);
  });

  it("selects the hit feature, or clears the selection on empty map", () => {
    const source = new VectorSource();
    source.addFeature(polygonFeature(5, 0, 100));
    selectByClickAt({ source }, [50, 50], 1, NONE);
    assert.deepEqual([...selectedFeatureIdsSignal.value], [5]);
    selectByClickAt({ source }, [500, 500], 1, NONE);
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });

  it("changes nothing without a valid Active Layer", () => {
    const before = selectedFeatureIdsSignal.value;
    selectByClickAt(null, [50, 50], 1, NONE);
    assert.equal(selectedFeatureIdsSignal.value, before);
  });
});

describe("selectFeaturesInRegion", () => {
  /**
   * @function layerWithSquares
   * @description A selectable layer with squares 1 ([0,10]) and 2 ([20,30]).
   * @returns {{ source: VectorSource }} Layer.
   */
  function layerWithSquares(): { source: VectorSource } {
    const source = new VectorSource();
    source.addFeatures([polygonFeature(1, 0, 10), polygonFeature(2, 20, 30)]);
    return { source };
  }

  beforeEach(() => {
    selectedFeatureIdsSignal.value = new Set([2]);
  });

  it("replaces the selection with the features overlapping the region", () => {
    selectFeaturesInRegion(
      layerWithSquares(),
      createRectangleRegion([5, 5, 15, 15]),
      NONE
    );
    assert.deepEqual([...selectedFeatureIdsSignal.value], [1]);
  });

  it("adds with Shift and toggles each with Ctrl", () => {
    const layer = layerWithSquares();
    const both = createRectangleRegion([5, 5, 25, 25]);
    selectFeaturesInRegion(layer, createRectangleRegion([5, 5, 15, 15]), {
      shift: true,
      ctrl: false,
    });
    assert.deepEqual([...selectedFeatureIdsSignal.value].sort(), [1, 2]);
    selectedFeatureIdsSignal.value = new Set([2]);
    selectFeaturesInRegion(layer, both, { shift: false, ctrl: true });
    assert.deepEqual([...selectedFeatureIdsSignal.value], [1]);
  });

  it("clears the selection when a plain rectangle overlaps nothing", () => {
    selectFeaturesInRegion(
      layerWithSquares(),
      createRectangleRegion([100, 100, 200, 200]),
      NONE
    );
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });

  it("changes nothing without a valid Active Layer", () => {
    const before = selectedFeatureIdsSignal.value;
    selectFeaturesInRegion(null, createRectangleRegion([0, 0, 50, 50]), NONE);
    assert.equal(selectedFeatureIdsSignal.value, before);
  });
});

describe("isSelectionShapeDragStart", () => {
  /**
   * @function down
   * @description A map browser event stand-in carrying a pointer event.
   * @param {object} pointer - Pointer event fields.
   * @returns {any} Event.
   */
  const down = (pointer: object): any => ({
    originalEvent: { pointerId: 1, isPrimary: true, button: 0, ...pointer },
  });

  it("starts on a primary-button drag, also with Shift or Ctrl", () => {
    assert.equal(isSelectionShapeDragStart(down({})), true);
    assert.equal(isSelectionShapeDragStart(down({ shiftKey: true })), true);
    assert.equal(isSelectionShapeDragStart(down({ ctrlKey: true })), true);
  });

  it("does not start on other buttons or with Alt held (Alt+Shift+drag rotates)", () => {
    assert.equal(isSelectionShapeDragStart(down({ button: 2 })), false);
    assert.equal(
      isSelectionShapeDragStart(down({ altKey: true, shiftKey: true })),
      false
    );
  });
});
