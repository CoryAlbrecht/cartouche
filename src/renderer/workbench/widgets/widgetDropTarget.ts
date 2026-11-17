/**
 * @file widgetDropTarget.ts
 * @module renderer/workbench/widgets/widgetDropTarget
 * @description Pure helpers for BasicWidget and OverlapTabWidget drag-and-drop: the widget drag payload MIME contract (widget and tab-extract types), classification of a drag as a widget drag, reading the dragged widget id at drop time, and hit-zone resolution of the drop target.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link resolveWidgetDropZone}
 * @see {@link isWidgetDrag}
 * @see {@link readDraggedWidgetId}
 */

/**
 * @constant {string} WIDGET_DRAG_MIME
 * @description Drag payload MIME type set by a BasicWidget header drag. Its JSON value carries `widgetId`, `panelId` and `overlappable`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 */
export const WIDGET_DRAG_MIME = 'application/x-cartouche-widget';

/**
 * @constant {string} TAB_EXTRACT_DRAG_MIME
 * @description Drag payload MIME type set by an OverlapTabWidget tab drag. Its JSON value carries `containerId` and `tabId`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 */
export const TAB_EXTRACT_DRAG_MIME = 'application/x-cartouche-tab-extract';

/**
 * Decides whether a drag is a widget drag that widget drop targets should react to.
 * Only Cartouche's own widget and tab-extract payload types count: other drags that merely
 * carry `text/plain` (LayerTreeWidget Tree Node Row drags, toolbar drags) are foreign to widget drop targets.
 * @function isWidgetDrag
 * @description Classifies a drag as a widget drag by its payload MIME types.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {ArrayLike<string>} types - The drag's `DataTransfer.types` (readable during dragover).
 * @returns {boolean} True when the drag carries a widget or tab-extract payload.
 */
export function isWidgetDrag(types: ArrayLike<string>): boolean {
  const list = Array.from(types);
  return list.includes(WIDGET_DRAG_MIME) || list.includes(TAB_EXTRACT_DRAG_MIME);
}

/**
 * Reads the dragged widget id at drop time: the widget payload's `widgetId` (or `panelId`),
 * else the tab-extract payload's `tabId`. Never falls back to `text/plain`, which other drag
 * sources use for ids that are not widgets.
 * @function readDraggedWidgetId
 * @description Extracts the dragged widget id from a drop's widget or tab-extract payload.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {Pick<DataTransfer, 'getData'>} dataTransfer - The drop event's data transfer.
 * @returns {string} The dragged widget id, or '' when the drag carries no readable widget payload.
 */
export function readDraggedWidgetId(dataTransfer: Pick<DataTransfer, 'getData'>): string {
  try {
    const widgetData = dataTransfer.getData(WIDGET_DRAG_MIME);
    if (widgetData) {
      const parsed = JSON.parse(widgetData);
      return String(parsed.widgetId || parsed.panelId || '');
    }
    const tabData = dataTransfer.getData(TAB_EXTRACT_DRAG_MIME);
    if (tabData) {
      return String(JSON.parse(tabData).tabId || '');
    }
  } catch {
    // Malformed payload: not a usable widget drag.
  }
  return '';
}

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
