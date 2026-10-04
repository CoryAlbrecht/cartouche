/**
 * @file i18nSignals.ts
 * @module renderer/state/i18nSignals
 * @description Reactive Preact signals and core translation function for the i18n subsystem.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 */

import { signal } from '@preact/signals-react';
import type { I18nDictionary, I18nState } from '@shared/types';

/**
 * @signal activeLocaleSignal
 * @description Signal holding the currently active locale string.
 * @type {Signal<string>}
 */
export const activeLocaleSignal = signal<string>('en');

/**
 * @signal dictionarySignal
 * @description Signal holding the current locale's translation dictionary.
 * @type {Signal<I18nDictionary>}
 */
export const dictionarySignal = signal<I18nDictionary>({});

/**
 * @description Initializes the signals by fetching the initial state from the main process and setting up listeners.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 * @returns {Promise<void>}
 */
export async function initializeI18n(): Promise<void> {
  if (window.electronAPI?.getI18nState) {
    const initialState = await window.electronAPI.getI18nState();
    activeLocaleSignal.value = initialState.locale;
    dictionarySignal.value = initialState.dictionary;

    if (window.electronAPI.onI18nStateChanged) {
      window.electronAPI.onI18nStateChanged((newState: I18nState) => {
        activeLocaleSignal.value = newState.locale;
        dictionarySignal.value = newState.dictionary;
      });
    }
  }
}

/**
 * @description Core translation function. Retrieves a translated string and interpolates dynamic parameters.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 * @param {string} key - The translation dictionary key.
 * @param {Record<string, string | number>} [params] - Dynamic parameters to interpolate using `{paramName}`.
 * @returns {string} The translated and interpolated string, or the raw key if not found.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dictionarySignal.value;
  let text = dict[key];

  if (text === undefined) {
    // Graceful fallback to returning the key itself
    return key;
  }

  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      // Replace all instances of {pKey}
      text = text.split(`{${pKey}}`).join(String(pVal));
    }
  }

  return text;
}
