/**
 * @file index.ts
 * @module shared/shortcuts
 * @description Centralized default keyboard shortcut definitions for Cartouche shared across main and renderer processes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @see {@link KeyCombination}
 */

import type { ShortcutDefinition } from '../types';

/**
 * @description Default application keyboard shortcut definitions list.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @type {ShortcutDefinition[]}
 */
export const defaultShortcuts: ShortcutDefinition[] = [
  {
    name: 'add_layers',
    displayName: 'Add Layers',
    description: 'Opens the Add Layers dialog box to attach spatial data sources',
    keyCombination: { key: 'l', ctrl: true }
  },
  {
    name: 'new_project',
    displayName: 'New Project',
    description: 'Initializes a new blank project with default canvas',
    keyCombination: { key: 'n', ctrl: true }
  },
  {
    name: 'open_project',
    displayName: 'Open Project',
    description: 'Opens an existing Cartouche project file',
    keyCombination: { key: 'o', ctrl: true }
  },
  {
    name: 'save_project',
    displayName: 'Save Project',
    description: 'Saves current active project state',
    keyCombination: { key: 's', ctrl: true }
  },
  {
    name: 'save_as_project',
    displayName: 'Save Project As',
    description: 'Saves current active project state under a new file path',
    keyCombination: { key: 's', ctrl: true, shift: true }
  },
  {
    name: 'undo_action',
    displayName: 'Undo',
    description: 'Reverts the previous editing or layer operation',
    keyCombination: { key: 'z', ctrl: true }
  },
  {
    name: 'redo_action',
    displayName: 'Redo',
    description: 'Re-applies the last undone operation',
    keyCombination: { key: 'y', ctrl: true }
  },
  {
    name: 'open_preferences',
    displayName: 'Preferences',
    description: 'Opens application preferences dialog',
    keyCombination: { key: ',', ctrl: true }
  },
  {
    name: 'toggle_layers_widget',
    displayName: 'Toggle Layers Widget',
    description: 'Toggles visibility of the Layers widget in the workbench grid',
    keyCombination: { key: 'l', ctrl: true, shift: true }
  }
];
