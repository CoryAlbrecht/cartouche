/**
 * @file ActionRegistry.ts
 * @module main/actions/ActionRegistry
 * @description Centralized Action registry for the Cartouche main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */

import type { KeyCombination, ActionDefinition } from '@shared/types';
import { BUILTIN_ACTIONS } from './defaults';

/**
 * @description Formats a key combination object into a user-facing shortcut string (e.g. "Ctrl+Alt+V", "Escape").
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-13
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
    if (combo.key.toLowerCase() === 'escape') {
      parts.push('Escape');
    } else if (/^f\d+$/i.test(combo.key)) {
      parts.push(combo.key.toUpperCase());
    } else if (combo.key.length === 1) {
      parts.push(combo.key.toUpperCase());
    } else {
      parts.push(combo.key.charAt(0).toUpperCase() + combo.key.slice(1));
    }
  }
  return parts.join('+');
}

/**
 * @class ActionRegistryClass
 * @description Singleton class managing registration, lookup, and execution of global application actions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 */
class ActionRegistryClass {
  private actionsMap = new Map<string, ActionDefinition>();

  constructor() {
    this.registerDefaultActions();
  }

  private registerDefaultActions(): void {
    for (const def of BUILTIN_ACTIONS) {
      this.registerAction(def);
    }
  }

  public registerAction(action: ActionDefinition): void {
    this.actionsMap.set(action.name, action);
  }

  public getActionByName(name: string): ActionDefinition | undefined {
    return this.actionsMap.get(name);
  }

  public executeAction(name: string): void {
    const action = this.actionsMap.get(name);
    if (action && typeof action.functionCall === 'function') {
      console.log(`[Main Process] Executing action "${name}"...`);
      action.functionCall();
    } else {
      console.log(`[Main Process] Action "${name}" triggered (no backend functionCall mapping).`);
    }
  }

  public getAllActionDefinitions(): ActionDefinition[] {
    return Array.from(this.actionsMap.values()).map((a) => {
      // Strip functionCall to avoid IPC cloning errors
      const { functionCall, ...serializableAction } = a;
      return {
        ...serializableAction,
        formattedKey: a.keyCombination ? formatKeyCombination(a.keyCombination) : undefined
      };
    });
  }
}

export const ActionRegistry = new ActionRegistryClass();
