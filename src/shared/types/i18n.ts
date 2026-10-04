/**
 * @file i18n.ts
 * @module shared/types/i18n
 * @description Type definitions for the Internationalization and Localization subsystem.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 */

/**
 * @typedef {Object} I18nDictionary
 * @description A flat key-value map of translation strings.
 */
export type I18nDictionary = Record<string, string>;

/**
 * @typedef {Object} I18nState
 * @description The active state of the i18n subsystem.
 * @property {string} locale - The currently active locale (e.g., 'en', 'fr_CA.UTF8').
 * @property {I18nDictionary} dictionary - The loaded dictionary for the active locale.
 */
export interface I18nState {
  locale: string;
  dictionary: I18nDictionary;
}
