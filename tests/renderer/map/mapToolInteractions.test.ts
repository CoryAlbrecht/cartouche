/**
 * @file mapToolInteractions.test.ts
 * @module tests/renderer/map/mapToolInteractions.test
 * @description Tests for the tool-driven map interactions: which default navigation gestures each map tool leaves on (Selection Tools turn off drag-pan and Shift+drag zoom), how Select by Click resolves a click to the Active Layer's topmost feature, how a gesture's hits are published to the shared feature selection, how Select by Rectangle selects the features overlapping its rectangle and which drags start a Selection Shape, how Select by Lasso selects what its freehand outline encloses under the Lasso Fill Rule (with release modifiers, Escape, pass-through of other buttons and Alt drags, and no selectable layer), and how the tool's handler is swapped as the active tool changes.
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
import Target from "ol/events/Target.js";
import View from "ol/View.js";
import type Interaction from "ol/interaction/Interaction.js";
import {
  selectedFeatureIdsSignal,
  selectionTargetSignal,
  vertexEditorModeSignal,
} from "../../../src/renderer/state/gisSignals";
import { preferencesMapSignal } from "../../../src/renderer/state/preferencesSignals";
import { cancelSelectionShape } from "../../../src/renderer/map/selectionShapeCancel";
import {
  activateSelectByLasso,
  MAP_TOOL_HANDLERS,
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

describe("activateSelectByLasso", () => {
  /**
   * @class FakeMap
   * @description The parts of an OpenLayers map the lasso's Draw interaction touches, with pixels equal to map coordinates; records added interactions.
   */
  class FakeMap extends Target {
    readonly view = new View({ center: [0, 0], resolution: 1 });
    readonly interactions: Interaction[] = [];
    /** @returns {View} The view. */
    getView(): View {
      return this.view;
    }
    /** @returns {void} */
    render(): void {}
    /** @returns {undefined} No DOM target in tests. */
    getTargetElement(): undefined {
      return undefined;
    }
    /**
     * @param {number[]} coordinate - Map coordinate.
     * @returns {number[]} The same pixel.
     */
    getPixelFromCoordinate(coordinate: number[]): number[] {
      return coordinate.slice();
    }
    /**
     * @param {Interaction} interaction - Interaction to add.
     * @returns {void}
     */
    addInteraction(interaction: Interaction): void {
      this.interactions.push(interaction);
      interaction.setMap(fromPartial(this));
    }
    /**
     * @param {Interaction} interaction - Interaction to remove.
     * @returns {void}
     */
    removeInteraction(interaction: Interaction): void {
      const i = this.interactions.indexOf(interaction);
      if (i >= 0) this.interactions.splice(i, 1);
      interaction.setMap(null);
    }
  }

  /**
   * @function pointer
   * @description A map browser event stand-in (pixel = coordinate) for the lasso interaction.
   * @param {FakeMap} map - Map.
   * @param {string} type - Map browser event type.
   * @param {number[]} at - Coordinate.
   * @param {object} [extra] - Extra pointer event fields (button, modifiers).
   * @returns {any} Event.
   */
  const pointer = (
    map: FakeMap,
    type: string,
    at: number[],
    extra: object = {}
  ): any => ({
    type,
    map,
    coordinate: at.slice(),
    pixel: at.slice(),
    frameState: null,
    preventDefault() {},
    originalEvent: {
      type: type === "pointerdrag" ? "pointermove" : type,
      pointerId: 1,
      isPrimary: true,
      button: type === "pointerdrag" || type === "pointermove" ? -1 : 0,
      pointerType: "mouse",
      preventDefault() {},
      ...extra,
    },
  });

  /**
   * @function drag
   * @description Moves the pressed primary pointer to a coordinate: OpenLayers relays a `pointermove` and then a `pointerdrag` for each move during a drag.
   * @param {Interaction} lasso - The lasso interaction.
   * @param {FakeMap} map - Map.
   * @param {number[]} at - Coordinate.
   * @returns {void}
   */
  function drag(lasso: Interaction, map: FakeMap, at: number[]): void {
    lasso.handleEvent(pointer(map, "pointermove", at));
    lasso.handleEvent(pointer(map, "pointerdrag", at));
  }

  /**
   * @function pentagram
   * @description A one-stroke five-pointed star of radius 10 around the origin.
   * @returns {number[][]} Tips in stroke order.
   */
  function pentagram(): number[][] {
    const tips = [0, 1, 2, 3, 4].map((i) => {
      const angle = Math.PI / 2 + (i * 2 * Math.PI) / 5;
      return [10 * Math.cos(angle), 10 * Math.sin(angle)];
    });
    return [0, 2, 4, 1, 3].map((i) => tips[i]);
  }

  /**
   * @function trace
   * @description Drags a lasso through the outline's points with the primary button and releases at its start.
   * @param {Interaction} lasso - The lasso interaction.
   * @param {FakeMap} map - Map.
   * @param {number[][]} outline - Outline points.
   * @param {object} [release] - Modifiers held at release.
   * @returns {void}
   */
  function trace(
    lasso: Interaction,
    map: FakeMap,
    outline: number[][],
    release: object = {}
  ): void {
    lasso.handleEvent(pointer(map, "pointerdown", outline[0]));
    for (const at of [...outline.slice(1), outline[0], outline[0]]) {
      drag(lasso, map, at);
    }
    lasso.handleEvent(pointer(map, "pointerup", outline[0], release));
  }

  /**
   * @function setUp
   * @description Activates Select by Lasso on a fake map whose Active Layer holds a point at the star's centre (id 1) and one in its top tip (id 2).
   * @param {boolean} [selectable=true] - Whether there is a valid Active Layer.
   * @returns {{ map: FakeMap, lasso: Interaction, deactivate: () => void }} Fixture.
   */
  function setUp(selectable = true): {
    map: FakeMap;
    lasso: Interaction;
    deactivate: () => void;
  } {
    const source = new VectorSource();
    const centre = new Feature(new Point([0, 0]));
    centre.setId(1);
    const tip = new Feature(new Point([0, 8]));
    tip.setId(2);
    source.addFeatures([centre, tip]);
    const map = new FakeMap();
    const deactivate = activateSelectByLasso({
      map: fromPartial(map),
      getSelectableLayer: () => (selectable ? { source } : null),
      setNavigation: () => {},
    });
    assert.equal(map.interactions.length, 1, "adds one interaction");
    return { map, lasso: map.interactions[0], deactivate };
  }

  beforeEach(() => {
    selectedFeatureIdsSignal.value = new Set([99]);
    vertexEditorModeSignal.value = false;
    preferencesMapSignal.value = {};
  });

  it("is Select by Lasso's handler", () => {
    assert.equal(
      MAP_TOOL_HANDLERS.select_lasso === activateSelectByLasso,
      true
    );
  });

  it("selects what a pentagram encloses under Even-Odd (default): the tip, not the centre", () => {
    const { map, lasso } = setUp();
    trace(lasso, map, pentagram());
    assert.deepEqual([...selectedFeatureIdsSignal.value], [2]);
  });

  it("selects the pentagram's centre too under Non-Zero, read when the lasso starts", () => {
    const { map, lasso } = setUp();
    preferencesMapSignal.value = {
      "mapTools.selection.lassoFillRule": fromPartial({ value: "nonzero" }),
    };
    trace(lasso, map, pentagram());
    assert.deepEqual([...selectedFeatureIdsSignal.value].sort(), [1, 2]);
  });

  it("merges with the Shift held at release", () => {
    const { map, lasso } = setUp();
    trace(lasso, map, pentagram(), { shiftKey: true });
    assert.deepEqual([...selectedFeatureIdsSignal.value].sort(), [2, 99]);
  });

  it("discards the shape on Escape mid-drag, then lassos normally again", () => {
    const { map, lasso } = setUp();
    const before = selectedFeatureIdsSignal.value;
    const star = pentagram();
    lasso.handleEvent(pointer(map, "pointerdown", star[0]));
    drag(lasso, map, star[1]);
    assert.equal(cancelSelectionShape(), true, "a shape was in progress");
    for (const at of star.slice(2)) {
      drag(lasso, map, at);
    }
    lasso.handleEvent(pointer(map, "pointerup", star[0]));
    assert.equal(selectedFeatureIdsSignal.value === before, true);
    assert.equal(cancelSelectionShape(), false, "nothing left to cancel");

    trace(lasso, map, star);
    assert.deepEqual([...selectedFeatureIdsSignal.value], [2]);
  });

  it("lets other buttons and Alt drags through without drawing", () => {
    const { map, lasso } = setUp();
    const before = selectedFeatureIdsSignal.value;
    const right = lasso.handleEvent(
      pointer(map, "pointerdown", [0, 0], { button: 2 })
    );
    assert.equal(right, true, "right-button down passes on");
    assert.equal(cancelSelectionShape(), false, "no shape started");
    lasso.handleEvent(pointer(map, "pointerup", [0, 0], { button: 2 }));
    const alt = lasso.handleEvent(
      pointer(map, "pointerdown", [0, 0], { altKey: true, shiftKey: true })
    );
    assert.equal(alt, true, "Alt+Shift down passes on (rotation)");
    assert.equal(selectedFeatureIdsSignal.value === before, true);
  });

  it("draws but selects nothing without a valid Active Layer or while the Selection Target is vertices", () => {
    const before = selectedFeatureIdsSignal.value;
    const noLayer = setUp(false);
    noLayer.lasso.handleEvent(
      pointer(noLayer.map, "pointerdown", pentagram()[0])
    );
    assert.equal(cancelSelectionShape(), true, "the shape is drawn");
    noLayer.lasso.handleEvent(
      pointer(noLayer.map, "pointerup", pentagram()[0])
    );
    trace(noLayer.lasso, noLayer.map, pentagram());
    assert.equal(selectedFeatureIdsSignal.value === before, true);

    vertexEditorModeSignal.value = true;
    assert.equal(selectionTargetSignal.value, "vertices");
    const vertices = setUp();
    trace(vertices.lasso, vertices.map, pentagram());
    assert.equal(selectedFeatureIdsSignal.value === before, true);
  });

  it("removes its interaction and abandons a drag in progress on deactivation", () => {
    const { map, lasso, deactivate } = setUp();
    lasso.handleEvent(pointer(map, "pointerdown", [0, 10]));
    deactivate();
    assert.equal(map.interactions.length, 0);
    assert.equal(cancelSelectionShape(), false, "no shape left registered");
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
