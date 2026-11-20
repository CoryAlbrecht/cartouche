/**
 * @file mapToolInteractions.ts
 * @module renderer/map/mapToolInteractions
 * @description Tool-driven map interactions: what a primary click or drag on the map does under the active map tool. {@link MapToolInteractions}, owned by the MapController and fed from `activeToolSignal`, switches OpenLayers' default navigation gestures per tool ({@link resolveNavigationForTool}: Selection Tools turn off drag-pan and Shift+drag box zoom) and activates the tool's {@link MapToolHandler} from a handler table ({@link MAP_TOOL_HANDLERS}). Select by Click, Select by Rectangle and Select by Lasso have handlers; vertex selection branches on the Selection Target inside them. All Selection Tools publish through {@link publishFeatureSelection}, which applies the shared {@link mergeSelection} rule to `selectedFeatureIdsSignal`, so the map highlight and Attribute Table follow.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link mergeSelection}
 * @see {@link findTopmostFeatureAt}
 * @see {@link findFeaturesOverlappingRegion}
 * @see {@link beginSelectionShape}
 * @see {@link createLassoShapeStyle}
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
import DoubleClickZoom from "ol/interaction/DoubleClickZoom.js";
import DragBox, { type DragBoxEvent } from "ol/interaction/DragBox.js";
import Draw, { type DrawEvent } from "ol/interaction/Draw.js";
import Polygon from "ol/geom/Polygon.js";
import type { StyleLike } from "ol/style/Style.js";
import type { FlatStyleLike } from "ol/style/flat.js";
import { primaryAction } from "ol/events/condition.js";
import {
  selectedFeatureIdsSignal,
  selectionTargetSignal,
  type ActiveTool,
} from "../state/gisSignals";
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
import {
  createSelectionRegion,
  findFeaturesOverlappingRegion,
  type SelectionRegion,
} from "./selectionRegion";
import { beginSelectionShape } from "./selectionShapeCancel";
import {
  createLassoShapeStyle,
  readLassoFillRule,
  readSelectionShapeColour,
  type SelectionShapePaint,
} from "./selectionLasso";

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
 * @description Which of OpenLayers' default pointer navigation gestures are on.
 * @property {boolean} dragPan - Primary-button drag pans the map.
 * @property {boolean} dragZoom - Shift+drag draws a box and zooms to it.
 * @property {boolean} doubleClickZoom - Double-click zooms in (Shift+double-click out).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MapNavigationState {
  dragPan: boolean;
  dragZoom: boolean;
  doubleClickZoom: boolean;
}

/**
 * @function resolveNavigationForTool
 * @description Decides which default pointer navigation gestures a map tool leaves on. A Selection Tool owns primary clicks and drags (and Shift/Ctrl, which add and toggle), so drag-pan, Shift+drag box zoom and double-click zoom (which quick successive or Ctrl-clicks would trigger) are off; every other tool keeps them (panning in other tools is deferred). Wheel zoom, Alt+Shift+drag rotation and keyboard navigation are never touched.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {ActiveTool} tool - Map tool.
 * @returns {MapNavigationState} Gesture state.
 */
export function resolveNavigationForTool(tool: ActiveTool): MapNavigationState {
  const selecting = isSelectionTool(tool);
  return {
    dragPan: !selecting,
    dragZoom: !selecting,
    doubleClickZoom: !selecting,
  };
}

/**
 * @function applyNavigationToMap
 * @description Activates or deactivates the map's DragPan, DragZoom and DoubleClickZoom interactions to match a navigation state.
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
    } else if (interaction instanceof DoubleClickZoom) {
      interaction.setActive(state.doubleClickZoom);
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
 * @description {@link MapToolHandler} for Select by Click: each primary click on the map (OpenLayers fires `click` only for the primary button and not after a drag, so drags do nothing) runs {@link selectByClickAt} at the click coordinate with the event's Shift/Ctrl modifiers, while the Selection Target is features. While it is vertices (Vertex Editor Mode) a click leaves the feature selection alone; vertex selection branches here on `selectionTargetSignal`.
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
      if (selectionTargetSignal.peek() !== "features") return;
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
 * @description CSS class of the Selection Shape element OpenLayers' DragBox draws for Select by Rectangle; workbench.css styles it from the `--cartouche-map-selection-shape` Theme token.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {string}
 */
export const SELECTION_SHAPE_CLASS = "cartouche-selection-shape";

/**
 * @function selectFeaturesInRegion
 * @description Performs one area selection (Select by Rectangle, Select by Lasso): with a valid Active Layer, publishes the ids of its features overlapping the region under the given modifiers, so a plain gesture overlapping nothing clears the selection; without one, changes nothing. The region is tested against the features in the renderer's source: a Selection Shape lies within the visible map, which every loading strategy has loaded.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectableLayer | null} layer - The valid Active Layer, or null.
 * @param {SelectionRegion} region - The Selection Shape's region in the display CRS.
 * @param {SelectionModifiers} modifiers - Modifiers held at the end of the gesture.
 * @returns {void}
 */
