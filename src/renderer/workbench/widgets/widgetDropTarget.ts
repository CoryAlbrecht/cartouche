/**
 * @file widgetDropTarget.ts
 * @module renderer/workbench/widgets/widgetDropTarget
 * @description Pure hit-zone and drop target resolution helpers for BasicWidget and OverlapTabWidget drag-and-drop interactions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @see {@link resolveWidgetDropZone}
 */

/**
 * @typedef {'edge-top' | 'edge-bottom' | 'edge-left' | 'edge-right' | 'center-overlap' | 'none'} WidgetDropZone
 * @description Drop target zone classification distinguishing perimeter edge reordering from center tab overlapping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 */
export type WidgetDropZone =
  | 'edge-top'
  | 'edge-bottom'
  | 'edge-left'
  | 'edge-right'
  | 'center-overlap'
  | 'none';

/**
 * @typedef {Object} ResolveWidgetDropZoneParams
 * @description Bounding geometry and capability attributes for resolving widget drop targets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @property {{ top: number; left: number; width: number; height: number }} rect - Target element client rectangle bounds.
 * @property {number} clientX - Pointer horizontal screen coordinate.
 * @property {number} clientY - Pointer vertical screen coordinate.
 * @property {boolean} targetOverlappable - Whether target widget accepts overlap tab grouping.
 * @property {boolean} draggedOverlappable - Whether dragged widget accepts overlap tab grouping.
 * @property {boolean} [isTargetOverlapContainer] - Whether target is an existing OverlapTabWidget container.
 * @property {string} [draggedWidgetId] - Identifier of dragged widget.
 * @property {string} [targetWidgetId] - Identifier of target widget.
 */
export interface ResolveWidgetDropZoneParams {
  rect: { top: number; left: number; width: number; height: number };
  clientX: number;
  clientY: number;
  targetOverlappable: boolean;
  draggedOverlappable: boolean;
  isTargetOverlapContainer?: boolean;
  draggedWidgetId?: string;
  targetWidgetId?: string;
}

/**
 * Resolves drop zone classification based on cursor pointer coordinates and widget overlappability capabilities.
 * @function resolveWidgetDropZone
 * @description Identifies perimeter edge zones for dock reordering vs center backdrop zone for tab grouping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {ResolveWidgetDropZoneParams} params - Geometry and capability attributes.
 * @returns {WidgetDropZone} Resolved drop zone.
 */
export function resolveWidgetDropZone(params: ResolveWidgetDropZoneParams): WidgetDropZone {
  const {
    rect,
    clientX,
    clientY,
    targetOverlappable,
    draggedOverlappable,
    isTargetOverlapContainer = false,
    draggedWidgetId,
    targetWidgetId,
  } = params;

  // Cannot drop widget onto itself
  if (draggedWidgetId && targetWidgetId && draggedWidgetId === targetWidgetId) {
    return 'none';
  }

  const relX = clientX - rect.left;
  const relY = clientY - rect.top;

  // Out of bounds
  if (relX < 0 || relX > rect.width || relY < 0 || relY > rect.height) {
    return 'none';
  }

  // Edge thresholds: 25% of dimension or minimum 24px
  const edgeThresholdX = Math.min(rect.width * 0.25, 40);
  const edgeThresholdY = Math.min(rect.height * 0.25, 40);

  // Check top and bottom edges
  const isTopEdge = relY <= edgeThresholdY;
  const isBottomEdge = relY >= rect.height - edgeThresholdY;
  const isLeftEdge = relX <= edgeThresholdX;
  const isRightEdge = relX >= rect.width - edgeThresholdX;

  // Determine closest edge if near perimeter
  if (isTopEdge && relY <= relX && relY <= rect.width - relX) {
    return 'edge-top';
  }
  if (isBottomEdge && rect.height - relY <= relX && rect.height - relY <= rect.width - relX) {
    return 'edge-bottom';
  }
  if (isLeftEdge) {
    return 'edge-left';
  }
  if (isRightEdge) {
    return 'edge-right';
  }

  // Center region: check overlap compatibility
  const canOverlap =
    draggedOverlappable && (targetOverlappable || isTargetOverlapContainer);

  if (canOverlap) {
    return 'center-overlap';
  }

  return 'none';
}
