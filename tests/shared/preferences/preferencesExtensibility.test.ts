/**
 * @file preferencesExtensibility.test.ts
 * @module tests/shared/preferences/preferencesExtensibility.test
 * @description Unit tests verifying declarative preference controls, grouping attributes, order sorting, and i18n XML localization dictionary parity.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
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
import type { PreferenceItem, PreferenceControlType } from '../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Extensible Preferences Subsystem Contracts', () => {
  const enXmlPath = path.join(__dirname, '../../../assets/xml/i18n/en.xml');
  const xmlContent = fs.readFileSync(enXmlPath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
  });
  const parsed = parser.parse(xmlContent);
  const root = parsed['ci18n:localization'] || parsed.localization;
  const rawStrings = Array.isArray(root.string) ? root.string : [root.string];
  const enDict = new Set<string>();
  for (const item of rawStrings) {
    if (item && item['@_name']) {
      enDict.add(item['@_name']);
    }
  }

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
    const expectedTabs = ['general', 'ui', 'rendering', 'plugins'];
    for (const tab of expectedTabs) {
      const tabKey = `prefs_tab_${tab}_name`;
      assert.ok(enDict.has(tabKey), `en.xml must define category tab entry '${tabKey}'`);
    }

    const expectedGroups = ['logging', 'logging_colours', 'display'];
    for (const grp of expectedGroups) {
      const grpKey = `prefs_group_${grp}`;
      assert.ok(enDict.has(grpKey), `en.xml must define preference group header '${grpKey}'`);
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

