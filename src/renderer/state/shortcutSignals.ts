import { signal, computed } from '@preact/signals-react';
import type { KeyboardShortcutDefinition } from '@shared/types';
import { addConsoleLog } from './gisSignals';

export const registeredShortcutsSignal = signal<KeyboardShortcutDefinition[]>([]);

export const shortcutsMapSignal = computed(() => {
  const map = new Map<string, KeyboardShortcutDefinition>();
  for (const shortcut of registeredShortcutsSignal.value) {
    map.set(shortcut.name, shortcut);
  }
  return map;
});

/**
 * Returns formatted shortcut string for UI menu slots by shortcut name (e.g. "add_vector_layer" -> "Ctrl+Alt+V")
 */
export function getShortcutFormattedKey(name: string, defaultFallback: string = ''): string {
  const shortcut = shortcutsMapSignal.value.get(name);
  if (shortcut && shortcut.formattedKey) {
    return shortcut.formattedKey;
  }
  return defaultFallback;
}

/**
 * Fetches shortcut definitions from Main process IPC
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
