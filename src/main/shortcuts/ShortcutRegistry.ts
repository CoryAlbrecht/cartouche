/**
 * @file ShortcutRegistry.ts
 * @module main/shortcuts/ShortcutRegistry
 * @description Centralized keyboard shortcut registry for the Cartouche main process, binding action handlers to key combinations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @see {@link ApiFunctions}
 */

import type { KeyCombination, KeyboardShortcutDefinition } from '@shared/types';
import * as ApiFunctions from '../api/ApiFunctions';

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

/**
 * @description Formats a key combination object into a user-facing shortcut string (e.g. "Ctrl+Alt+V").
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {KeyCombination} combo - The key combination object containing key and modifiers.
 * @returns {string} Human-readable formatted key combination string.
 */
export function formatKeyCombination(combo: KeyCombination): string {
  const parts: string[] = [];
  if (combo.ctrl) parts.push('Ctrl');
  if (combo.alt) parts.push('Alt');
  if (combo.shift) parts.push('Shift');
  if (combo.meta) parts.push('Meta');
  if (combo.key) {
    parts.push(combo.key.toUpperCase());
  }
  return parts.join('+');
}

/**
 * @class ShortcutRegistryClass
 * @description Singleton class managing registration, lookup, and execution of global application keyboard shortcuts.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-09-24
 * @since 0.1.0-dev
 */
class ShortcutRegistryClass {
  private shortcutsMap = new Map<string, KeyboardShortcut>();

  /**
   * @description Initializes the shortcut registry and registers default application shortcuts.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-23
   * @updated 2026-09-24
   * @since 0.1.0-dev
   */
  constructor() {
    this.registerDefaultShortcuts();
  }

  /**
   * @description Registers all default application keyboard shortcuts into the active map.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-23
   * @updated 2026-09-24
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private registerDefaultShortcuts(): void {
    // Master Keyboard Shortcuts Registry
    const defaults: KeyboardShortcut[] = [
      {
        name: 'add_vector_layer',
        displayName: 'Add Vector Layer',
        description: 'Adds a new vector layer from a spatial data source to the project',
        shortcutFunction: ApiFunctions.addVectorLayer,
        keyCombination: { key: 'v', ctrl: true, alt: true }
      },
      {
        name: 'new_project',
        displayName: 'New Project',
        description: 'Initializes a new blank project with default canvas',
        shortcutFunction: ApiFunctions.newProject,
        keyCombination: { key: 'n', ctrl: true }
      },
      {
        name: 'open_project',
        displayName: 'Open Project',
        description: 'Opens an existing Cartouche project file',
        shortcutFunction: ApiFunctions.openProject,
        keyCombination: { key: 'o', ctrl: true }
      },
      {
        name: 'save_project',
        displayName: 'Save Project',
        description: 'Saves current active project state',
        shortcutFunction: ApiFunctions.saveProject,
        keyCombination: { key: 's', ctrl: true }
      },
      {
        name: 'save_as_project',
        displayName: 'Save Project As',
        description: 'Saves current active project state under a new file path',
        shortcutFunction: ApiFunctions.saveAsProject,
        keyCombination: { key: 's', ctrl: true, shift: true }
      },
      {
        name: 'undo_action',
        displayName: 'Undo',
        description: 'Reverts the previous editing or layer operation',
        shortcutFunction: ApiFunctions.undoAction,
        keyCombination: { key: 'z', ctrl: true }
      },
      {
        name: 'redo_action',
        displayName: 'Redo',
        description: 'Re-applies the last undone operation',
        shortcutFunction: ApiFunctions.redoAction,
        keyCombination: { key: 'y', ctrl: true }
      },
      {
        name: 'open_preferences',
        displayName: 'Preferences',
        description: 'Opens application preferences dialog',
        shortcutFunction: () => {
          console.log('[Shortcut] Triggering open_preferences...');
        },
        keyCombination: { key: ',', ctrl: true }
      }
    ];

    for (const shortcut of defaults) {
      this.registerShortcut(shortcut);
    }
  }

  /**
   * @description Registers a single keyboard shortcut in the map.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-23
   * @updated 2026-09-24
   * @since 0.1.0-dev
   * @param {KeyboardShortcut} shortcut - Shortcut definition containing name, action, and key combination.
   * @returns {void}
   */
  public registerShortcut(shortcut: KeyboardShortcut): void {
    this.shortcutsMap.set(shortcut.name, shortcut);
  }

  /**
   * @description Retrieves a registered keyboard shortcut by its unique name identifier.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-23
   * @updated 2026-09-24
   * @since 0.1.0-dev
   * @param {string} name - Unique identifier of the shortcut.
   * @returns {KeyboardShortcut | undefined} The registered shortcut object or undefined if not found.
   */
  public getShortcutByName(name: string): KeyboardShortcut | undefined {
    return this.shortcutsMap.get(name);
  }

  /**
   * @description Executes the callback action associated with a registered shortcut name.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-23
   * @updated 2026-09-24
   * @since 0.1.0-dev
   * @param {string} name - Unique identifier of the shortcut to execute.
   * @returns {void}
   */
  public executeShortcut(name: string): void {
    const shortcut = this.shortcutsMap.get(name);
    if (shortcut && typeof shortcut.shortcutFunction === 'function') {
      console.log(`[Main Process Shortcut] Executing shortcut "${shortcut.displayName}" (${shortcut.name})...`);
      shortcut.shortcutFunction();
    } else {
      console.warn(`[Main Process Shortcut] Shortcut "${name}" not found or lacks executable function.`);
    }
  }

  /**
   * @description Returns all registered shortcut definitions formatted for transmission over IPC to renderer processes.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-23
   * @updated 2026-09-24
   * @since 0.1.0-dev
   * @returns {KeyboardShortcutDefinition[]} Array of keyboard shortcut definitions.
   */
  public getAllShortcutDefinitions(): KeyboardShortcutDefinition[] {
    return Array.from(this.shortcutsMap.values()).map((s) => ({
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      keyCombination: s.keyCombination,
      formattedKey: formatKeyCombination(s.keyCombination)
    }));
  }
}

export const ShortcutRegistry = new ShortcutRegistryClass();
