/**
 * @file actions.ts
 * @module shared/types/actions
 * @description Centralized TypeScript type definitions and interfaces for application actions (shortcuts, menus, toolbars).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */

/**
 * @typedef {Object} KeyCombination
 * @property {string} key - Trigger key character.
 * @property {boolean} [ctrl] - Requires Control key.
 * @property {boolean} [alt] - Requires Alt key.
 * @property {boolean} [shift] - Requires Shift key.
 * @property {boolean} [meta] - Requires Meta/Super key.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface KeyCombination {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * @typedef {Object} ActionDefinition
 * @property {string} name - Unique string identifier for the action.
 * @property {string} description - Detailed explanation of what the action performs.
 * @property {string} [icon] - SVG path string for the action icon (e.g., from @mdi/js).
 * @property {KeyCombination} [keyCombination] - Optional modifier keys and target key configuration.
 * @property {() => void} [functionCall] - Executable callback function invoked when triggered (Main Process only).
 * @property {string} [formattedKey] - Pre-formatted display text string for the key combination.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface ActionDefinition {
  name: string;
  description: string;
  icon?: string;
  keyCombination?: KeyCombination;
  functionCall?: () => void;
  formattedKey?: string;
}
