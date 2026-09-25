import { signal } from '@preact/signals-react';
import type { PreferenceMap } from '@shared/types';
import { addConsoleLog } from './gisSignals';

export const isPreferencesOpenSignal = signal<boolean>(false);
export const preferencesMapSignal = signal<PreferenceMap>({});
export const activeCategorySignal = signal<string>('general');

/**
 * Loads preference descriptors from the Main process via IPC and updates preferencesMapSignal.
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
 * Saves a single preference value via IPC and updates preferencesMapSignal reactively.
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
 * Opens the Preferences Dialog modal and loads current preferences from Main process.
 */
export function openPreferencesDialog(): void {
  loadPreferences();
  isPreferencesOpenSignal.value = true;
  addConsoleLog('info', 'Preferences dialog opened.', 'Preferences');
}

/**
 * Closes the Preferences Dialog modal.
 */
export function closePreferencesDialog(): void {
  isPreferencesOpenSignal.value = false;
}
