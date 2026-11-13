/**
 * @file crsCatalogueService.ts
 * @module main/crs/crsCatalogueService
 * @description Main-process holder of the CRS Catalogue state. At startup it asks the geospatial worker to load or build the catalogue in the background (about 50 s on a cold cache) and broadcasts `crs:catalogue-updated` to every window when the state changes; the renderer can also ask for the current state over `crs:get-catalogue` at any time, which reports `building` until the worker finishes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link CrsCatalogueState}
 * @see {@link runCrsCatalogueBuild}
 */

import type { CrsCatalogueEntry, CrsCatalogueState } from '../../shared/types/crs';
import { logging } from '../../shared/logging';

/**
 * @callback CrsCatalogueBuilder
 * @description Produces the catalogue entries for a cache directory.
 * @param {string} cacheDir - Cache directory.
 * @returns {Promise<{ entries: CrsCatalogueEntry[]; fromCache: boolean }>} Entries.
 */
export type CrsCatalogueBuilder = (cacheDir: string) => Promise<{ entries: CrsCatalogueEntry[]; fromCache: boolean }>;

/**
 * @callback CrsCatalogueBroadcaster
 * @description Publishes a state change to the renderer windows.
 * @param {CrsCatalogueState} state - New state.
 * @returns {void}
 */
export type CrsCatalogueBroadcaster = (state: CrsCatalogueState) => void;

let state: CrsCatalogueState = { status: 'idle', entries: [] };
let inFlight: Promise<CrsCatalogueState> | null = null;

/**
 * @function getCrsCatalogueState
 * @description Current catalogue state (`idle`, `building`, `ready` or `error`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @returns {CrsCatalogueState} State snapshot.
 */
export function getCrsCatalogueState(): CrsCatalogueState {
  return state;
}

/**
 * @function startCrsCatalogueBuild
 * @description Starts loading or building the catalogue in the background unless a build is already running or finished; returns the promise of the final state. The builder runs in the geospatial worker in production, so neither the main nor the renderer thread is blocked.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} cacheDir - App preferences directory.
 * @param {CrsCatalogueBuilder} builder - Catalogue producer.
 * @param {CrsCatalogueBroadcaster} [broadcast] - State change publisher.
 * @returns {Promise<CrsCatalogueState>} Final state.
 */
export function startCrsCatalogueBuild(
  cacheDir: string,
  builder: CrsCatalogueBuilder,
  broadcast?: CrsCatalogueBroadcaster
): Promise<CrsCatalogueState> {
  if (inFlight) return inFlight;
  if (state.status === 'ready') return Promise.resolve(state);

  state = { status: 'building', entries: [] };
  broadcast?.(state);
  const started = Date.now();
  inFlight = builder(cacheDir)
    .then(({ entries, fromCache }) => {
      state = { status: 'ready', entries };
      logging.info('CRS Catalogue ready', {
        scope: 'crsCatalogue',
        entries: entries.length,
        fromCache,
        ms: Date.now() - started,
      });
      return state;
    })
    .catch((err: any) => {
      state = { status: 'error', entries: [], error: err?.message || String(err) };
      logging.error('CRS Catalogue build failed', err, { scope: 'crsCatalogue' });
      return state;
    })
    .finally(() => {
      inFlight = null;
      broadcast?.(state);
    });
  return inFlight;
}

/**
 * @function resetCrsCatalogueState
 * @description Resets the state to `idle` (tests only).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @returns {void}
 */
export function resetCrsCatalogueState(): void {
  state = { status: 'idle', entries: [] };
  inFlight = null;
}
