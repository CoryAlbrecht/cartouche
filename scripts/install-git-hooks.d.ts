/**
 * @file install-git-hooks.d.ts
 * @module scripts/install-git-hooks
 * @description Type declarations for the git hooks installer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see scripts/install-git-hooks.js
 */

/** Repository-relative hooks directory written to `core.hooksPath`. */
export declare const HOOKS_PATH: string;

/**
 * Sets `core.hooksPath` in the repository at `cwd`; `false` outside a git work tree.
 * @param cwd - Directory inside the repository to configure.
 * @returns `true` when the hooks path was configured.
 */
export declare function installGitHooks(cwd?: string): boolean;
