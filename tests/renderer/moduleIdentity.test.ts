/**
 * @file moduleIdentity.test.ts
 * @module tests/renderer/moduleIdentity.test
 * @description Guards the renderer test harness against duplicate module instances: a module reached through the `@renderer` jiti alias (as tests import it) and through a relative import inside `src/` (as components import it) must resolve to one cached instance, or a test sets one signal while the component reads another. On failure it prints the raw module-cache keys so the diverging path spellings (e.g. Windows separators or drive-letter case) are visible.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see tests/renderer/rendererJiti.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type createJiti from 'jiti';
import { createRendererJiti, rootRelativePosix } from './rendererJiti';

const moduleCache = createRequire(import.meta.url).cache;

/**
 * @function i18nCacheKeys
 * @description Lists module-cache keys that refer to `src/renderer/state/i18nSignals.ts` or `src/renderer/hooks/useTranslation.ts`, however their path is spelled.
 * @returns {string[]} Raw cache keys.
 */
function i18nCacheKeys(): string[] {
  return Object.keys(moduleCache).filter((k) => /[\\/]renderer[\\/](state[\\/]i18nSignals|hooks[\\/]useTranslation)\.ts$/i.test(k));
}

/**
 * @function clearI18nCache
 * @description Removes the i18n modules from the module cache so each jiti configuration starts cold.
 * @returns {void}
 */
function clearI18nCache(): void {
  for (const key of i18nCacheKeys()) delete moduleCache[key];
}

/**
 * @function loadBothWays
 * @description Loads `i18nSignals` through the `@renderer` alias and through `useTranslation`'s relative import, then counts the distinct cached instances of `i18nSignals`.
 * @param {ReturnType<typeof createJiti>} jiti - jiti instance under test.
 * @returns {{ instances: number, keys: string[] }} Distinct `i18nSignals` cache entries and all matching keys.
 */
function loadBothWays(jiti: ReturnType<typeof createJiti>): { instances: number; keys: string[] } {
  jiti('@renderer/state/i18nSignals');
  jiti('@renderer/hooks/useTranslation');
  const keys = i18nCacheKeys();
  return { instances: keys.filter((k) => /i18nSignals\.ts$/i.test(k)).length, keys };
}

describe('Renderer test harness module identity', () => {
  it('resolves a module reached by @renderer alias and by relative import to a single instance', () => {
    clearI18nCache();
    const { instances, keys } = loadBothWays(createRendererJiti(import.meta.url));
    clearI18nCache();
    assert.equal(instances, 1, `Expected one i18nSignals instance; module cache keys:\n  ${keys.join('\n  ')}`);
  });

  it('writes alias targets as root-relative POSIX paths so jiti never reads a drive letter as a URL scheme', () => {
    assert.equal(rootRelativePosix('D:\\a\\cartouche\\src\\renderer'), '/a/cartouche/src/renderer');
    assert.equal(rootRelativePosix('/home/user/cartouche/src/renderer'), '/home/user/cartouche/src/renderer');
  });
});
