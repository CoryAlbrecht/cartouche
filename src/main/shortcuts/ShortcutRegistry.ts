import type { KeyCombination, KeyboardShortcutDefinition } from '@shared/types';
import * as ApiFunctions from '../api/ApiFunctions';

export interface KeyboardShortcut {
  name: string;
  displayName: string;
  description: string;
  shortcutFunction: () => void;
  keyCombination: KeyCombination;
}

/**
 * Formats a key combination object into a user-facing string (e.g. "Ctrl+Alt+V").
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

class ShortcutRegistryClass {
  private shortcutsMap = new Map<string, KeyboardShortcut>();

  constructor() {
    this.registerDefaultShortcuts();
  }

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
      }
    ];

    for (const shortcut of defaults) {
      this.registerShortcut(shortcut);
    }
  }

  public registerShortcut(shortcut: KeyboardShortcut): void {
    this.shortcutsMap.set(shortcut.name, shortcut);
  }

  public getShortcutByName(name: string): KeyboardShortcut | undefined {
    return this.shortcutsMap.get(name);
  }

  public executeShortcut(name: string): void {
    const shortcut = this.shortcutsMap.get(name);
    if (shortcut && typeof shortcut.shortcutFunction === 'function') {
      console.log(`[Main Process Shortcut] Executing shortcut "${shortcut.displayName}" (${shortcut.name})...`);
      shortcut.shortcutFunction();
    } else {
      console.warn(`[Main Process Shortcut] Shortcut "${name}" not found or lacks executable function.`);
    }
  }

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
