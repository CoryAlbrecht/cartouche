/**
 * @file ShortcutRegistry.ts
 * @module main/shortcuts/ShortcutRegistry
 * @description Centralized keyboard shortcut registry for the Cartouche main process, binding action handlers to key combinations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @see {@link ApiFunctions}
 */

import type { KeyCombination, KeyboardShortcutDefinition, KeyboardShortcut } from '@shared/types';
import { BUILTIN_SHORTCUTS } from '@shared/shortcuts';
import * as ApiFunctions from '../api/ApiFunctions';

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
   * @updated 2026-10-02
   * @since 0.1.0-dev
   */
  constructor() {
    this.registerDefaultShortcuts();
  }

  /**
   * @description Registers all default application keyboard shortcuts into the active map.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-23
   * @updated 2026-10-02
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private registerDefaultShortcuts(): void {
    const actionMap: Record<string, () => void> = {
      new_project: ApiFunctions.newProject,
      open_project: ApiFunctions.openProject,
      save_project: ApiFunctions.saveProject,
      save_as_project: ApiFunctions.saveAsProject,
      undo_action: ApiFunctions.undoAction,
      redo_action: ApiFunctions.redoAction
    };

    for (const def of BUILTIN_SHORTCUTS) {
      const shortcutFunction =
        actionMap[def.name] ||
        (() => {
          console.log(`[Shortcut] Triggering ${def.name}...`);
        });
      this.registerShortcut({
        ...def,
        shortcutFunction
      });
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
