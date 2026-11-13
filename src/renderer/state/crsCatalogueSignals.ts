/**
 * @file crsCatalogueSignals.ts
 * @module renderer/state/crsCatalogueSignals
 * @description Renderer mirror of the main-process CRS Catalogue: the catalogue state signal (building / ready / error with entries), the `crs.hideDeprecated` preference, and helpers every catalogue-backed CRS chooser uses to list visible entries while always keeping the current CRS.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link CrsCatalogueState}
 * @see {@link selectVisibleCrsEntries}
 */

import { signal, computed, type Signal, type ReadonlySignal } from '@preact/signals-react';
import {
  CRS_HIDE_DEPRECATED_PREF,
  selectVisibleCrsEntries,
  type CrsCatalogueEntry,
  type CrsCatalogueState,
} from '../../shared/types/crs';
import { preferencesMapSignal } from './preferencesSignals';
import { logging } from '../../shared/logging';

/**
 * @signal crsCatalogueSignal
 * @description Current CRS Catalogue state. Starts as `building` so choosers show the catalogue-building placeholder until the main process reports otherwise.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @type {Signal<CrsCatalogueState>}
 */
export const crsCatalogueSignal: Signal<CrsCatalogueState> = signal<CrsCatalogueState>({ status: 'building', entries: [] });

/**
 * @signal crsCatalogueIndexSignal
 * @description Catalogue entries indexed by upper-cased `AUTH:code`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @type {ReadonlySignal<Map<string, CrsCatalogueEntry>>}
 */
export const crsCatalogueIndexSignal: ReadonlySignal<Map<string, CrsCatalogueEntry>> = computed(
  () => new Map(crsCatalogueSignal.value.entries.map((e) => [e.authId.toUpperCase(), e]))
);

/**
 * @signal hideDeprecatedCrsSignal
 * @description Value of the hidden `crs.hideDeprecated` app preference (default true).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @type {ReadonlySignal<boolean>}
 */
export const hideDeprecatedCrsSignal: ReadonlySignal<boolean> = computed(
  () => preferencesMapSignal.value[CRS_HIDE_DEPRECATED_PREF]?.value !== false
);

/**
 * @function setCrsCatalogueState
 * @description Replaces the catalogue state (from IPC or tests).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {CrsCatalogueState} state - New state.
 * @returns {void}
 */
export function setCrsCatalogueState(state: CrsCatalogueState): void {
  crsCatalogueSignal.value = {
    status: state?.status ?? 'error',
    entries: Array.isArray(state?.entries) ? state.entries : [],
    ...(state?.error ? { error: state.error } : {}),
  };
}

/**
 * @function findCrsCatalogueEntry
 * @description Looks up a catalogue entry by `AUTH:code` (case-insensitive).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | null | undefined} authId - `AUTH:code`.
 * @returns {CrsCatalogueEntry | undefined} Entry, if catalogued.
 */
export function findCrsCatalogueEntry(authId: string | null | undefined): CrsCatalogueEntry | undefined {
  if (!authId) return undefined;
  return crsCatalogueIndexSignal.value.get(authId.toUpperCase());
}

/**
 * @function listCrsChooserEntries
 * @description Entries a CRS chooser shows: the visible catalogue entries (deprecated ones hidden per preference) with every `alwaysShow` CRS kept; an `alwaysShow` CRS missing from the catalogue is prepended as a placeholder entry so the current choice never disappears.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string[]} [alwaysShow] - `AUTH:code` ids always listed (current CRS, Recently Used).
 * @param {Record<string, string>} [fallbackNames] - Names for placeholder entries keyed by upper-cased `AUTH:code`, used while the catalogue is building or for uncatalogued CRSs.
 * @returns {CrsCatalogueEntry[]} Chooser entries.
 */
export function listCrsChooserEntries(
  alwaysShow: string[] = [],
  fallbackNames: Record<string, string> = {}
): CrsCatalogueEntry[] {
  const visible = selectVisibleCrsEntries(crsCatalogueSignal.value.entries, hideDeprecatedCrsSignal.value, alwaysShow);
  const index = crsCatalogueIndexSignal.value;
  const missing = alwaysShow
    .filter((id) => id && !index.has(id.toUpperCase()))
    .map((id): CrsCatalogueEntry => ({ authId: id, name: fallbackNames[id.toUpperCase()] ?? id, type: 'projected', deprecated: false }));
  return [...missing, ...visible];
}

/**
 * @function refreshCrsCatalogue
 * @description Fetches the catalogue state from the main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @returns {Promise<void>}
 */
export async function refreshCrsCatalogue(): Promise<void> {
  const api = (globalThis as any).window?.electronAPI;
  if (typeof api?.getCrsCatalogue !== 'function') return;
  try {
    setCrsCatalogueState(await api.getCrsCatalogue());
  } catch (err) {
    logging.warn('Failed to fetch CRS Catalogue', err, { scope: 'crsCatalogueSignals' });
  }
}

// Subscribe to catalogue broadcasts and fetch the current state once
if (typeof window !== 'undefined' && window.electronAPI?.onCrsCatalogueUpdated) {
  window.electronAPI.onCrsCatalogueUpdated((state) => setCrsCatalogueState(state));
  void refreshCrsCatalogue();
}
