/**
 * @file widgetDockSignals.ts
 * @module renderer/state/widgetDockSignals
 * @description Preact reactive signals store and helper operations for workbench flex-proportional dock layout state, axis ratios, display ordering, and overlap container persistence.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link WorkbenchWidgetDocksState}
 * @see {@link WidgetDockItem}
 */

import { signal, type Signal } from '@preact/signals-react';
import {
  type WidgetDockId,
  type WidgetDockItem,
  type WorkbenchWidgetDocksState,
  DEFAULT_WORKBENCH_WIDGET_DOCKS,
  type PreferenceMap,
} from '../../shared/types';
import { updatePreference } from './preferencesSignals';

/**
 * Deep clones the default dock configuration to ensure mutations do not alter constant templates.
 * @function cloneDefaultWidgetDocks
 * @description Creates an isolated deep clone of the default workbench widget docks state.
 * @returns {WorkbenchWidgetDocksState} Fresh copy of default workbench widget docks state.
 */
function cloneDefaultWidgetDocks(): WorkbenchWidgetDocksState {
  return JSON.parse(JSON.stringify(DEFAULT_WORKBENCH_WIDGET_DOCKS));
}

/**
 * @signal widgetDocksSignal
 * @description Signal holding active flex-proportional dock layout state mapping dock zones to widget item lists.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @type {Signal<WorkbenchWidgetDocksState>}
 */
export const widgetDocksSignal: Signal<WorkbenchWidgetDocksState> = signal<WorkbenchWidgetDocksState>(
  cloneDefaultWidgetDocks()
);

/**
 * Result returned by getWidgetDockItem lookup.
 * @typedef {Object} WidgetDockItemSearchResult
 * @property {WidgetDockItem} item - Dock item model found.
 * @property {WidgetDockId} dock - Dock identifier containing the item.
 * @property {number} index - Index within that dock's item array.
 */
export interface WidgetDockItemSearchResult {
  item: WidgetDockItem;
  dock: WidgetDockId;
  index: number;
}

/**
 * Locates a widget item across all four dock zones.
 * @function getWidgetDockItem
 * @description Searches all perimeter docks for a widget item matching the given ID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} id - Identifier of widget or container to locate.
 * @param {WorkbenchWidgetDocksState} [state] - Optional explicit state snapshot; defaults to widgetDocksSignal.value.
 * @returns {WidgetDockItemSearchResult | undefined} Search result or undefined if not found.
 */
export function getWidgetDockItem(
  id: string,
  state?: WorkbenchWidgetDocksState
): WidgetDockItemSearchResult | undefined {
  const currentState = state || widgetDocksSignal.value;
  const dockIds: WidgetDockId[] = ['left', 'right', 'top', 'bottom'];

  for (const dock of dockIds) {
    const items = currentState[dock] || [];
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1) {
      return { item: items[index], dock, index };
    }
  }

  return undefined;
}

/**
 * Updates the flex-proportional axis ratio of a docked widget and persists changes.
 * @function updateWidgetDockRatio
 * @description Updates the proportional axis ratio of a docked widget along its dock axis and persists to preferences.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} id - Identifier of widget whose ratio is changing.
 * @param {number} newRatio - Proportional axis ratio value (minimum 0.01).
 * @returns {Promise<void>}
 */
export async function updateWidgetDockRatio(id: string, newRatio: number): Promise<void> {
  const current = widgetDocksSignal.value;
  const match = getWidgetDockItem(id, current);
  if (!match) return;

  const boundedRatio = Math.max(0.01, newRatio);
  const updatedDockItems = current[match.dock].map((item, idx) => {
    if (idx === match.index) {
      return { ...item, axisRatio: boundedRatio };
    }
    return item;
  });

  const nextState: WorkbenchWidgetDocksState = {
    ...current,
    [match.dock]: updatedDockItems,
  };

  widgetDocksSignal.value = nextState;
  await updatePreference('ui.workbench.widgetDocks', nextState);
}

/**
 * Reorders a widget within its current dock and updates display order indices.
 * @function reorderWidgetInDock
 * @description Moves a widget within the same dock to a target index, updates order properties, and persists state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {WidgetDockId} dockId - Target dock zone identifier.
 * @param {number} sourceIndex - Original array index of widget.
 * @param {number} targetIndex - Destination array index for widget.
 * @returns {Promise<void>}
 */
