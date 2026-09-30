/**
 * @file preferencesSignals.ts
 * @module renderer/state/preferencesSignals
 * @description Preact reactive signals store for application preferences management and preferences dialog visibility.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @see {@link PreferenceMap}
 */

import { signal } from '@preact/signals-react';
import type { PreferenceMap } from '@shared/types';
import { addConsoleLog } from './gisSignals';

/**
 * @signal
 * @description Signal controlling preferences dialog modal visibility.
 * @type {Signal<boolean>}
 */
export const isPreferencesOpenSignal = signal<boolean>(false);
/**
 * @signal
 * @description Signal holding active reactive map of preference descriptors.
 * @type {Signal<PreferenceMap>}
 */
export const preferencesMapSignal = signal<PreferenceMap>({});
/**
 * @signal
 * @description Signal tracking active selected category tab in preferences dialog UI.
 * @type {Signal<string>}
 */
export const activeCategorySignal = signal<string>('general');

/**
 * @description Loads preference descriptors from the Main process via IPC and updates preferencesMapSignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {string} [name] - Optional preference key to fetch specific item.
 * @returns {Promise<PreferenceMap>} Loaded preference map.
 */
export async function loadPreferences(name?: string): Promise<PreferenceMap> {
  try {
    if (window.electronAPI?.getPreferenceValue) {
      const prefs = await window.electronAPI.getPreferenceValue(name);
      if (name && name.trim() !== '') {
        preferencesMapSignal.value = {
          ...preferencesMapSignal.value,
          ...prefs
        };
      } else {
        preferencesMapSignal.value = { ...prefs };
      }
      return prefs;
    }
  } catch (err) {
    console.error('[PreferencesSignal] Error loading preferences:', err);
  }
  return preferencesMapSignal.value;
}

/**
 * @description Saves a single preference value via IPC and updates preferencesMapSignal reactively.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {string} name - Preference key identifier.
 * @param {any} value - New preference value to set.
 * @returns {Promise<void>}
 */
export async function updatePreference(name: string, value: any): Promise<void> {
  try {
    if (window.electronAPI?.setPreferenceValue) {
      const updatedMap = await window.electronAPI.setPreferenceValue(name, value);
      preferencesMapSignal.value = {
        ...preferencesMapSignal.value,
        ...updatedMap
      };
      addConsoleLog('info', `Preference updated: "${name}" = ${JSON.stringify(value)}`, 'Preferences');
    }
  } catch (err) {
    console.error(`[PreferencesSignal] Error setting preference "${name}":`, err);
    addConsoleLog('error', `Failed to update preference: ${name}`, 'Preferences');
  }
}

/**
 * @description Opens the Preferences Dialog modal and loads current preferences from Main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
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
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @returns {void}
 */
export function closePreferencesDialog(): void {
  isPreferencesOpenSignal.value = false;
}
