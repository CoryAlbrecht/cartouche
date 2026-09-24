import type { PreferenceMap } from '@shared/types';
import { PreferencesStore } from './PreferencesStore';

/**
 * Saves the preference value for the given preference name and persists changes to disk.
 *
 * @param name Preference key (e.g. "ui.basefont.size")
 * @param value New preference value to store
 * @returns Object mapping the updated preference key to its updated descriptor
 */
export default function setPreferenceValue(name: string, value: any): PreferenceMap {
  console.log(`[Main API] setPreferenceValue: "${name}" =`, value);
  return PreferencesStore.set(name, value);
}
