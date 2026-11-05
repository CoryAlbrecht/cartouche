/**
 * @file widgetDockSignals.ts
 * @module renderer/state/widgetDockSignals
 * @description Preact reactive signals store and helper operations for workbench flex-proportional dock layout state, axis ratios, display ordering, and overlap container persistence.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-05
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
 * @updated 2026-11-05
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
 * @property {string} [containerId] - Parent container ID if contained within an overlap group.
 */
export interface WidgetDockItemSearchResult {
  item: WidgetDockItem;
  dock: WidgetDockId;
  index: number;
  containerId?: string;
}

/**
 * Locates a widget item across all four dock zones, including child tabs inside overlap containers.
 * @function getWidgetDockItem
 * @description Searches all perimeter docks for a widget item matching the given ID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-05
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
    // 1. Direct match on item ID
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1) {
      return { item: items[index], dock, index };
    }
    // 2. Child tab match within an overlap container
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.isOverlapContainer && item.tabChildren?.includes(id)) {
        return { item, dock, index: i, containerId: item.id };
      }
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
 * @updated 2026-11-05
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
 * @updated 2026-11-05
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
 * @updated 2026-11-05
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
 * @updated 2026-11-05
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
 * @updated 2026-11-05
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
 * @updated 2026-11-05
 * @since 0.1.0-dev
 */
export function resetWidgetDocksToDefault(): void {
  widgetDocksSignal.value = cloneDefaultWidgetDocks();
}

/**
 * Creates a new OverlapTabWidget container bundling two overlappable widgets.
 * @function createOverlapContainer
 * @description Bundles target and dragged widgets into a new overlap container, replaces target in dock, and persists state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {WidgetDockId} dockId - Perimeter dock zone hosting the container.
 * @param {string} targetWidgetId - Initial widget receiving the drop.
 * @param {string} draggedWidgetId - Incoming dragged widget being bundled.
 * @returns {Promise<string>} Created container ID.
 */
export async function createOverlapContainer(
  dockId: WidgetDockId,
  targetWidgetId: string,
  draggedWidgetId: string
): Promise<string> {
  const current = widgetDocksSignal.value;
  const targetMatch = getWidgetDockItem(targetWidgetId, current);
  const draggedMatch = getWidgetDockItem(draggedWidgetId, current);

  const containerId = `overlap-group-${Date.now()}`;
  const targetOrder = targetMatch ? targetMatch.item.order : 0;
  const targetRatio = targetMatch ? targetMatch.item.axisRatio : 1;
  const targetDims = targetMatch ? targetMatch.item.dimensions : {};

  // Remove dragged widget from its previous dock
  const nextState: WorkbenchWidgetDocksState = JSON.parse(JSON.stringify(current));
  if (draggedMatch) {
    nextState[draggedMatch.dock] = nextState[draggedMatch.dock].filter(
      (item) => item.id !== draggedWidgetId
    );
  }

  // Replace target widget in dockId with container
  const containerItem: WidgetDockItem = {
    id: containerId,
    dock: dockId,
    order: targetOrder,
    axisRatio: targetRatio,
    dimensions: { ...targetDims },
    visible: true,
    isOverlapContainer: true,
    tabChildren: [targetWidgetId, draggedWidgetId],
    activeTabId: draggedWidgetId,
  };

  const dockList = nextState[dockId].filter((item) => item.id !== targetWidgetId);
  dockList.splice(targetOrder, 0, containerItem);
  nextState[dockId] = dockList.map((item, idx) => ({ ...item, order: idx }));

  // Re-index dragged match dock if different
  if (draggedMatch && draggedMatch.dock !== dockId) {
    nextState[draggedMatch.dock] = nextState[draggedMatch.dock].map((item, idx) => ({
      ...item,
      order: idx,
    }));
  }

  widgetDocksSignal.value = nextState;
  await updatePreference('ui.workbench.widgetDocks', nextState);
  return containerId;
}

/**
 * Appends an overlappable widget as a child tab in an existing OverlapTabWidget container.
 * @function appendTabToOverlapContainer
 * @description Adds incoming widget ID to container tabChildren, removes from standalone dock, and persists state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {string} containerId - Target container ID.
 * @param {string} tabId - Widget ID being appended.
 * @returns {Promise<void>}
 */
export async function appendTabToOverlapContainer(
  containerId: string,
  tabId: string
): Promise<void> {
  const current = widgetDocksSignal.value;
  const containerMatch = getWidgetDockItem(containerId, current);
  const tabMatch = getWidgetDockItem(tabId, current);

  if (!containerMatch || !containerMatch.item.isOverlapContainer) return;

  const nextState: WorkbenchWidgetDocksState = JSON.parse(JSON.stringify(current));

  // Remove tab from previous standalone dock if present
  if (tabMatch && tabMatch.dock) {
    nextState[tabMatch.dock] = nextState[tabMatch.dock].filter(
      (item) => item.id !== tabId
    );
    nextState[tabMatch.dock] = nextState[tabMatch.dock].map((item, idx) => ({
      ...item,
      order: idx,
    }));
  }

  const existingTabs = containerMatch.item.tabChildren || [];
  const updatedTabs = existingTabs.includes(tabId) ? existingTabs : [...existingTabs, tabId];

  nextState[containerMatch.dock] = nextState[containerMatch.dock].map((item) => {
    if (item.id === containerId) {
      return {
        ...item,
        tabChildren: updatedTabs,
        activeTabId: tabId,
      };
    }
    return item;
  });

  widgetDocksSignal.value = nextState;
  await updatePreference('ui.workbench.widgetDocks', nextState);
}

