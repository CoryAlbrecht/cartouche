/**
 * @file stateDirectoryTree.test.ts
 * @module tests/shared/metadata/stateDirectoryTree.test
 * @description Unit tests verifying that Section 3 of state.md accurately reflects the workspace directory structure without missing paths.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see scripts/validate-directory-tree.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_REQUIRED_SUBSYSTEMS,
  parseDirectoryTree,
  validateDirectoryTree,
} from '../../../scripts/validate-directory-tree.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../../../');
const statePath = path.resolve(workspaceRoot, '.agents/memory/state.md');

describe('state.md Directory Layout Tree Validation', () => {
  it('parses directory tree lines into structured entries with full paths', () => {
    const sampleTree = `
/home/cory/Documents/Cartouche/
├── .agents/               # AI directives
│   └── memory/            # Memory
│       └── state.md       # State md
├── AGENTS.md              # Directives
└── cartouche/             # Repository root
    └── package.json       # Manifest
`;
    const entries = parseDirectoryTree(sampleTree, workspaceRoot);
    assert.ok(entries.length >= 5, 'Expected at least 5 parsed entries');

    const stateEntry = entries.find((e) => e.name === 'state.md');
    assert.ok(stateEntry, 'Expected state.md entry to exist');
    assert.strictEqual(
      stateEntry.fullPath,
      path.join(workspaceRoot, '.agents', 'memory', 'state.md')
    );
    assert.strictEqual(stateEntry.comment, 'State md');
  });

  it('detects missing filesystem paths in simulated trees', () => {
    const sampleWithMissing = `
/home/cory/Documents/Cartouche/
├── nonexistent-directory-12345/ # Missing dir
└── AGENTS.md                    # Exists
`;
    const entries = parseDirectoryTree(sampleWithMissing, workspaceRoot);
    const result = validateDirectoryTree({
      workspaceRoot,
      entries,
      requiredSubsystems: [],
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.missingPaths.length, 1);
    assert.ok(result.missingPaths[0].includes('nonexistent-directory-12345'));
  });

  it('verifies that all entries in state.md exist on disk and required subsystems are present', () => {
    const result = validateDirectoryTree({
      workspaceRoot,
      statePath,
      requiredSubsystems: [...DEFAULT_REQUIRED_SUBSYSTEMS],
    });

    if (!result.isValid) {
      assert.fail(
        `Directory tree validation failed with ${result.missingPaths.length} missing paths:\n` +
          result.missingPaths.join('\n')
      );
    }

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.missingPaths.length, 0);
    assert.ok(result.totalEntries > 40, `Expected at least 40 entries, got ${result.totalEntries}`);
  });
});

