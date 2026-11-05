/**
 * @file dockLayoutEngine.ts
 * @module renderer/workbench/dockLayoutEngine
 * @description Flex-proportional layout engine and interactive sash ratio synchronization for perimeter docks in Cartouche Workbench.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @see {@link calculateProportionalSizes}
 * @see {@link recalculateSashRatios}
 * @see {@link syncDockCrossAxis}
 * @see {@link rebalanceDockOnResize}
 */

import type { DockviewApi } from 'dockview-react';
import type { WidgetDockId, WorkbenchWidgetDocksState } from '../../shared/types';
import {
  widgetDocksSignal,
  reorderWidgetInDock,
  moveWidgetToDock,
} from '../state/widgetDockSignals';
import { updatePreference } from '../state/preferencesSignals';

/**
 * @typedef {Object} ProportionalItemInput
 * @description Item specification for proportional dock layout distribution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @property {string} id - Identifier of widget or panel.
 * @property {number} axisRatio - Flex-box proportional weight (ratio > 0).
 * @property {number} [minSize] - Minimum pixel size floor (e.g. minHeight or minWidth).
 */
export interface ProportionalItemInput {
  id: string;
  axisRatio: number;
  minSize?: number;
}

/**
 * @typedef {Object} ProportionalAllocationResult
 * @description Computed pixel allocation for an item along its dock axis.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @property {string} id - Identifier of widget or panel.
 * @property {number} size - Calculated pixel dimension.
 */
export interface ProportionalAllocationResult {
  id: string;
  size: number;
}

/**
 * Calculates proportional pixel sizes for docked items along a primary axis respecting minimum size floors.
 * @function calculateProportionalSizes
 * @description Apportions available dock length across items based on axis ratios and minimum size constraints.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {ProportionalItemInput[]} items - Dock items to apportion.
 * @param {number} availableLength - Total available pixel length along the dock axis.
 * @returns {ProportionalAllocationResult[]} Calculated pixel allocations per item.
 */
export function calculateProportionalSizes(
  items: ProportionalItemInput[],
  availableLength: number
): ProportionalAllocationResult[] {
  if (!items || items.length === 0) {
    return [];
  }

  const boundedLength = Math.max(0, Math.round(availableLength));

  if (items.length === 1) {
    const minSize = Math.max(0, items[0].minSize ?? 0);
    return [{ id: items[0].id, size: Math.max(minSize, boundedLength) }];
  }

  // Calculate sum of minimum sizes
  const totalMinSize = items.reduce(
    (sum, item) => sum + Math.max(0, item.minSize ?? 0),
    0
  );

  // If available length is less than or equal to total minimum sizes,
  // distribute length proportionally according to minSizes
  if (boundedLength <= totalMinSize) {
    if (totalMinSize === 0) {
      const equalShare = Math.floor(boundedLength / items.length);
      const remainder = boundedLength - equalShare * items.length;
      return items.map((item, idx) => ({
        id: item.id,
        size: equalShare + (idx === 0 ? remainder : 0),
      }));
    }
    let allocatedSum = 0;
    const result: ProportionalAllocationResult[] = items.map((item) => {
      const min = Math.max(0, item.minSize ?? 0);
      const portion = Math.round((min / totalMinSize) * boundedLength);
      allocatedSum += portion;
      return { id: item.id, size: portion };
    });
    // Adjust any rounding deficit to the first item
    const diff = boundedLength - allocatedSum;
    if (diff !== 0 && result.length > 0) {
      result[0].size = Math.max(0, result[0].size + diff);
    }
    return result;
  }

  // Flex relaxation algorithm to honor minimum floors:
  // Items that violate minSize are clamped to minSize, and remaining space is redistributed
  const unconstrained = new Set<string>(items.map((i) => i.id));
  const finalSizes = new Map<string, number>();
  let remainingLength = boundedLength;

  let changed = true;
  while (changed && unconstrained.size > 0) {
    changed = false;
    const activeItems = items.filter((i) => unconstrained.has(i.id));
    const totalActiveRatio = activeItems.reduce(
      (sum, i) => sum + Math.max(0.001, i.axisRatio),
      0
    );

    for (const item of activeItems) {
      const ratio = Math.max(0.001, item.axisRatio);
      const proportionalShare = (ratio / totalActiveRatio) * remainingLength;
      const minSize = Math.max(0, item.minSize ?? 0);

      if (proportionalShare < minSize) {
        finalSizes.set(item.id, minSize);
        unconstrained.delete(item.id);
        remainingLength -= minSize;
        changed = true;
        break; // restart redistribution loop with remaining unconstrained items
      }
    }
  }

  // Assign remaining unconstrained items their proportional share
  if (unconstrained.size > 0) {
    const activeItems = items.filter((i) => unconstrained.has(i.id));
    const totalActiveRatio = activeItems.reduce(
      (sum, i) => sum + Math.max(0.001, i.axisRatio),
      0
    );
    for (const item of activeItems) {
      const ratio = Math.max(0.001, item.axisRatio);
      const share = Math.round((ratio / totalActiveRatio) * remainingLength);
      finalSizes.set(item.id, share);
    }
  }

  // Build final array preserving original item order
  let allocatedTotal = 0;
  const result: ProportionalAllocationResult[] = items.map((item) => {
    const size = finalSizes.get(item.id) ?? Math.max(0, item.minSize ?? 0);
    allocatedTotal += size;
    return { id: item.id, size };
  });

  // Reconcile any rounding difference with the largest item
  const diff = boundedLength - allocatedTotal;
  if (diff !== 0 && result.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < result.length; i++) {
      if (result[i].size > result[maxIdx].size) {
        maxIdx = i;
      }
    }
    result[maxIdx].size = Math.max(
      items[maxIdx].minSize ?? 0,
      result[maxIdx].size + diff
    );
  }

  return result;
}

