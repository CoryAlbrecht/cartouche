/**
 * @file dockLayoutEngine.test.ts
 * @module tests/renderer/workbench/dockLayoutEngine.test
 * @description Unit tests for dockLayoutEngine, validating flex-proportional sizing, minimum dimension floors, sash ratio synchronization, cross-axis unification, and dock transfer ratio resets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @see {@link calculateProportionalSizes}
 * @see {@link recalculateSashRatios}
 * @see {@link syncDockCrossAxis}
 * @see {@link rebalanceDockOnResize}
 * @see {@link detectAndSyncSashDrag}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProportionalSizes,
  recalculateSashRatios,
  syncDockCrossAxis,
  rebalanceDockOnResize,
  detectAndSyncSashDrag,
  transferWidgetDock,
  reorderWidgetDock,
} from '../../../src/renderer/workbench/dockLayoutEngine';
import {
  widgetDocksSignal,
  resetWidgetDocksToDefault,
  getWidgetDockItem,
} from '../../../src/renderer/state/widgetDockSignals';
import type { DockviewApi, IDockviewPanel } from 'dockview-react';

/**
 * Creates a mock DockviewPanel for testing layout operations.
 * @param {string} id - Panel identifier.
 * @param {number} width - Current panel width.
 * @param {number} height - Current panel height.
 * @returns {IDockviewPanel} Mock DockviewPanel.
 */
function createMockPanel(id: string, width: number, height: number): IDockviewPanel {
  const panelState = { width, height };
  const mockPanel = {
    id,
    api: {
      get width() {
        return panelState.width;
      },
      get height() {
        return panelState.height;
      },
      setSize: (size: { width?: number; height?: number }) => {
        if (size.width !== undefined) {
          panelState.width = size.width;
        }
        if (size.height !== undefined) {
          panelState.height = size.height;
        }
      },
    },
  } as unknown as IDockviewPanel;

  return mockPanel;
}

/**
 * Creates a mock DockviewApi populated with panels.
 * @param {IDockviewPanel[]} panels - Panel list.
 * @returns {DockviewApi} Mock DockviewApi.
 */
function createMockDockviewApi(panels: IDockviewPanel[]): DockviewApi {
  const panelMap = new Map<string, IDockviewPanel>();
  panels.forEach((p) => panelMap.set(p.id, p));

  return {
    panels,
    getPanel: (id: string) => panelMap.get(id),
  } as unknown as DockviewApi;
}

