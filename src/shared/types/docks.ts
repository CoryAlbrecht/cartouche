/**
 * @file docks.ts
 * @module shared/types/docks
 * @description Type definitions and interfaces for flex-proportional dock layout state and docked widget items.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link WorkbenchWidgetDocksState}
 */

/**
 * @typedef {'left' | 'right' | 'top' | 'bottom'} WidgetDockId
 * @description Identifiers for the four outer perimeter dock zones surrounding the central map canvas.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */
export type WidgetDockId = 'left' | 'right' | 'top' | 'bottom';

/**
 * @typedef {Object} WidgetDockDimensions
 * @description Width and height pixel dimensions for docked widgets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @property {number} [width] - Explicit width in pixels.
 * @property {number} [height] - Explicit height in pixels.
 */
export interface WidgetDockDimensions {
  width?: number;
  height?: number;
}

/**
 * @typedef {Object} WidgetDockItem
 * @description Model representing a single docked widget or overlap tab container within a perimeter dock.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @property {string} id - Unique identifier of the docked widget or container.
 * @property {WidgetDockId} dock - Current dock assignment ('left', 'right', 'top', or 'bottom').
 * @property {number} order - Display ordering index along the dock axis.
 * @property {number} axisRatio - Flex-box proportional axis ratio along the primary dock dimension.
 * @property {WidgetDockDimensions} dimensions - Explicit or cached pixel dimensions.
 * @property {boolean} visible - Whether the docked widget is currently visible.
 * @property {boolean} isOverlapContainer - True if this item represents an OverlapTabWidget container.
 * @property {string[]} [tabChildren] - List of child widget IDs contained within this overlap container.
 * @property {string} [activeTabId] - ID of the currently selected/active tab child if an overlap container.
 */
export interface WidgetDockItem {
  id: string;
  dock: WidgetDockId;
  order: number;
  axisRatio: number;
  dimensions: WidgetDockDimensions;
  visible: boolean;
  isOverlapContainer: boolean;
  tabChildren?: string[];
  activeTabId?: string;
}

/**
 * @typedef {Record<WidgetDockId, WidgetDockItem[]>} WorkbenchWidgetDocksState
 * @description Comprehensive map of perimeter dock zones to arrays of docked widget items.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */
export type WorkbenchWidgetDocksState = Record<WidgetDockId, WidgetDockItem[]>;

/**
 * @description Default flex-proportional dock layout assignments and ratios for Cartouche workbench panels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {WorkbenchWidgetDocksState}
 */
export const DEFAULT_WORKBENCH_WIDGET_DOCKS: WorkbenchWidgetDocksState = {
  left: [
    {
      id: 'layer-tree',
      dock: 'left',
      order: 0,
      axisRatio: 1,
      dimensions: { width: 260 },
      visible: true,
      isOverlapContainer: false,
    },
  ],
  right: [],
  top: [
    {
      id: 'time-filter',
      dock: 'top',
      order: 0,
      axisRatio: 1,
      dimensions: { height: 74 },
      visible: true,
      isOverlapContainer: false,
    },
  ],
  bottom: [
    {
      id: 'attribute-table',
      dock: 'bottom',
      order: 0,
      axisRatio: 1,
      dimensions: { height: 200 },
      visible: false,
      isOverlapContainer: false,
    },
    {
      id: 'console',
      dock: 'bottom',
      order: 1,
      axisRatio: 1,
      dimensions: { height: 160 },
      visible: false,
      isOverlapContainer: false,
    },
  ],
};

