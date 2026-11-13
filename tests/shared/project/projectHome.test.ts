/**
 * @file projectHome.test.ts
 * @module tests/shared/project/projectHome.test
 * @description Unit tests for the platform-neutral Project Home helpers used by the renderer draft: project file directory extraction, the effective Project Home rule, and directory normalisation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link resolveEffectiveProjectHome}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectFileDirectory,
  resolveEffectiveProjectHome,
  normalizeDirectoryPath,
} from '../../../src/shared/project/projectHome';

describe('projectHome helpers (Ticket #274)', () => {
  it('extracts the directory of a project file for both separator styles', () => {
    assert.equal(projectFileDirectory('/projects/atlas/atlas.cproj'), '/projects/atlas');
    assert.equal(projectFileDirectory('C:\\maps\\world\\world.cproj'), 'C:\\maps\\world');
    assert.equal(projectFileDirectory('/root.cproj'), '/');
    assert.equal(projectFileDirectory('C:\\root.cproj'), 'C:\\');
    assert.equal(projectFileDirectory('bare.cproj'), null);
    assert.equal(projectFileDirectory(null), null);
  });

  it('prefers the explicit home, then the file directory, then null', () => {
    assert.equal(resolveEffectiveProjectHome('/gis/data', '/projects/atlas/atlas.cproj'), '/gis/data');
    assert.equal(resolveEffectiveProjectHome('  ', '/projects/atlas/atlas.cproj'), '/projects/atlas');
    assert.equal(resolveEffectiveProjectHome(null, null), null);
  });

  it('normalises trailing separators for comparisons', () => {
    assert.equal(normalizeDirectoryPath('/projects/atlas/'), '/projects/atlas');
    assert.equal(normalizeDirectoryPath(' /projects/atlas '), '/projects/atlas');
    assert.equal(normalizeDirectoryPath('/'), '/');
    assert.equal(normalizeDirectoryPath('C:\\'), 'C:\\');
    assert.equal(normalizeDirectoryPath(null), '');
  });
});
