/**
 * @file SetPreferenceValue.ts
 * @module main/api/ui/preferences/SetPreferenceValue
 * @description Main Process API function for updating and persisting preference values in PreferencesStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 */

import type { PreferenceMap } from '@shared/types';
import { PreferencesStore } from './PreferencesStore';

/**
 * @description Saves the preference value for the given preference name and persists changes to disk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {string} name - Preference key (e.g. "ui.basefont.size").
 * @param {any} value - New preference value to store.
 * @returns {PreferenceMap} Object mapping the updated preference key to its updated descriptor.
 */
/**
 * @ipc gis:set-preference
 * @description Updates preference key value in PreferencesStore and persists change to disk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {string} name - Target preference key.
 * @param {any} value - New preference value.
 * @returns {PreferenceMap} Updated preference map dictionary.
 */
export default function setPreferenceValue(name: string, value: any): PreferenceMap {
  console.log(`[Main API] setPreferenceValue: "${name}" =`, value);
  return PreferencesStore.set(name, value);
}
