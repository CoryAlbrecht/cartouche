/**
 * @file shortcuts.ts
 * @module shared/types/shortcuts
 * @description Centralized TypeScript type definitions and interfaces for keyboard shortcut combinations and shortcut descriptors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-02
 * @since 0.1.0-dev
 */

/**
 * @typedef {Object} KeyCombination
 * @property {string} key - Trigger key character.
 * @property {boolean} [ctrl] - Requires Control key.
 * @property {boolean} [alt] - Requires Alt key.
 * @property {boolean} [shift] - Requires Shift key.
 * @property {boolean} [meta] - Requires Meta/Super key.
 */
export interface KeyCombination {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * @typedef {Object} KeyboardShortcutDefinition
 * @property {string} name - Unique shortcut action ID.
 * @property {string} displayName - Human-readable shortcut action name.
 * @property {string} description - Detailed description of action.
 * @property {KeyCombination} keyCombination - Modifier and key configuration.
 * @property {string} [formattedKey] - Pre-formatted display text string.
 */
export interface KeyboardShortcutDefinition {
  name: string;
  displayName: string;
  description: string;
  keyCombination: KeyCombination;
  formattedKey?: string;
}

/**
 * @typedef {Object} ShortcutDefinition
 * @property {string} name - Unique string identifier for the shortcut action.
 * @property {string} displayName - Human-readable name for UI menus and dialogs.
 * @property {string} description - Detailed explanation of what the shortcut action performs.
 * @property {KeyCombination} keyCombination - Modifier keys and target key configuration.
 */
export interface ShortcutDefinition {
  name: string;
  displayName: string;
  description: string;
  keyCombination: KeyCombination;
}

/**
 * @typedef {Object} KeyboardShortcut
 * @property {string} name - Unique string identifier for the shortcut action.
 * @property {string} displayName - Human-readable name for UI menus and dialogs.
 * @property {string} description - Detailed explanation of what the shortcut action performs.
 * @property {() => void} shortcutFunction - Executable callback function invoked when triggered.
 * @property {KeyCombination} keyCombination - Modifier keys and target key configuration.
 */
export interface KeyboardShortcut {
  name: string;
  displayName: string;
  description: string;
  shortcutFunction: () => void;
  keyCombination: KeyCombination;
}
