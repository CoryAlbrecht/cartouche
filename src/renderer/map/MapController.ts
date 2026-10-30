/**
 * @file MapController.ts
 * @module renderer/map/MapController
 * @description Isolated imperative OpenLayers map controller managing map lifecycle, spatial viewports, vector layers, OGC WKB streaming queries, and reactive signal synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @see {@link OlMap}
 * @see {@link VectorImageLayer}
 * @see {@link VectorSource}
 */

import { effect } from "@preact/signals-react";
import { logging } from "../../shared/logging";
import OlMap from "ol/Map.js";
import View from "ol/View.js";
import VectorImageLayer from "ol/layer/VectorImage.js";
import VectorSource from "ol/source/Vector.js";
import WKB from "ol/format/WKB.js";
import GeoJSON from "ol/format/GeoJSON.js";
import {
  all as allStrategy,
  bbox as bboxStrategy,
} from "ol/loadingstrategy.js";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj.js";
import Feature from "ol/Feature.js";
import { getScale } from "./getScale";
import {
  cursorCoordsSignal,
  viewportExtentSignal,
  scaleDenominatorSignal,
  mapActionSignal,
  activeMapControllerSignal,
  addConsoleLog,
} from "../state/gisSignals";
import {
  projectLayersSignal,
  layerStylesSignal,
  currentProjectSignal,
  projectTreeSignal,
  projectVisibleSignal,
} from "../state/projectSignals";
import { preferencesMapSignal } from "../state/preferencesSignals";
import {
  compileFlatLayerStyleSync,
  compileLayerStyle,
  extractStyleAttributes,
  isSldStyleDescriptor,
} from "./styleCompiler";
import {
  WKB_PACKET_MAGIC,
  type LayerDescriptor,
  type BoundingBox,
  type ProjectLayerItem,
  type ProjectGroupItem,
  type QueryExtentOptions,
} from "../../shared/types";

export { extractStyleAttributes };

/**
 * @typedef {Object} FlattenedTreeLayer
 * @property {string} id - Layer identifier.
 * @property {number} flatIndex - 0-based depth-first display index in layer tree.
 * @property {boolean} effectiveVisible - Effective visibility taking parent group and project visibility into account.
 * @property {number} opacity - Render opacity ranging from 0.0 to 1.0.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-15
 * @since 0.1.0-dev
 */
export interface FlattenedTreeLayer {
  id: string;
  flatIndex: number;
  effectiveVisible: boolean;
  opacity: number;
}

/**
 * @description Recursively flattens the project layer tree into a sequential list of layers with effective visibility and visual stacking order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Hierarchical layer tree items.
 * @param {boolean} [parentVisible=true] - Inherited parent container visibility.
 * @param {FlattenedTreeLayer[]} [result=[]] - Accumulator array for flattened layers.
 * @returns {FlattenedTreeLayer[]} Flattened array of layer items with calculated stacking indices.
 */
export function flattenTreeLayers(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  parentVisible: boolean = true,
  result: FlattenedTreeLayer[] = []
): FlattenedTreeLayer[] {
  for (const item of items) {
    if (
      "children" in item
      && Array.isArray((item as ProjectGroupItem).children)
    ) {
      const group = item as ProjectGroupItem;
      const isGroupEffectiveVisible = parentVisible && group.visible !== false;
      flattenTreeLayers(group.children, isGroupEffectiveVisible, result);
    } else {
      const layer = item as ProjectLayerItem;
      const effectiveVisible = parentVisible && layer.visible !== false;
      result.push({
        id: layer.id,
        flatIndex: result.length,
        effectiveVisible,
        opacity: layer.opacity ?? 1,
      });
    }
  }
  return result;
}

/**
 * @typedef {Object} VectorLayerEntry
 * @property {VectorImageLayer<VectorSource>} layer - Native OpenLayers image-cached vector layer instance.
 * @property {VectorSource} source - Native OpenLayers vector source backed by allStrategy/bboxStrategy.
 * @property {LayerDescriptor} descriptor - Serializable layer metadata descriptor.
 * @property {Set<string>} loadedFields - Set of feature attribute column names currently projected in the VectorSource.
 * @property {boolean} [allFieldsLoaded] - True if all feature attributes were projected without restriction.
 * @property {unknown} [activeRawStyle] - Most recently applied raw style descriptor or wrapper.
 * @property {number} [styleRevision] - Monotonic counter guarding out-of-order async style compilations/reloads.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
export interface VectorLayerEntry {
  layer: VectorImageLayer<VectorSource>;
  source: VectorSource;
  descriptor: LayerDescriptor;
  loadedFields: Set<string>;
  allFieldsLoaded?: boolean;
  activeRawStyle?: unknown;
  styleRevision?: number;
}

/**
 * @typedef {Object} FitExtentOptions
 * @property {[number, number, number, number]} [padding] - Pixel padding [top, right, bottom, left].
 * @property {number} [duration] - Animation duration in milliseconds.
 * @property {[number, number]} [size] - Explicit [width, height] dimensions overriding map DOM size.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 */
export interface FitExtentOptions {
  padding?: [number, number, number, number];
  duration?: number;
  size?: [number, number];
}

