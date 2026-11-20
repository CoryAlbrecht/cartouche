/**
 * @file mapToolInteractions.ts
 * @module renderer/map/mapToolInteractions
 * @description Tool-driven map interactions: what a primary click or drag on the map does under the active map tool. {@link MapToolInteractions}, owned by the MapController and fed from `activeToolSignal`, switches OpenLayers' default navigation gestures per tool ({@link resolveNavigationForTool}: Selection Tools turn off drag-pan and Shift+drag box zoom) and activates the tool's {@link MapToolHandler} from a handler table ({@link MAP_TOOL_HANDLERS}). Select by Click is the first handler; Select by Rectangle and Select by Lasso add their own entries, and vertex selection branches on the Selection Target inside them. All Selection Tools publish through {@link publishFeatureSelection}, which applies the shared {@link mergeSelection} rule to `selectedFeatureIdsSignal`, so the map highlight and Attribute Table follow.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link mergeSelection}
 * @see {@link findTopmostFeatureAt}
 */

import type OlMap from "ol/Map.js";
import type MapBrowserEvent from "ol/MapBrowserEvent.js";
import type VectorSource from "ol/source/Vector.js";
import type Style from "ol/style/Style.js";
import type { Coordinate } from "ol/coordinate.js";
import { buffer as bufferExtent } from "ol/extent.js";
import { unByKey } from "ol/Observable.js";
import DragPan from "ol/interaction/DragPan.js";
import DragZoom from "ol/interaction/DragZoom.js";
import { selectedFeatureIdsSignal, type ActiveTool } from "../state/gisSignals";
import {
  mergeSelection,
  readSelectionModifiers,
  type SelectionModifiers,
} from "./selectionMerge";
import {
  findTopmostFeatureAt,
  SELECTION_HIT_TOLERANCE_PX,
  type SymbolReachResolver,
} from "./selectionHitTest";

/**
 * @description Largest symbol reach, in pixels, considered when gathering click candidates from the source's spatial index: features whose extent lies farther than this plus the hit tolerance from the pointer are never tested.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
const MAX_SYMBOL_REACH_PX = 64;

/**
 * @description The map tools that are Selection Tools.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {ReadonlySet<ActiveTool>}
 */
const SELECTION_TOOLS: ReadonlySet<ActiveTool> = new Set<ActiveTool>([
  "select_click",
  "select_rectangle",
  "select_lasso",
]);

/**
 * @function isSelectionTool
 * @description Whether a map tool is one of the Selection Tools (Select by Click, Select by Rectangle, Select by Lasso).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {ActiveTool} tool - Map tool.
 * @returns {boolean} True for a Selection Tool.
 */
export function isSelectionTool(tool: ActiveTool): boolean {
  return SELECTION_TOOLS.has(tool);
}

/**
 * @typedef {Object} MapNavigationState
 * @description Which of OpenLayers' default drag gestures are on.
 * @property {boolean} dragPan - Primary-button drag pans the map.
 * @property {boolean} dragZoom - Shift+drag draws a box and zooms to it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MapNavigationState {
  dragPan: boolean;
  dragZoom: boolean;
}

/**
 * @function resolveNavigationForTool
 * @description Decides which default drag gestures a map tool leaves on. A Selection Tool owns primary drags (and Shift+drag, which adds to the selection), so drag-pan and Shift+drag box zoom are off; every other tool keeps them (panning in other tools is deferred). Wheel zoom and keyboard navigation are never touched.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {ActiveTool} tool - Map tool.
 * @returns {MapNavigationState} Gesture state.
 */
export function resolveNavigationForTool(tool: ActiveTool): MapNavigationState {
  const selecting = isSelectionTool(tool);
  return { dragPan: !selecting, dragZoom: !selecting };
}

/**
 * @function applyNavigationToMap
 * @description Activates or deactivates the map's DragPan and DragZoom interactions to match a navigation state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {OlMap} map - OpenLayers map.
 * @param {MapNavigationState} state - Gesture state to apply.
 * @returns {void}
 */
export function applyNavigationToMap(
  map: OlMap,
  state: MapNavigationState
): void {
  for (const interaction of map.getInteractions().getArray()) {
    if (interaction instanceof DragPan) interaction.setActive(state.dragPan);
    else if (interaction instanceof DragZoom) {
      interaction.setActive(state.dragZoom);
    }
  }
}

