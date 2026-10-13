/**
 * @file actionParity.test.ts
 * @module tests/main/actions/actionParity.test
 * @description Unit tests verifying action registry parity, ensuring every BUILTIN_ACTION maps to a localized string in en.xml and has a valid functionCall where expected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link BUILTIN_ACTIONS}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUILTIN_ACTIONS } from '../../../src/main/actions/defaults';

describe('actionParity', () => {
  const enXmlPath = path.resolve(process.cwd(), 'assets/xml/i18n/en.xml');
  const enXmlContent = fs.readFileSync(enXmlPath, 'utf-8');
  const frXmlPath = path.resolve(process.cwd(), 'assets/xml/i18n/fr.xml');
  const frXmlContent = fs.readFileSync(frXmlPath, 'utf-8');

  it('ensures every BUILTIN_ACTION has a corresponding localized string entry in en.xml', () => {
    const stringNameRegex = /<string\s+name=["']([^"']+)["']/g;
    const definedI18nKeys = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = stringNameRegex.exec(enXmlContent)) !== null) {
      definedI18nKeys.add(match[1]);
    }

    const missingKeys: string[] = [];
    for (const action of BUILTIN_ACTIONS) {
      if (!definedI18nKeys.has(action.name)) {
        missingKeys.push(action.name);
      }
    }

    assert.deepEqual(
      missingKeys,
      [],
      `The following builtin actions are missing <string name="..."> entries in assets/xml/i18n/en.xml: ${missingKeys.join(', ')}`
    );
  });

  it('ensures core project and layer actions have matching entries in fr.xml', () => {
    const stringNameRegex = /<string\s+name=["']([^"']+)["']/g;
    const definedFrKeys = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = stringNameRegex.exec(frXmlContent)) !== null) {
      definedFrKeys.add(match[1]);
    }

    const coreProjectActions = [
      'new_project',
      'open_project',
      'close_project',
      'save_project',
      'save_as_project',
      'save_active_layer',
      'save_active_layer_as'
    ];

    for (const key of coreProjectActions) {
      assert.ok(
        definedFrKeys.has(key),
        `Action "${key}" must have a localized entry in assets/xml/i18n/fr.xml`
      );
    }
  });

  it('verifies migrated project and layer keyboard shortcuts conform to spec', () => {
    const actionsMap = new Map(BUILTIN_ACTIONS.map(a => [a.name, a]));

    const saveProject = actionsMap.get('save_project');
    assert.deepEqual(saveProject?.keyCombination, { key: 's', ctrl: true, alt: true });

    const saveAsProject = actionsMap.get('save_as_project');
    assert.deepEqual(saveAsProject?.keyCombination, { key: 's', ctrl: true, alt: true, shift: true });

    const openProject = actionsMap.get('open_project');
    assert.deepEqual(openProject?.keyCombination, { key: 'o', ctrl: true, alt: true });

    const newProject = actionsMap.get('new_project');
    assert.deepEqual(newProject?.keyCombination, { key: 'n', ctrl: true, alt: true });

    const closeProject = actionsMap.get('close_project');
    assert.deepEqual(closeProject?.keyCombination, { key: 'w', ctrl: true });

    const saveActiveLayer = actionsMap.get('save_active_layer');
    assert.deepEqual(saveActiveLayer?.keyCombination, { key: 's', ctrl: true });

    const saveActiveLayerAs = actionsMap.get('save_active_layer_as');
    assert.deepEqual(saveActiveLayerAs?.keyCombination, { key: 's', ctrl: true, shift: true });

    const cancelAction = actionsMap.get('cancel_action');
    assert.deepEqual(cancelAction?.keyCombination, { key: 'Escape' });
  });

  it('ensures every BUILTIN_ACTION that defines a functionCall has a callable function', () => {
    for (const action of BUILTIN_ACTIONS) {
      if (action.functionCall !== undefined) {
        assert.equal(
          typeof action.functionCall,
          'function',
          `Action "${action.name}" defines a functionCall that is not a function.`
        );
      }
    }
  });

  it('ensures all BUILTIN_ACTIONS have non-empty name, description, and valid key combinations if defined', () => {
    for (const action of BUILTIN_ACTIONS) {
      assert.ok(action.name && action.name.trim().length > 0, 'Action name must not be empty');
      assert.ok(action.description && action.description.trim().length > 0, `Action "${action.name}" description must not be empty`);
      if (action.keyCombination) {
        assert.ok(action.keyCombination.key, `Action "${action.name}" key combination must define a key`);
      }
    }
  });
});