/**
 * @class MapController
 * @description Imperative OpenLayers map canvas controller encapsulating native ol/Map and vector rendering completely insulated from React Virtual DOM.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
export class MapController {
  private map: OlMap;
  private view: View;
  private container: HTMLElement;
  private vectorLayers = new Map<string, VectorLayerEntry>();
  private wkbFormat = new WKB();
  private geojsonFormat = new GeoJSON();
  private inFlightQueries = new Map<string, Promise<Feature[]>>();
  private pendingStyleUpdates = new Set<Promise<void>>();
  private disposeSignals: Array<() => void> = [];
  private previousLayerCount = 0;
  private scaleThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScaleUpdateTime = 0;

  /**
   * @constructor
   * @description Initializes the isolated OpenLayers map instance, view, and reactive signal subscriptions.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-26
   * @since 0.1.0-dev
   * @param {HTMLElement} container - Target unmanaged DOM container element.
   * @param {Object} [options] - Optional map initialization options.
   * @param {View} [options.view] - Custom OpenLayers View instance.
   */
  constructor(container: HTMLElement, options?: { view?: View }) {
    this.container = container;

    this.view =
      options?.view
      ?? new View({
        center: fromLonLat([15, 35]),
        zoom: 3,
      });

    this.map = new OlMap({
      target: container,
      layers: [],
      view: this.view,
      controls: [],
    });

    this.bindEvents();
    this.initProjectViewport();
    this.bindSignals();
    this.updateScaleSignal(true);

    activeMapControllerSignal.value = this;

    addConsoleLog(
      "info",
      "MapController spatial canvas engine initialized.",
      "OpenLayers"
    );
  }

  /**
   * @description Applies initial saved viewport from active project model if available.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private initProjectViewport(): void {
    const currentProject = currentProjectSignal.value;
    if (currentProject?.viewport) {
      this.setViewport({
        extent:
          currentProject.viewport.extent ?
            [
              currentProject.viewport.extent.xmin,
              currentProject.viewport.extent.ymin,
              currentProject.viewport.extent.xmax,
              currentProject.viewport.extent.ymax,
            ]
          : undefined,
        center: currentProject.viewport.center,
        rotation: currentProject.viewport.rotation,
      });
    }
    this.updateViewportSignals();
  }

  /**
   * @description Attaches native OpenLayers event listeners for cursor tracking, resolution changes, and moveend.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private bindEvents(): void {
    // Cursor location tracking when not actively dragging the map canvas
    this.map.on("pointermove", (evt) => {
      if (evt.dragging) {
        return;
      }
      const coordinate = evt.coordinate;
      if (coordinate) {
        const pixel = evt.pixel;
        const [lon, lat] = toLonLat(coordinate);
        cursorCoordsSignal.value = {
          lon: Math.round(lon * 100000) / 100000,
          lat: Math.round(lat * 100000) / 100000,
          x: Math.round(pixel ? pixel[0] : 0),
          y: Math.round(pixel ? pixel[1] : 0),
        };
      }
    });

    // View resolution change signal updates
    this.view.on("change:resolution", () => {
      this.updateScaleSignal(false);
    });

    // Viewport bounding box updates on movement completion
    this.map.on("moveend", () => {
      this.updateViewportSignals();
      this.updateScaleSignal(true);
    });
  }

  /**
   * @description Binds reactive signal listeners for project layers and map navigation actions.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private bindSignals(): void {
    // Synchronize loaded layer descriptors from projectLayersSignal
    const disposeLayers = effect(() => {
      const descriptors = projectLayersSignal.value;
      this.syncLayers(descriptors);
    });
    this.disposeSignals.push(disposeLayers);

    // Synchronize visual stacking order (zIndex), visibility, and opacity from projectTreeSignal & projectVisibleSignal
    const disposeTree = effect(() => {
      const tree = projectTreeSignal.value;
      const projectVisible = projectVisibleSignal.value;
      this.syncTreeState(tree, projectVisible);
    });
    this.disposeSignals.push(disposeTree);

    // Apply live dynamic Flat Style updates from layerStylesSignal at 60 FPS
    const disposeStyles = effect(() => {
      const styles = layerStylesSignal.value;
      this.applyLayerStyles(styles);
    });
    this.disposeSignals.push(disposeStyles);

    // Map navigation action signal dispatcher
    const disposeActions = effect(() => {
      const mapAction = mapActionSignal.value;
      if (!mapAction) return;

      if (mapAction.action === "zoomIn") {
        this.zoomIn();
      } else if (mapAction.action === "zoomOut") {
        this.zoomOut();
      } else if (mapAction.action === "reset") {
        this.resetExtent();
      } else if (mapAction.action === "setViewport") {
        this.setViewport(mapAction);
      }
    });
    this.disposeSignals.push(disposeActions);
  }

  /**
   * @description Synchronizes OpenLayers vector layers with current layer descriptors in projectLayersSignal.
   * Instantiates new vector layers, removes deleted layers, and auto-fits viewport on initial layer import.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {LayerDescriptor[]} descriptors - Flat collection of active layer descriptors.
   * @returns {void}
   */
  public syncLayers(descriptors: LayerDescriptor[]): void {
    const currentDescriptorIds = new Set(descriptors.map((d) => d.id));

    // 1. Remove layers no longer registered in projectLayersSignal
    for (const [id, entry] of this.vectorLayers.entries()) {
      if (!currentDescriptorIds.has(id)) {
        this.map.removeLayer(entry.layer);
        entry.source.clear();
        this.vectorLayers.delete(id);
      }
    }

    // 2. Add newly registered layers
    let newlyAddedFirstLayer: LayerDescriptor | null = null;
    for (const descriptor of descriptors) {
      if (!this.vectorLayers.has(descriptor.id)) {
        this.createVectorLayer(descriptor);
        if (this.previousLayerCount === 0 && !newlyAddedFirstLayer) {
          newlyAddedFirstLayer = descriptor;
        }
      }
    }

    // 3. Auto-fit viewport to first imported layer if canvas was previously empty
    if (newlyAddedFirstLayer && this.previousLayerCount === 0) {
      this.fitLayerExtent(newlyAddedFirstLayer);
    }

    this.previousLayerCount = descriptors.length;

    // 4. Synchronize stacking order (zIndex), visibility, opacity, and styles on current layers
    this.syncTreeState(projectTreeSignal.value, projectVisibleSignal.value);
    this.applyLayerStyles(layerStylesSignal.value);
  }

  /**
   * @description Synchronizes layer visual stacking order (zIndex = 1000 - flatIndex), visibility, and opacity from the hierarchical layer tree.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {Array<ProjectLayerItem | ProjectGroupItem>} tree - Hierarchical layer and group tree items.
   * @param {boolean} projectVisible - Global project visibility toggle.
   * @returns {void}
   */
  public syncTreeState(
    tree: Array<ProjectLayerItem | ProjectGroupItem>,
    projectVisible: boolean
  ): void {
    const flattened = flattenTreeLayers(tree, projectVisible);
    for (const item of flattened) {
      const entry = this.vectorLayers.get(item.id);
      if (entry) {
        entry.layer.setZIndex(1000 - item.flatIndex);
        entry.layer.setVisible(item.effectiveVisible);
        entry.layer.setOpacity(item.opacity);
      }
    }
  }

  /**
   * @description Applies dynamic OpenLayers Flat Style rules or SLD XML styles to registered vector layers, reloading missing attribute fields on demand before passing the compiled style to OpenLayers.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @param {Record<string, any>} styles - Style descriptors or rules map keyed by layer UUID.
   * @returns {void}
   */
  public applyLayerStyles(styles: Record<string, any>): void {
    for (const [id, entry] of this.vectorLayers.entries()) {
      if (styles[id] !== undefined && styles[id] !== entry.activeRawStyle) {
        this.applySingleLayerStyle(entry, styles[id], false);
      }
    }
  }

  /**
   * @description Waits for all in-flight asynchronous SLD compilations and field-subset reloads to settle.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-29
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @returns {Promise<void>} Resolves when all pending style operations complete.
   */
  public async waitForPendingStyleUpdates(): Promise<void> {
    while (this.pendingStyleUpdates.size > 0) {
      await Promise.all(Array.from(this.pendingStyleUpdates));
    }
  }

  /**
   * @description Checks whether a newly compiled style references feature attribute fields that are not yet present in the layer's loadedFields set.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-29
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @param {VectorLayerEntry} entry - Target vector layer entry.
   * @param {Set<string>} requiredFields - Attribute fields referenced by the new style.
   * @param {boolean} isInitialCreate - True if called during initial layer creation before first loadFeaturesForExtent.
   * @private
   * @returns {boolean} True if Main process feature reload is required before applying the style.
   */
  private requiresFieldReload(
    entry: VectorLayerEntry,
    requiredFields: Set<string>,
    isInitialCreate: boolean
  ): boolean {
    if (isInitialCreate || requiredFields.size === 0 || entry.allFieldsLoaded) {
      return false;
    }
    if (typeof window === "undefined" || !window.electronAPI?.queryExtent) {
      return false;
    }
    for (const field of requiredFields) {
      if (!entry.loadedFields.has(field)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @description Reloads features for a vector layer from Main with the specified union of attribute fields.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-29
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @param {VectorLayerEntry} entry - Target vector layer entry.
   * @param {string[]} fieldsToLoad - Attribute field names to project in queryExtent.
   * @private
   * @returns {Promise<void>}
   */
  private async reloadLayerWithFields(
    entry: VectorLayerEntry,
    fieldsToLoad: string[]
  ): Promise<void> {
    const viewCrs = this.view.getProjection() || "EPSG:3857";
    const size = this.map.getSize();
    const extent =
      size && size[0] > 0 && size[1] > 0 ?
        this.view.calculateExtent(size)
      : entry.descriptor.extent || [-180, -90, 180, 90];

    await this.loadFeaturesForExtent(
      entry.descriptor,
      entry.source,
      extent,
      viewCrs,
      { forceReload: true, fields: fieldsToLoad }
    );
  }

  /**
   * @description Compiles and applies a style to a single vector layer entry, executing synchronously on the fast path when `format === 'openlayers'` and `requiredFields ⊆ loadedFields`, or asynchronously when SLD compilation or missing field reload is needed.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-29
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @param {VectorLayerEntry} entry - Target vector layer entry.
   * @param {unknown} rawStyle - Raw style descriptor or wrapper.
   * @param {boolean} isInitialCreate - True if invoked during initial layer creation.
   * @private
   * @returns {void}
   */
  private applySingleLayerStyle(
    entry: VectorLayerEntry,
    rawStyle: unknown,
    isInitialCreate: boolean
  ): void {
    const nextRevision = (entry.styleRevision ?? 0) + 1;
    entry.styleRevision = nextRevision;
    entry.activeRawStyle = rawStyle;

    const sharedStyles = currentProjectSignal.value?.styles;
    const isSld = isSldStyleDescriptor(rawStyle, sharedStyles);

    if (!isSld) {
      const flatResult = compileFlatLayerStyleSync(rawStyle, {
        sharedStyles,
        layerId: entry.descriptor.id,
      });

      if (
        !this.requiresFieldReload(
          entry,
          flatResult.requiredFields,
          isInitialCreate
        )
      ) {
        entry.layer.setStyle(flatResult.compiledStyle as any);
        return;
      }

      const mergedFields = Array.from(
        new Set([...entry.loadedFields, ...flatResult.requiredFields])
      );
      const reloadTask = (async () => {
        await this.reloadLayerWithFields(entry, mergedFields);
        if (entry.styleRevision === nextRevision) {
          entry.layer.setStyle(flatResult.compiledStyle as any);
        }
      })();

      this.pendingStyleUpdates.add(reloadTask);
      void reloadTask.finally(() => {
        this.pendingStyleUpdates.delete(reloadTask);
      });
      return;
    }

    const sldTask = (async () => {
      const compiledResult = await compileLayerStyle(rawStyle, {
        sharedStyles,
        layerId: entry.descriptor.id,
      });
      if (entry.styleRevision !== nextRevision) {
        return;
      }
      if (
        this.requiresFieldReload(
          entry,
          compiledResult.requiredFields,
          isInitialCreate
        )
      ) {
        const mergedFields = Array.from(
          new Set([...entry.loadedFields, ...compiledResult.requiredFields])
        );
        await this.reloadLayerWithFields(entry, mergedFields);
        if (entry.styleRevision !== nextRevision) {
          return;
        }
      }
      entry.layer.setStyle(compiledResult.compiledStyle as any);
    })();

    this.pendingStyleUpdates.add(sldTask);
    void sldTask.finally(() => {
      this.pendingStyleUpdates.delete(sldTask);
    });
  }

  /**
   * @description Creates and registers an OpenLayers VectorImageLayer and VectorSource backed by allStrategy/bboxStrategy, wrapX: false, and WKB/GeoJSON loader.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @param {LayerDescriptor} descriptor - Spatial layer metadata descriptor.
   * @returns {VectorLayerEntry} Created layer and source tuple.
   */
  public createVectorLayer(descriptor: LayerDescriptor): VectorLayerEntry {
    const isLocalVector =
      descriptor.layerKind === "vector" || !descriptor.layerKind;
    const strategy =
      (
        isLocalVector
        && (descriptor.featureCount === undefined
          || descriptor.featureCount < 50000)
      ) ?
        allStrategy
      : bboxStrategy;

    const source = new VectorSource({
      strategy,
      wrapX: false,
      loader: async (extent, _resolution, viewCrs, success, _failure) => {
        const loaded = await this.loadFeaturesForExtent(
          descriptor,
          source,
          extent,
          viewCrs
        );
        if (success) {
          success(loaded);
        }
        return loaded;
      },
    });

    const initialRawStyle =
      layerStylesSignal.value[descriptor.id] !== undefined ?
        layerStylesSignal.value[descriptor.id]
      : descriptor.style;

    const sharedStyles = currentProjectSignal.value?.styles;
    const isInitialSld = isSldStyleDescriptor(initialRawStyle, sharedStyles);
    const initialFlatResult =
      isInitialSld ?
        compileFlatLayerStyleSync(null, {
          sharedStyles,
          layerId: descriptor.id,
        })
      : compileFlatLayerStyleSync(initialRawStyle, {
          sharedStyles,
          layerId: descriptor.id,
        });

    const currentFlat = flattenTreeLayers(
      projectTreeSignal.value,
      projectVisibleSignal.value
    );
    const treeMatch = currentFlat.find((item) => item.id === descriptor.id);

    const layer = new VectorImageLayer({
      source,
      style: initialFlatResult.compiledStyle as any,
      opacity: treeMatch ? treeMatch.opacity : (descriptor.opacity ?? 1),
      visible:
        treeMatch ? treeMatch.effectiveVisible : (descriptor.visible ?? true),
      zIndex: treeMatch ? 1000 - treeMatch.flatIndex : 0,
    });

    this.map.addLayer(layer);
    const entry: VectorLayerEntry = {
      layer,
      source,
      descriptor,
      loadedFields: new Set<string>(),
      activeRawStyle: initialRawStyle,
      styleRevision: 0,
    };
    this.vectorLayers.set(descriptor.id, entry);

    if (isInitialSld) {
      this.applySingleLayerStyle(entry, initialRawStyle, true);
    }

    return entry;
  }

  /**
   * @description Fetches visible feature slices via IPC layers:queryExtent using zero-copy contiguous binary WKB packet deserialization and dynamic style field selection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @param {LayerDescriptor} descriptor - Spatial layer metadata descriptor.
   * @param {VectorSource} source - Target vector source.
   * @param {number[]} extent - Spatial query bounding box extent.
   * @param {any} viewCrs - Viewport CRS instance or authority string.
   * @param {{ forceReload?: boolean; fields?: string[] }} [reloadOptions] - Optional reload overrides when fetching missing style attribute fields.
   * @returns {Promise<Feature[]>} Deserialized features loaded for extent.
   */
  public async loadFeaturesForExtent(
    descriptor: LayerDescriptor,
    source: VectorSource,
    extent: number[],
    viewCrs: any,
    reloadOptions?: { forceReload?: boolean; fields?: string[] }
  ): Promise<Feature[]> {
    if (typeof window === "undefined" || !window.electronAPI?.queryExtent) {
      return [];
    }

    const forceReload = reloadOptions?.forceReload === true;

    // Skip redundant IPC query if all features are already loaded into the vector source
    if (
      !forceReload
      && descriptor.featureCount
      && descriptor.featureCount > 0
      && source.getFeatures().length >= descriptor.featureCount
    ) {
      return [];
    }

    // Deduplicate in-flight queries for the same layer
    const inFlight = this.inFlightQueries.get(descriptor.id);
    if (inFlight) {
      if (!forceReload) {
        return await inFlight;
      }
      try {
        await inFlight;
      } catch {
        // Proceed with reload even if prior query failed
      }
    }

    const queryPromise = (async (): Promise<Feature[]> => {
      const projectionCode =
        typeof viewCrs === "string" ? viewCrs : (
          viewCrs?.getCode?.() || "EPSG:3857"
        );

      const queryBox: BoundingBox = [
        extent[0],
        extent[1],
        extent[2],
        extent[3],
      ];
      const newFeatures: Feature[] = [];

      try {
        const api =
          typeof window !== "undefined" ? window.electronAPI : undefined;
        if (!api?.queryExtent) {
          return [];
        }

        const activeStyle =
          layerStylesSignal.value[descriptor.id] !== undefined ?
            layerStylesSignal.value[descriptor.id]
          : descriptor.style;

        let fields: string[] | undefined;
        if (reloadOptions?.fields !== undefined) {
          fields = reloadOptions.fields;
        } else if (typeof activeStyle === "function") {
          fields = undefined;
        } else if (activeStyle) {
          const extracted = extractStyleAttributes(
            activeStyle,
            new Set(),
            currentProjectSignal.value?.styles
          );
          fields = Array.from(extracted);
        } else {
          fields = [];
        }

        const options: QueryExtentOptions = {
          extent: queryBox,
          targetProjection: projectionCode,
          includeGeometry: true,
          fields,
        };

        const result = await api.queryExtent(
          descriptor.id,
          options,
          projectionCode
        );

        if (!result) {
          return [];
        }

        if (forceReload) {
          source.clear(true);
        }

        const dataProjection = descriptor.crs?.authId || "EPSG:4326";

        let buffer: ArrayBuffer | null = null;
        if ("buffer" in result && result.buffer) {
          if (result.buffer instanceof ArrayBuffer) {
            buffer = result.buffer;
          } else if (
            typeof ArrayBuffer !== "undefined"
            && ArrayBuffer.isView(result.buffer)
          ) {
            const view = result.buffer as ArrayBufferView;
            const copy = new Uint8Array(view.byteLength);
            copy.set(
              new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
            );
            buffer = copy.buffer;
          }
        }

        if (buffer && buffer.byteLength >= 12) {
          const view = new DataView(buffer);
          const magic = view.getUint32(0, true);
          if (magic === WKB_PACKET_MAGIC) {
            const featureCount = view.getUint32(8, true);
            let offset = 12;
            const decoder = new TextDecoder();

            for (let i = 0; i < featureCount; i++) {
              if (offset + 12 > buffer.byteLength) {
                break;
              }

              const fid = Number(view.getBigInt64(offset, true));
              offset += 8;

              const wkbLen = view.getUint32(offset, true);
              offset += 4;

              let geometry: any = null;
              if (wkbLen > 0 && offset + wkbLen <= buffer.byteLength) {
                const wkbSlice = new Uint8Array(buffer, offset, wkbLen);
                offset += wkbLen;
                try {
                  geometry = this.wkbFormat.readGeometry(wkbSlice, {
                    dataProjection,
                    featureProjection: projectionCode,
                  });
                } catch (geomErr) {
                  logging.warn(
                    "Failed to parse WKB geometry for feature",
                    geomErr,
                    { scope: "MapController", fid, layerId: descriptor.id }
                  );
                }
              }

              if (offset + 4 > buffer.byteLength) {
                break;
              }
              const propsLen = view.getUint32(offset, true);
              offset += 4;

              let properties: Record<string, any> = {};
              if (propsLen > 0 && offset + propsLen <= buffer.byteLength) {
                try {
                  const propsSlice = new Uint8Array(buffer, offset, propsLen);
                  properties = JSON.parse(decoder.decode(propsSlice));
                } catch (propsErr) {
                  logging.warn(
                    "Failed to parse properties for feature",
                    propsErr,
                    { scope: "MapController", fid, layerId: descriptor.id }
                  );
                }
                offset += propsLen;
              }

              // Deduplicate by ID to prevent duplicate entities during pan overlaps
              if (geometry && !source.getFeatureById(fid)) {
                const feature = new Feature({ geometry, ...properties });
                feature.setId(fid);
                newFeatures.push(feature);
              }
            }
          } else {
            logging.warn("Invalid WKB packet magic header", {
              scope: "MapController",
              magic: `0x${magic.toString(16)}`,
              layerId: descriptor.id,
            });
          }
        } else if ("features" in result && Array.isArray(result.features)) {
          // Legacy object array fallback
          for (const featRecord of result.features) {
            // Deduplicate by ID to prevent duplicate entities during pan overlaps
            if (source.getFeatureById(featRecord.id)) {
              continue;
            }

            try {
              let geometry: any = null;
              if (featRecord.wkb) {
                geometry = this.wkbFormat.readGeometry(featRecord.wkb, {
                  dataProjection,
                  featureProjection: projectionCode,
                });
              } else if (featRecord.geojson) {
                geometry = this.geojsonFormat.readGeometry(featRecord.geojson, {
                  dataProjection,
                  featureProjection: projectionCode,
                });
              }

              if (!geometry) {
                continue;
              }

              const feature = new Feature({
                geometry,
                ...(featRecord.properties || {}),
              });
              feature.setId(featRecord.id);

              newFeatures.push(feature);
            } catch (geomErr) {
              logging.warn("Failed to parse legacy feature record", geomErr, {
                scope: "MapController",
                featureId: featRecord.id,
                layerId: descriptor.id,
              });
            }
          }
        }

        const entry = this.vectorLayers.get(descriptor.id);
        if (entry) {
          if (fields === undefined) {
            entry.allFieldsLoaded = true;
          } else {
            for (const f of fields) {
              entry.loadedFields.add(f);
            }
          }
        }

        if (newFeatures.length > 0) {
          source.addFeatures(newFeatures);
        }
      } catch (err) {
        logging.error("Failed to load features for layer", err, {
          scope: "MapController",
          layerId: descriptor.id,
        });
        addConsoleLog(
          "error",
          `Failed to query features for layer "${descriptor.name || descriptor.id}": ${err}`,
          "OpenLayers"
        );
      }

      return newFeatures;
    })();

    this.inFlightQueries.set(descriptor.id, queryPromise);
    try {
      return await queryPromise;
    } finally {
      this.inFlightQueries.delete(descriptor.id);
    }
  }

  /**
   * @description Centers and fits the viewport camera onto the geographic bounding envelope of a layer descriptor.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {LayerDescriptor} descriptor - Spatial layer metadata descriptor containing extent.
   * @returns {void}
   */
  public fitLayerExtent(descriptor: LayerDescriptor): void {
    if (
      !descriptor.extent
      || !Array.isArray(descriptor.extent)
      || descriptor.extent.length !== 4
    ) {
      return;
    }

    const [minX, minY, maxX, maxY] = descriptor.extent;
    if (minX === 0 && minY === 0 && maxX === 0 && maxY === 0) {
      return;
    }

    try {
      const sourceCrs = descriptor.crs?.authId || "EPSG:4326";
      const extent3857 = transformExtent(
        descriptor.extent,
        sourceCrs,
        "EPSG:3857"
      );

      if (!extent3857 || extent3857.some((val) => !isFinite(val))) {
        return;
      }

      const size = this.map.getSize();
      if (size && size[0] > 0 && size[1] > 0) {
        this.view.fit(extent3857, {
          size,
          padding: [40, 40, 40, 40],
          maxZoom: 16,
        });
      } else {
        this.view.fit(extent3857, { padding: [40, 40, 40, 40], maxZoom: 16 });
      }
    } catch (err) {
      logging.warn("Failed to fit extent for layer", err, {
        scope: "MapController",
        layerId: descriptor.id,
      });
    }
  }

  /**
   * @description Synchronizes current map canvas bounding envelope and zoom metrics into reactive signals.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {void}
   */
  public updateViewportSignals(): void {
    const size = this.map.getSize();
    if (!size || size[0] <= 0 || size[1] <= 0) return;

    const extent3857 = this.view.calculateExtent(size);
    if (!extent3857 || extent3857.some((val) => !isFinite(val))) return;

    const [minLon, minLat, maxLon, maxLat] = transformExtent(
      extent3857,
      "EPSG:3857",
      "EPSG:4326"
    );

    viewportExtentSignal.value = [
      Math.round(minLon * 100000) / 100000,
      Math.round(minLat * 100000) / 100000,
      Math.round(maxLon * 100000) / 100000,
      Math.round(maxLat * 100000) / 100000,
    ];

    this.updateScaleSignal(true);
  }

  /**
   * @description Updates the cartographic scale denominator signal from the active view, throttled to 250 ms during movement and flushed immediately on demand.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-26
   * @updated 2026-10-26
   * @since 0.1.0-dev
   * @param {boolean} [immediate=false] - Whether to bypass throttling and update scale immediately.
   * @private
   * @returns {void}
   */
  private updateScaleSignal(immediate: boolean = false): void {
    const now = Date.now();
    const elapsed = now - this.lastScaleUpdateTime;

    const doUpdate = () => {
      this.lastScaleUpdateTime = Date.now();
      if (this.scaleThrottleTimer !== null) {
        clearTimeout(this.scaleThrottleTimer);
        this.scaleThrottleTimer = null;
      }
      scaleDenominatorSignal.value = getScale(this.view);
    };

    if (immediate || elapsed >= 250) {
      doUpdate();
    } else if (this.scaleThrottleTimer === null) {
      this.scaleThrottleTimer = setTimeout(doUpdate, 250 - elapsed);
    }
  }

  /**
   * @description Retrieves the configured map zoom amount step factor from preferences.
   * Priority: 'mapTools.mapViewport.zoomAmount' -> 'general.mapViewport.zoomAmount' -> 1.0.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-26
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @returns {number} Zoom step factor (defaults to 1.0 if not configured or non-positive).
   */
  public getZoomAmount(): number {
    const mapToolVal =
      preferencesMapSignal.value["mapTools.mapViewport.zoomAmount"]?.value;
    if (
      typeof mapToolVal === "number"
      && Number.isFinite(mapToolVal)
      && mapToolVal > 0
    ) {
      return mapToolVal;
    }
    const prefVal =
      preferencesMapSignal.value["general.mapViewport.zoomAmount"]?.value;
    if (
      typeof prefVal === "number"
      && Number.isFinite(prefVal)
      && prefVal > 0
    ) {
      return prefVal;
    }
    return 1.0;
  }

  /**
   * @description Steps map view resolution closer by the configured zoom amount preference.
   * Steps view resolution by dividing by 2^zoomAmount.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-26
   * @since 0.1.0-dev
   * @returns {void}
   */
  public zoomIn(): void {
    const zoomAmount = this.getZoomAmount();
    const currentResolution = this.view.getResolution();
    if (
      typeof currentResolution === "number"
      && Number.isFinite(currentResolution)
    ) {
      this.view.animate({
        resolution: currentResolution / Math.pow(2, zoomAmount),
        duration: 200,
      });
    } else {
      this.view.animate({
        zoom: (this.view.getZoom() || 3) + zoomAmount,
        duration: 200,
      });
    }
  }

  /**
   * @description Steps map view resolution farther by the configured zoom amount preference.
   * Steps view resolution by multiplying by 2^zoomAmount.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-26
   * @since 0.1.0-dev
   * @returns {void}
   */
  public zoomOut(): void {
    const zoomAmount = this.getZoomAmount();
    const currentResolution = this.view.getResolution();
    if (
      typeof currentResolution === "number"
      && Number.isFinite(currentResolution)
    ) {
      this.view.animate({
        resolution: currentResolution * Math.pow(2, zoomAmount),
        duration: 200,
      });
    } else {
      this.view.animate({
        zoom: (this.view.getZoom() || 3) - zoomAmount,
        duration: 200,
      });
    }
  }

  /**
   * @description Resets view center and zoom to initial world default.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {void}
   */
  public resetExtent(): void {
    this.view.animate({ center: fromLonLat([15, 35]), zoom: 3, duration: 300 });
  }

  /**
   * @description Restores viewport camera by fitting a geographic extent according to the map viewport's dominant screen axis.
   * Supports optional padding and animation duration.
   * On landscape viewports (W >= H), matches viewport width to extent width and centers on midpoint (clipping height if necessary).
   * On portrait viewports (H > W), matches viewport height to extent height and centers on midpoint (clipping width if necessary).
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-26
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @param {BoundingBox} extent - Geographic bounding envelope [minLon, minLat, maxLon, maxLat] in EPSG:4326.
   * @param {FitExtentOptions | [number, number]} [optionsOrSize] - Optional explicit size [width, height] or fit configuration options.
   * @returns {void}
   */
  public fitExtent(
    extent: BoundingBox,
    optionsOrSize?: FitExtentOptions | [number, number]
  ): void {
    if (!extent || extent.length !== 4) return;

    const viewCrs = this.view.getProjection() || "EPSG:3857";
    const projected = transformExtent(extent, "EPSG:4326", viewCrs);
    const [minX, minY, maxX, maxY] = projected;
    const deltaX = Math.abs(maxX - minX);
    const deltaY = Math.abs(maxY - minY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    if (Array.isArray(optionsOrSize)) {
      const size = optionsOrSize;
      const width = size[0];
      const height = size[1];

      if (width > 0 && height > 0) {
        if (width >= height) {
          // Landscape or square: dominant axis is width
          const targetResolution = deltaX / width;
          this.view.setCenter([centerX, centerY]);
          this.view.setResolution(targetResolution);
        } else {
          // Portrait: dominant axis is height
          const targetResolution = deltaY / height;
          this.view.setCenter([centerX, centerY]);
          this.view.setResolution(targetResolution);
        }
        return;
      }
    }

    const options =
      !Array.isArray(optionsOrSize) && optionsOrSize ? optionsOrSize : {};
    const size = options.size
      ?? this.map.getSize() ?? [
        this.container.clientWidth || 0,
        this.container.clientHeight || 0,
      ];
    const width = size[0];
    const height = size[1];

    if (options.padding || options.duration !== undefined) {
      this.view.fit(projected, {
        size: width > 0 && height > 0 ? size : undefined,
        padding: options.padding,
        duration: options.duration,
      });
      return;
    }

    if (width > 0 && height > 0) {
      if (width >= height) {
        // Landscape or square: dominant axis is width
        const targetResolution = deltaX / width;
        this.view.setCenter([centerX, centerY]);
        this.view.setResolution(targetResolution);
      } else {
        // Portrait: dominant axis is height
        const targetResolution = deltaY / height;
        this.view.setCenter([centerX, centerY]);
        this.view.setResolution(targetResolution);
      }
    } else {
      this.view.fit(projected);
    }
  }

  /**
   * @description Fits or sets viewport center, extent, and rotation on the OpenLayers view.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-27
   * @since 0.1.0-dev
   * @param {Object} payload - Viewport configuration parameters.
   * @param {BoundingBox} [payload.extent] - Bounding envelope [minX, minY, maxX, maxY].
   * @param {{ x: number; y: number }} [payload.center] - Center point coordinate.
   * @param {number} [payload.rotation] - Camera rotation.
   * @param {[number, number, number, number]} [payload.padding] - Viewport margin padding.
   * @param {number} [payload.duration] - Animation duration.
   * @returns {void}
   */
  public setViewport(payload: {
    extent?: BoundingBox;
    center?: { x: number; y: number };
    rotation?: number;
    padding?: [number, number, number, number];
    duration?: number;
  }): void {
    if (payload.rotation !== undefined) {
      this.view.setRotation(payload.rotation);
    }
    if (payload.extent && payload.extent.length === 4) {
      this.fitExtent(payload.extent, {
        padding: payload.padding,
        duration: payload.duration,
      });
    } else if (payload.center) {
      this.view.setCenter(fromLonLat([payload.center.x, payload.center.y]));
    }
  }

  /**
   * @description Updates map canvas dimensions after DOM container size changes.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {void}
   */
  public resize(): void {
    this.map.updateSize();
    this.updateViewportSignals();
  }

  /**
   * @description Retrieves the unmanaged container DOM element hosting the map canvas.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {HTMLElement} Container DOM element.
   */
  public getContainer(): HTMLElement {
    return this.container;
  }

  /**
   * @description Retrieves the underlying native OpenLayers map instance.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {OlMap} Native OpenLayers Map instance.
   */
  public getMap(): OlMap {
    return this.map;
  }

  /**
   * @description Retrieves the underlying native OpenLayers View instance.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {View} Native OpenLayers View instance.
   */
  public getView(): View {
    return this.view;
  }

  /**
   * @description Retrieves the map of active vector layer entries keyed by layer ID.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {Map<string, VectorLayerEntry>} Active vector layers map.
   */
  public getVectorLayers(): Map<string, VectorLayerEntry> {
    return this.vectorLayers;
  }

  /**
   * @description Retrieves a single active vector layer entry by its layer ID.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {string} id - Layer unique identifier.
   * @returns {VectorLayerEntry | undefined} Active layer entry or undefined if not registered.
   */
  public getLayer(id: string): VectorLayerEntry | undefined {
    return this.vectorLayers.get(id);
  }

  /**
   * @description Atomically re-keys a vector layer entry in the active layers map without recreating the OpenLayers layer or dropping cached features.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-24
   * @updated 2026-10-24
   * @since 0.1.0-dev
   * @param {string} oldLayerId - Existing registered layer identifier.
   * @param {string} newLayerId - Target layer identifier.
   * @returns {void}
   */
  public rekeyLayer(oldLayerId: string, newLayerId: string): void {
    if (!oldLayerId || !newLayerId || oldLayerId === newLayerId) {
      return;
    }
    const entry = this.vectorLayers.get(oldLayerId);
    if (!entry) {
      return;
    }
    this.vectorLayers.delete(oldLayerId);
    entry.descriptor = { ...entry.descriptor, id: newLayerId };
    this.vectorLayers.set(newLayerId, entry);
  }

  /**
   * @description Disposes all reactive signal subscriptions, clears layer sources, and detaches the map target.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-29
   * @since 0.1.0-dev
   * @returns {void}
   */
  public dispose(): void {
    for (const dispose of this.disposeSignals) {
      try {
        dispose();
      } catch {
        // Suppress disposal errors
      }
    }
    this.disposeSignals = [];

    if (this.scaleThrottleTimer !== null) {
      clearTimeout(this.scaleThrottleTimer);
      this.scaleThrottleTimer = null;
    }

    for (const entry of this.vectorLayers.values()) {
      try {
        this.map.removeLayer(entry.layer);
        entry.source.clear();
      } catch {
        // Suppress layer cleanup errors
      }
    }
    this.vectorLayers.clear();

    if (activeMapControllerSignal.value === this) {
      activeMapControllerSignal.value = null;
    }

    try {
      this.map.setTarget(undefined);
    } catch {
      // Suppress unmount errors
    }
  }
}