/**
 * @typedef {Object} SelectableLayer
 * @description The valid Active Layer as the Selection Tools see it: its features on the map and how far each feature's symbol reaches.
 * @property {VectorSource} source - The layer's OpenLayers vector source (features in the display CRS, ids = feature ids).
 * @property {SymbolReachResolver} [symbolReachPx] - Symbol reach per feature at the current resolution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface SelectableLayer {
  source: VectorSource;
  symbolReachPx?: SymbolReachResolver;
}

/**
 * @typedef {Object} MapToolContext
 * @description What a {@link MapToolHandler} may use, supplied by the MapController.
 * @property {OlMap} map - The OpenLayers map (to listen to map browser events and add interactions).
 * @property {() => SelectableLayer | null} getSelectableLayer - The valid Active Layer (vector, loaded, visible), or null when there is none; read at gesture time.
 * @property {(state: MapNavigationState) => void} setNavigation - Applies a default-gesture state to the map.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MapToolContext {
  map: OlMap;
  getSelectableLayer: () => SelectableLayer | null;
  setNavigation: (state: MapNavigationState) => void;
}

/**
 * @callback MapToolHandler
 * @description Activates one map tool's behaviour on the map (listeners, interactions) and returns the function that removes it again. Must not read signals reactively at activation time (use `peek()`), since it runs inside the tool effect.
 * @param {MapToolContext} context - Map tool context.
 * @returns {() => void} Deactivation function.
 */
export type MapToolHandler = (context: MapToolContext) => () => void;

/**
 * @function symbolReachFromStyles
 * @description How far a feature's rendered symbol reaches beyond its geometry, in pixels: the largest point-marker radius (plus half its outline) or half stroke width among the styles a layer's style function returned. Unknown symbols count as 0.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Style | Style[] | void | undefined} styles - Styles for one feature.
 * @returns {number} Symbol reach in pixels.
 */
export function symbolReachFromStyles(
  styles: Style | Style[] | void | undefined
): number {
  if (!styles) return 0;
  let reach = 0;
  for (const style of Array.isArray(styles) ? styles : [styles]) {
    const strokeWidth = style.getStroke?.()?.getWidth?.() ?? 0;
    reach = Math.max(reach, strokeWidth / 2);
    const image = style.getImage?.() as
      | {
          getRadius?: () => number;
          getStroke?: () => { getWidth?: () => number | undefined } | null;
          getSize?: () => number[] | null;
          getScale?: () => number | number[];
        }
      | null
      | undefined;
    if (!image) continue;
    if (typeof image.getRadius === "function") {
      const outline = image.getStroke?.()?.getWidth?.() ?? 0;
      reach = Math.max(reach, (image.getRadius() ?? 0) + outline / 2);
    } else if (typeof image.getSize === "function") {
      const size = image.getSize();
      const rawScale = image.getScale?.() ?? 1;
      const scale = Array.isArray(rawScale) ? Math.max(...rawScale) : rawScale;
      if (size) reach = Math.max(reach, (Math.max(...size) * scale) / 2);
    }
  }
  return reach;
}

/**
 * @function resolveClickHits
 * @description Select by Click's hit set: the id of the topmost feature of the Active Layer under the pointer within the hit tolerance (see {@link findTopmostFeatureAt}), or no ids when nothing is hit or there is no valid Active Layer. Candidates come from the source's spatial index around the pointer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectableLayer | null} layer - The valid Active Layer, or null.
 * @param {Coordinate} coordinate - Click coordinate in the display CRS.
 * @param {number} resolution - View resolution in map units per pixel.
 * @returns {Array<string | number>} Zero or one feature id.
 */
export function resolveClickHits(
  layer: SelectableLayer | null,
  coordinate: Coordinate,
  resolution: number
): Array<string | number> {
  if (!layer) return [];
  const searchRadius =
    (SELECTION_HIT_TOLERANCE_PX + MAX_SYMBOL_REACH_PX) * resolution;
  const searchExtent = bufferExtent(
    [coordinate[0], coordinate[1], coordinate[0], coordinate[1]],
    searchRadius
  );
  const candidates = layer.source.getFeaturesInExtent(searchExtent);
  const hit = findTopmostFeatureAt(candidates, coordinate, resolution, {
    symbolReachPx: layer.symbolReachPx,
  });
  const id = hit?.getId();
  return id === undefined ? [] : [id];
}

/**
 * @function publishFeatureSelection
 * @description Merges a Selection Tool gesture's feature hits into the shared feature selection (`selectedFeatureIdsSignal`, read by the map highlight and the Attribute Table) with {@link mergeSelection}. Does not republish when the merge leaves the selection unchanged.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Array<string | number>} hits - Feature ids the gesture hit.
 * @param {SelectionModifiers} modifiers - Modifiers held during the gesture.
 * @returns {void}
 */
