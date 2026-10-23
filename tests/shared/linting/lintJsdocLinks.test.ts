/**
 * @file lintJsdocLinks.test.ts
 * @module tests/shared/linting/lintJsdocLinks.test
 * @description Unit tests verifying JSDoc symbol link validation, path detection, and whole-codebase compliance.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see scripts/lint-jsdoc-links.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isFilePathTarget,
  checkJsdocLinks,
  runJsdocLinkLinter
} from '../../../scripts/lint-jsdoc-links.js';

describe('JSDoc Symbol Link Linter (scripts/lint-jsdoc-links.js)', () => {
  it('correctly identifies file paths and document extensions in {@link} targets', () => {
    assert.strictEqual(isFilePathTarget('docs/adr/0010.md'), true);
    assert.strictEqual(isFilePathTarget('../scripts/validate.js'), true);
    assert.strictEqual(isFilePathTarget('foo\\bar'), true);
    assert.strictEqual(isFilePathTarget('style.css'), true);
    assert.strictEqual(isFilePathTarget('schema.json'), true);
    assert.strictEqual(isFilePathTarget('component.tsx'), true);

    // Valid code symbols
    assert.strictEqual(isFilePathTarget('LayerTreeWidget'), false);
    assert.strictEqual(isFilePathTarget('ProjectModel'), false);
    assert.strictEqual(isFilePathTarget('validateDirectoryTree'), false);
    assert.strictEqual(isFilePathTarget('LogLevel'), false);
  });

  it('detects invalid file-path links in multiline source text', () => {
    const fixture = [
      '/**',
      ' * @see {@link LayerTreeWidget}',
      ' * @see {@' + 'link docs/adr/0010-layer-tree.md}',
      ' * @see docs/valid-text-link.md',
      ' */'
    ].join('\n');

    const violations = checkJsdocLinks('sample.ts', fixture);
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].lineNumber, 3);
    assert.strictEqual(violations[0].target, 'docs/adr/0010-layer-tree.md');
    assert.match(violations[0].message, /must only reference code symbols/);
  });

  it('passes cleanly across the entire production codebase', () => {
    const result = runJsdocLinkLinter();
    assert.ok(result.totalFiles > 100, `Expected > 100 scanned files, got ${result.totalFiles}`);
    assert.deepStrictEqual(result.violations, [], 'Expected zero JSDoc link violations in repository');
  });
});