export async function reorderWidgetInDock(
  dockId: WidgetDockId,
  sourceIndex: number,
  targetIndex: number
): Promise<void> {
  const current = widgetDocksSignal.value;
  const items = [...(current[dockId] || [])];
  if (
    sourceIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex < 0 ||
    targetIndex >= items.length ||
    sourceIndex === targetIndex
  ) {
    return;
  }

  const [movedItem] = items.splice(sourceIndex, 1);
  items.splice(targetIndex, 0, movedItem);

  const reordered = items.map((item, idx) => ({ ...item, order: idx }));

  const nextState: WorkbenchWidgetDocksState = {
    ...current,
    [dockId]: reordered,
  };

  widgetDocksSignal.value = nextState;
  await updatePreference('ui.workbench.widgetDocks', nextState);
}

/**
 * Moves a widget from its current dock to a different dock, resetting its axisRatio to 1.
 * @function moveWidgetToDock
 * @description Transfers a docked widget to another dock, resets its proportional axisRatio to 1, and re-indexes orders.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} id - Identifier of widget to transfer.
 * @param {WidgetDockId} targetDockId - Destination dock zone.
 * @param {number} [targetIndex] - Optional insertion index in target dock; appends to end if omitted.
 * @returns {Promise<void>}
 */
export async function moveWidgetToDock(
  id: string,
  targetDockId: WidgetDockId,
  targetIndex?: number
): Promise<void> {
  const current = widgetDocksSignal.value;
  const match = getWidgetDockItem(id, current);
  if (!match) return;

  if (match.dock === targetDockId) {
    if (targetIndex !== undefined && targetIndex !== match.index) {
      await reorderWidgetInDock(targetDockId, match.index, targetIndex);
    }
    return;
  }

  // Remove from source dock
  const sourceItems = current[match.dock].filter((item) => item.id !== id);
  const reorderedSource = sourceItems.map((item, idx) => ({ ...item, order: idx }));

  // Prepare transferred item: reset axisRatio to 1 per ADR 0025
  const transferredItem: WidgetDockItem = {
    ...match.item,
    dock: targetDockId,
    axisRatio: 1,
  };

  const targetItems = [...(current[targetDockId] || [])];
  const insertionIndex =
    targetIndex !== undefined ?
      Math.max(0, Math.min(targetIndex, targetItems.length))
    : targetItems.length;

  targetItems.splice(insertionIndex, 0, transferredItem);
  const reorderedTarget = targetItems.map((item, idx) => ({ ...item, order: idx }));

  const nextState: WorkbenchWidgetDocksState = {
    ...current,
    [match.dock]: reorderedSource,
    [targetDockId]: reorderedTarget,
  };

  widgetDocksSignal.value = nextState;
  await updatePreference('ui.workbench.widgetDocks', nextState);
}

/**
 * Updates visibility status of a docked widget.
 * @function setWidgetDockItemVisibility
 * @description Updates visible boolean on a dock item and saves preference state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {string} id - Identifier of widget.
 * @param {boolean} visible - Whether the widget is visible.
 * @returns {Promise<void>}
 */
export async function setWidgetDockItemVisibility(id: string, visible: boolean): Promise<void> {
  const current = widgetDocksSignal.value;
  const match = getWidgetDockItem(id, current);
  if (!match) return;

  const updatedDockItems = current[match.dock].map((item, idx) => {
    if (idx === match.index) {
      return { ...item, visible };
    }
    return item;
  });

  const nextState: WorkbenchWidgetDocksState = {
    ...current,
    [match.dock]: updatedDockItems,
  };

  widgetDocksSignal.value = nextState;
  await updatePreference('ui.workbench.widgetDocks', nextState);
}

/**
 * Hydrates widgetDocksSignal from an incoming PreferenceMap if present.
 * @function hydrateWidgetDocksFromPreferences
 * @description Synchronizes widgetDocksSignal with persisted preference value from Main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @param {PreferenceMap} prefs - Loaded preferences map.
 */
export function hydrateWidgetDocksFromPreferences(prefs: PreferenceMap): void {
  const pref = prefs['ui.workbench.widgetDocks'];
  if (pref && typeof pref.value === 'object' && pref.value !== null) {
    const val = pref.value as WorkbenchWidgetDocksState;
    if (val.left && val.right && val.top && val.bottom) {
      widgetDocksSignal.value = val;
    }
  }
}

/**
 * Resets widget docks to the default initial layout state.
 * @function resetWidgetDocksToDefault
 * @description Resets widgetDocksSignal back to default workbench widget dock arrangement.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 */
export function resetWidgetDocksToDefault(): void {
  widgetDocksSignal.value = cloneDefaultWidgetDocks();
}