/**
 * @typedef {Object} SashRatioResult
 * @description Recalculated proportional axis ratios for two adjacent docked widgets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @property {number} ratio1 - Updated axis ratio for the first widget.
 * @property {number} ratio2 - Updated axis ratio for the second widget.
 */
export interface SashRatioResult {
  ratio1: number;
  ratio2: number;
}

/**
 * Recalculates relative axis ratios between two adjacent widgets based on divider sash pixel movement.
 * @function recalculateSashRatios
 * @description Redistributes combined ratio proportionally across two widgets according to their new pixel sizes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {number} ratio1 - Original axis ratio of first widget.
 * @param {number} ratio2 - Original axis ratio of second widget.
 * @param {number} size1 - New pixel dimension of first widget.
 * @param {number} size2 - New pixel dimension of second widget.
 * @returns {SashRatioResult} Updated ratio pair preserving the total combined ratio.
 */
export function recalculateSashRatios(
  ratio1: number,
  ratio2: number,
  size1: number,
  size2: number
): SashRatioResult {
  const r1 = Math.max(0.01, ratio1);
  const r2 = Math.max(0.01, ratio2);
  const combinedRatio = r1 + r2;

  const s1 = Math.max(1, size1);
  const s2 = Math.max(1, size2);
  const totalSize = s1 + s2;

  const raw1 = combinedRatio * (s1 / totalSize);

  // Round to 4 decimal places for clean storage
  const rounded1 = Math.max(0.01, Math.round(raw1 * 10000) / 10000);
  const rounded2 = Math.max(0.01, Math.round((combinedRatio - rounded1) * 10000) / 10000);

  return {
    ratio1: rounded1,
    ratio2: rounded2,
  };
}

/**
 * Synchronizes cross-axis dimensions across all visible widgets within a dock zone.
 * @function syncDockCrossAxis
 * @description Enforces equal cross-axis size across all panels in the specified dock (width for left/right, height for top/bottom).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {WidgetDockId} dock - Target perimeter dock zone.
 * @param {number} crossAxisSize - Unified cross-axis pixel dimension.
 * @param {DockviewApi} api - Active Dockview container API.
 */
export function syncDockCrossAxis(
  dock: WidgetDockId,
  crossAxisSize: number,
  api: DockviewApi
): void {
  const boundedSize = Math.max(50, Math.round(crossAxisSize));
  const dockItems = widgetDocksSignal.value[dock] || [];

  for (const item of dockItems) {
    const panel = api.getPanel(item.id);
    if (!panel) continue;

    if (dock === 'left' || dock === 'right') {
      if (panel.api.width !== boundedSize) {
        panel.api.setSize({ width: boundedSize });
      }
    } else {
      if (panel.api.height !== boundedSize) {
        panel.api.setSize({ height: boundedSize });
      }
    }
  }
}

/**
 * Rebalances panel dimensions in a dock proportionally when available dimensions change.
 * @function rebalanceDockOnResize
 * @description Computes and applies proportional pixel sizes along the primary axis for all visible panels in a dock.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {WidgetDockId} dock - Perimeter dock zone to rebalance.
 * @param {number} availableLength - Total available length along the primary axis.
 * @param {DockviewApi} api - Active Dockview container API.
 */
export function rebalanceDockOnResize(
  dock: WidgetDockId,
  availableLength: number,
  api: DockviewApi
): void {
  const dockItems = (widgetDocksSignal.value[dock] || [])
    .filter((item) => item.visible && api.getPanel(item.id) !== undefined)
    .sort((a, b) => a.order - b.order);

  if (dockItems.length === 0) return;

  const isVertical = dock === 'left' || dock === 'right';
  const inputs: ProportionalItemInput[] = dockItems.map((item) => {
    const minSize = isVertical ? 120 : 150;
    return {
      id: item.id,
      axisRatio: item.axisRatio,
      minSize,
    };
  });

  const allocations = calculateProportionalSizes(inputs, availableLength);

  for (const alloc of allocations) {
    const panel = api.getPanel(alloc.id);
    if (!panel) continue;

    if (isVertical) {
      panel.api.setSize({ height: alloc.size });
    } else {
      panel.api.setSize({ width: alloc.size });
    }
  }
}

