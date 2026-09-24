import type { PreferenceMap } from '@shared/types';
import { PreferencesStore } from './PreferencesStore';

/**
 * Returns a preference descriptor object matching the requested preference name,
 * or all registered preference descriptors if name is omitted or empty.
 *
 * @param name Optional preference key (e.g. "ui.basefont.size")
 * @returns Object mapping preference keys to preference item descriptors
 */
export default function getPreferenceValue(name?: string): PreferenceMap {
  return PreferencesStore.get(name);
}
