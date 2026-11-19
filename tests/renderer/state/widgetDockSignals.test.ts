/**
 * @file widgetDockSignals.test.ts
 * @module tests/renderer/state/widgetDockSignals.test
 * @description Unit tests for widgetDockSignals store, verifying dock item retrieval, ratio updates, reordering, inter-dock transfers, visibility toggling, and preference hydration, which drops the removed Console Panel (#362).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link widgetDocksSignal}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  widgetDocksSignal,
  getWidgetDockItem,
  updateWidgetDockRatio,
  reorderWidgetInDock,
  moveWidgetToDock,
  setWidgetDockItemVisibility,
  hydrateWidgetDocksFromPreferences,
  resetWidgetDocksToDefault,
} from "../../../src/renderer/state/widgetDockSignals";
import {
  DEFAULT_WORKBENCH_WIDGET_DOCKS,
  type WorkbenchWidgetDocksState,
  type PreferenceMap,
} from "../../../src/shared/types";

describe("widgetDockSignals Reactive Store & Helper Operations", () => {
  let savedElectronAPI: any;
  const recordedPreferenceCalls: Array<{ key: string; value: any }> = [];

  beforeEach(() => {
    resetWidgetDocksToDefault();
    recordedPreferenceCalls.length = 0;

    savedElectronAPI = (globalThis as any).window?.electronAPI;
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.electronAPI = {
      setPreferenceValue: async (name: string, value: any) => {
        recordedPreferenceCalls.push({ key: name, value });
        return {
          [name]: { displayName: name, value, category: "ui", type: "object" },
        };
      },
    };
  });

  afterEach(() => {
    resetWidgetDocksToDefault();
    if ((globalThis as any).window) {
      (globalThis as any).window.electronAPI = savedElectronAPI;
    }
  });

  it("initializes widgetDocksSignal matching DEFAULT_WORKBENCH_WIDGET_DOCKS", () => {
    assert.deepStrictEqual(
      widgetDocksSignal.value,
      DEFAULT_WORKBENCH_WIDGET_DOCKS
    );
  });

  it("getWidgetDockItem locates items by id across all four perimeter dock zones", () => {
    const layerTreeMatch = getWidgetDockItem("layer-tree");
    assert.ok(layerTreeMatch, "layer-tree must be located");
    assert.strictEqual(layerTreeMatch.dock, "left");
    assert.strictEqual(layerTreeMatch.index, 0);
    assert.strictEqual(layerTreeMatch.item.id, "layer-tree");

    const timeFilterMatch = getWidgetDockItem("time-filter");
    assert.ok(timeFilterMatch, "time-filter must be located");
    assert.strictEqual(timeFilterMatch.dock, "top");
    assert.strictEqual(timeFilterMatch.index, 0);

    const attrMatch = getWidgetDockItem("attribute-table");
    assert.ok(attrMatch, "attribute-table must be located");
    assert.strictEqual(attrMatch.dock, "bottom");
    assert.strictEqual(attrMatch.index, 0);

    const unknownMatch = getWidgetDockItem("non-existent-widget");
    assert.strictEqual(unknownMatch, undefined);
  });

  it("updateWidgetDockRatio adjusts axisRatio, enforces minimum floor of 0.01, and updates preference", async () => {
    await updateWidgetDockRatio("layer-tree", 2.5);

    const updated = getWidgetDockItem("layer-tree");
    assert.ok(updated);
    assert.strictEqual(updated.item.axisRatio, 2.5);

    // Verify negative or zero values are clamped to floor 0.01
    await updateWidgetDockRatio("layer-tree", -0.5);
    const clamped = getWidgetDockItem("layer-tree");
    assert.ok(clamped);
    assert.strictEqual(clamped.item.axisRatio, 0.01);

    assert.ok(recordedPreferenceCalls.length >= 2);
    assert.strictEqual(
      recordedPreferenceCalls[0].key,
      "ui.workbench.widgetDocks"
    );
  });

  it("reorderWidgetInDock reorders items within the same dock and recalculates sequential orders", async () => {
    // Bottom dock: [0: attribute-table, 1: time-filter] -> swap to [0: time-filter, 1: attribute-table]
    await moveWidgetToDock("time-filter", "bottom");
    await reorderWidgetInDock("bottom", 0, 1);

    const bottomItems = widgetDocksSignal.value.bottom;
    assert.strictEqual(bottomItems.length, 2);
    assert.strictEqual(bottomItems[0].id, "time-filter");
    assert.strictEqual(bottomItems[0].order, 0);
    assert.strictEqual(bottomItems[1].id, "attribute-table");
    assert.strictEqual(bottomItems[1].order, 1);

    // Swap back
    await reorderWidgetInDock("bottom", 1, 0);
    const reverted = widgetDocksSignal.value.bottom;
    assert.strictEqual(reverted[0].id, "attribute-table");
    assert.strictEqual(reverted[0].order, 0);
    assert.strictEqual(reverted[1].id, "time-filter");
    assert.strictEqual(reverted[1].order, 1);
  });

  it("moveWidgetToDock transfers widget to a different dock, resets axisRatio to 1, and updates orders", async () => {
    // Bottom dock: [0: attribute-table, 1: time-filter]; set time-filter axisRatio to 3 before transferring
    await moveWidgetToDock("time-filter", "bottom");
    await updateWidgetDockRatio("time-filter", 3);

    // Transfer time-filter from 'bottom' to 'right'
    await moveWidgetToDock("time-filter", "right");

    const rightItems = widgetDocksSignal.value.right;
    assert.strictEqual(rightItems.length, 1);
    assert.strictEqual(rightItems[0].id, "time-filter");
    assert.strictEqual(rightItems[0].dock, "right");
    assert.strictEqual(rightItems[0].order, 0);
    assert.strictEqual(
      rightItems[0].axisRatio,
      1,
      "axisRatio must reset to 1 when moving to another dock"
    );

    // Bottom dock should now have only attribute-table with order 0
    const bottomItems = widgetDocksSignal.value.bottom;
    assert.strictEqual(bottomItems.length, 1);
    assert.strictEqual(bottomItems[0].id, "attribute-table");
    assert.strictEqual(bottomItems[0].order, 0);
  });

  it("setWidgetDockItemVisibility updates visible state and persists to preferences", async () => {
    const initialAttr = getWidgetDockItem("attribute-table");
    assert.ok(initialAttr);
    assert.strictEqual(initialAttr.item.visible, false);

    await setWidgetDockItemVisibility("attribute-table", true);

    const visibleAttr = getWidgetDockItem("attribute-table");
    assert.ok(visibleAttr);
    assert.strictEqual(visibleAttr.item.visible, true);
  });

  it("hydrateWidgetDocksFromPreferences synchronizes state from loaded PreferenceMap", () => {
    const customDocks: WorkbenchWidgetDocksState = {
      left: [],
      right: [
        {
          id: "layer-tree",
          dock: "right",
          order: 0,
          axisRatio: 1.5,
          dimensions: { width: 300 },
          visible: true,
          isOverlapContainer: false,
        },
      ],
      top: [],
      bottom: [],
    };

    const mockPrefs: PreferenceMap = {
      "ui.workbench.widgetDocks": {
        displayName: "Docks",
        value: customDocks,
        category: "ui",
        type: "object",
      },
    };

    hydrateWidgetDocksFromPreferences(mockPrefs);

    assert.deepStrictEqual(widgetDocksSignal.value, customDocks);
    assert.strictEqual(widgetDocksSignal.value.right[0].id, "layer-tree");
  });

  it("hydrateWidgetDocksFromPreferences drops the removed Console Panel from saved docks and overlap containers (#362)", () => {
    const item = (id: string, order: number, extra = {}) => ({
      id,
      dock: "bottom" as const,
      order,
      axisRatio: 1,
      dimensions: {},
      visible: true,
      isOverlapContainer: false,
      ...extra,
    });
    const saved: WorkbenchWidgetDocksState = {
      left: [],
      right: [],
      top: [],
      bottom: [
        item("console", 0),
        item("attribute-table", 1),
        item("overlap-1", 2, {
          isOverlapContainer: true,
          tabChildren: ["console", "layer-tree"],
          activeTabId: "console",
        }),
      ],
    };

    hydrateWidgetDocksFromPreferences({
      "ui.workbench.widgetDocks": {
        displayName: "Docks",
        value: saved,
        category: "ui",
        type: "object",
      },
    });

    const bottom = widgetDocksSignal.value.bottom;
    assert.deepEqual(
      bottom.map((i) => [i.id, i.order]),
      [
        ["attribute-table", 0],
        ["overlap-1", 1],
      ]
    );
    assert.deepEqual(bottom[1].tabChildren, ["layer-tree"]);
    assert.equal(bottom[1].activeTabId, "layer-tree");
  });

  it("resetWidgetDocksToDefault restores original default layout", async () => {
    await updateWidgetDockRatio("layer-tree", 4);
    await moveWidgetToDock("attribute-table", "top");

    resetWidgetDocksToDefault();
    assert.deepStrictEqual(
      widgetDocksSignal.value,
      DEFAULT_WORKBENCH_WIDGET_DOCKS
    );
  });
});
