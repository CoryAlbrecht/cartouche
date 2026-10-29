/**
 * @file toolbarPreferencesHydration.test.ts
 * @module tests/renderer/state/toolbarPreferencesHydration.test
 * @description Unit tests for toolbar coordinate preferences schema, factory defaults, and startup signal hydration (Ticket #113).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link BUILTIN_PREFERENCES}
 * @see {@link DEFAULT_TOOLBAR_COORDINATES}
 * @see {@link hydrateToolbarSignalsFromPreferences}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_PREFERENCES } from '../../../src/shared/preferences/index';
import {
  DEFAULT_TOOLBAR_COORDINATES,
  visibleToolbarsSignal,
  toolbarLocationsSignal,
  toolbarRowsSignal,
  toolbarOrdersSignal,
  toolbarOrderSignal,
  hydrateToolbarSignalsFromPreferences,
  type ToolbarId
} from '../../../src/renderer/state/gisSignals';

describe('Toolbar Preferences Schema & Hydration (Ticket #113)', () => {
  const toolbarIds: ToolbarId[] = ['project', 'map_view', 'selection', 'digitizing', 'snapping'];

  beforeEach(() => {
    // Reset to factory defaults before each test
    hydrateToolbarSignalsFromPreferences({});
  });

  it('registers 20 discrete toolbar preference definitions in BUILTIN_PREFERENCES with hidden: true and ephemeral: false', () => {
    for (const id of toolbarIds) {
      const visiblePref = BUILTIN_PREFERENCES[`ui.toolbars.${id}.visible`];
      const dockPref = BUILTIN_PREFERENCES[`ui.toolbars.${id}.dock`];
      const rowPref = BUILTIN_PREFERENCES[`ui.toolbars.${id}.row`];
      const orderPref = BUILTIN_PREFERENCES[`ui.toolbars.${id}.order`];

      assert.ok(visiblePref, `Preference ui.toolbars.${id}.visible must be registered`);
      assert.equal(visiblePref.category, 'ui');
      assert.equal(visiblePref.hidden, true);
      assert.equal(visiblePref.ephemeral, false);
      assert.equal(visiblePref.type, 'boolean');

      assert.ok(dockPref, `Preference ui.toolbars.${id}.dock must be registered`);
      assert.equal(dockPref.category, 'ui');
      assert.equal(dockPref.hidden, true);
      assert.equal(dockPref.ephemeral, false);
      assert.equal(dockPref.type, 'string');

      assert.ok(rowPref, `Preference ui.toolbars.${id}.row must be registered`);
      assert.equal(rowPref.category, 'ui');
      assert.equal(rowPref.hidden, true);
      assert.equal(rowPref.ephemeral, false);
      assert.equal(rowPref.type, 'number');

      assert.ok(orderPref, `Preference ui.toolbars.${id}.order must be registered`);
      assert.equal(orderPref.category, 'ui');
      assert.equal(orderPref.hidden, true);
      assert.equal(orderPref.ephemeral, false);
      assert.equal(orderPref.type, 'number');
    }
  });

  it('configures factory defaults with Project, MapView, Selection, Digitizing visible in row 0 and Snapping hidden', () => {
    assert.deepEqual(DEFAULT_TOOLBAR_COORDINATES.project, {
      visible: true,
      dock: 'top',
      row: 0,
      order: 0
    });
    assert.deepEqual(DEFAULT_TOOLBAR_COORDINATES.map_view, {
      visible: true,
      dock: 'top',
      row: 0,
      order: 1
    });
    assert.deepEqual(DEFAULT_TOOLBAR_COORDINATES.selection, {
      visible: true,
      dock: 'top',
      row: 0,
      order: 2
    });
    assert.deepEqual(DEFAULT_TOOLBAR_COORDINATES.digitizing, {
      visible: true,
      dock: 'top',
      row: 0,
      order: 3
    });
    assert.deepEqual(DEFAULT_TOOLBAR_COORDINATES.snapping, {
      visible: false,
      dock: 'top',
      row: 0,
      order: -1
    });
  });

  it('hydrates signals with custom user preferences across multiple rows and dock zones', () => {
    const customPrefs: Record<string, any> = {
      'ui.toolbars.project.visible': { value: true },
      'ui.toolbars.project.dock': { value: 'top' },
      'ui.toolbars.project.row': { value: 0 },
      'ui.toolbars.project.order': { value: 0 },

      'ui.toolbars.map_view.visible': { value: true },
      'ui.toolbars.map_view.dock': { value: 'top' },
      'ui.toolbars.map_view.row': { value: 1 },
      'ui.toolbars.map_view.order': { value: 0 },

      'ui.toolbars.selection.visible': { value: true },
      'ui.toolbars.selection.dock': { value: 'left' },
      'ui.toolbars.selection.row': { value: 0 },
      'ui.toolbars.selection.order': { value: 0 },

      'ui.toolbars.digitizing.visible': { value: true },
      'ui.toolbars.digitizing.dock': { value: 'left' },
      'ui.toolbars.digitizing.row': { value: 1 },
      'ui.toolbars.digitizing.order': { value: 0 },

      'ui.toolbars.snapping.visible': { value: true },
      'ui.toolbars.snapping.dock': { value: 'bottom' },
      'ui.toolbars.snapping.row': { value: 0 },
      'ui.toolbars.snapping.order': { value: 0 }
    };

    hydrateToolbarSignalsFromPreferences(customPrefs);

    assert.equal(visibleToolbarsSignal.value.project, true);
    assert.equal(toolbarLocationsSignal.value.project, 'top');
    assert.equal(toolbarRowsSignal.value.project, 0);

    assert.equal(toolbarLocationsSignal.value.map_view, 'top');
    assert.equal(toolbarRowsSignal.value.map_view, 1);

    assert.equal(toolbarLocationsSignal.value.selection, 'left');
    assert.equal(toolbarRowsSignal.value.selection, 0);

    assert.equal(toolbarLocationsSignal.value.digitizing, 'left');
    assert.equal(toolbarRowsSignal.value.digitizing, 1);

    assert.equal(visibleToolbarsSignal.value.snapping, true);
    assert.equal(toolbarLocationsSignal.value.snapping, 'bottom');

    assert.deepEqual(toolbarOrderSignal.value.top, ['project', 'map_view']);
    assert.deepEqual(toolbarOrderSignal.value.left, ['selection', 'digitizing']);
    assert.deepEqual(toolbarOrderSignal.value.bottom, ['snapping']);
    assert.deepEqual(toolbarOrderSignal.value.right, []);
  });

  it('cleanly falls back to factory defaults when preference values are missing, invalid, or corrupted', () => {
    const corruptPrefs: Record<string, any> = {
      'ui.toolbars.project.visible': 'not-a-boolean',
      'ui.toolbars.project.dock': 'invalid-zone-name',
      'ui.toolbars.project.row': -5,
      'ui.toolbars.project.order': NaN,

      // map_view omitted completely
      'ui.toolbars.selection.row': 'string-instead-of-number',
      'ui.toolbars.snapping.dock': null
    };

    hydrateToolbarSignalsFromPreferences(corruptPrefs);

    assert.equal(visibleToolbarsSignal.value.project, true);
    assert.equal(toolbarLocationsSignal.value.project, 'top');
    assert.equal(toolbarRowsSignal.value.project, 0);
    assert.equal(toolbarOrdersSignal.value.project, 0);

    assert.equal(visibleToolbarsSignal.value.map_view, true);
    assert.equal(toolbarLocationsSignal.value.map_view, 'top');
    assert.equal(toolbarRowsSignal.value.map_view, 0);
    assert.equal(toolbarOrdersSignal.value.map_view, 1);

    assert.equal(toolbarRowsSignal.value.selection, 0);
    assert.equal(toolbarLocationsSignal.value.snapping, 'top');
  });

  it('handles empty preference map gracefully without throwing', () => {
    assert.doesNotThrow(() => {
      hydrateToolbarSignalsFromPreferences({});
    });
    assert.equal(visibleToolbarsSignal.value.project, true);
    assert.equal(visibleToolbarsSignal.value.snapping, false);
  });
});