export function publishFeatureSelection(
  hits: Array<string | number>,
  modifiers: SelectionModifiers
): void {
  const current = selectedFeatureIdsSignal.peek();
  const next = mergeSelection(current, hits, modifiers);
  if (next === current) return;
  if (next.size === current.size && [...next].every((id) => current.has(id))) {
    return;
  }
  selectedFeatureIdsSignal.value = new Set(next);
}

/**
 * @function selectByClickAt
 * @description Performs one Select by Click: with a valid Active Layer, publishes the topmost hit (or no hit) under the given modifiers, so a plain click on empty map clears the selection; without one, changes nothing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectableLayer | null} layer - The valid Active Layer, or null.
 * @param {Coordinate} coordinate - Click coordinate in the display CRS.
 * @param {number} resolution - View resolution in map units per pixel.
 * @param {SelectionModifiers} modifiers - Modifiers held during the click.
 * @returns {void}
 */
export function selectByClickAt(
  layer: SelectableLayer | null,
  coordinate: Coordinate,
  resolution: number,
  modifiers: SelectionModifiers
): void {
  if (!layer) return;
  publishFeatureSelection(
    resolveClickHits(layer, coordinate, resolution),
    modifiers
  );
}

/**
 * @function activateSelectByClick
 * @description {@link MapToolHandler} for Select by Click: each primary click on the map (OpenLayers fires `click` only for the primary button and not after a drag, so drags do nothing) runs {@link selectByClickAt} at the click coordinate with the event's Shift/Ctrl modifiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MapToolContext} context - Map tool context.
 * @returns {() => void} Removes the click listener.
 */
export const activateSelectByClick: MapToolHandler = (context) => {
  const key = context.map.on(
    "click",
    (evt: MapBrowserEvent<PointerEvent | KeyboardEvent | WheelEvent>) => {
      const resolution = context.map.getView().getResolution();
      if (!resolution || !evt.coordinate) return;
      selectByClickAt(
        context.getSelectableLayer(),
        evt.coordinate,
        resolution,
        readSelectionModifiers(evt.originalEvent as PointerEvent)
      );
    }
  );
  return () => unByKey(key);
};

/**
 * @description The tool handler table: the behaviour each map tool adds on the map. Tools without an entry only get their navigation state. Select by Rectangle and Select by Lasso register here.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {Partial<Record<ActiveTool, MapToolHandler>>}
 */
export const MAP_TOOL_HANDLERS: Partial<Record<ActiveTool, MapToolHandler>> = {
  select_click: activateSelectByClick,
};

/**
 * @class MapToolInteractions
 * @description Keeps the map's interactions in step with the active map tool: on each tool change it applies the tool's navigation state and swaps the previous tool's handler for the new one. Owned and disposed by the MapController, which calls {@link MapToolInteractions#setTool} from an effect on `activeToolSignal`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export class MapToolInteractions {
  private readonly context: MapToolContext;
  private readonly handlers: Partial<Record<ActiveTool, MapToolHandler>>;
  private currentTool: ActiveTool | null = null;
  private deactivate: (() => void) | null = null;

  /**
   * @constructor
   * @description Creates the tool interaction manager; nothing is applied until the first {@link MapToolInteractions#setTool}.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @param {MapToolContext} context - Map tool context.
   * @param {Partial<Record<ActiveTool, MapToolHandler>>} [handlers=MAP_TOOL_HANDLERS] - Tool handler table.
   */
  constructor(
    context: MapToolContext,
    handlers: Partial<Record<ActiveTool, MapToolHandler>> = MAP_TOOL_HANDLERS
  ) {
    this.context = context;
    this.handlers = handlers;
  }

  /**
   * @description Switches to a map tool: applies its navigation state, deactivates the previous tool's handler and activates the new one's. Setting the current tool again does nothing.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @param {ActiveTool} tool - The new active map tool.
   * @returns {void}
   */
  public setTool(tool: ActiveTool): void {
    if (tool === this.currentTool) return;
    this.currentTool = tool;
    this.context.setNavigation(resolveNavigationForTool(tool));
    this.deactivateHandler();
    const handler = this.handlers[tool];
    if (handler) this.deactivate = handler(this.context);
  }

  /**
   * @description Removes the active tool's handler; used on tool change and disposal.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @returns {void}
   */
  private deactivateHandler(): void {
    const deactivate = this.deactivate;
    this.deactivate = null;
    deactivate?.();
  }

  /**
   * @description Removes the active tool's handler and forgets the tool.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @returns {void}
   */
  public dispose(): void {
    this.deactivateHandler();
    this.currentTool = null;
  }
}
