/**
 * @file workbenchResizePolicy.test.ts
 * @module tests/renderer/workbench/workbenchResizePolicy.test
 * @description Unit tests for the Workbench window resize policy: the equal-share shortfall arithmetic, per-axis dock depth resolution, the window minimum computation, map viewport group priority, and a layout pass over a simulated proportional Dockview layout.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link shareShortfall}
 * @see {@link resolveAxisDepths}
 * @see {@link computeWorkbenchMinimumSize}
 * @see {@link layoutWorkbenchGrid}
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  MAP_VIEWPORT_MIN_SIZE,
  shareShortfall,
  resolveAxisDepths,
  computeWorkbenchMinimumSize,
  computeGridMinimum,
  applyGroupLayoutPriority,
  layoutWorkbenchGrid,
  isSqueezedDockDepth,
} from "../../../src/renderer/workbench/workbenchResizePolicy";
import { widgetDocksSignal } from "../../../src/renderer/state/widgetDockSignals";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { DockviewApi, DockviewGroupPanel } from "dockview-react";
import type { WidgetDockItem } from "../../../src/shared/types";

describe("shareShortfall", () => {
  it("takes equal shares from two docks", () => {
    assert.deepEqual(
      shareShortfall(8, [
        { depth: 300, floor: 100 },
        { depth: 200, floor: 100 },
      ]),
      [296, 196]
    );
  });

  it("gives an odd pixel to the earlier dock", () => {
    assert.deepEqual(
      shareShortfall(5, [
        { depth: 300, floor: 100 },
        { depth: 200, floor: 100 },
      ]),
      [297, 198]
    );
  });

  it("moves the rest to the other dock once one reaches its floor", () => {
    assert.deepEqual(
      shareShortfall(40, [
        { depth: 105, floor: 100 },
        { depth: 200, floor: 100 },
      ]),
      [100, 165]
    );
  });

  it("stops at the floors when the shortfall is larger than the room", () => {
    assert.deepEqual(
      shareShortfall(1000, [
        { depth: 150, floor: 100 },
        { depth: 200, floor: 120 },
      ]),
      [100, 120]
    );
  });

  it("takes the whole shortfall from a single dock", () => {
    assert.deepEqual(shareShortfall(30, [{ depth: 200, floor: 64 }]), [170]);
  });

  it("leaves a dock already below its floor alone", () => {
    assert.deepEqual(
      shareShortfall(10, [
        { depth: 80, floor: 100 },
        { depth: 200, floor: 100 },
      ]),
      [80, 190]
    );
  });
});

describe("resolveAxisDepths", () => {
  it("keeps the intended depths while the map viewport stays above its minimum", () => {
    assert.deepEqual(
      resolveAxisDepths({
        mapSize: 500,
        mapMin: 256,
        docks: [
          { current: 240, intended: 260, floor: 150 },
          { current: 180, intended: 200, floor: 150 },
        ],
      }),
      [260, 200]
    );
  });

  it("shares the map viewport's shortfall equally between the docks", () => {
    // Restored to 260 and 200, the map would be 292 - 20 - 20 = 252: 4 px short.
    assert.deepEqual(
      resolveAxisDepths({
        mapSize: 292,
        mapMin: 256,
        docks: [
          { current: 240, intended: 260, floor: 150 },
          { current: 180, intended: 200, floor: 150 },
        ],
      }),
      [258, 198]
    );
    assert.deepEqual(
      resolveAxisDepths({
        mapSize: 248,
        mapMin: 256,
        docks: [
          { current: 260, intended: 260, floor: 150 },
          { current: 200, intended: 200, floor: 150 },
        ],
      }),
      [256, 196]
    );
  });
});

describe("computeWorkbenchMinimumSize", () => {
  it("adds the fixed bars around the Dockview layout to its minimum", () => {
    assert.deepEqual(
      computeWorkbenchMinimumSize({
        gridMinWidth: 256 + 512.4,
        gridMinHeight: 640,
        viewportWidth: 1400,
        viewportHeight: 900,
        gridWidth: 1340,
        gridHeight: 800,
      }),
      { width: 829, height: 740 }
    );
  });
});

describe("computeGridMinimum", () => {
  /**
   * Builds a leaf node.
   * @param {number} w - Minimum width.
   * @param {number} h - Minimum height.
   * @returns {object} Leaf node.
   */
  const leaf = (w: number, h: number) => ({
    view: { minimumWidth: w, minimumHeight: h },
  });

  it("adds a left dock's widget minimum heights (256 + 128 + 128 = 512)", () => {
    const root = {
      orientation: "HORIZONTAL",
      children: [
        {
          orientation: "VERTICAL",
          children: [leaf(150, 256), leaf(150, 128), leaf(150, 128)],
        },
        leaf(256, 291),
      ],
    };
    assert.deepEqual(computeGridMinimum(root), { width: 406, height: 512 });
  });

  it("adds a bottom dock's widget minimum widths (256 + 256 + 64 + 64 = 640)", () => {
    const root = {
      orientation: "VERTICAL",
      children: [
        leaf(256, 291),
        {
          orientation: "HORIZONTAL",
          children: [
            leaf(256, 120),
            leaf(256, 120),
            leaf(64, 120),
            leaf(64, 120),
          ],
        },
      ],
    };
    assert.deepEqual(computeGridMinimum(root), { width: 640, height: 411 });
  });

  it("skips hidden children", () => {
    const root = {
      orientation: "HORIZONTAL",
      children: [leaf(150, 100), leaf(256, 291)],
      isChildVisible: (i: number) => i === 1,
    };
    assert.deepEqual(computeGridMinimum(root), { width: 256, height: 291 });
  });
});

