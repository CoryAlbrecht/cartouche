/**
 * @file widgetDocksPreference.test.ts
 * @module tests/shared/preferences/widgetDocksPreference.test
 * @description Unit tests verifying registration, defaults, and descriptor constraints of ui.workbench.widgetDocks preference.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link BUILTIN_PREFERENCES}
 * @see {@link DEFAULT_WORKBENCH_WIDGET_DOCKS}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_PREFERENCES } from '../../../src/shared/preferences';
import {
  DEFAULT_WORKBENCH_WIDGET_DOCKS,
  type WorkbenchWidgetDocksState,
} from '../../../src/shared/types';

describe('ui.workbench.widgetDocks Preference Registration', () => {
  it('registers ui.workbench.widgetDocks in BUILTIN_PREFERENCES with correct descriptor attributes', () => {
    const pref = BUILTIN_PREFERENCES['ui.workbench.widgetDocks'];
    assert.ok(pref, 'ui.workbench.widgetDocks preference must be registered');
    assert.strictEqual(pref.hidden, true, 'Preference must be hidden from Preferences Dialog');
    assert.strictEqual(pref.ephemeral, false, 'Preference must be persistent (not ephemeral)');
    assert.strictEqual(pref.category, 'ui', 'Preference category must be "ui"');
    assert.strictEqual(pref.type, 'object', 'Preference type must be "object"');
    assert.deepStrictEqual(
      pref.defaultValue,
      DEFAULT_WORKBENCH_WIDGET_DOCKS,
      'Default value must match DEFAULT_WORKBENCH_WIDGET_DOCKS'
    );
  });

  it('defines default dock allocations for built-in panels (layer-tree, attribute-table, console)', () => {
    const docks: WorkbenchWidgetDocksState = DEFAULT_WORKBENCH_WIDGET_DOCKS;

    // Left dock contains visible layer-tree with width 260
    assert.strictEqual(docks.left.length, 1);
    const layerTree = docks.left[0];
    assert.strictEqual(layerTree.id, 'layer-tree');
    assert.strictEqual(layerTree.dock, 'left');
    assert.strictEqual(layerTree.order, 0);
    assert.strictEqual(layerTree.axisRatio, 1);
    assert.strictEqual(layerTree.visible, true);
    assert.strictEqual(layerTree.isOverlapContainer, false);
    assert.strictEqual(layerTree.dimensions.width, 260);

    // Right and Top docks start empty
    assert.strictEqual(docks.right.length, 0);
    assert.strictEqual(docks.top.length, 0);

    // Bottom dock contains attribute-table and console (both initially hidden)
    assert.strictEqual(docks.bottom.length, 2);
    const attrTable = docks.bottom[0];
    assert.strictEqual(attrTable.id, 'attribute-table');
    assert.strictEqual(attrTable.dock, 'bottom');
    assert.strictEqual(attrTable.order, 0);
    assert.strictEqual(attrTable.axisRatio, 1);
    assert.strictEqual(attrTable.visible, false);
    assert.strictEqual(attrTable.dimensions.height, 200);

    const consolePanel = docks.bottom[1];
    assert.strictEqual(consolePanel.id, 'console');
    assert.strictEqual(consolePanel.dock, 'bottom');
    assert.strictEqual(consolePanel.order, 1);
    assert.strictEqual(consolePanel.axisRatio, 1);
    assert.strictEqual(consolePanel.visible, false);
    assert.strictEqual(consolePanel.dimensions.height, 160);
  });
});