/**
 * Extracts a child tab from an overlap container, auto-dissolving if 1 child remains, and docks the extracted widget independently.
 * @function extractTabFromOverlapContainer
 * @description Extracts child tab, dissolves container if single child remains, restores extracted widget to dock with axisRatio = 1, and persists state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {string} containerId - Source container ID.
 * @param {string} tabId - Extracted widget ID.
 * @param {WidgetDockId} [targetDockId] - Destination dock; defaults to container dock.
 * @param {number} [targetIndex] - Optional destination index.
 * @returns {Promise<void>}
 */
export async function extractTabFromOverlapContainer(
  containerId: string,
  tabId: string,
  targetDockId?: WidgetDockId,
  targetIndex?: number
): Promise<void> {
  const current = widgetDocksSignal.value;
  const containerMatch = getWidgetDockItem(containerId, current);
  if (!containerMatch || !containerMatch.item.isOverlapContainer) return;

  const destDock = targetDockId || containerMatch.dock;
  const remainingTabs = (containerMatch.item.tabChildren || []).filter((id) => id !== tabId);

  const nextState: WorkbenchWidgetDocksState = JSON.parse(JSON.stringify(current));

  // Single-child auto-dissolution: if only 1 tab remains, dissolve container and restore solitary child
  if (remainingTabs.length <= 1) {
    const solitaryId = remainingTabs[0];
    const containerIdx = nextState[containerMatch.dock].findIndex((i) => i.id === containerId);

    if (solitaryId && containerIdx !== -1) {
      const solitaryItem: WidgetDockItem = {
        id: solitaryId,
        dock: containerMatch.dock,
        order: containerIdx,
        axisRatio: containerMatch.item.axisRatio,
        dimensions: containerMatch.item.dimensions,
        visible: true,
        isOverlapContainer: false,
      };
      nextState[containerMatch.dock].splice(containerIdx, 1, solitaryItem);
    } else {
      nextState[containerMatch.dock] = nextState[containerMatch.dock].filter(
        (i) => i.id !== containerId
      );
    }
  } else {
    // Update container with remaining tabs
    nextState[containerMatch.dock] = nextState[containerMatch.dock].map((item) => {
      if (item.id === containerId) {
        return {
          ...item,
          tabChildren: remainingTabs,
          activeTabId:
            item.activeTabId === tabId ? remainingTabs[0] : item.activeTabId,
        };
      }
      return item;
    });
  }

  // Insert extracted widget into destDock as independent widget with axisRatio = 1
  const extractedItem: WidgetDockItem = {
    id: tabId,
    dock: destDock,
    order: 0,
    axisRatio: 1,
    dimensions: {},
    visible: true,
    isOverlapContainer: false,
  };

  const destList = nextState[destDock];
  const insertIdx =
    targetIndex !== undefined ?
      Math.max(0, Math.min(targetIndex, destList.length))
    : destList.length;

  destList.splice(insertIdx, 0, extractedItem);

  // Re-index orders
  nextState[destDock] = destList.map((item, idx) => ({ ...item, order: idx }));
  if (destDock !== containerMatch.dock) {
    nextState[containerMatch.dock] = nextState[containerMatch.dock].map((item, idx) => ({
      ...item,
      order: idx,
    }));
  }

  widgetDocksSignal.value = nextState;
  await updatePreference('ui.workbench.widgetDocks', nextState);
}

/**
 * Dissolves an overlap container, restoring all child tabs as independent widgets with axisRatio = 1.
 * @function dissolveOverlapContainer
 * @description Unwraps overlap container into standalone widgets and persists state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {string} containerId - Container ID to dissolve.
 * @returns {Promise<void>}
 */
export async function dissolveOverlapContainer(containerId: string): Promise<void> {
  const current = widgetDocksSignal.value;
  const match = getWidgetDockItem(containerId, current);
  if (!match || !match.item.isOverlapContainer) return;

  const nextState: WorkbenchWidgetDocksState = JSON.parse(JSON.stringify(current));
  const tabs = match.item.tabChildren || [];

  const restoredItems: WidgetDockItem[] = tabs.map((tabId, idx) => ({
    id: tabId,
    dock: match.dock,
    order: match.index + idx,
    axisRatio: 1,
    dimensions: match.item.dimensions,
    visible: false,
    isOverlapContainer: false,
  }));

  const dockList = nextState[match.dock];
  dockList.splice(match.index, 1, ...restoredItems);
  nextState[match.dock] = dockList.map((item, idx) => ({ ...item, order: idx }));

  widgetDocksSignal.value = nextState;
  await updatePreference('ui.workbench.widgetDocks', nextState);
}