describe("applyGroupLayoutPriority", () => {
  it("reports high while the group holds a map viewport and low otherwise", () => {
    const source = { panels: [{ id: "map-viewport" }] };
    const group = fromAny<DockviewGroupPanel, typeof source>(source);
    applyGroupLayoutPriority(group);
    assert.equal(group.priority, "high");
    source.panels = [{ id: "layer-tree" }];
    assert.equal(group.priority, "low");
    applyGroupLayoutPriority(group);
    assert.equal(group.priority, "low");
  });
});

/**
 * @typedef {Object} SimGroup
 * @description A group in the simulated one-row layout [left, map, right].
 * @property {string} id - Group id.
 * @property {number} width - Current width.
 * @property {number} minimumWidth - Minimum width.
 */
interface SimGroup {
  id: string;
  width: number;
  minimumWidth: number;
}

/**
 * Builds a simulated Dockview layout of one row: left dock, map viewport, right dock. `layout()` scales every group in proportion (as Dockview does); `setSize()` on a dock gives or takes the difference from the map viewport, which has high priority.
 * @param {number} left - Left dock width.
 * @param {number} map - Map viewport width.
 * @param {number} right - Right dock width.
 * @param {number} floor - Each dock's minimum width.
 * @returns {{ api: DockviewApi; groups: Record<string, SimGroup> }} The simulated API and its groups.
 */
function createSimulatedGrid(
  left: number,
  map: number,
  right: number,
  floor: number
): { api: DockviewApi; groups: Record<string, SimGroup> } {
  const groups: Record<string, SimGroup> = {
    left: { id: "left", width: left, minimumWidth: floor },
    map: { id: "map", width: map, minimumWidth: MAP_VIEWPORT_MIN_SIZE },
    right: { id: "right", width: right, minimumWidth: floor },
  };
  const order = ["left", "map", "right"];

  const makeGroup = (key: string, panelId: string) => {
    const g = groups[key];
    const group: any = {
      panels: [{ id: panelId }],
      get minimumWidth() {
        return g.minimumWidth;
      },
      minimumHeight: 0,
      api: {
        get width() {
          return g.width;
        },
        height: 600,
        setSize: ({ width }: { width?: number }) => {
          if (width === undefined) return;
          const w = Math.max(g.minimumWidth, width);
          groups.map.width -= w - g.width;
          g.width = w;
        },
        setConstraints: ({ minimumWidth }: { minimumWidth: number }) => {
          g.minimumWidth = minimumWidth;
        },
      },
    };
    group.element = { querySelector: () => null };
    return group;
  };

  const groupObjects = {
    left: makeGroup("left", "layer-tree"),
    map: makeGroup("map", "map-viewport"),
    right: makeGroup("right", "attribute-table"),
  };
  const panels: Record<string, any> = {
    "layer-tree": { group: groupObjects.left },
    "attribute-table": { group: groupObjects.right },
    "map-viewport": { group: groupObjects.map },
  };

  const api = fromAny<DockviewApi, object>({
    groups: Object.values(groupObjects),
    getPanel: (id: string) => panels[id],
    layout: (width: number) => {
      const total = order.reduce((s, k) => s + groups[k].width, 0);
      let used = 0;
      for (const k of order.slice(0, -1)) {
        groups[k].width = Math.round((groups[k].width * width) / total);
        used += groups[k].width;
      }
      groups.right.width = width - used;
    },
  });

  return { api, groups };
}

