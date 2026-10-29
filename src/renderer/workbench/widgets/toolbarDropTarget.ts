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
 * @typedef {'before' | 'after' | 'new-row-above' | 'new-row-below' | 'new-row-before' | 'new-row-after'} ToolbarDropPosition
 * @description Relative insertion placement relative to the hovered toolbar widget, supporting intra-row reordering and multi-row creation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 */
export type ToolbarDropPosition =
  | 'before'
  | 'after'
  | 'new-row-above'
  | 'new-row-below'
  | 'new-row-before'
  | 'new-row-after';

/**
 * @typedef {Object} CalculateToolbarTargetIndexParams
 * @property {ToolbarId[]} fullOrder - Full ordered array of toolbar IDs in the destination target zone.
 * @property {ToolbarId[]} [visibleOrder] - Optional ordered array of visible toolbar IDs in the destination target zone.
 * @property {ToolbarId} draggedId - Identifier of the toolbar currently being dragged.
 * @property {ToolbarId} hoveredId - Identifier of the toolbar widget hovered as the drop target.
 * @property {ToolbarZone} currentZone - Current dock zone of the dragged toolbar.
 * @property {ToolbarZone} targetZone - Destination dock zone where the drop is taking place.
 * @property {ToolbarDropPosition} position - Relative insertion side.
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
 * @description Resolves relative drop position ('before', 'after', 'new-row-above', 'new-row-below', 'new-row-before', or 'new-row-after')
 * using a 25% / 50% / 25% cross-axis threshold system.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @param {ToolbarZone} zone - Dock zone of the target toolbar container ('top', 'bottom', 'left', or 'right').
 * @param {number} offsetX - Cursor horizontal offset within the hovered toolbar element.
 * @param {number} offsetY - Cursor vertical offset within the hovered toolbar element.
 * @param {number} width - Total width of the hovered toolbar element.
 * @param {number} height - Total height of the hovered toolbar element.
 * @returns {ToolbarDropPosition} Resolved insertion position.
 */
export function resolveToolbarDropPosition(
  zone: ToolbarZone,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number
): ToolbarDropPosition {
  const isHorizontal = zone === 'top' || zone === 'bottom';

  if (isHorizontal) {
    // Cross axis is Y (vertical offset within toolbar height)
    if (offsetY < height * 0.25) {
      return 'new-row-above';
    }
    if (offsetY > height * 0.75) {
      return 'new-row-below';
    }
    // Middle 50% cross-axis band: intra-row reordering by primary axis (X)
    return offsetX < width * 0.5 ? 'before' : 'after';
  }

  // Vertical zones ('left' | 'right'): cross axis is X (horizontal offset within toolbar width)
  if (offsetX < width * 0.25) {
    return 'new-row-before';
  }
  if (offsetX > width * 0.75) {
    return 'new-row-after';
  }
  // Middle 50% cross-axis band: intra-column reordering by primary axis (Y)
  return offsetY < height * 0.5 ? 'before' : 'after';
}

/**
 * @description Resolves container boundary drop target position ('prepend-new-row' or 'append-new-row')
 * when dropping onto empty container hit zones or trailing space.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @param {ToolbarZone} zone - Dock zone of the container ('top', 'bottom', 'left', or 'right').
 * @param {number} offset - Cursor offset along the cross-axis (Y for horizontal, X for vertical).
 * @param {number} dimension - Container cross-axis dimension (height for horizontal, width for vertical).
 * @returns {'prepend-new-row' | 'append-new-row'} Resolved container row placement.
 */
export function resolveContainerDropPosition(
  _zone: ToolbarZone,
  offset: number,
  dimension: number
): 'prepend-new-row' | 'append-new-row' {
  if (dimension <= 0) return 'append-new-row';
  return offset < dimension * 0.25 ? 'prepend-new-row' : 'append-new-row';
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

  // Normalize multi-row positions to before/after for flat array indexing
  const isBefore = position === 'before' || position === 'new-row-above' || position === 'new-row-before';

  const isSameZone = currentZone === targetZone;
  const draggedIndex = fullOrder.indexOf(draggedId);

  // If dropping before the first visible toolbar in the zone, it must land at index 0
  if (isBefore && visibleOrder && visibleOrder.length > 0 && visibleOrder[0] === hoveredId) {
    return 0;
  }

  // If dropping after the last visible toolbar in the zone, it must land at the end
  if (!isBefore && visibleOrder && visibleOrder.length > 0 && visibleOrder[visibleOrder.length - 1] === hoveredId) {
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
      return isBefore ? hoverIndex - 1 : hoverIndex;
    }

    return isBefore ? hoverIndex : hoverIndex + 1;
  }

  return isBefore ? hoverIndex : hoverIndex + 1;
}
