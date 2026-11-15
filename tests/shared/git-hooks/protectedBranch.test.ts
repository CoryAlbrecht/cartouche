/**
 * @file protectedBranch.test.ts
 * @module tests/shared/git-hooks/protectedBranch.test
 * @description Tests the ADR 0031 protected-branch check (`scripts/git-hooks/check-protected-branch.sh`) against throwaway git repositories, the pre-commit wiring that runs it first, and the `core.hooksPath` installer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see scripts/git-hooks/check-protected-branch.sh
 * @see scripts/install-git-hooks.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { HOOKS_PATH, installGitHooks } from '../../../scripts/install-git-hooks.js';

const HOOKS_DIR = resolve(import.meta.dirname, '../../../scripts/git-hooks');
const CHECK_SCRIPT = join(HOOKS_DIR, 'check-protected-branch.sh');

/**
 * @function git
 * @description Runs a git command in `cwd` with a fixed identity, throwing on failure.
 * @param {string} cwd - Repository directory.
 * @param {string[]} args - Git arguments.
 * @returns {string} Trimmed stdout.
 */
function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'core.hooksPath=/dev/null', ...args],
    { cwd, encoding: 'utf8' },
  ).trim();
}

/**
 * @function runCheck
 * @description Runs the protected-branch check in `cwd`.
 * @param {string} cwd - Repository directory.
 * @returns {{ status: number | null, stderr: string }} Exit status and stderr.
 */
function runCheck(cwd: string): { status: number | null; stderr: string } {
  const result = spawnSync('bash', [CHECK_SCRIPT], { cwd, encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr };
}

describe('protected-branch pre-commit check (scripts/git-hooks/check-protected-branch.sh)', () => {
  let repo: string;

  before(() => {
    repo = mkdtempSync(join(tmpdir(), 'cartouche-hooks-'));
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'root');
  });

  after(() => rmSync(repo, { recursive: true, force: true }));

  it('refuses commits on main and names the fix', () => {
    git(repo, 'switch', '-q', 'main');
    const r = runCheck(repo);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Direct commits to 'main' are prohibited/);
    assert.match(r.stderr, /git switch -c/);
  });

  it('refuses commits on release branches', () => {
    git(repo, 'switch', '-q', '-c', 'release/v0.1.x', 'main');
    assert.equal(runCheck(repo).status, 1);
  });

  it('allows commits on ticket and ticketless work branches', () => {
    git(repo, 'switch', '-q', '-c', 'fix/228-gradient-anchoring', 'main');
    assert.equal(runCheck(repo).status, 0);
    git(repo, 'switch', '-q', '-c', 'style/theme-contrast', 'main');
    assert.equal(runCheck(repo).status, 0);
  });

  it('does not mistake a branch merely containing "main" for main', () => {
    git(repo, 'switch', '-q', '-c', 'chore/main-menu', 'main');
    assert.equal(runCheck(repo).status, 0);
  });

  it('allows a detached HEAD', () => {
    git(repo, 'switch', '-q', '--detach', 'main');
    assert.equal(runCheck(repo).status, 0);
  });

  it('allows concluding an in-progress merge on main', () => {
    git(repo, 'switch', '-q', '-c', 'feat/200-layer-styling', 'main');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'spec work');
    git(repo, 'switch', '-q', 'main');
    git(repo, 'merge', '--no-ff', '--no-commit', 'feat/200-layer-styling');
    assert.equal(runCheck(repo).status, 0);
    git(repo, 'merge', '--abort');
    assert.equal(runCheck(repo).status, 1);
  });
});

describe('pre-commit hook wiring (scripts/git-hooks/pre-commit)', () => {
  it('refuses a real commit on main when installed via core.hooksPath, before any other step runs', () => {
    const repo = mkdtempSync(join(tmpdir(), 'cartouche-hooks-'));
    try {
      git(repo, 'init', '-q', '-b', 'main');
      cpSync(HOOKS_DIR, join(repo, HOOKS_PATH), { recursive: true });
      assert.equal(installGitHooks(repo), true);
      const result = spawnSync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'on main'],
        { cwd: repo, encoding: 'utf8' },
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Direct commits to 'main' are prohibited/);
      assert.doesNotMatch(result.stderr + result.stdout, /lint:jsdoc/, 'later pre-commit steps must not run');
      assert.throws(() => git(repo, 'rev-parse', '--verify', 'HEAD'), 'no commit may be created');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('git hooks installer (scripts/install-git-hooks.js)', () => {
  it('points core.hooksPath at scripts/git-hooks inside a work tree', () => {
    const repo = mkdtempSync(join(tmpdir(), 'cartouche-hooks-'));
    try {
      git(repo, 'init', '-q');
      assert.equal(installGitHooks(repo), true);
      assert.equal(execFileSync('git', ['config', 'core.hooksPath'], { cwd: repo, encoding: 'utf8' }).trim(), HOOKS_PATH);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('returns false outside a git work tree', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cartouche-nogit-'));
    try {
      assert.equal(installGitHooks(dir), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
