/**
 * @file shortcutSignals.ts
 * @module renderer/state/shortcutSignals
 * @description Preact reactive signals store managing renderer-side keyboard shortcut definitions synced from Main Process over IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link KeyboardShortcutDefinition}
 */

import { signal, computed } from '@preact/signals-react';
import type { KeyboardShortcutDefinition } from '@shared/types';
import { addConsoleLog } from './gisSignals';

/**
 * @signal registeredShortcutsSignal
 * @description Array of registered keyboard shortcut definitions synchronized from Main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<KeyboardShortcutDefinition[]>}
 */
export const registeredShortcutsSignal = signal<KeyboardShortcutDefinition[]>([]);

/**
 * @signal shortcutsMapSignal
 * @description Computed map derivation mapping shortcut action names to shortcut definitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {ReadonlySignal<Map<string, KeyboardShortcutDefinition>>}
 */
export const shortcutsMapSignal = computed(() => {
  const map = new Map<string, KeyboardShortcutDefinition>();
  for (const shortcut of registeredShortcutsSignal.value) {
    map.set(shortcut.name, shortcut);
  }
  return map;
});

/**
 * @description Returns formatted shortcut string for UI menu slots by shortcut name (e.g. "add_layers" -> "Ctrl+L").
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-09-23
 * @since 0.1.0-dev
 * @param {string} name - Unique shortcut action ID.
 * @param {string} [defaultFallback=''] - Default string returned if shortcut is unmapped.
 * @returns {string} Formatted shortcut key combination string.
 */
export function getShortcutFormattedKey(name: string, defaultFallback: string = ''): string {
  const shortcut = shortcutsMapSignal.value.get(name);
  if (shortcut && shortcut.formattedKey) {
    return shortcut.formattedKey;
  }
  return defaultFallback;
}

/**
 * @description Asynchronously fetches registered shortcut definitions from Main process over Electron IPC bridge.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-09-23
 * @since 0.1.0-dev
 * @returns {Promise<void>} Resolves when shortcuts are loaded into signal state.
 */
export async function loadShortcutsFromMain(): Promise<void> {
  if (window.electronAPI?.getShortcuts) {
    try {
      const shortcuts = await window.electronAPI.getShortcuts();
      registeredShortcutsSignal.value = shortcuts || [];
      addConsoleLog('info', `Loaded ${registeredShortcutsSignal.value.length} keyboard shortcut(s) from Main Process.`, 'Shortcuts');
    } catch (err) {
      console.error('[Renderer] Failed to load shortcuts from Main Process:', err);
    }
  }
}
