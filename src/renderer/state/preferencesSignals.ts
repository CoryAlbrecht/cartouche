/**
 * @file preferencesSignals.ts
 * @module renderer/state/preferencesSignals
 * @description Preact reactive signals store for application preferences management and preferences dialog visibility.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link PreferenceMap}
 */

import { signal, type Signal } from '@preact/signals-react';
import type { PreferenceMap } from '@shared/types';
import { addConsoleLog, hydrateToolbarSignalsFromPreferences } from './gisSignals';
import { logging } from '../../shared/logging';

/**
 * @signal isPreferencesOpenSignal
 * @description Signal controlling preferences dialog modal visibility.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isPreferencesOpenSignal = signal<boolean>(false);

/**
 * @signal preferencesMapSignal
 * @description Signal holding active reactive map of preference descriptors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<PreferenceMap>}
 */
export const preferencesMapSignal = signal<PreferenceMap>({});

/**
 * @signal activeCategorySignal
 * @description Signal tracking active selected category tab in preferences dialog UI.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<string>}
 */
export const activeCategorySignal = signal<string>('general');

/**
 * @signal prefsUiBaseFontSize
 * @description Signal holding workbench base font size setting in points.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<number | undefined>}
 */
export const prefsUiBaseFontSize = signal<number | undefined>(undefined);

/**
 * @signal prefsUiIconSize
 * @description Signal holding toolbar icon size setting in pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<number | undefined>}
 */
export const prefsUiIconSize = signal<number | undefined>(undefined);

/**
 * @signal prefsGeneralMapViewportZoomAmount
 * @description Signal holding map viewport zoom amount step factor.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @type {Signal<number | undefined>}
 */
export const prefsGeneralMapViewportZoomAmount = signal<number | undefined>(undefined);

/**
 * @description Lookup dictionary mapping preference key strings to exported Preact Signal instances.
 */
const PREFERENCE_SIGNALS_MAP: Record<string, Signal<any>> = {
  'ui.basefont.size': prefsUiBaseFontSize,
  'ui.icon.size': prefsUiIconSize,
  'general.mapViewport.zoomAmount': prefsGeneralMapViewportZoomAmount
};

/**
 * @description Helper function to attach Signal instances to PreferenceItem records and update signal values.
 * @param {PreferenceMap} map - Preference map to attach and sync signals for.
 * @returns {PreferenceMap} Modified preference map.
 */
function attachAndSyncSignals(map: PreferenceMap): PreferenceMap {
  for (const key of Object.keys(map)) {
    const item = map[key];
    if (PREFERENCE_SIGNALS_MAP[key]) {
      item.signal = PREFERENCE_SIGNALS_MAP[key];
    }
    if (item.signal) {
      item.signal.value = item.value;
    }
  }
  return map;
}

/**
 * @description Loads preference descriptors from the Main process via IPC and updates preferencesMapSignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @param {string} [name] - Optional preference key to fetch specific item.
 * @returns {Promise<PreferenceMap>} Loaded preference map.
 */
export async function loadPreferences(name?: string): Promise<PreferenceMap> {
  try {
    if (window.electronAPI?.getPreferenceValue) {
      const prefs = await window.electronAPI.getPreferenceValue(name);
      let merged: PreferenceMap;
      if (name && name.trim() !== '') {
        merged = {
          ...preferencesMapSignal.value,
          ...prefs
        };
      } else {
        merged = { ...prefs };
      }
      attachAndSyncSignals(merged);
      preferencesMapSignal.value = merged;
      hydrateToolbarSignalsFromPreferences(merged);
      return prefs;
    }
  } catch (err) {
    logging.error('Error loading preferences from Main Process', err, { scope: 'preferencesSignals' });
  }
  return preferencesMapSignal.value;
}

/**
 * @description Saves a single preference value via IPC and updates preferencesMapSignal reactively.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @param {string} name - Preference key identifier.
 * @param {any} value - New preference value to set.
 * @returns {Promise<void>}
 */
export async function updatePreference(name: string, value: any): Promise<void> {
  try {
    if (window.electronAPI?.setPreferenceValue) {
      const updatedMap = await window.electronAPI.setPreferenceValue(name, value);
      const merged = {
        ...preferencesMapSignal.value,
        ...updatedMap
      };
      attachAndSyncSignals(merged);
      preferencesMapSignal.value = merged;
      hydrateToolbarSignalsFromPreferences(merged);
      addConsoleLog('info', `Preference updated: "${name}" = ${JSON.stringify(value)}`, 'Preferences');
    }
  } catch (err) {
    logging.error('Error setting preference value', err, { preference: name, scope: 'preferencesSignals' });
    addConsoleLog('error', `Failed to update preference: ${name}`, 'Preferences');
  }
}

/**
 * @description Opens the Preferences Dialog modal and loads current preferences from Main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @returns {void}
 */
export function openPreferencesDialog(): void {
  loadPreferences();
  isPreferencesOpenSignal.value = true;
  addConsoleLog('info', 'Preferences dialog opened.', 'Preferences');
}

/**
 * @description Closes the Preferences Dialog modal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @returns {void}
 */
export function closePreferencesDialog(): void {
  isPreferencesOpenSignal.value = false;
}

/**
 * @description Cancels pending preference edits, reverting any modified signals back to authoritative values and closing dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
export function cancelPreferencesEdits(): void {
  const currentMap = preferencesMapSignal.value;
  for (const item of Object.values(currentMap)) {
    if (item.signal && item.value !== undefined) {
      item.signal.value = item.value;
    }
  }
  closePreferencesDialog();
  addConsoleLog('info', 'Preferences changes cancelled.', 'Preferences');
}
