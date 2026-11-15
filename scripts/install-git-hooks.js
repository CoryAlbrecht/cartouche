/**
 * @file install-git-hooks.js
 * @module scripts/install-git-hooks
 * @description Points the clone's `core.hooksPath` at the tracked `scripts/git-hooks/` directory so every clone runs the same hooks, including the protected-branch check that refuses commits on `main` and `release/*` (ADR 0031). Runs from the npm `prepare` lifecycle; outside a git work tree (e.g. an unpacked tarball) it does nothing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see scripts/git-hooks/check-protected-branch.sh
 */

import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @description Repository-relative hooks directory written to `core.hooksPath`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @type {string}
 */
export const HOOKS_PATH = 'scripts/git-hooks';

/**
 * @description Sets `core.hooksPath` to {@link HOOKS_PATH} in the git repository at `cwd`. Returns `false` instead of throwing when `cwd` is not inside a git work tree or git is unavailable.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @param {string} [cwd=process.cwd()] - Directory inside the repository to configure.
 * @returns {boolean} `true` when the hooks path was configured.
 */
export function installGitHooks(cwd = process.cwd()) {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, stdio: 'ignore' });
    execFileSync('git', ['config', 'core.hooksPath', HOOKS_PATH], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  if (installGitHooks()) {
    console.log(`git hooks: core.hooksPath -> ${HOOKS_PATH}`);
  }
}
