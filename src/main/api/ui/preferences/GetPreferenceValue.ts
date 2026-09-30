/**
 * @file GetPreferenceValue.ts
 * @module main/api/ui/preferences/GetPreferenceValue
 * @description Main Process API function for querying preference descriptor records from PreferencesStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 */

import type { PreferenceMap } from '@shared/types';
import { PreferencesStore } from './PreferencesStore';

/**
 * @description Returns a preference descriptor object matching the requested preference name, or all registered preference descriptors if name is omitted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {string} [name] - Optional preference key (e.g. "ui.basefont.size").
 * @returns {PreferenceMap} Object mapping preference keys to preference item descriptors.
 */
/**
 * @ipc gis:get-preference
 * @description Returns a preference descriptor object matching requested key or all preferences.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {string} [name] - Optional preference key.
 * @returns {PreferenceMap} Preference map dictionary.
 */
export default function getPreferenceValue(name?: string): PreferenceMap {
  return PreferencesStore.get(name);
}
