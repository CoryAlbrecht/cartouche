/**
 * @file preferencesExtensibility.test.ts
 * @module tests/shared/preferences/preferencesExtensibility.test
 * @description Unit tests verifying declarative preference controls, grouping attributes, order sorting, and i18n XML localization dictionary parity across en.xml and fr.xml.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @see {@link BUILTIN_PREFERENCES}
 * @see {@link PreferenceItem}
 * @see {@link PreferenceControlType}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { BUILTIN_PREFERENCES } from '../../../src/shared/preferences/index';
import {
  prefsAttributeTableMaxRows,
  loadPreferences,
  updatePreference
} from '../../../src/renderer/state/preferencesSignals';
import type { PreferenceItem, PreferenceControlType } from '../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Extensible Preferences Subsystem Contracts', () => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
  });

  /**
   * @description Loads and parses an i18n XML localization dictionary into a set of string keys.
   * @param {string} filename - Localization dictionary filename.
   * @returns {Set<string>} Set of localized string keys.
   */
  const loadDict = (filename: string): Set<string> => {
    const xmlPath = path.join(__dirname, '../../../assets/xml/i18n', filename);
    const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
    const parsed = parser.parse(xmlContent);
    const root = parsed['ci18n:localization'] || parsed.localization;
    const rawStrings = Array.isArray(root.string) ? root.string : [root.string];
    const dict = new Set<string>();
    for (const item of rawStrings) {
      if (item && item['@_name']) {
        dict.add(item['@_name']);
      }
    }
    return dict;
  };

  const enDict = loadDict('en.xml');
  const frDict = loadDict('fr.xml');

  it('ensures all visible built-in preferences define valid i18nId matching en.xml entries for title and description', () => {
    for (const [key, item] of Object.entries(BUILTIN_PREFERENCES)) {
      if (item.hidden) continue;

      assert.ok(item.i18nId, `Visible preference '${key}' must define an explicit i18nId`);
      assert.ok(
        enDict.has(item.i18nId!),
        `en.xml must contain string entry for i18nId '${item.i18nId}' (preference '${key}')`
      );

      const descrKey = `${item.i18nId}_descr`;
      assert.ok(
        enDict.has(descrKey),
        `en.xml must contain string entry for description '${descrKey}' (preference '${key}')`
      );
    }
  });

  it('ensures all category sidebar tab names and group headers exist in en.xml', () => {
    const expectedTabs = ['general', 'ui', 'rendering', 'map_tools', 'plugins'];
    for (const tab of expectedTabs) {
      const tabKey = `prefs_tab_${tab}_name`;
      assert.ok(enDict.has(tabKey), `en.xml must define category tab entry '${tabKey}'`);
    }

    const expectedGroups = ['logging', 'logging_colours', 'display', 'scaling', 'snapping'];
    for (const grp of expectedGroups) {
      const grpKey = `prefs_group_${grp}`;
      assert.ok(enDict.has(grpKey), `en.xml must define preference group header '${grpKey}'`);
    }
  });

  it('ensures all visible built-in preferences, tabs, and groups have localized entries in fr.xml', () => {
    for (const [key, item] of Object.entries(BUILTIN_PREFERENCES)) {
      if (item.hidden) continue;

      assert.ok(item.i18nId, `Visible preference '${key}' must define an explicit i18nId`);
      assert.ok(
        frDict.has(item.i18nId!),
        `fr.xml must contain localized string entry for i18nId '${item.i18nId}' (preference '${key}')`
      );

      const descrKey = `${item.i18nId}_descr`;
      assert.ok(
        frDict.has(descrKey),
        `fr.xml must contain localized string entry for description '${descrKey}' (preference '${key}')`
      );
    }

    const expectedTabs = ['general', 'ui', 'rendering', 'map_tools', 'plugins'];
    for (const tab of expectedTabs) {
      const tabKey = `prefs_tab_${tab}_name`;
      assert.ok(frDict.has(tabKey), `fr.xml must define category tab entry '${tabKey}'`);
    }

    const expectedGroups = ['logging', 'logging_colours', 'display', 'scaling', 'snapping'];
    for (const grp of expectedGroups) {
      const grpKey = `prefs_group_${grp}`;
      assert.ok(frDict.has(grpKey), `fr.xml must define preference group header '${grpKey}'`);
    }
  });

  it('ensures compound controls and grouping are properly declared on log severity colors', () => {
    const warnPref = BUILTIN_PREFERENCES['general.logging.colours.level.warn'];
    assert.ok(warnPref);
    assert.deepEqual(warnPref.controls, ['text', 'colour']);
    assert.equal(warnPref.group, 'logging_colours');
    assert.equal(warnPref.groupOrder, 2);
    assert.equal(warnPref.order, 3);
  });

  it('validates schema, default values, and bounds constraints for mapTools preferences', () => {
    const zoomPref = BUILTIN_PREFERENCES['mapTools.mapViewport.zoomAmount'];
    assert.ok(zoomPref, 'mapTools.mapViewport.zoomAmount must be registered in BUILTIN_PREFERENCES');
    assert.equal(zoomPref.category, 'map_tools');
    assert.equal(zoomPref.type, 'number');
    assert.deepEqual(zoomPref.controls, ['slider', 'number']);
    assert.equal(zoomPref.defaultValue, 1.0);
    assert.equal(zoomPref.value, 1.0);
    assert.equal(zoomPref.minimum, 0.1);
    assert.equal(zoomPref.maximum, 5.0);
    assert.equal(zoomPref.step, 0.1);
    assert.equal(zoomPref.i18nId, 'prefs_mapTools_mapViewport_zoomAmount');
    assert.equal(zoomPref.group, 'scaling');
    assert.equal(zoomPref.groupOrder, 3);
    assert.equal(zoomPref.order, 1);

    const snapPref = BUILTIN_PREFERENCES['mapTools.snapping.distance'];
    assert.ok(snapPref, 'mapTools.snapping.distance must be registered in BUILTIN_PREFERENCES');
    assert.equal(snapPref.category, 'map_tools');
    assert.equal(snapPref.type, 'number');
    assert.deepEqual(snapPref.controls, ['number']);
    assert.equal(snapPref.unit, 'px');
    assert.equal(snapPref.defaultValue, 10);
    assert.equal(snapPref.value, 10);
    assert.equal(snapPref.minimum, 0);
    assert.equal(snapPref.maximum, 256);
    assert.equal(snapPref.step, 1);
    assert.equal(snapPref.i18nId, 'prefs_mapTools_snapping_distance');
    assert.equal(snapPref.group, 'snapping');
    assert.equal(snapPref.groupOrder, 2);
    assert.equal(snapPref.order, 1);
  });

  it('validates schema, default values, and bounds constraints for general.mapViewport.zoomAmount', () => {
    const pref = BUILTIN_PREFERENCES['general.mapViewport.zoomAmount'];
    assert.ok(pref, 'general.mapViewport.zoomAmount must be registered in BUILTIN_PREFERENCES');
    assert.equal(pref.category, 'general');
    assert.equal(pref.type, 'number');
    assert.deepEqual(pref.controls, ['spinner']);
    assert.equal(pref.defaultValue, 1.0);
    assert.equal(pref.value, 1.0);
    assert.equal(pref.minimum, 0.1);
    assert.equal(pref.maximum, 5.0);
    assert.equal(pref.step, 0.1);
    assert.equal(pref.i18nId, 'prefs_general_mapViewport_zoomAmount');
    assert.equal(pref.order, 40);
  });

  it('validates schema and default values for ui.layerProperties.fields.showNativeType', () => {
    const pref = BUILTIN_PREFERENCES['ui.layerProperties.fields.showNativeType'];
    assert.ok(pref, 'ui.layerProperties.fields.showNativeType must be registered in BUILTIN_PREFERENCES');
    assert.equal(pref.category, 'ui');
    assert.equal(pref.type, 'boolean');
    assert.deepEqual(pref.controls, ['checkbox']);
    assert.equal(pref.defaultValue, false);
    assert.equal(pref.value, false);
    assert.equal(pref.hidden, true);
    assert.equal(pref.i18nId, 'prefs_ui_layer_properties_fields_show_native_type');
  });

  it('validates ui.attributeTable.maxRows preference definition, reactive signal synchronization, and pagination i18n keys (#183)', async () => {
    const pref = BUILTIN_PREFERENCES['ui.attributeTable.maxRows'];
    assert.ok(pref, 'ui.attributeTable.maxRows must be registered in BUILTIN_PREFERENCES');
    assert.equal(pref.category, 'ui');
    assert.equal(pref.group, 'display');
    assert.equal(pref.type, 'number');
    assert.deepEqual(pref.controls, ['spinner']);
    assert.equal(pref.defaultValue, 5000);
    assert.equal(pref.value, 5000);
    assert.equal(pref.minimum, 100);
    assert.equal(pref.maximum, 100000);
    assert.equal(pref.step, 100);
    assert.equal(pref.hidden, false);
    assert.equal(pref.ephemeral, false);
    assert.equal(pref.i18nId, 'prefs_ui_attribute_table_max_rows');

    const requiredI18nKeys = [
      'prefs_ui_attribute_table_max_rows',
      'prefs_ui_attribute_table_max_rows_descr',
      'attribute_table_page_first',
      'attribute_table_page_prev',
      'attribute_table_page_next',
      'attribute_table_page_last',
      'attribute_table_page_range'
    ];
    for (const key of requiredI18nKeys) {
      assert.ok(enDict.has(key), `en.xml must contain key '${key}'`);
      assert.ok(frDict.has(key), `fr.xml must contain key '${key}'`);
    }

    assert.equal(prefsAttributeTableMaxRows.value, 5000);

    const prevWindow = (globalThis as any).window;
    (globalThis as any).window = {
      ...(prevWindow || {}),
      electronAPI: {
        ...(prevWindow?.electronAPI || {}),
        getPreferenceValue: async () => ({
          'ui.attributeTable.maxRows': {
            ...pref,
            value: 2000
          }
        }),
        setPreferenceValue: async (_name: string, val: any) => ({
          'ui.attributeTable.maxRows': {
            ...pref,
            value: val
          }
        })
      }
    };

    try {
      await loadPreferences('ui.attributeTable.maxRows');
      assert.equal(prefsAttributeTableMaxRows.value, 2000);

      await updatePreference('ui.attributeTable.maxRows', 10000);
      assert.equal(prefsAttributeTableMaxRows.value, 10000);
    } finally {
      prefsAttributeTableMaxRows.value = 5000;
      (globalThis as any).window = prevWindow;
    }
  });

  it('validates canonical control types across all built-in preferences', () => {
    const validControls: Set<PreferenceControlType> = new Set([
      'text',
      'multiline-text',
      'colour',
      'color',
      'checkbox',
      'button',
      'toggle',
      'range',
      'spinner',
      'number',
      'slider',
      'dropdown',
      'image',
      'radio-button',
      'button-group',
      'checkbox-group'
    ]);

    for (const [key, item] of Object.entries(BUILTIN_PREFERENCES)) {
      if (item.controls) {
        assert.ok(Array.isArray(item.controls), `Preference '${key}' controls must be an array`);
        for (const ctrl of item.controls) {
          assert.ok(validControls.has(ctrl), `Preference '${key}' contains unrecognized control variant '${ctrl}'`);
        }
      }
    }
  });

  it('correctly sorts groups by minGroupOrder and items by order ascending', () => {
    interface TestItem {
      key: string;
      order?: number;
      group?: string;
      groupOrder?: number;
    }

    const testItems: TestItem[] = [
      { key: 'ungrouped-2', order: 20 },
      { key: 'group-b-2', group: 'grp-b', groupOrder: 2, order: 200 },
      { key: 'group-a-1', group: 'grp-a', groupOrder: 1, order: 10 },
      { key: 'ungrouped-1', order: 10 },
      { key: 'group-b-1', group: 'grp-b', groupOrder: 2, order: 100 },
      { key: 'group-a-2', group: 'grp-a', groupOrder: 1, order: 20 }
    ];

    // Grouping logic simulation
    const groupMap = new Map<string, { key: string; minGroupOrder: number; items: TestItem[] }>();
    for (const item of testItems) {
      const gKey = item.group || '';
      if (!groupMap.has(gKey)) {
        groupMap.set(gKey, { key: gKey, minGroupOrder: Infinity, items: [] });
      }
      const gData = groupMap.get(gKey)!;
      if (item.groupOrder !== undefined && item.groupOrder < gData.minGroupOrder) {
        gData.minGroupOrder = item.groupOrder;
      }
      gData.items.push(item);
    }

    for (const grp of groupMap.values()) {
      grp.items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    const named = Array.from(groupMap.values()).filter((g) => g.key !== '');
    named.sort((a, b) => a.minGroupOrder - b.minGroupOrder);

    assert.equal(named[0].key, 'grp-a');
    assert.deepEqual(named[0].items.map((i) => i.key), ['group-a-1', 'group-a-2']);

    assert.equal(named[1].key, 'grp-b');
    assert.deepEqual(named[1].items.map((i) => i.key), ['group-b-1', 'group-b-2']);

    const ungrouped = groupMap.get('')!;
    assert.deepEqual(ungrouped.items.map((i) => i.key), ['ungrouped-1', 'ungrouped-2']);
  });

  it('validates text regex patterns logic', () => {
    const patterns = ['^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$', '^rgba?\\('];

    function isValid(val: string, specifiers?: string[]): boolean {
      if (!specifiers || specifiers.length === 0) return true;
      return specifiers.some((p) => new RegExp(p).test(val));
    }

    assert.equal(isValid('#ffffff', patterns), true);
    assert.equal(isValid('#fff', patterns), true);
    assert.equal(isValid('rgb(255, 0, 0)', patterns), true);
    assert.equal(isValid('invalid-color', patterns), false);
    assert.equal(isValid('anything', undefined), true);
  });
});

