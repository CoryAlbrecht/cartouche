/**
 * @file toolbarDropTarget.ts
 * @module renderer/workbench/widgets/toolbarDropTarget
 * @description Pure hit-zone resolution and index calculation helpers for ToolbarWidget and ToolbarContainerWidget drag-and-drop reordering across perimeter zones.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see {@link ToolbarContainerWidget}
 */

import type { ToolbarId, ToolbarZone } from '@renderer/state/gisSignals';

/**
 * @typedef {'before' | 'after'} ToolbarDropPosition
 * @description Relative insertion placement relative to the hovered toolbar widget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 */
export type ToolbarDropPosition = 'before' | 'after';

/**
 * @typedef {Object} CalculateToolbarTargetIndexParams
 * @property {ToolbarId[]} fullOrder - Full ordered array of toolbar IDs in the destination target zone.
 * @property {ToolbarId[]} [visibleOrder] - Optional ordered array of visible toolbar IDs in the destination target zone.
 * @property {ToolbarId} draggedId - Identifier of the toolbar currently being dragged.
 * @property {ToolbarId} hoveredId - Identifier of the toolbar widget hovered as the drop target.
 * @property {ToolbarZone} currentZone - Current dock zone of the dragged toolbar.
 * @property {ToolbarZone} targetZone - Destination dock zone where the drop is taking place.
 * @property {ToolbarDropPosition} position - Relative insertion side ('before' | 'after').
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 */
export interface CalculateToolbarTargetIndexParams {
  fullOrder: ToolbarId[];
  visibleOrder?: ToolbarId[];
  draggedId: ToolbarId;
  hoveredId: ToolbarId;
  currentZone: ToolbarZone;
  targetZone: ToolbarZone;
  position: ToolbarDropPosition;
}

/**
 * @description Resolves relative drop position ('before' or 'after') based on dock zone orientation, cursor coordinates, and target toolbar dimensions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @param {ToolbarZone} zone - Dock zone of the target toolbar container ('top', 'bottom', 'left', or 'right').
 * @param {number} offsetX - Cursor horizontal offset within the hovered toolbar element.
 * @param {number} offsetY - Cursor vertical offset within the hovered toolbar element.
 * @param {number} width - Total width of the hovered toolbar element.
 * @param {number} height - Total height of the hovered toolbar element.
 * @returns {ToolbarDropPosition} Resolved insertion position ('before' or 'after').
 */
export function resolveToolbarDropPosition(
  zone: ToolbarZone,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number
): ToolbarDropPosition {
  const isHorizontal = zone === 'top' || zone === 'bottom';
  const offset = isHorizontal ? offsetX : offsetY;
  const dimension = isHorizontal ? width : height;
  const midpoint = dimension / 2;
  return offset < midpoint ? 'before' : 'after';
}

/**
 * @description Computes the target insertion index in the destination zone array for moveToolbar.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @param {CalculateToolbarTargetIndexParams} params - Calculation parameters including order, zones, and relative position.
 * @returns {number} Computed target index for splicing into the destination zone array.
 */
export function calculateToolbarTargetIndex(
  params: CalculateToolbarTargetIndexParams
): number {
  const { fullOrder, visibleOrder, draggedId, hoveredId, currentZone, targetZone, position } = params;

  const isSameZone = currentZone === targetZone;
  const draggedIndex = fullOrder.indexOf(draggedId);

  // If dropping before the first visible toolbar in the zone, it must land at index 0
  if (position === 'before' && visibleOrder && visibleOrder.length > 0 && visibleOrder[0] === hoveredId) {
    return 0;
  }

  // If dropping after the last visible toolbar in the zone, it must land at the end
  if (position === 'after' && visibleOrder && visibleOrder.length > 0 && visibleOrder[visibleOrder.length - 1] === hoveredId) {
    return isSameZone && draggedIndex !== -1 ? fullOrder.length - 1 : fullOrder.length;
  }

  const hoverIndex = fullOrder.indexOf(hoveredId);
  if (hoverIndex === -1) {
    return fullOrder.length;
  }

  if (isSameZone && draggedIndex !== -1) {
    if (draggedIndex === hoverIndex) {
      return draggedIndex;
    }

    if (draggedIndex < hoverIndex) {
      return position === 'before' ? hoverIndex - 1 : hoverIndex;
    }

    return position === 'before' ? hoverIndex : hoverIndex + 1;
  }

  return position === 'before' ? hoverIndex : hoverIndex + 1;
}
