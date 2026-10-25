/**
 * @file lintGlossary.test.ts
 * @module tests/shared/linting/lintGlossary.test
 * @description Unit tests verifying domain glossary parsing, prohibited term detection, and git diff inspection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @see scripts/lint-glossary.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolveGlossaryPath,
  parseGlossaryRules,
  checkLineForViolations,
  isMatchCoveredByCanonical,
  isMatchCoveredByAllowedPhrase,
  checkGitDiff,
  ALLOWED_COMPOUND_PHRASES,
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

  it('distinguishes between Dropdown form controls and prohibited Dropdown menu for popup menus', () => {
    // Dropdown as a form control must be permitted
    const formControlLine = "const controlType = 'dropdown';";
    assert.strictEqual(checkLineForViolations(formControlLine, rules), null);

    // Dropdown menu must be flagged as prohibited
    const popupMenuViolation = checkLineForViolations(
      "const menu = 'drop" + "down menu';",
      rules
    );
    assert.ok(popupMenuViolation);
    assert.strictEqual(popupMenuViolation.matchedTerm.toLowerCase(), 'dropdown menu');
    assert.ok(
      popupMenuViolation.canonicalTerm === 'PopupMenu' || popupMenuViolation.canonicalTerm === 'Dropdown'
    );
  });

  it('allows canonical Project Dirty State and Layer Dirty State while flagging bare dirty state', () => {
    // Canonical compound terms must not be flagged
    assert.strictEqual(checkLineForViolations("project.setDirty(Project Dirty State);", rules), null);
    assert.strictEqual(checkLineForViolations("layer.setDirty(Layer Dirty State);", rules), null);

    // Bare dirty state must be flagged
    const bareViolation = checkLineForViolations(
      "checkIfModified('has " + "dirty state" + "');",
      rules
    );
    assert.ok(bareViolation);
    assert.strictEqual(bareViolation.matchedTerm.toLowerCase(), 'dirty state');
    assert.strictEqual(bareViolation.canonicalTerm, 'Project Dirty State');
  });

  it('verifies isMatchCoveredByCanonical enclosure testing', () => {
    const canonicals = ['Project Dirty State', 'Layer Dirty State', 'Dropdown'];

    // Enclosed inside canonical term
    const line1 = 'This tracks Project Dirty State.';
    const idx1 = line1.indexOf('Dirty State');
    assert.strictEqual(
      isMatchCoveredByCanonical(line1, idx1, 'Dirty State'.length, 'Dirty state', canonicals),
      true
    );

    // Not enclosed
    const line2 = 'This tracks dirty state.';
    const idx2 = line2.indexOf('dirty state');
    assert.strictEqual(
      isMatchCoveredByCanonical(line2, idx2, 'dirty state'.length, 'Dirty state', canonicals),
      false
    );

    // Candidate that is shorter than avoid term should not cover it
    assert.strictEqual(
      isMatchCoveredByCanonical('A dropdown menu', 2, 'dropdown menu'.length, 'dropdown menu', ['Dropdown']),
      false
    );
  });

  it('allows legitimate technical compound phrases in non-domain CLI, filesystem, and font fallback contexts', () => {
    // CLI commands permitted
    assert.strictEqual(checkLineForViolations('// Execute command-line utility', rules), null);
    assert.strictEqual(checkLineForViolations('const cli = "parse command line args";', rules), null);
    assert.strictEqual(checkLineForViolations('const run = app.commandLine.appendSwitch;', rules), null);

    // Standalone prohibited Command flagged
    const commandViolation = checkLineForViolations('const cmd = "Run ' + 'Command";', rules);
    assert.ok(commandViolation);
    assert.strictEqual(commandViolation.matchedTerm.toLowerCase(), 'command');
    assert.strictEqual(commandViolation.canonicalTerm, 'Action');

    // Filesystem directory/folder phrases permitted
    assert.strictEqual(checkLineForViolations('// resolve folder path on disk', rules), null);
    assert.strictEqual(checkLineForViolations('// Find boundaries of memory folder entries', rules), null);
    assert.strictEqual(checkLineForViolations('const cacheDir = getTemp' + 'Folder();', rules), null);

    // Standalone prohibited Folder flagged
    const folderViolation = checkLineForViolations('const group = "Layer ' + 'folder";', rules);
    assert.ok(folderViolation);
    assert.strictEqual(folderViolation.canonicalTerm, 'LayerGroup');

    // Font fallback phrases permitted
    assert.strictEqual(checkLineForViolations('/* monospace system fonts fallback */', rules), null);
    assert.strictEqual(checkLineForViolations('const stack = "operating system fonts";', rules), null);

    // Standalone prohibited System fonts flagged
    const fontViolation = checkLineForViolations('const font = "system ' + 'fonts";', rules);
    assert.ok(fontViolation);
    assert.strictEqual(fontViolation.canonicalTerm, 'Bundled Fonts');
  });

  it('verifies isMatchCoveredByAllowedPhrase compound protection', () => {
    const line = '/* CLI command-line argument */';
    const idx = line.indexOf('command');
    assert.strictEqual(
      isMatchCoveredByAllowedPhrase(line, idx, 'command'.length, 'Command', ALLOWED_COMPOUND_PHRASES),
      true
    );

    const bareLine = '/* Execute command now */';
    const bareIdx = bareLine.indexOf('command');
    assert.strictEqual(
      isMatchCoveredByAllowedPhrase(bareLine, bareIdx, 'command'.length, 'Command', ALLOWED_COMPOUND_PHRASES),
      false
    );
  });

  it('inspects untracked files in working tree diff check when not staged', () => {
    const cwd = process.cwd();
    const tempFile = path.resolve(cwd, 'temp-untracked-lint-test.ts');

    try {
      // Write a temporary untracked file with a prohibited term
      fs.writeFileSync(tempFile, 'const item = "nodeline";\n', 'utf8');

      const violations = checkGitDiff({ staged: false, cwd, rules, includeUntracked: true });
      const found = violations.find((v) => v.filePath.includes('temp-untracked-lint-test.ts'));
      assert.ok(found, 'Must detect prohibited term in untracked file');
      assert.strictEqual(found.matchedTerm, 'nodeline');
      assert.strictEqual(found.canonicalTerm, 'Tree Node Row');
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  it('verifies that current git working tree is clean of prohibited terms', () => {
    const violations = checkGitDiff({ staged: false, rules });
    assert.deepStrictEqual(violations, [], 'Expected zero glossary violations in git diff');
  });
});
