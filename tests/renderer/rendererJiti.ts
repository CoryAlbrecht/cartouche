/**
 * @file rendererJiti.ts
 * @module tests/renderer/rendererJiti
 * @description Shared jiti loader for renderer tests: transpiles TSX and maps the `@renderer`, `@shared` and `@main` aliases onto `src/`. Alias targets are written as root-relative POSIX paths (drive letter dropped on Windows, e.g. `/a/cartouche/src/renderer`). jiti's resolver (mlly) reads a drive-letter path such as `D:/a/...` as a URL with scheme `d:`, fails, and falls back to Node's resolver, which caches the module under a backslash key (`D:\a\...`). The same module reached by a relative import inside `src/` is cached under `D:/a/...`. Two keys mean two module instances, so a test sets one signal while the component reads another. A root-relative target goes through mlly like a relative import, so every route yields the same key.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see tests/renderer/moduleIdentity.test.ts
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createJiti from 'jiti';

/** Repository root, resolved from this file so the loader works from any launch location. */
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Alias prefixes and the source directories they map to. */
const SOURCE_ALIASES: Record<string, string> = {
  '@renderer': 'src/renderer',
  '@shared': 'src/shared',
  '@main': 'src/main',
};

/**
 * @function rootRelativePosix
 * @description Converts an absolute path to a root-relative POSIX path by dropping any Windows drive letter and using forward slashes; POSIX paths are returned unchanged.
 * @param {string} absolutePath - Absolute native path.
 * @returns {string} Root-relative POSIX path, e.g. `D:\a\src` → `/a/src`.
 */
export function rootRelativePosix(absolutePath: string): string {
  return absolutePath.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/');
}

/**
 * @function rendererAliases
 * @description Builds the jiti alias map for the renderer test harness.
 * @returns {Record<string, string>} Alias prefix to root-relative POSIX source directory.
 */
export function rendererAliases(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SOURCE_ALIASES).map(([alias, dir]) => [alias, rootRelativePosix(path.join(REPOSITORY_ROOT, dir))]),
  );
}

/**
 * @function createRendererJiti
 * @description Creates the jiti loader a renderer test uses to import `src/` modules by alias.
 * @param {string} callerUrl - The calling test's `import.meta.url`.
 * @returns {ReturnType<typeof createJiti>} jiti loader with TSX support and the renderer aliases.
 */
export function createRendererJiti(callerUrl: string): ReturnType<typeof createJiti> {
  return createJiti(callerUrl, { jsx: true, alias: rendererAliases() });
}
