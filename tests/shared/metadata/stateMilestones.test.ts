/**
 * @file stateMilestones.test.ts
 * @module tests/shared/metadata/stateMilestones.test
 * @description Unit tests verifying fixed-size milestone archiving, active milestone limits (< 20), and archive file integrity.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see scripts/archive-milestones.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_ACTIVE_MILESTONES,
  ARCHIVE_CHUNK_SIZE,
  parseMilestones,
  deduplicateMilestones,
  getArchiveFiles,
  archiveStateMilestones,
} from '../../../scripts/archive-milestones.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../../../');
const memoryDir = path.resolve(workspaceRoot, '.agents/memory');
const statePath = path.resolve(memoryDir, 'state.md');

describe('Fixed-Size Milestone Archiving & Integrity (ADR 0014)', () => {
  it('parses numbered milestone entries from markdown blocks', () => {
    const sample = `
101. First Feature:
    - Bullet 1
    * Sub-bullet

102. Second Feature:
    - Bullet 2
`;
    const milestones = parseMilestones(sample);
    assert.strictEqual(milestones.length, 2);
    assert.strictEqual(milestones[0].number, 101);
    assert.strictEqual(milestones[0].title, 'First Feature:');
    assert.ok(milestones[0].rawText.includes('- Bullet 1'));
    assert.strictEqual(milestones[1].number, 102);
  });

  it('deduplicates consecutive identical milestone entries', () => {
    const sampleMilestones = [
      { number: 101, title: 'Item 1', rawText: '101. Item 1' },
      { number: 102, title: 'Item 2', rawText: '102. Item 2' },
      { number: 102, title: 'Item 2', rawText: '102. Item 2' },
      { number: 103, title: 'Item 3', rawText: '103. Item 3' },
    ];
    const deduplicated = deduplicateMilestones(sampleMilestones);
    assert.strictEqual(deduplicated.length, 3);
    assert.deepStrictEqual(
      deduplicated.map((m) => m.number),
      [101, 102, 103]
    );
  });

  it('verifies that state.md contains fewer than 20 active milestones', () => {
    assert.ok(fs.existsSync(statePath), `state.md must exist at ${statePath}`);
    const stateContent = fs.readFileSync(statePath, 'utf8');
    const sec5 = stateContent.split('## 5. Completed Milestones')[1];
    assert.ok(sec5, 'Section 5 must be present in state.md');

    const activeMilestones = deduplicateMilestones(parseMilestones(sec5));
    assert.ok(
      activeMilestones.length < MAX_ACTIVE_MILESTONES,
      `state.md contains ${activeMilestones.length} active milestones; must be strictly < ${MAX_ACTIVE_MILESTONES}`
    );
  });

  it('verifies that all archive files contain at most 20 milestones and form a contiguous sequence', () => {
    const archives = getArchiveFiles(memoryDir);
    assert.ok(archives.length >= 6, `Expected at least 6 archive files, found ${archives.length}`);

    let expectedStart = 1;
    for (let i = 0; i < archives.length; i++) {
      const archive = archives[i];
      assert.strictEqual(
        archive.index,
        i + 1,
        `Archive index must be strictly sequential (expected ${i + 1}, got ${archive.index})`
      );
      assert.ok(
        archive.count <= ARCHIVE_CHUNK_SIZE,
        `Archive ${archive.fileName} has ${archive.count} milestones; must be <= ${ARCHIVE_CHUNK_SIZE}`
      );
      assert.strictEqual(
        archive.startMilestone,
        expectedStart,
        `Archive ${archive.fileName} must start at milestone ${expectedStart}`
      );

      // Verify header navigation links
      const content = fs.readFileSync(archive.filePath, 'utf8');
      assert.ok(content.includes('# Cartouche Milestones Archive'), 'Archive must have standard header');
      assert.ok(content.includes('> - **Previous Archive**:'), 'Archive must have Previous link');
      assert.ok(content.includes('> - **Next Archive**:'), 'Archive must have Next link');
      assert.ok(content.includes('> - **Active State**:'), 'Archive must have Active State link');

      expectedStart = archive.endMilestone + 1;
    }
  });

  it('confirms archiveStateMilestones reports clean check status', () => {
    const result = archiveStateMilestones({
      workspaceRoot,
      statePath,
      memoryDir,
      checkOnly: true,
    });

    assert.strictEqual(result.archived, false);
    assert.ok(result.finalActiveCount < MAX_ACTIVE_MILESTONES);
  });
});

