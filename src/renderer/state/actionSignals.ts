/**
 * @file actionSignals.ts
 * @module renderer/state/actionSignals
 * @description Preact reactive signals store managing renderer-side action definitions synced from Main Process over IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link ActionDefinition}
 */

import { signal, computed } from '@preact/signals-react';
import type { ActionDefinition } from '@shared/types';
import { addConsoleLog } from './gisSignals';
import { logging } from '../../shared/logging';

/**
 * @signal registeredActionsSignal
 * @description Flat array of all registered actions.
 */
export const registeredActionsSignal = signal<ActionDefinition[]>([]);

/**
 * @signal actionsMapSignal
 * @description Computed map derivation mapping action names to action definitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 * @type {ReadonlySignal<Map<string, ActionDefinition>>}
 */
export const actionsMapSignal = computed(() => {
  const map = new Map<string, ActionDefinition>();
  for (const action of registeredActionsSignal.value) {
    map.set(action.name, action);
  }
  return map;
});

/**
 * @description Returns formatted shortcut string for UI menu slots by action name (e.g. "add_layers" -> "Ctrl+L").
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 * @param {string} name - Unique action ID.
 * @param {string} [defaultFallback=''] - Default string returned if action is unmapped.
 * @returns {string} Formatted shortcut key combination string.
 */
export function getActionFormattedKey(name: string, defaultFallback: string = ''): string {
  const action = actionsMapSignal.value.get(name);
  if (action && action.formattedKey) {
    return action.formattedKey;
  }
  return defaultFallback;
}

/**
 * @description Returns the raw SVG path string for the action's icon.
 * @param {string} name - Unique action ID.
 * @param {string} [defaultFallback=''] - Default SVG path returned if no icon is specified.
 * @returns {string} SVG path string.
 */
export function getActionIcon(name: string, defaultFallback: string = ''): string {
  const action = actionsMapSignal.value.get(name);
  if (action && action.icon) {
    return action.icon;
  }
  return defaultFallback;
}

/**
 * @description Asynchronously fetches registered action definitions from Main process over Electron IPC bridge.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 * @returns {Promise<void>} Resolves when actions are loaded into signal state.
 */
export async function loadActionsFromMain(): Promise<void> {
  if (window.electronAPI?.getActions) {
    try {
      const actions = await window.electronAPI.getActions();
      registeredActionsSignal.value = actions || [];
      addConsoleLog('info', `Loaded ${actions.length} action(s) from Main Process.`, 'Actions');
    } catch (err) {
      logging.error('Failed to load actions from Main Process', err, { scope: 'actionSignals' });
    }
  }
}