describe('dockLayoutEngine', () => {
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
          [name]: {
            displayName: name,
            value,
            category: 'ui',
            type: 'object',
          },
        };
      },
    };
  });

  afterEach(() => {
    if (savedElectronAPI !== undefined) {
      (globalThis as any).window.electronAPI = savedElectronAPI;
    } else if ((globalThis as any).window) {
      delete (globalThis as any).window.electronAPI;
    }
  });

  describe('calculateProportionalSizes', () => {
    it('returns empty array when input items array is empty', () => {
      const result = calculateProportionalSizes([], 800);
      assert.deepEqual(result, []);
    });

    it('allocates full available length to a single item respecting minSize', () => {
      const singleItem = [{ id: 'p1', axisRatio: 1, minSize: 150 }];
      const res1 = calculateProportionalSizes(singleItem, 800);
      assert.deepEqual(res1, [{ id: 'p1', size: 800 }]);

      const res2 = calculateProportionalSizes(singleItem, 100);
      assert.deepEqual(res2, [{ id: 'p1', size: 150 }]);
    });

    it('splits available length evenly between items with equal axis ratios', () => {
      const items = [
        { id: 'w1', axisRatio: 1 },
        { id: 'w2', axisRatio: 1 },
      ];
      const result = calculateProportionalSizes(items, 800);
      assert.deepEqual(result, [
        { id: 'w1', size: 400 },
        { id: 'w2', size: 400 },
      ]);
      const sum = result.reduce((s, r) => s + r.size, 0);
      assert.equal(sum, 800);
    });

    it('splits available length proportionally according to unequal ratios', () => {
      const items = [
        { id: 'w1', axisRatio: 1 },
        { id: 'w2', axisRatio: 3 },
      ];
      const result = calculateProportionalSizes(items, 800);
      assert.deepEqual(result, [
        { id: 'w1', size: 200 },
        { id: 'w2', size: 600 },
      ]);
      const sum = result.reduce((s, r) => s + r.size, 0);
      assert.equal(sum, 800);
    });

    it('enforces minSize floor on constrained item and redistributes remainder proportionally', () => {
      const items = [
        { id: 'w1', axisRatio: 1, minSize: 250 },
        { id: 'w2', axisRatio: 3 },
      ];
      // Ideal without minSize: w1 = 200, w2 = 600
      // With minSize: w1 is clamped to 250, remainder 550 goes to w2
      const result = calculateProportionalSizes(items, 800);
      assert.deepEqual(result, [
        { id: 'w1', size: 250 },
        { id: 'w2', size: 550 },
      ]);
      const sum = result.reduce((s, r) => s + r.size, 0);
      assert.equal(sum, 800);
    });

    it('handles multiple constrained items in 3-panel layout', () => {
      const items = [
        { id: 'w1', axisRatio: 1, minSize: 300 },
        { id: 'w2', axisRatio: 2 },
        { id: 'w3', axisRatio: 1 },
      ];
      // Available 1000. Ideal shares: w1=250, w2=500, w3=250.
      // w1 hits floor 300. Remainder = 700 distributed 2:1 -> w2=467, w3=233.
      const result = calculateProportionalSizes(items, 1000);
      assert.equal(result[0].size, 300);
      assert.equal(result[0].id, 'w1');
      assert.equal(result[1].size, 467);
      assert.equal(result[1].id, 'w2');
      assert.equal(result[2].size, 233);
      assert.equal(result[2].id, 'w3');

      const sum = result.reduce((s, r) => s + r.size, 0);
      assert.equal(sum, 1000);
    });

    it('scales down gracefully when available length is smaller than total minSize', () => {
      const items = [
        { id: 'w1', axisRatio: 1, minSize: 200 },
        { id: 'w2', axisRatio: 1, minSize: 300 },
      ];
      // Total min = 500, available = 400 -> proportional scaling 400 * (200/500) = 160, 400 * (300/500) = 240
      const result = calculateProportionalSizes(items, 400);
      assert.equal(result[0].size, 160);
      assert.equal(result[1].size, 240);
      assert.equal(result[0].size + result[1].size, 400);
    });
  });

  describe('recalculateSashRatios', () => {
    it('preserves total combined ratio between adjacent widgets', () => {
      const { ratio1, ratio2 } = recalculateSashRatios(1, 1, 300, 100);
      assert.equal(ratio1, 1.5);
      assert.equal(ratio2, 0.5);
      assert.equal(ratio1 + ratio2, 2);
    });

    it('updates ratios accurately for unequal initial ratios', () => {
      // initial r1 = 2, r2 = 3 (sum = 5). sizes: 250, 750 (total 1000)
      // new r1 = 5 * (250/1000) = 1.25, new r2 = 5 * (750/1000) = 3.75
      const { ratio1, ratio2 } = recalculateSashRatios(2, 3, 250, 750);
      assert.equal(ratio1, 1.25);
      assert.equal(ratio2, 3.75);
      assert.equal(ratio1 + ratio2, 5);
    });

    it('enforces a minimum ratio floor of 0.01', () => {
      const { ratio1, ratio2 } = recalculateSashRatios(1, 1, 0, 500);
      assert.ok(ratio1 >= 0.01);
      assert.ok(ratio2 > 0);
    });
  });

  describe('syncDockCrossAxis', () => {
    it('synchronizes width across all panels in a vertical dock', () => {
      const p1 = createMockPanel('layer-tree', 260, 300);
      const api = createMockDockviewApi([p1]);

      syncDockCrossAxis('left', 320, api);
      assert.equal(p1.api.width, 320);
    });

    it('synchronizes height across all panels in a horizontal dock', () => {
      const p1 = createMockPanel('attribute-table', 400, 200);
      const p2 = createMockPanel('console', 400, 160);
      const api = createMockDockviewApi([p1, p2]);

      syncDockCrossAxis('bottom', 240, api);
      assert.equal(p1.api.height, 240);
      assert.equal(p2.api.height, 240);
    });
  });

  describe('rebalanceDockOnResize', () => {
    it('rebalances bottom dock widgets along width according to axisRatio', () => {
      const p1 = createMockPanel('attribute-table', 400, 200);
      const p2 = createMockPanel('console', 400, 200);
      const api = createMockDockviewApi([p1, p2]);

      // Make both visible in bottom dock
      widgetDocksSignal.value = {
        ...widgetDocksSignal.value,
        bottom: [
          {
            id: 'attribute-table',
            dock: 'bottom',
            order: 0,
            axisRatio: 1,
            dimensions: { height: 200 },
            visible: true,
            isOverlapContainer: false,
          },
          {
            id: 'console',
            dock: 'bottom',
            order: 1,
            axisRatio: 3,
            dimensions: { height: 200 },
            visible: true,
            isOverlapContainer: false,
          },
        ],
      };

      // Available width 1000px, 1:3 ratio with minWidth 150px
      rebalanceDockOnResize('bottom', 1000, api);

      assert.equal(p1.api.width, 250);
      assert.equal(p2.api.width, 750);
    });
  });

  describe('detectAndSyncSashDrag', () => {
    it('detects boundary sash drag and updates cross-axis dimension', async () => {
      const p1 = createMockPanel('layer-tree', 310, 400);
      const api = createMockDockviewApi([p1]);

      const changed = await detectAndSyncSashDrag('left', api);
      assert.equal(changed, true);

      const updated = getWidgetDockItem('layer-tree');
      assert.equal(updated?.item.dimensions.width, 310);
    });

    it('detects divider sash drag between adjacent panels and updates axisRatio', async () => {
      const p1 = createMockPanel('attribute-table', 600, 200);
      const p2 = createMockPanel('console', 200, 200);
      const api = createMockDockviewApi([p1, p2]);

      // Set initial state with ratio 1:1 and visible = true
      widgetDocksSignal.value = {
        ...widgetDocksSignal.value,
        bottom: [
          {
            id: 'attribute-table',
            dock: 'bottom',
            order: 0,
            axisRatio: 1,
            dimensions: { height: 200 },
            visible: true,
            isOverlapContainer: false,
          },
          {
            id: 'console',
            dock: 'bottom',
            order: 1,
            axisRatio: 1,
            dimensions: { height: 200 },
            visible: true,
            isOverlapContainer: false,
          },
        ],
      };

      const changed = await detectAndSyncSashDrag('bottom', api);
      assert.equal(changed, true);

      const attrItem = getWidgetDockItem('attribute-table');
      const consoleItem = getWidgetDockItem('console');

      // 600 vs 200 from initial ratio 1:1 (sum 2) -> ratio1 = 1.5, ratio2 = 0.5
      assert.equal(attrItem?.item.axisRatio, 1.5);
      assert.equal(consoleItem?.item.axisRatio, 0.5);
    });
  });

  describe('dock transfer and reordering', () => {
    it('preserves axisRatio when reordering within the same dock', async () => {
      widgetDocksSignal.value = {
        ...widgetDocksSignal.value,
        bottom: [
          {
            id: 'attribute-table',
            dock: 'bottom',
            order: 0,
            axisRatio: 1.8,
            dimensions: { height: 200 },
            visible: true,
            isOverlapContainer: false,
          },
          {
            id: 'console',
            dock: 'bottom',
            order: 1,
            axisRatio: 0.2,
            dimensions: { height: 200 },
            visible: true,
            isOverlapContainer: false,
          },
        ],
      };

      await reorderWidgetDock('bottom', 0, 1);

      const first = widgetDocksSignal.value.bottom[0];
      const second = widgetDocksSignal.value.bottom[1];

      assert.equal(first.id, 'console');
      assert.equal(first.axisRatio, 0.2);
      assert.equal(second.id, 'attribute-table');
      assert.equal(second.axisRatio, 1.8);
    });

    it('resets axisRatio to 1 when transferring a widget to a different dock', async () => {
      widgetDocksSignal.value = {
        ...widgetDocksSignal.value,
        bottom: [
          {
            id: 'console',
            dock: 'bottom',
            order: 0,
            axisRatio: 2.5,
            dimensions: { height: 200 },
            visible: true,
            isOverlapContainer: false,
          },
        ],
      };

      await transferWidgetDock('console', 'right');

      const transferred = getWidgetDockItem('console');
      assert.equal(transferred?.dock, 'right');
      assert.equal(transferred?.item.axisRatio, 1);
    });
  });
});
