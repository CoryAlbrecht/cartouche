/**
 * @file actionParity.test.ts
 * @module tests/main/actions/actionParity.test
 * @description Unit tests verifying action registry parity, ensuring every BUILTIN_ACTION maps to a localized string in en.xml and has a valid functionCall where expected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
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

  it('ensures every BUILTIN_ACTION has a corresponding localized string entry in en.xml', () => {
    // Extract all <string name="..."> entries from en.xml
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