export function selectFeaturesInRegion(
  layer: SelectableLayer | null,
  region: SelectionRegion,
  modifiers: SelectionModifiers
): void {
  if (!layer) return;
  publishFeatureSelection(
    findFeaturesOverlappingRegion(layer.source, region),
    modifiers
  );
}

/**
 * @function isSelectionShapeDragStart
 * @description Whether a pointer-down starts drawing a Selection Shape: the primary button of the primary pointer, with or without Shift/Ctrl, but not with Alt (Alt+Shift+drag stays OpenLayers' rotation).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MapBrowserEvent<PointerEvent | KeyboardEvent | WheelEvent>} evt - Pointer-down map browser event.
 * @returns {boolean} True when the drag draws a Selection Shape.
 */
export function isSelectionShapeDragStart(
  evt: MapBrowserEvent<PointerEvent | KeyboardEvent | WheelEvent>
): boolean {
  return primaryAction(evt) && !evt.originalEvent.altKey;
}

/**
 * @function activateSelectByRectangle
 * @description {@link MapToolHandler} for Select by Rectangle: adds an OpenLayers DragBox (class {@link SELECTION_SHAPE_CLASS}) whose primary drag spans the rectangle's diagonal, shown live as the Selection Shape. On release, while the Selection Target is features, the features of the Active Layer overlapping the rectangle (its four corners as a ring, so a rotated view stays exact) are merged into the selection with the Shift/Ctrl held at release ({@link selectFeaturesInRegion}). While a drag is in progress it is registered with {@link beginSelectionShape}, so Escape discards the shape without selecting and keeps the tool. Drags shorter than OpenLayers' minimum box (8 px diagonal) select nothing. With no valid Active Layer, or while the Selection Target is vertices, the shape is still drawn but nothing is selected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MapToolContext} context - Map tool context.
 * @returns {() => void} Removes the DragBox (abandoning a drag in progress).
 */
export const activateSelectByRectangle: MapToolHandler = (context) => {
  const dragBox = new DragBox({
    className: SELECTION_SHAPE_CLASS,
    condition: isSelectionShapeDragStart,
  });
  let endShape: (() => void) | null = null;
  const finishShape = (): void => {
    endShape?.();
    endShape = null;
  };
  dragBox.on("boxstart", () => {
    endShape = beginSelectionShape(() => {
      finishShape();
      // Deactivating drops the box (firing boxcancel); the rest of the drag is ignored.
      dragBox.setActive(false);
      dragBox.setActive(true);
    });
  });
  dragBox.on("boxcancel", finishShape);
  dragBox.on("boxend", (evt: DragBoxEvent) => {
    finishShape();
    if (selectionTargetSignal.peek() !== "features") return;
    const ring = dragBox.getGeometry()?.getCoordinates()[0];
    if (!ring) return;
    selectFeaturesInRegion(
      context.getSelectableLayer(),
      createSelectionRegion(ring),
      readSelectionModifiers(evt.mapBrowserEvent?.originalEvent as PointerEvent)
    );
  });
  context.map.addInteraction(dragBox);
  return () => {
    finishShape();
    context.map.removeInteraction(dragBox);
  };
};

/**
 * @class SelectionLassoDraw
 * @description OpenLayers' freehand polygon Draw, narrowed to Select by Lasso's needs: a pointer-down starts a lasso only when {@link isSelectionShapeDragStart} accepts it, so other buttons and Alt+Shift+drag (rotation) pass on to the map's other interactions, as do drags and context menus while no lasso is drawn; it remembers the Shift/Ctrl held at release for the `drawend` listener; and {@link SelectionLassoDraw#discard} abandons a lasso in progress, ignoring the rest of that drag (so the release does not start a new sketch).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @extends Draw
 */
export class SelectionLassoDraw extends Draw {
  private drawing = false;
  private discarding = false;
  private modifiersAtRelease: SelectionModifiers = {
    shift: false,
    ctrl: false,
  };

  /**
   * @constructor
   * @description Creates a freehand polygon Draw with the given sketch style.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @param {StyleLike | FlatStyleLike} style - Sketch style (see {@link createLassoShapeStyle}).
   */
  constructor(style: StyleLike | FlatStyleLike) {
    super({ type: "Polygon", freehand: true, style });
    this.on("drawstart", () => {
      this.drawing = true;
    });
    this.on(["drawend", "drawabort"], () => {
      this.drawing = false;
    });
  }

