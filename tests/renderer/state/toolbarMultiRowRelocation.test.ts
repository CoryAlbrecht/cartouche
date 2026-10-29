/**
 * @file toolbarMultiRowRelocation.test.ts
 * @module tests/renderer/state/toolbarMultiRowRelocation.test
 * @description Unit tests for multi-row toolbar relocation, row creation, auto-compaction, and IPC coordinate persistence (Ticket #115, ADR 0020).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link moveToolbar}
 * @see {@link toolbarLocationsSignal}
 * @see {@link toolbarRowsSignal}
 * @see {@link toolbarOrdersSignal}
 * @see {@link toolbarOrderSignal}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  moveToolbar,
  toolbarLocationsSignal,
  toolbarRowsSignal,
  toolbarOrdersSignal,
  toolbarOrderSignal,
  hydrateToolbarSignalsFromPreferences,
  type ToolbarId
} from '../../../src/renderer/state/gisSignals';

describe('Toolbar Multi-Row Relocation and Compaction (Ticket #115)', () => {
  let ipcDispatches: Array<{ name: string; value: any }> = [];

  beforeEach(() => {
    hydrateToolbarSignalsFromPreferences({});
    ipcDispatches = [];
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

  it('reorders toolbars within the same row when dropped before target toolbar', () => {
    // Initial top row 0: project (0), map_view (1), selection (2), digitizing (3)
    moveToolbar('digitizing', 'top', { hoveredId: 'map_view', position: 'before' });

    assert.equal(toolbarLocationsSignal.value.digitizing, 'top');
    assert.equal(toolbarRowsSignal.value.digitizing, 0);
    assert.equal(toolbarOrdersSignal.value.digitizing, 1);
    assert.equal(toolbarOrdersSignal.value.project, 0);
    assert.equal(toolbarOrdersSignal.value.map_view, 2);
    assert.equal(toolbarOrdersSignal.value.selection, 3);

    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'digitizing',
      'map_view',
      'selection',
      'snapping'
    ]);
  });

  it('reorders toolbars within the same row when dropped after target toolbar', () => {
    // Initial top row 0: project (0), map_view (1), selection (2), digitizing (3)
    moveToolbar('project', 'top', { hoveredId: 'selection', position: 'after' });

    assert.equal(toolbarRowsSignal.value.project, 0);
    assert.equal(toolbarOrdersSignal.value.project, 2);
    assert.equal(toolbarOrdersSignal.value.map_view, 0);
    assert.equal(toolbarOrdersSignal.value.selection, 1);
    assert.equal(toolbarOrdersSignal.value.digitizing, 3);

    assert.deepEqual(toolbarOrderSignal.value.top, [
      'map_view',
      'selection',
      'project',
      'digitizing',
      'snapping'
    ]);
  });

  it('creates a new row above the hovered toolbar when dropping on top 25% edge', () => {
    // All currently in row 0
    moveToolbar('digitizing', 'top', { hoveredId: 'project', position: 'new-row-above' });

    // digitizing becomes row 0; existing row 0 items shift to row 1
    assert.equal(toolbarRowsSignal.value.digitizing, 0);
    assert.equal(toolbarOrdersSignal.value.digitizing, 0);

    assert.equal(toolbarRowsSignal.value.project, 1);
    assert.equal(toolbarRowsSignal.value.map_view, 1);
    assert.equal(toolbarRowsSignal.value.selection, 1);

    // toolbarOrderSignal sorts by (row, order)
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'digitizing',
      'project',
      'map_view',
      'selection',
      'snapping'
    ]);
  });

  it('creates a new row below the hovered toolbar when dropping on bottom 25% edge', () => {
    // Drop selection below digitizing (row 0)
    moveToolbar('selection', 'top', { hoveredId: 'digitizing', position: 'new-row-below' });

    // project, map_view, digitizing stay in row 0
    assert.equal(toolbarRowsSignal.value.project, 0);
    assert.equal(toolbarRowsSignal.value.map_view, 0);
    assert.equal(toolbarRowsSignal.value.digitizing, 0);

    // selection becomes row 1, order 0
    assert.equal(toolbarRowsSignal.value.selection, 1);
    assert.equal(toolbarOrdersSignal.value.selection, 0);

    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'map_view',
      'digitizing',
      'snapping',
      'selection'
    ]);
  });

  it('prepends a new row when dropping on leading container boundary', () => {
    moveToolbar('digitizing', 'top', { position: 'prepend-new-row' });

    assert.equal(toolbarRowsSignal.value.digitizing, 0);
    assert.equal(toolbarOrdersSignal.value.digitizing, 0);

    assert.equal(toolbarRowsSignal.value.project, 1);
    assert.equal(toolbarRowsSignal.value.map_view, 1);
    assert.equal(toolbarRowsSignal.value.selection, 1);
  });

  it('appends a new row when dropping on container trailing space', () => {
    moveToolbar('digitizing', 'top', { position: 'append-new-row' });

    // Existing row 0 items remain in row 0
    assert.equal(toolbarRowsSignal.value.project, 0);
    assert.equal(toolbarRowsSignal.value.map_view, 0);
    assert.equal(toolbarRowsSignal.value.selection, 0);

    // digitizing becomes row 1, order 0
    assert.equal(toolbarRowsSignal.value.digitizing, 1);
    assert.equal(toolbarOrdersSignal.value.digitizing, 0);
  });

  it('auto-compacts remaining rows when a row is completely vacated', () => {
    // Step 1: Create row 1 with selection, and row 2 with digitizing
    moveToolbar('selection', 'top', { position: 'append-new-row' });
    moveToolbar('digitizing', 'top', { position: 'append-new-row' });

    assert.equal(toolbarRowsSignal.value.project, 0);
    assert.equal(toolbarRowsSignal.value.map_view, 0);
    assert.equal(toolbarRowsSignal.value.selection, 1);
    assert.equal(toolbarRowsSignal.value.digitizing, 2);

    // Step 2: Move selection (the only toolbar in row 1) to row 0
    moveToolbar('selection', 'top', { hoveredId: 'project', position: 'after' });

    // Row 1 was vacated! digitizing in row 2 must automatically compact to row 1!
    assert.equal(toolbarRowsSignal.value.selection, 0);
    assert.equal(toolbarRowsSignal.value.digitizing, 1);

    // Verify row indices remain strictly contiguous 0, 1
    const topRows = Array.from(
      new Set(
        (['project', 'map_view', 'selection', 'digitizing'] as ToolbarId[]).map(
          (id) => toolbarRowsSignal.value[id]
        )
      )
    ).sort((a, b) => a - b);
    assert.deepEqual(topRows, [0, 1]);
  });

  it('supports relocation across different perimeter zones and compacts vacated source row', () => {
    // Create row 1 with digitizing
    moveToolbar('digitizing', 'top', { position: 'append-new-row' });
    assert.equal(toolbarRowsSignal.value.digitizing, 1);

    // Move digitizing to bottom zone
    moveToolbar('digitizing', 'bottom');

    assert.equal(toolbarLocationsSignal.value.digitizing, 'bottom');
    assert.equal(toolbarRowsSignal.value.digitizing, 0);

    // Top zone had row 1 vacated, so remaining rows are just row 0
    const topRows = Array.from(
      new Set(
        (['project', 'map_view', 'selection'] as ToolbarId[]).map(
          (id) => toolbarRowsSignal.value[id]
        )
      )
    );
    assert.deepEqual(topRows, [0]);
  });

  it('supports vertical dock zones with column creation (new-row-before / new-row-after) and auto-compaction', () => {
    // Relocate project and map_view to left zone
    moveToolbar('project', 'left');
    moveToolbar('map_view', 'left');

    assert.equal(toolbarLocationsSignal.value.project, 'left');
    assert.equal(toolbarLocationsSignal.value.map_view, 'left');
    assert.equal(toolbarRowsSignal.value.project, 0);
    assert.equal(toolbarRowsSignal.value.map_view, 0);

    // Create a new column before project in left zone
    moveToolbar('selection', 'left', { hoveredId: 'project', position: 'new-row-before' });
    assert.equal(toolbarLocationsSignal.value.selection, 'left');
    assert.equal(toolbarRowsSignal.value.selection, 0);
    assert.equal(toolbarRowsSignal.value.project, 1);
    assert.equal(toolbarRowsSignal.value.map_view, 1);

    // Create a new column after selection (column index 1)
    moveToolbar('digitizing', 'left', { hoveredId: 'selection', position: 'new-row-after' });
    assert.equal(toolbarLocationsSignal.value.digitizing, 'left');
    assert.equal(toolbarRowsSignal.value.digitizing, 1);
    assert.equal(toolbarRowsSignal.value.project, 2);
    assert.equal(toolbarRowsSignal.value.map_view, 2);

    // Vacate column 1 by moving digitizing back to top zone; remaining columns auto-compact to [0, 1]
    moveToolbar('digitizing', 'top');
    assert.equal(toolbarRowsSignal.value.selection, 0);
    assert.equal(toolbarRowsSignal.value.project, 1);
    assert.equal(toolbarRowsSignal.value.map_view, 1);
  });

  it('dispatches window.electronAPI.setPreference for all coordinates modified during relocation', () => {
    // Relocate digitizing to new row below project
    moveToolbar('digitizing', 'top', { hoveredId: 'project', position: 'new-row-below' });

    assert.ok(ipcDispatches.length > 0);
    const modifiedPrefNames = ipcDispatches.map((d) => d.name);

    assert.ok(modifiedPrefNames.includes('ui.toolbars.digitizing.row'));
    assert.ok(modifiedPrefNames.includes('ui.toolbars.digitizing.order'));
  });
});
