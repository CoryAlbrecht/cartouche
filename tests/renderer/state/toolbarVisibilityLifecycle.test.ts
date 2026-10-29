/**
 * @file toolbarVisibilityLifecycle.test.ts
 * @module tests/renderer/state/toolbarVisibilityLifecycle.test
 * @description Unit tests for negative-order toolbar hide/show lifecycle and atomic IPC preference persistence (Ticket #114, ADR 0020).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link toggleToolbar}
 * @see {@link visibleToolbarsSignal}
 * @see {@link toolbarOrdersSignal}
 * @see {@link toolbarRowsSignal}
 * @see {@link toolbarLocationsSignal}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  toggleToolbar,
  visibleToolbarsSignal,
  toolbarLocationsSignal,
  toolbarRowsSignal,
  toolbarOrdersSignal,
  toolbarOrderSignal,
  hydrateToolbarSignalsFromPreferences
} from '../../../src/renderer/state/gisSignals';

describe('Toolbar Negative-Order Visibility Lifecycle (Ticket #114)', () => {
  let ipcDispatches: Array<{ name: string; value: any }> = [];

  beforeEach(() => {
    // Reset signals to clean factory defaults
    hydrateToolbarSignalsFromPreferences({});

    ipcDispatches = [];
    // Mock window.electronAPI with setPreference
    (globalThis as any).window = {
      electronAPI: {
        setPreference: (name: string, value: any) => {
          ipcDispatches.push({ name, value });
          return Promise.resolve({});
        }
      }
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('toggling a visible toolbar to hidden sets visible: false and negates its order coordinate', () => {
    // selection starts visible with order: 2, row: 0, dock: 'top'
    assert.equal(visibleToolbarsSignal.value.selection, true);
    assert.equal(toolbarOrdersSignal.value.selection, 2);

    toggleToolbar('selection');

    assert.equal(visibleToolbarsSignal.value.selection, false);
    assert.equal(toolbarOrdersSignal.value.selection, -2);
    assert.equal(toolbarLocationsSignal.value.selection, 'top');
    assert.equal(toolbarRowsSignal.value.selection, 0);
  });

  it('toggling a visible toolbar with order 0 to hidden produces a strictly negative order coordinate', () => {
    // project starts visible with order: 0, row: 0, dock: 'top'
    assert.equal(visibleToolbarsSignal.value.project, true);
    assert.equal(toolbarOrdersSignal.value.project, 0);

    toggleToolbar('project');

    assert.equal(visibleToolbarsSignal.value.project, false);
    assert.ok(
      toolbarOrdersSignal.value.project < 0,
      `Expected negative order for hidden project toolbar, got ${toolbarOrdersSignal.value.project}`
    );
    assert.equal(toolbarOrdersSignal.value.project, -1);
  });

  it('toggling a hidden toolbar to visible sets visible: true and assigns order: max(visibleOrdersInRow) + 1', () => {
    // snapping starts hidden with order: -1, row: 0, dock: 'top'
    // visible toolbars in row 0 are: project (0), map_view (1), selection (2), digitizing (3)
    assert.equal(visibleToolbarsSignal.value.snapping, false);
    assert.equal(toolbarOrdersSignal.value.snapping, -1);

    toggleToolbar('snapping');

    assert.equal(visibleToolbarsSignal.value.snapping, true);
    // max(0, 0, 1, 2, 3) + 1 = 4
    assert.equal(toolbarOrdersSignal.value.snapping, 4);
    assert.equal(toolbarLocationsSignal.value.snapping, 'top');
    assert.equal(toolbarRowsSignal.value.snapping, 0);
  });

  it('unhiding a toolbar preserves row affinity and does not shift other visible toolbars', () => {
    // Hide selection (order: 2 -> -2)
    toggleToolbar('selection');
    assert.equal(visibleToolbarsSignal.value.selection, false);
    assert.equal(toolbarOrdersSignal.value.selection, -2);

    // Remaining visible in row 0: project (0), map_view (1), digitizing (3)
    assert.equal(toolbarOrdersSignal.value.project, 0);
    assert.equal(toolbarOrdersSignal.value.map_view, 1);
    assert.equal(toolbarOrdersSignal.value.digitizing, 3);

    // Unhide selection: max(0, 0, 1, 3) + 1 = 4
    toggleToolbar('selection');
    assert.equal(visibleToolbarsSignal.value.selection, true);
    assert.equal(toolbarOrdersSignal.value.selection, 4);

    // Verify existing visible toolbars were not shifted or displaced
    assert.equal(toolbarOrdersSignal.value.project, 0);
    assert.equal(toolbarOrdersSignal.value.map_view, 1);
    assert.equal(toolbarOrdersSignal.value.digitizing, 3);
  });

  it('unhiding a toolbar when all other toolbars in that row are hidden assigns order 1', () => {
    // Put snapping in row 1 on top
    toolbarRowsSignal.value = {
      ...toolbarRowsSignal.value,
      snapping: 1
    };
    toolbarOrdersSignal.value = {
      ...toolbarOrdersSignal.value,
      snapping: -1
    };
    visibleToolbarsSignal.value = {
      ...visibleToolbarsSignal.value,
      snapping: false
    };

    // No visible toolbars exist in row 1
    toggleToolbar('snapping');

    assert.equal(visibleToolbarsSignal.value.snapping, true);
    // max(0) + 1 = 1
    assert.equal(toolbarOrdersSignal.value.snapping, 1);
  });

  it('dispatches window.electronAPI.setPreference for visible and order upon toggle', () => {
    toggleToolbar('selection');

    assert.equal(ipcDispatches.length, 2);
    assert.deepEqual(ipcDispatches[0], {
      name: 'ui.toolbars.selection.visible',
      value: false
    });
    assert.deepEqual(ipcDispatches[1], {
      name: 'ui.toolbars.selection.order',
      value: -2
    });
  });

  it('falls back to window.electronAPI.setPreferenceValue if setPreference is not available', () => {
    const fallbackDispatches: Array<{ name: string; value: any }> = [];
    (globalThis as any).window = {
      electronAPI: {
        setPreferenceValue: (name: string, value: any) => {
          fallbackDispatches.push({ name, value });
          return Promise.resolve({});
        }
      }
    };

    toggleToolbar('snapping');

    assert.equal(fallbackDispatches.length, 2);
    assert.deepEqual(fallbackDispatches[0], {
      name: 'ui.toolbars.snapping.visible',
      value: true
    });
    assert.deepEqual(fallbackDispatches[1], {
      name: 'ui.toolbars.snapping.order',
      value: 4
    });
  });

  it('re-sorts toolbarOrderSignal according to (row, order) when toolbars are toggled', () => {
    // Unhide snapping -> should appear at the end of top zone
    toggleToolbar('snapping');
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'map_view',
      'selection',
      'digitizing',
      'snapping'
    ]);

    // Hide selection -> negative order (-2) sorts it before positive orders in row 0
    toggleToolbar('selection');
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'selection',
      'project',
      'map_view',
      'digitizing',
      'snapping'
    ]);
  });
});

