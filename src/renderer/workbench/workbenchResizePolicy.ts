/**
 * @file workbenchResizePolicy.ts
 * @module renderer/workbench/workbenchResizePolicy
 * @description Window resize policy for the Workbench's Dockview layout (ADR 0025 §8). Dockview always scales every group in proportion when its container resizes, so the Workbench lays the Dockview layout out itself: it records each perimeter dock's depth (the width of a left or right dock, the height of a top or bottom dock), lets Dockview lay out, then puts the depths back so the map viewport takes the whole change. Only when the map viewport would fall below its 256 px × 256 px minimum do the two opposite docks on that axis give up space, in equal shares and never below the largest minimum among their widgets. The module also gives the map viewport's group high layout priority and the widget groups low priority, and works out the Workbench window's minimum size from the layout's minimum plus the fixed bars around it (menubar, outer toolbars, status bar).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link layoutWorkbenchGrid}
 * @see {@link shareShortfall}
 * @see {@link resolveAxisDepths}
 * @see {@link computeWorkbenchMinimumSize}
 */

import type { DockviewApi, DockviewGroupPanel } from "dockview-react";
import type { WidgetDockId, WorkbenchMinimumSize } from "../../shared/types";
import { widgetDocksSignal } from "../state/widgetDockSignals";

/**
 * @description Minimum width and height, in pixels, of the map viewport's content area (ADR 0025 §8).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {number}
 */
export const MAP_VIEWPORT_MIN_SIZE = 256;

/**
 * @typedef {Object} DockDepthInput
 * @description One perimeter dock on an axis, as the shortfall arithmetic sees it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @property {number} depth - The depth the dock should keep, in pixels.
 * @property {number} floor - The dock's minimum depth: the largest minimum among its widgets.
 */
export interface DockDepthInput {
  depth: number;
  floor: number;
}

/**
 * @typedef {Object} AxisDockState
 * @description One perimeter dock on an axis during a layout pass.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @property {number} current - The dock's depth after Dockview's proportional layout.
 * @property {number} intended - The depth the dock had before the layout, which it should keep.
 * @property {number} floor - The dock's minimum depth.
 */
export interface AxisDockState {
  current: number;
  intended: number;
  floor: number;
}

/**
 * @typedef {Object} AxisDepthInput
 * @description Everything needed to settle the dock depths on one axis.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @property {number} mapSize - The map viewport group's size on this axis after Dockview's proportional layout.
 * @property {number} mapMin - The map viewport group's minimum size on this axis.
 * @property {AxisDockState[]} docks - The open docks on this axis (left and right, or top and bottom).
 */
export interface AxisDepthInput {
  mapSize: number;
  mapMin: number;
  docks: AxisDockState[];
}

/**
 * @typedef {Object} WorkbenchMinimumSizeInput
 * @description Measurements the Workbench window minimum is computed from.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @property {number} gridMinWidth - The Dockview layout's minimum width.
 * @property {number} gridMinHeight - The Dockview layout's minimum height.
 * @property {number} viewportWidth - The window's current inner width.
 * @property {number} viewportHeight - The window's current inner height.
 * @property {number} gridWidth - The Dockview container's current width.
 * @property {number} gridHeight - The Dockview container's current height.
 */