/**
 * Builds a visible dock entry for a widget.
 * @param {string} id - Widget id.
 * @param {"left" | "right"} dock - Its dock.
 * @param {number} width - Its stored width.
 * @returns {WidgetDockItem} The dock entry.
 */
function dockItem(
  id: string,
  dock: "left" | "right",
  width: number
): WidgetDockItem {
  return fromPartial<WidgetDockItem>({
    id,
    dock,
    order: 0,
    axisRatio: 1,
    visible: true,
    isOverlapContainer: false,
    dimensions: { width },
  });
}

describe("layoutWorkbenchGrid", () => {
  beforeEach(() => {
    widgetDocksSignal.value = {
      left: [dockItem("layer-tree", "left", 260)],
      right: [dockItem("attribute-table", "right", 200)],
      top: [],
      bottom: [],
    };
  });

  it("gives the whole width change to the map viewport", () => {
    const { api, groups } = createSimulatedGrid(260, 700, 200, 150);
    layoutWorkbenchGrid(api, 1000, 600);
    assert.deepEqual(
      [groups.left.width, groups.map.width, groups.right.width],
      [260, 540, 200]
    );
    layoutWorkbenchGrid(api, 1300, 600);
    assert.deepEqual(
      [groups.left.width, groups.map.width, groups.right.width],
      [260, 840, 200]
    );
  });

  it("shrinks both docks equally once the map viewport is at its minimum", () => {
    const { api, groups } = createSimulatedGrid(260, 256, 200, 150);
    layoutWorkbenchGrid(api, 716 - 8, 600);
    assert.deepEqual(
      [groups.left.width, groups.map.width, groups.right.width],
      [256, 256, 196]
    );
  });

  it("keeps the depth of an open widget whose dock entry still says hidden", () => {
    widgetDocksSignal.value = {
      ...widgetDocksSignal.value,
      right: [{ ...dockItem("attribute-table", "right", 200), visible: false }],
    };
    const { api, groups } = createSimulatedGrid(260, 700, 200, 150);
    layoutWorkbenchGrid(api, 1300, 600);
    assert.deepEqual(
      [groups.left.width, groups.map.width, groups.right.width],
      [260, 840, 200]
    );
  });

  it("records squeezed depths so they are not stored as the user's dock dimension", () => {
    const { api } = createSimulatedGrid(260, 256, 200, 150);
    layoutWorkbenchGrid(api, 716 - 8, 600);
    assert.equal(isSqueezedDockDepth("left", 256), true);
    assert.equal(isSqueezedDockDepth("right", 196), true);
    assert.equal(isSqueezedDockDepth("right", 200), false);
  });

  it("does not grow a squeezed dock back when the window grows", () => {
    const { api, groups } = createSimulatedGrid(260, 256, 200, 150);
    layoutWorkbenchGrid(api, 700, 600);
    layoutWorkbenchGrid(api, 900, 600);
    assert.deepEqual(
      [groups.left.width, groups.map.width, groups.right.width],
      [252, 456, 192]
    );
  });
});