/**
 * Detects sash adjustments between panels or outer boundary changes and synchronizes ratios and cross-axis dimensions.
 * @function detectAndSyncSashDrag
 * @description Inspects panel pixel dimensions, updates axis ratios on divider movement, and synchronizes cross-axis sizes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {WidgetDockId} dock - Perimeter dock zone to inspect.
 * @param {DockviewApi} api - Active Dockview container API.
 * @returns {Promise<boolean>} True if state was updated and persisted.
 */
export async function detectAndSyncSashDrag(
  dock: WidgetDockId,
  api: DockviewApi
): Promise<boolean> {
  const current = widgetDocksSignal.value;
  const dockItems = [...(current[dock] || [])]
    .filter((item) => item.visible && api.getPanel(item.id) !== undefined)
    .sort((a, b) => a.order - b.order);

  if (dockItems.length === 0) return false;

  const isVertical = dock === 'left' || dock === 'right';
  let stateModified = false;
  let nextState: WorkbenchWidgetDocksState = { ...current };

  // 1. Cross-axis check (dock width for left/right; dock height for top/bottom)
  const firstPanel = api.getPanel(dockItems[0].id);
  if (firstPanel) {
    const currentCrossAxis = isVertical ? firstPanel.api.width : firstPanel.api.height;
    const storedCrossAxis =
      isVertical ?
        dockItems[0].dimensions.width
      : dockItems[0].dimensions.height;

    if (currentCrossAxis > 0 && currentCrossAxis !== storedCrossAxis) {
      // Synchronize all panels in dock to this cross-axis size
      syncDockCrossAxis(dock, currentCrossAxis, api);

      const updatedItems = current[dock].map((item) => ({
        ...item,
        dimensions: {
          ...item.dimensions,
          [isVertical ? 'width' : 'height']: currentCrossAxis,
        },
      }));

      nextState = {
        ...nextState,
        [dock]: updatedItems,
      };
      stateModified = true;
    }
  }

  // 2. Primary axis ratio check between adjacent panels
  if (dockItems.length >= 2) {
    for (let i = 0; i < dockItems.length - 1; i++) {
      const itemA = dockItems[i];
      const itemB = dockItems[i + 1];
      const panelA = api.getPanel(itemA.id);
      const panelB = api.getPanel(itemB.id);

      if (!panelA || !panelB) continue;

      const sizeA = isVertical ? panelA.api.height : panelA.api.width;
      const sizeB = isVertical ? panelB.api.height : panelB.api.width;

      if (sizeA <= 0 || sizeB <= 0) continue;

      const totalRatio = itemA.axisRatio + itemB.axisRatio;
      const currentProportionA = itemA.axisRatio / totalRatio;
      const observedProportionA = sizeA / (sizeA + sizeB);

      // Check if proportion deviated by more than 0.02 (user dragged divider sash)
      if (Math.abs(currentProportionA - observedProportionA) > 0.02) {
        const { ratio1, ratio2 } = recalculateSashRatios(
          itemA.axisRatio,
          itemB.axisRatio,
          sizeA,
          sizeB
        );

        const updatedItems = nextState[dock].map((item) => {
          if (item.id === itemA.id) return { ...item, axisRatio: ratio1 };
          if (item.id === itemB.id) return { ...item, axisRatio: ratio2 };
          return item;
        });

        nextState = {
          ...nextState,
          [dock]: updatedItems,
        };
        stateModified = true;
      }
    }
  }

  if (stateModified) {
    widgetDocksSignal.value = nextState;
    await updatePreference('ui.workbench.widgetDocks', nextState);
    return true;
  }

  return false;
}

/**
 * Moves a widget to another dock, resetting its axisRatio to 1 per ADR 0025.
 * @function transferWidgetDock
 * @description Delegates to moveWidgetToDock, ensuring the transferred widget's axis ratio is reset to 1.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {string} id - Identifier of widget to transfer.
 * @param {WidgetDockId} targetDock - Destination dock zone.
 * @param {number} [targetIndex] - Optional destination index.
 * @returns {Promise<void>}
 */
export async function transferWidgetDock(
  id: string,
  targetDock: WidgetDockId,
  targetIndex?: number
): Promise<void> {
  await moveWidgetToDock(id, targetDock, targetIndex);
}

/**
 * Reorders a widget within the same dock, preserving its existing axisRatio.
 * @function reorderWidgetDock
 * @description Delegates to reorderWidgetInDock, preserving existing axis ratios for all widgets in the dock.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {WidgetDockId} dock - Dock zone containing widget.
 * @param {number} sourceIndex - Source index of widget.
 * @param {number} targetIndex - Target index of widget.
 * @returns {Promise<void>}
 */
export async function reorderWidgetDock(
  dock: WidgetDockId,
  sourceIndex: number,
  targetIndex: number
): Promise<void> {
  await reorderWidgetInDock(dock, sourceIndex, targetIndex);
}