export interface WorkbenchMinimumSizeInput {
  gridMinWidth: number;
  gridMinHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Takes a shortfall from a set of docks in equal shares, never pushing a dock below its floor.
 * @function shareShortfall
 * @description Splits `shortfall` pixels equally across the docks that still have room above their floor. A dock that reaches its floor stops and the others take the rest; any odd pixel goes to the earlier dock. When every dock is at its floor the rest of the shortfall is left untaken.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {number} shortfall - Pixels to take from the docks.
 * @param {DockDepthInput[]} docks - The docks sharing the shortfall.
 * @returns {number[]} The new depth of each dock, in input order.
 */
export function shareShortfall(
  shortfall: number,
  docks: DockDepthInput[]
): number[] {
  const depths = docks.map((d) => Math.round(d.depth));
  const floors = docks.map((d, i) => Math.min(depths[i], Math.round(d.floor)));
  let remaining = Math.max(0, Math.round(shortfall));

  while (remaining > 0) {
    const open = depths
      .map((_depth, i) => i)
      .filter((i) => depths[i] > floors[i]);
    if (open.length === 0) break;

    const share = Math.floor(remaining / open.length);
    let extra = remaining - share * open.length;
    let taken = 0;
    for (const i of open) {
      const want = share + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
      const cut = Math.min(want, depths[i] - floors[i]);
      depths[i] -= cut;
      taken += cut;
    }
    if (taken === 0) break;
    remaining -= taken;
  }

  return depths;
}

/**
 * Settles the dock depths on one axis after Dockview's proportional layout.
 * @function resolveAxisDepths
 * @description Works out the map viewport's size as if every dock on the axis were put back to its intended depth. If that leaves the map viewport at or above its minimum, the docks keep their intended depths; otherwise the shortfall is shared equally between them with {@link shareShortfall}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {AxisDepthInput} input - The map viewport and dock sizes on the axis.
 * @returns {number[]} The depth each dock should take, in input order.
 */
export function resolveAxisDepths(input: AxisDepthInput): number[] {
  const { mapSize, mapMin, docks } = input;
  const projectedMap = docks.reduce(
    (size, d) => size + d.current - d.intended,
    mapSize
  );
  const intended = docks.map((d) => ({ depth: d.intended, floor: d.floor }));
  if (projectedMap >= mapMin) {
    return intended.map((d) => Math.round(d.depth));
  }
  return shareShortfall(mapMin - projectedMap, intended);
}

/**
 * Computes the Workbench window's minimum size.
 * @function computeWorkbenchMinimumSize
 * @description Adds the fixed bars around the Dockview layout (the window's inner size less the Dockview container's size: menubar, outer toolbars and status bar) to the layout's minimum size, rounding up to whole pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {WorkbenchMinimumSizeInput} input - Layout minimum and current window and container sizes.
 * @returns {WorkbenchMinimumSize} The minimum window size.
 */
export function computeWorkbenchMinimumSize(
  input: WorkbenchMinimumSizeInput
): WorkbenchMinimumSize {
  const barsWidth = Math.max(0, input.viewportWidth - input.gridWidth);
  const barsHeight = Math.max(0, input.viewportHeight - input.gridHeight);
  return {
    width: Math.ceil(input.gridMinWidth + barsWidth),
    height: Math.ceil(input.gridMinHeight + barsHeight),
  };
}

/**
 * @typedef {Object} GridNodeLike
 * @description The parts of a Dockview layout node (branch or leaf) the minimum size walk reads.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @property {string} [orientation] - `HORIZONTAL` (children side by side) or `VERTICAL` (stacked), for a branch.
 * @property {GridNodeLike[]} [children] - A branch's child nodes.
 * @property {{ minimumWidth: number; minimumHeight: number }} [view] - A leaf's view (a group).
 * @property {(index: number) => boolean} [isChildVisible] - Whether a branch's child is visible.
 */
export interface GridNodeLike {
  orientation?: string;
  children?: GridNodeLike[];
  view?: { minimumWidth: number; minimumHeight: number };
  isChildVisible?: (index: number) => boolean;
}

/**
 * Computes a Dockview layout node's minimum size from its leaves.
 * @function computeGridMinimum
 * @description Walks the Dockview layout tree: a leaf reports its group's live minimum; a horizontal branch adds its visible children's minimum widths and takes the largest minimum height, a vertical branch the other way round. Dockview caches each branch's minimum across the branch and does not always clear that cache when a nested group is removed, so the Workbench computes the minimum itself.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {GridNodeLike} node - The node to measure.
 * @returns {WorkbenchMinimumSize} The node's minimum width and height.
 */
export function computeGridMinimum(node: GridNodeLike): WorkbenchMinimumSize {
  if (!node.children) {
    return {
      width: node.view?.minimumWidth ?? 0,
      height: node.view?.minimumHeight ?? 0,
    };
  }
  const horizontal = node.orientation === "HORIZONTAL";
  let width = 0;
  let height = 0;
  node.children.forEach((child, index) => {
    if (node.isChildVisible && !node.isChildVisible(index)) return;
    const min = computeGridMinimum(child);
    if (horizontal) {
      width += min.width;
      height = Math.max(height, min.height);
    } else {
      height += min.height;
      width = Math.max(width, min.width);
    }
  });
  return { width, height };
}

/**
 * Reads the Workbench's Dockview layout minimum size.
 * @function readGridMinimum
 * @description Computes the minimum from the live Dockview layout tree with {@link computeGridMinimum}, falling back to Dockview's own `minimumWidth` / `minimumHeight` when the tree cannot be reached.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @returns {WorkbenchMinimumSize} The Dockview layout's minimum width and height.
 */
function readGridMinimum(api: DockviewApi): WorkbenchMinimumSize {
  const root = (api as any).component?.gridview?.root as
    GridNodeLike | undefined;
  if (root?.children) return computeGridMinimum(root);
  return { width: api.minimumWidth, height: api.minimumHeight };
}

/**
 * @description The last minimum window size sent to the main process, so unchanged values are not resent.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {WorkbenchMinimumSize | null}
 */
let lastReportedMinimumSize: WorkbenchMinimumSize | null = null;

/**
 * Sends the Workbench window's minimum size to the main process when it changes.
 * @function reportWorkbenchMinimumSize
 * @description Computes the minimum with {@link computeWorkbenchMinimumSize} from the Dockview layout's minimum ({@link readGridMinimum}) and the fixed bars around the Dockview container, and sends it through `electronAPI.setWorkbenchMinimumSize` unless it equals the last value sent. Does nothing before the Dockview container has a size.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @param {HTMLElement} container - The element holding the Dockview layout.
 * @returns {WorkbenchMinimumSize | null} The size sent, or null when nothing was sent.
 */
export function reportWorkbenchMinimumSize(
  api: DockviewApi,
  container: HTMLElement
): WorkbenchMinimumSize | null {
  const gridWidth = container.clientWidth;
  const gridHeight = container.clientHeight;
  if (gridWidth <= 0 || gridHeight <= 0) return null;

  const gridMinimum = readGridMinimum(api);
  const size = computeWorkbenchMinimumSize({
    gridMinWidth: gridMinimum.width,
    gridMinHeight: gridMinimum.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    gridWidth,
    gridHeight,
  });
  if (
    !Number.isFinite(size.width)
    || !Number.isFinite(size.height)
    || (lastReportedMinimumSize?.width === size.width
      && lastReportedMinimumSize?.height === size.height)
  ) {
    return null;
  }
  lastReportedMinimumSize = size;
  window.electronAPI?.setWorkbenchMinimumSize?.(size);
  return size;
}

/**
 * Tells whether a Dockview panel is a map viewport.
 * @function isMapViewportPanel
 * @description Matches panels whose id starts with `map-viewport` or whose content component is `map-viewport`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {any} panel - The Dockview panel.
 * @returns {boolean} True for a map viewport panel.
 */
export function isMapViewportPanel(panel: any): boolean {
  return (
    typeof panel?.id === "string"
    && (panel.id.startsWith("map-viewport")
      || panel.view?.contentComponent === "map-viewport")
  );
}

/**
 * Gives a Dockview group the layout priority its contents call for.
 * @function applyGroupLayoutPriority
 * @description Dockview ignores `priority` on `addPanel` and creates every group without a layout priority. This shadows the group's `priority` getter so the group reports `high` while it holds a map viewport and `low` otherwise, so that Dockview's own resizes (sash drags, `setSize`, empty-space distribution) give space to and take space from the map viewport first. Applying it twice is harmless.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewGroupPanel} group - The group to prioritise.
 * @returns {void}
 */
export function applyGroupLayoutPriority(group: DockviewGroupPanel): void {
  Object.defineProperty(group, "priority", {
    configurable: true,
    get: () => (group.panels.some(isMapViewportPanel) ? "high" : "low"),
  });
}

/**
 * Finds the groups that hold a map viewport.
 * @function getMapGroups
 * @description Returns every docked group with at least one map viewport panel.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @returns {DockviewGroupPanel[]} The map viewport groups.
 */
function getMapGroups(api: DockviewApi): DockviewGroupPanel[] {
  return api.groups.filter((g) => g.panels.some(isMapViewportPanel));
}

/**
 * Keeps each map viewport group's minimum at 256 px × 256 px of map content.
 * @function ensureMapGroupConstraints
 * @description Sets explicit minimum constraints on each map viewport group: 256 px wide, and 256 px plus the group's tab header (measured from its element) tall. Constraints are only written when they change, since each write relays out the Dockview layout.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @returns {void}
 */
export function ensureMapGroupConstraints(api: DockviewApi): void {
  for (const group of getMapGroups(api)) {
    const header = group.element.querySelector<HTMLElement>(
      ".dv-tabs-and-actions-container"
    );
    const headerHeight = header?.offsetHeight ?? 0;
    const minimumWidth = MAP_VIEWPORT_MIN_SIZE;
    const minimumHeight = MAP_VIEWPORT_MIN_SIZE + headerHeight;
    if (
      group.minimumWidth !== minimumWidth
      || group.minimumHeight !== minimumHeight
    ) {
      group.api.setConstraints({ minimumWidth, minimumHeight });
    }
  }
}

/**
 * @description Depths the window resize policy squeezed docks to, by dock, so a squeeze is not mistaken for a user sash drag and stored as the dock's dimension in `ui.workbench.widgetDocks`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {Map<WidgetDockId, number>}
 */
const squeezedDockDepths = new Map<WidgetDockId, number>();

/**
 * Tells whether a dock's depth is one the window resize policy squeezed it to.
 * @function isSqueezedDockDepth
 * @description True when `depth` is the depth the policy last squeezed `dock` to at the map viewport's minimum. Sash-drag detection uses it to leave the user's stored dock dimension alone; a squeezed dock keeps its squeezed depth on screen but reopens at the depth the user gave it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {WidgetDockId} dock - The perimeter dock.
 * @param {number} depth - The dock's current depth.
 * @returns {boolean} True for a depth set by a squeeze.
 */
export function isSqueezedDockDepth(
  dock: WidgetDockId,
  depth: number
): boolean {
  return squeezedDockDepths.get(dock) === Math.round(depth);
}

/**
 * Lists the docked groups of a perimeter dock.
 * @function getDockGroups
 * @description Resolves the dock's widgets that have an open panel to their Dockview groups, without duplicates and skipping floating and popout groups.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @param {WidgetDockId} dock - The perimeter dock.
 * @returns {DockviewGroupPanel[]} The dock's groups.
 */
function getDockGroups(
  api: DockviewApi,
  dock: WidgetDockId
): DockviewGroupPanel[] {
  const groups: DockviewGroupPanel[] = [];
  for (const item of widgetDocksSignal.value[dock] || []) {
    // An open panel counts whatever its `visible` flag says: the flag can lag
    // behind panels restored from a saved layout.
    const group = api.getPanel(item.id)?.group;
    if (!group || groups.includes(group)) continue;
    const locationType = group.api.location?.type;
    if (locationType === "floating" || locationType === "popout") continue;
    if (group.panels.some(isMapViewportPanel)) continue;
    groups.push(group);
  }
  return groups;
}

/**
 * Tells whether a dock's depth is a width.
 * @function isWidthDock
 * @description Left and right docks have a width depth; top and bottom docks a height depth.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {WidgetDockId} dock - The perimeter dock.
 * @returns {boolean} True for left and right.
 */
function isWidthDock(dock: WidgetDockId): boolean {
  return dock === "left" || dock === "right";
}

/**
 * Reads a dock's current depth.
 * @function readDockDepth
 * @description Returns the dock's first group's width (left, right) or height (top, bottom), or 0 when the dock has no docked group.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @param {WidgetDockId} dock - The perimeter dock.
 * @returns {number} The depth in pixels.
 */
function readDockDepth(api: DockviewApi, dock: WidgetDockId): number {
  const group = getDockGroups(api, dock)[0];
  if (!group) return 0;
  return isWidthDock(dock) ? group.api.width : group.api.height;
}

/**
 * Reads a dock's minimum depth.
 * @function readDockFloor
 * @description Returns the largest minimum width (left, right) or height (top, bottom) among the dock's groups.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @param {WidgetDockId} dock - The perimeter dock.
 * @returns {number} The floor in pixels.
 */
function readDockFloor(api: DockviewApi, dock: WidgetDockId): number {
  return getDockGroups(api, dock).reduce(
    (floor, g) =>
      Math.max(floor, isWidthDock(dock) ? g.minimumWidth : g.minimumHeight),
    0
  );
}

/**
 * Sets a dock's depth.
 * @function setDockDepth
 * @description Sizes every group of the dock to the depth, so that groups stacked in one dock stay flush.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @param {WidgetDockId} dock - The perimeter dock.
 * @param {number} depth - The depth in pixels.
 * @returns {void}
 */
function setDockDepth(
  api: DockviewApi,
  dock: WidgetDockId,
  depth: number
): void {
  for (const group of getDockGroups(api, dock)) {
    if (isWidthDock(dock)) {
      if (group.api.width !== depth) group.api.setSize({ width: depth });
    } else if (group.api.height !== depth) {
      group.api.setSize({ height: depth });
    }
  }
}

/**
 * Settles one axis: the map viewport takes the resize, the docks only give way at its minimum.
 * @function settleAxis
 * @description Resolves the target depths of the axis's open docks with {@link resolveAxisDepths}, then applies the shrinking docks before the growing ones so Dockview never has to take space from the wrong group in between.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @param {[WidgetDockId, WidgetDockId]} docks - The opposite docks of the axis.
 * @param {Partial<Record<WidgetDockId, number>>} intended - Dock depths from before the layout.
 * @returns {void}
 */
function settleAxis(
  api: DockviewApi,
  docks: [WidgetDockId, WidgetDockId],
  intended: Partial<Record<WidgetDockId, number>>
): void {
  const open = docks.filter((d) => (intended[d] ?? 0) > 0);
  if (open.length === 0) return;

  const width = isWidthDock(docks[0]);
  const mapGroups = getMapGroups(api);
  if (mapGroups.length === 0) return;
  const mapSize = Math.min(
    ...mapGroups.map((g) => (width ? g.api.width : g.api.height))
  );
  const mapMin = Math.max(
    ...mapGroups.map((g) => (width ? g.minimumWidth : g.minimumHeight))
  );

  const targets = resolveAxisDepths({
    mapSize,
    mapMin,
    docks: open.map((d) => ({
      current: readDockDepth(api, d),
      intended: intended[d] ?? 0,
      floor: readDockFloor(api, d),
    })),
  });

  const order = open
    .map((dock, i) => ({ dock, target: targets[i] }))
    .sort(
      (a, b) =>
        a.target
        - readDockDepth(api, a.dock)
        - (b.target - readDockDepth(api, b.dock))
    );
  for (const { dock, target } of order) {
    setDockDepth(api, dock, target);
  }
  open.forEach((dock, i) => {
    if (targets[i] !== Math.round(intended[dock] ?? 0)) {
      squeezedDockDepths.set(dock, targets[i]);
    }
  });
}

/**
 * Lays the Workbench's Dockview layout out at a new size under the window resize policy.
 * @function layoutWorkbenchGrid
 * @description Records each open dock's depth, lays the Dockview layout out (Dockview scales every group in proportion), then puts the depths back so only the map viewport changes. Where that would take the map viewport below its minimum, the opposite docks on that axis shrink in equal shares down to their floors. A squeezed dock is not grown back later: the next resize starts from its squeezed depth, so extra space goes to the map viewport. A dock with no laid-out depth yet (0 before the first layout) is left where Dockview puts it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {DockviewApi} api - The Workbench's Dockview API.
 * @param {number} width - The Dockview container's new width.
 * @param {number} height - The Dockview container's new height.
 * @returns {void}
 */
export function layoutWorkbenchGrid(
  api: DockviewApi,
  width: number,
  height: number
): void {
  const docks: WidgetDockId[] = ["left", "right", "top", "bottom"];
  const intended: Partial<Record<WidgetDockId, number>> = {};
  for (const dock of docks) {
    intended[dock] = readDockDepth(api, dock);
  }

  api.layout(Math.round(width), Math.round(height));
  ensureMapGroupConstraints(api);

  settleAxis(api, ["left", "right"], intended);
  settleAxis(api, ["top", "bottom"], intended);
}
