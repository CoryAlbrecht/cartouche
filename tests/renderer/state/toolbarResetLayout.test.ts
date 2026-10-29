/**
 * @file toolbarResetLayout.test.ts
 * @module tests/renderer/state/toolbarResetLayout.test
 * @description Unit tests for toolbar reset layout action registration, i18n parity, reactive signals restoration, and IPC persistence (Ticket #117).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link resetToolbarsToDefault}
 * @see {@link resetToolbarLayout}
 * @see {@link ActionRegistry}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mdiRestore } from '@mdi/js';
import { BUILTIN_ACTIONS } from '../../../src/main/actions/defaults';
import { ActionRegistry } from '../../../src/main/actions/ActionRegistry';
import resetToolbarLayout from '../../../src/main/api/ui/toolbars/resetToolbarLayout';
import { PreferencesStore } from '../../../src/main/api/ui/preferences/PreferencesStore';
import {
  DEFAULT_TOOLBAR_COORDINATES,
  visibleToolbarsSignal,
  toolbarLocationsSignal,
  toolbarRowsSignal,
  toolbarOrdersSignal,
  toolbarOrderSignal,
  resetToolbarsToDefault,
  type ToolbarId
} from '../../../src/renderer/state/gisSignals';

describe('Toolbar Reset to Default Layout (Ticket #117)', () => {
  const toolbarIds: ToolbarId[] = ['project', 'map_view', 'selection', 'digitizing', 'snapping'];
  let ipcDispatches: Array<{ name: string; value: any }> = [];

  beforeEach(() => {
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

  it('registers reset_toolbar_layout in BUILTIN_ACTIONS and ActionRegistry', () => {
    const actionDef = BUILTIN_ACTIONS.find((a) => a.name === 'reset_toolbar_layout');
    assert.ok(actionDef, 'reset_toolbar_layout must be in BUILTIN_ACTIONS');
    assert.equal(actionDef.name, 'reset_toolbar_layout');
    assert.equal(actionDef.icon, mdiRestore);
    assert.equal(typeof actionDef.description, 'string');
    assert.ok(actionDef.description.length > 0);
    assert.equal(typeof actionDef.functionCall, 'function');

    const registryAction = ActionRegistry.getActionByName('reset_toolbar_layout');
    assert.ok(registryAction, 'reset_toolbar_layout must be registered in ActionRegistry');
    assert.equal(registryAction.name, 'reset_toolbar_layout');
    assert.equal(registryAction.icon, mdiRestore);
  });

  it('ensures reset_toolbar_layout localized string exists in en.xml and fr.xml', () => {
    const enXmlPath = path.resolve(process.cwd(), 'assets/xml/i18n/en.xml');
    const enContent = fs.readFileSync(enXmlPath, 'utf-8');
    const frXmlPath = path.resolve(process.cwd(), 'assets/xml/i18n/fr.xml');
    const frContent = fs.readFileSync(frXmlPath, 'utf-8');

    assert.match(
      enContent,
      /<string\s+name=["']reset_toolbar_layout["']>Reset Toolbars to Default<\/string>/,
      'en.xml must have Reset Toolbars to Default'
    );
    assert.match(
      frContent,
      /<string\s+name=["']reset_toolbar_layout["']>Rétablir les barres d'outils par défaut<\/string>/,
      'fr.xml must have Rétablir les barres d\'outils par défaut'
    );
  });

  it('restores all reactive toolbar signals to factory defaults upon resetToolbarsToDefault invocation', () => {
    // Dirty all signals with custom layout
    visibleToolbarsSignal.value = {
      project: false,
      map_view: false,
      selection: true,
      digitizing: false,
      snapping: true
    };
    toolbarLocationsSignal.value = {
      project: 'bottom',
      map_view: 'left',
      selection: 'right',
      digitizing: 'bottom',
      snapping: 'bottom'
    };
    toolbarRowsSignal.value = {
      project: 2,
      map_view: 1,
      selection: 0,
      digitizing: 1,
      snapping: 0
    };
    toolbarOrdersSignal.value = {
      project: -5,
      map_view: -1,
      selection: 0,
      digitizing: -2,
      snapping: 1
    };
    toolbarOrderSignal.value = {
      top: [],
      bottom: ['digitizing', 'project', 'snapping'],
      left: ['map_view'],
      right: ['selection']
    };

    // Execute reset
    resetToolbarsToDefault();

    // Verify all signals match factory defaults
    assert.deepEqual(visibleToolbarsSignal.value, {
      project: true,
      map_view: true,
      selection: true,
      digitizing: true,
      snapping: false
    });

    assert.deepEqual(toolbarLocationsSignal.value, {
      project: 'top',
      map_view: 'top',
      selection: 'top',
      digitizing: 'top',
      snapping: 'top'
    });

    assert.deepEqual(toolbarRowsSignal.value, {
      project: 0,
      map_view: 0,
      selection: 0,
      digitizing: 0,
      snapping: 0
    });

    assert.deepEqual(toolbarOrdersSignal.value, {
      project: 0,
      map_view: 1,
      selection: 2,
      digitizing: 3,
      snapping: -1
    });

    assert.deepEqual(toolbarOrderSignal.value, {
      top: ['project', 'map_view', 'selection', 'digitizing', 'snapping'],
      bottom: [],
      left: [],
      right: []
    });
  });

  it('dispatches setPreference IPC for all 20 toolbar preference keys with factory default values', () => {
    resetToolbarsToDefault();

    assert.equal(ipcDispatches.length, 20, 'Must dispatch exactly 20 preference persistence calls');

    const dispatchedMap = new Map<string, any>(
      ipcDispatches.map((d) => [d.name, d.value])
    );

    for (const id of toolbarIds) {
      const def = DEFAULT_TOOLBAR_COORDINATES[id];
      assert.equal(dispatchedMap.get(`ui.toolbars.${id}.visible`), def.visible);
      assert.equal(dispatchedMap.get(`ui.toolbars.${id}.dock`), def.dock);
      assert.equal(dispatchedMap.get(`ui.toolbars.${id}.row`), def.row);
      assert.equal(dispatchedMap.get(`ui.toolbars.${id}.order`), def.order);
    }
  });

  it('resets all toolbar preferences in PreferencesStore when main resetToolbarLayout is called', () => {
    // Override a couple in PreferencesStore
    PreferencesStore.set('ui.toolbars.project.dock', 'bottom');
    PreferencesStore.set('ui.toolbars.snapping.visible', true);

    // Call main action
    resetToolbarLayout();

    // Verify PreferencesStore has factory defaults
    for (const id of toolbarIds) {
      const def = DEFAULT_TOOLBAR_COORDINATES[id];
      const visKey = `ui.toolbars.${id}.visible`;
      const dockKey = `ui.toolbars.${id}.dock`;
      const rowKey = `ui.toolbars.${id}.row`;
      const orderKey = `ui.toolbars.${id}.order`;

      assert.equal(PreferencesStore.get(visKey)[visKey]?.value, def.visible);
      assert.equal(PreferencesStore.get(dockKey)[dockKey]?.value, def.dock);
      assert.equal(PreferencesStore.get(rowKey)[rowKey]?.value, def.row);
      assert.equal(PreferencesStore.get(orderKey)[orderKey]?.value, def.order);
    }
  });
});
