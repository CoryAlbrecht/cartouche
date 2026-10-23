/**
 * @file lintGlossary.test.ts
 * @module tests/shared/linting/lintGlossary.test
 * @description Unit tests verifying domain glossary parsing, prohibited term detection, and git diff inspection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see scripts/lint-glossary.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveGlossaryPath,
  parseGlossaryRules,
  checkLineForViolations,
  checkGitDiff,
  type ProhibitedTermRule
} from '../../../scripts/lint-glossary.js';

describe('Domain Glossary Terminology Linter (scripts/lint-glossary.js)', () => {
  const glossaryPath = resolveGlossaryPath();
  const rules = parseGlossaryRules(glossaryPath);

  it('resolves GLOSSARY.md and extracts canonical avoidance rules', () => {
    assert.ok(glossaryPath.endsWith('GLOSSARY.md'));
    assert.ok(rules.length > 50, `Expected > 50 rules, got ${rules.length}`);

    // Verify key canonical rules exist
    const nodelineRule = rules.find((r: ProhibitedTermRule) => r.avoid.toLowerCase() === 'nodeline');
    assert.ok(nodelineRule, 'Nodeline rule must be extracted');
    assert.strictEqual(nodelineRule.canonical, 'Tree Node Row');

    const mainWindowRule = rules.find((r: ProhibitedTermRule) => r.avoid.toLowerCase() === 'main window');
    assert.ok(mainWindowRule, 'Main window rule must be extracted');
    assert.strictEqual(mainWindowRule.canonical, 'Workbench');
  });

  it('detects prohibited domain terms in code or test strings', () => {
    const violation1 = checkLineForViolations(
      "describe('LayerTreeWidget " + "Nodeline" + " Layout', () => {",
      rules
    );
    assert.ok(violation1);
    assert.strictEqual(violation1.matchedTerm, 'Nodeline');
    assert.strictEqual(violation1.canonicalTerm, 'Tree Node Row');

    const violation2 = checkLineForViolations(
      "const frame = 'Primary " + "frame" + "';",
      rules
    );
    assert.ok(violation2);
    assert.strictEqual(violation2.matchedTerm, 'Primary frame');
    assert.strictEqual(violation2.canonicalTerm, 'Workbench');
  });

  it('allows canonical domain terminology without flagging false positives', () => {
    const cleanLine1 = "describe('LayerTreeWidget Tree Node Row Layout', () => {";
    assert.strictEqual(checkLineForViolations(cleanLine1, rules), null);

    const cleanLine2 = "const appShell = 'Workbench';";
    assert.strictEqual(checkLineForViolations(cleanLine2, rules), null);
  });

  it('verifies that current git working tree is clean of prohibited terms', () => {
    const violations = checkGitDiff({ staged: false, rules });
    assert.deepStrictEqual(violations, [], 'Expected zero glossary violations in git diff');
  });
});
