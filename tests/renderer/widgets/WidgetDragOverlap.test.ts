/**
 * @file WidgetDragOverlap.test.ts
 * @module tests/renderer/widgets/WidgetDragOverlap.test
 * @description Integration tests for drag-and-drop overlap creation, tab appending, tab extraction, visual drop cues, and layout persistence.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @see {@link resolveWidgetDropZone}
 * @see {@link createOverlapContainer}
 * @see {@link appendTabToOverlapContainer}
 * @see {@link extractTabFromOverlapContainer}
 * @see {@link dissolveOverlapContainer}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWidgetDropZone } from '../../../src/renderer/workbench/widgets/widgetDropTarget';
import {
  widgetDocksSignal,
  resetWidgetDocksToDefault,
  getWidgetDockItem,
  createOverlapContainer,
  appendTabToOverlapContainer,
  extractTabFromOverlapContainer,
  dissolveOverlapContainer,
} from '../../../src/renderer/state/widgetDockSignals';

describe('WidgetDragOverlap Integration', () => {
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

  describe('resolveWidgetDropZone', () => {
    const targetRect = { top: 100, left: 100, width: 400, height: 400 };

    it('returns "none" when pointer is outside widget bounds', () => {
      const zone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 50,
        clientY: 50,
        targetOverlappable: true,
        draggedOverlappable: true,
      });
      assert.equal(zone, 'none');
    });

    it('returns "none" when dropping a widget onto itself', () => {
      const zone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 300,
        clientY: 300,
        targetOverlappable: true,
        draggedOverlappable: true,
        draggedWidgetId: 'layer-tree',
        targetWidgetId: 'layer-tree',
      });
      assert.equal(zone, 'none');
    });

    it('returns perimeter edge zones when pointer is near edges', () => {
      // Top edge
      const topZone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 300,
        clientY: 110,
        targetOverlappable: true,
        draggedOverlappable: true,
      });
      assert.equal(topZone, 'edge-top');

      // Bottom edge
      const bottomZone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 300,
        clientY: 490,
        targetOverlappable: true,
        draggedOverlappable: true,
      });
      assert.equal(bottomZone, 'edge-bottom');

      // Left edge
      const leftZone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 110,
        clientY: 300,
        targetOverlappable: true,
        draggedOverlappable: true,
      });
      assert.equal(leftZone, 'edge-left');

      // Right edge
      const rightZone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 490,
        clientY: 300,
        targetOverlappable: true,
        draggedOverlappable: true,
      });
      assert.equal(rightZone, 'edge-right');
    });

    it('returns "center-overlap" when pointer is in center and both widgets are overlappable', () => {
      const zone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 300,
        clientY: 300,
        targetOverlappable: true,
        draggedOverlappable: true,
        draggedWidgetId: 'console',
        targetWidgetId: 'attribute-table',
      });
      assert.equal(zone, 'center-overlap');
    });

    it('rejects "center-overlap" when target widget is not overlappable', () => {
      const zone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 300,
        clientY: 300,
        targetOverlappable: false,
        draggedOverlappable: true,
        draggedWidgetId: 'console',
        targetWidgetId: 'fixed-widget',
      });
      assert.equal(zone, 'none');
    });

    it('rejects "center-overlap" when dragged widget is not overlappable', () => {
      const zone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 300,
        clientY: 300,
        targetOverlappable: true,
        draggedOverlappable: false,
        draggedWidgetId: 'fixed-widget',
        targetWidgetId: 'layer-tree',
      });
      assert.equal(zone, 'none');
    });

    it('accepts "center-overlap" when dropping an overlappable widget onto an existing OverlapTabWidget container', () => {
      const zone = resolveWidgetDropZone({
        rect: targetRect,
        clientX: 300,
        clientY: 300,
        targetOverlappable: false,
        draggedOverlappable: true,
        isTargetOverlapContainer: true,
        draggedWidgetId: 'console',
        targetWidgetId: 'overlap-container-1',
      });
      assert.equal(zone, 'center-overlap');
    });
  });

  describe('createOverlapContainer', () => {
    it('bundles two overlappable widgets into an OverlapTabWidget and persists to preferences', async () => {
      // Set up left dock with layer-tree, and bottom dock with console
      const containerId = await createOverlapContainer('left', 'layer-tree', 'console');

      assert.ok(containerId.startsWith('overlap-group-'));

      // In left dock, layer-tree is replaced by the container
      const leftDock = widgetDocksSignal.value.left;
      assert.equal(leftDock.length, 1);
      assert.equal(leftDock[0].id, containerId);
      assert.equal(leftDock[0].isOverlapContainer, true);
      assert.deepEqual(leftDock[0].tabChildren, ['layer-tree', 'console']);
      assert.equal(leftDock[0].activeTabId, 'console');

      // In bottom dock, console was removed
      const bottomDock = widgetDocksSignal.value.bottom;
      assert.ok(!bottomDock.some((item) => item.id === 'console'));

      // Preference persisted
      assert.ok(recordedPreferenceCalls.some((c) => c.key === 'ui.workbench.widgetDocks'));
    });
  });

  describe('appendTabToOverlapContainer', () => {
    it('appends an incoming widget to an existing overlap container and sets it as activeTab', async () => {
      const containerId = await createOverlapContainer('left', 'layer-tree', 'console');

      // Now append attribute-table from bottom dock
      await appendTabToOverlapContainer(containerId, 'attribute-table');

      const container = getWidgetDockItem(containerId);
      assert.ok(container);
      assert.deepEqual(container.item.tabChildren, ['layer-tree', 'console', 'attribute-table']);
      assert.equal(container.item.activeTabId, 'attribute-table');

      // attribute-table is no longer in bottom dock
      const bottomDock = widgetDocksSignal.value.bottom;
      assert.ok(!bottomDock.some((item) => item.id === 'attribute-table'));
    });
  });

  describe('extractTabFromOverlapContainer', () => {
    it('extracts a tab to a destination dock with axisRatio = 1 and dissolves container when 1 tab remains', async () => {
      const containerId = await createOverlapContainer('left', 'layer-tree', 'console');

      // Extract console to right dock
      await extractTabFromOverlapContainer(containerId, 'console', 'right');

      // Right dock contains extracted console with axisRatio = 1
      const extracted = getWidgetDockItem('console');
      assert.ok(extracted);
      assert.equal(extracted.dock, 'right');
      assert.equal(extracted.item.axisRatio, 1);
      assert.equal(extracted.item.isOverlapContainer, false);

      // Single-child auto-dissolution: left dock now contains layer-tree directly, container is gone!
      const leftDock = widgetDocksSignal.value.left;
      assert.equal(leftDock.length, 1);
      assert.equal(leftDock[0].id, 'layer-tree');
      assert.equal(leftDock[0].isOverlapContainer, false);

      const oldContainer = getWidgetDockItem(containerId);
      assert.equal(oldContainer, undefined);
    });

    it('keeps container intact when 2 or more tabs remain after extraction', async () => {
      const containerId = await createOverlapContainer('left', 'layer-tree', 'console');
      await appendTabToOverlapContainer(containerId, 'attribute-table');

      // Extract console
      await extractTabFromOverlapContainer(containerId, 'console', 'bottom');

      const container = getWidgetDockItem(containerId);
      assert.ok(container);
      assert.deepEqual(container.item.tabChildren, ['layer-tree', 'attribute-table']);
      assert.equal(container.item.isOverlapContainer, true);
    });
  });

  describe('dissolveOverlapContainer', () => {
    it('unwraps container and restores child tabs as independent widgets with axisRatio = 1', async () => {
      const containerId = await createOverlapContainer('bottom', 'attribute-table', 'console');

      await dissolveOverlapContainer(containerId);

      const bottomDock = widgetDocksSignal.value.bottom;
      assert.equal(bottomDock.length, 2);

      const attr = bottomDock.find((i) => i.id === 'attribute-table');
      const cons = bottomDock.find((i) => i.id === 'console');

      assert.ok(attr);
      assert.ok(cons);
      assert.equal(attr.axisRatio, 1);
      assert.equal(cons.axisRatio, 1);
      assert.equal(attr.isOverlapContainer, false);
      assert.equal(cons.isOverlapContainer, false);
    });
  });

  describe('getWidgetDockItem lookup', () => {
    it('locates widgets nested inside overlap containers and reports containerId', async () => {
      const containerId = await createOverlapContainer('left', 'layer-tree', 'console');

      const match = getWidgetDockItem('console');
      assert.ok(match);
      assert.equal(match.dock, 'left');
      assert.equal(match.containerId, containerId);
    });
  });
});