  /**
   * @description The Shift/Ctrl held when the last lasso was released.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @returns {SelectionModifiers} Modifiers at release.
   */
  public getModifiersAtRelease(): SelectionModifiers {
    return this.modifiersAtRelease;
  }

  /**
   * @description Abandons the lasso being drawn, if any (firing `drawabort`), and ignores the rest of its drag.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @returns {void}
   */
  public discard(): void {
    if (!this.drawing) return;
    this.discarding = true;
    this.abortDrawing();
  }

  /**
   * @description Passes on events that do not belong to a lasso before Draw sees them, swallows the drag of a discarded lasso, and otherwise defers to Draw.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @param {MapBrowserEvent<PointerEvent>} event - Map browser event.
   * @returns {boolean} False to stop the event reaching other interactions.
   * @override
   */
  public override handleEvent(event: MapBrowserEvent<PointerEvent>): boolean {
    if (this.discarding) {
      if (event.type === "pointerdrag") return false;
    } else if (!this.drawing) {
      if (
        event.type === "pointerdown"
        && !isSelectionShapeDragStart(
          event as Parameters<typeof isSelectionShapeDragStart>[0]
        )
      ) {
        return true;
      }
      if (
        event.type === "pointerdrag"
        || event.originalEvent?.type === "contextmenu"
      ) {
        return true;
      }
    }
    return super.handleEvent(event);
  }

  /**
   * @description Ends a discarded lasso's drag without starting a sketch; otherwise records the release modifiers and lets Draw finish the lasso.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @param {MapBrowserEvent<PointerEvent>} event - Pointer-up map browser event.
   * @returns {boolean} Whether the down/up sequence continues.
   * @override
   */
  public override handleUpEvent(event: MapBrowserEvent<PointerEvent>): boolean {
    if (this.discarding) {
      this.discarding = false;
      return false;
    }
    this.modifiersAtRelease = readSelectionModifiers(event.originalEvent);
    return super.handleUpEvent(event);
  }
}

/**
 * @function activateSelectByLasso
 * @description {@link MapToolHandler} for Select by Lasso: adds a {@link SelectionLassoDraw} whose primary drag traces a freehand outline, shown live as the Selection Shape with {@link createLassoShapeStyle} (the `--cartouche-map-selection-shape` colour and fill rule are read when the lasso starts, so a changed Lasso Fill Rule takes effect on the next lasso). On release the outline is closed back to its start and, while the Selection Target is features, the features of the Active Layer overlapping the area it encloses under the Lasso Fill Rule are merged into the selection with the Shift/Ctrl held at release ({@link selectFeaturesInRegion}). While a lasso is drawn it is registered with {@link beginSelectionShape}, so Escape discards it without selecting and keeps the tool. A click without a drag selects nothing. With no valid Active Layer, or while the Selection Target is vertices, the shape is still drawn but nothing is selected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MapToolContext} context - Map tool context.
 * @returns {() => void} Removes the lasso interaction (abandoning a lasso in progress).
 */
export const activateSelectByLasso: MapToolHandler = (context) => {
  let paint: SelectionShapePaint = { colour: "", fillRule: "evenodd" };
  const lasso = new SelectionLassoDraw(createLassoShapeStyle(() => paint));
  let endShape: (() => void) | null = null;
  const finishShape = (): void => {
    endShape?.();
    endShape = null;
  };
  lasso.on("drawstart", () => {
    paint = {
      colour: readSelectionShapeColour(context.map.getTargetElement?.()),
      fillRule: readLassoFillRule(),
    };
    endShape = beginSelectionShape(() => {
      finishShape();
      lasso.discard();
    });
  });
  lasso.on("drawabort", finishShape);
  lasso.on("drawend", (evt: DrawEvent) => {
    finishShape();
    if (selectionTargetSignal.peek() !== "features") return;
    const geometry = evt.feature.getGeometry();
    if (!(geometry instanceof Polygon)) return;
    const ring = geometry.getCoordinates()[0];
    if (!ring || ring.length < 3) return;
    selectFeaturesInRegion(
      context.getSelectableLayer(),
      createSelectionRegion(ring, paint.fillRule),
      lasso.getModifiersAtRelease()
    );
  });
  context.map.addInteraction(lasso);
  return () => {
    finishShape();
    context.map.removeInteraction(lasso);
  };
};

/**
 * @description The tool handler table: the behaviour each map tool adds on the map. Tools without an entry only get their navigation state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {Partial<Record<ActiveTool, MapToolHandler>>}
 */
export const MAP_TOOL_HANDLERS: Partial<Record<ActiveTool, MapToolHandler>> = {
  select_click: activateSelectByClick,
  select_rectangle: activateSelectByRectangle,
  select_lasso: activateSelectByLasso,
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
