/**
 * @file MapController.ts
 * @module renderer/map/MapController
 * @description Isolated imperative OpenLayers map controller managing map lifecycle, spatial viewports, vector layers, OGC WKB streaming queries, and reactive signal synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @see {@link OlMap}
 * @see {@link VectorLayer}
 * @see {@link VectorSource}
 */

import { effect } from '@preact/signals-react';
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Graticule from 'ol/layer/Graticule.js';
import Stroke from 'ol/style/Stroke.js';
import WKB from 'ol/format/WKB.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { all as allStrategy, bbox as bboxStrategy } from 'ol/loadingstrategy.js';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj.js';
import Feature from 'ol/Feature.js';
import {
  cursorCoordsSignal,
  viewportExtentSignal,
  zoomSignal,
  scaleDenominatorSignal,
  mapActionSignal,
  addConsoleLog,
} from '../state/gisSignals';
import {
  projectLayersSignal,
  layerStylesSignal,
  currentProjectSignal,
  projectTreeSignal,
  projectVisibleSignal,
} from '../state/projectSignals';
import { getDefaultLayerStyle } from '../../shared/styles/defaultLayerStyles';
import {
  WKB_PACKET_MAGIC,
  type LayerDescriptor,
  type BoundingBox,
  type ProjectLayerItem,
  type ProjectGroupItem,
  type QueryExtentOptions,
} from '../../shared/types';

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
    if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
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
 * @description Recursively extracts all property names referenced by `['get', '<property>']` expressions within an OpenLayers Flat Style definition.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @param {unknown} style - Flat style object, array of rules, or expression tree.
 * @param {Set<string>} [fields=new Set()] - Accumulator for extracted attribute names.
 * @returns {Set<string>} Set of unique attribute names referenced in the style.
 */
export function extractStyleAttributes(
  style: unknown,
  fields: Set<string> = new Set()
): Set<string> {
  if (!style || typeof style !== 'object') {
    return fields;
  }

  if (Array.isArray(style)) {
    if (style.length >= 2 && style[0] === 'get' && typeof style[1] === 'string') {
      fields.add(style[1]);
    }
    for (const item of style) {
      extractStyleAttributes(item, fields);
    }
  } else {
    for (const value of Object.values(style)) {
      extractStyleAttributes(value, fields);
    }
  }

  return fields;
}

/**
 * @typedef {Object} VectorLayerEntry
 * @property {VectorLayer<VectorSource>} layer - Native OpenLayers vector layer instance.
 * @property {VectorSource} source - Native OpenLayers vector source backed by bbox strategy.
 * @property {LayerDescriptor} descriptor - Serializable layer metadata descriptor.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
export interface VectorLayerEntry {
  layer: VectorLayer<VectorSource>;
  source: VectorSource;
  descriptor: LayerDescriptor;
}

/**
 * @class MapController
 * @description Imperative OpenLayers map canvas controller encapsulating native ol/Map and vector rendering completely insulated from React Virtual DOM.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
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
  private disposeSignals: Array<() => void> = [];
  private previousLayerCount = 0;

  /**
   * @constructor
   * @description Initializes the isolated OpenLayers map instance, graticule, view, and reactive signal subscriptions.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {HTMLElement} container - Target unmanaged DOM container element.
   * @param {Object} [options] - Optional map initialization options.
   * @param {View} [options.view] - Custom OpenLayers View instance.
   */
  constructor(container: HTMLElement, options?: { view?: View }) {
    this.container = container;

    const graticule = new Graticule({
      strokeStyle: new Stroke({
        color: 'rgba(0, 0, 0, 0.2)',
        width: 1,
        lineDash: [4, 4],
      }),
      showLabels: true,
      wrapX: true,
    });

    this.view =
      options?.view ??
      new View({
        center: fromLonLat([15, 35]),
        zoom: 3,
        projection: 'EPSG:3857',
      });

    this.map = new OlMap({
      target: container,
      layers: [graticule],
      view: this.view,
      controls: [],
    });

    this.bindEvents();
    this.initProjectViewport();
    this.bindSignals();

    addConsoleLog(
      'info',
      'MapController spatial canvas engine initialized.',
      'OpenLayers'
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
        extent: currentProject.viewport.extent
          ? [
              currentProject.viewport.extent.xmin,
              currentProject.viewport.extent.ymin,
              currentProject.viewport.extent.xmax,
              currentProject.viewport.extent.ymax,
            ]
          : undefined,
        center: currentProject.viewport.center,
        zoom: currentProject.viewport.zoom,
        rotation: currentProject.viewport.rotation,
      });
    }
    this.updateViewportSignals();
  }

  /**
   * @description Attaches native OpenLayers event listeners for cursor tracking, resolution changes, and moveend.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private bindEvents(): void {
    // Cursor location tracking
    this.map.on('pointermove', (evt) => {
      if (evt.coordinate) {
        const [lon, lat] = toLonLat(evt.coordinate);
        cursorCoordsSignal.value = {
          lon: Math.round(lon * 100000) / 100000,
          lat: Math.round(lat * 100000) / 100000,
          x: Math.round(evt.pixel ? evt.pixel[0] : 0),
          y: Math.round(evt.pixel ? evt.pixel[1] : 0),
        };
      }
    });

    // View resolution change signal updates
    this.view.on('change:resolution', () => {
      const zoom = this.view.getZoom() || 3;
      zoomSignal.value = Math.round(zoom * 10) / 10;
      scaleDenominatorSignal.value = Math.round(500000000 / Math.pow(2, zoom));
    });

    // Viewport bounding box updates on movement completion
    this.map.on('moveend', () => {
      this.updateViewportSignals();
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

      if (mapAction.action === 'zoomIn') {
        this.zoomIn();
      } else if (mapAction.action === 'zoomOut') {
        this.zoomOut();
      } else if (mapAction.action === 'reset') {
        this.resetExtent();
      } else if (mapAction.action === 'setViewport') {
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
   * @description Applies dynamic OpenLayers Flat Style rules to registered vector layers at 60 FPS without modifying feature buffers.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {Record<string, Record<string, any>>} styles - OpenLayers flat style rules map keyed by layer UUID.
   * @returns {void}
   */
  public applyLayerStyles(styles: Record<string, Record<string, any>>): void {
    for (const [id, entry] of this.vectorLayers.entries()) {
      if (styles[id]) {
        entry.layer.setStyle(styles[id] as any);
      }
    }
  }

  /**
   * @description Creates and registers an OpenLayers VectorLayer and VectorSource backed by allStrategy/bboxStrategy and WKB/GeoJSON loader.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-15
   * @since 0.1.0-dev
   * @param {LayerDescriptor} descriptor - Spatial layer metadata descriptor.
   * @returns {VectorLayerEntry} Created layer and source tuple.
   */
  public createVectorLayer(descriptor: LayerDescriptor): VectorLayerEntry {
    const isLocalVector = descriptor.layerKind === 'vector' || !descriptor.layerKind;
    const strategy =
      isLocalVector && (descriptor.featureCount === undefined || descriptor.featureCount < 50000)
        ? allStrategy
        : bboxStrategy;

    const source = new VectorSource({
      strategy,
      loader: async (extent, _resolution, projection, success, _failure) => {
        const loaded = await this.loadFeaturesForExtent(descriptor, source, extent, projection);
        if (success) {
          success(loaded);
        }
        return loaded;
      },
    });

    // Resolve Flat Style rules from layerStylesSignal, layer descriptor, or default geometry style
    const styleRules =
      layerStylesSignal.value[descriptor.id] ||
      (typeof descriptor.style === 'object' && descriptor.style !== null
        ? descriptor.style
        : getDefaultLayerStyle(descriptor.geometryKind));

    const currentFlat = flattenTreeLayers(projectTreeSignal.value, projectVisibleSignal.value);
    const treeMatch = currentFlat.find((item) => item.id === descriptor.id);

    const layer = new VectorLayer({
      source,
      style: styleRules as any,
      opacity: treeMatch ? treeMatch.opacity : (descriptor.opacity ?? 1),
      visible: treeMatch ? treeMatch.effectiveVisible : (descriptor.visible ?? true),
      zIndex: treeMatch ? 1000 - treeMatch.flatIndex : 0,
    });

    this.map.addLayer(layer);
    const entry: VectorLayerEntry = { layer, source, descriptor };
    this.vectorLayers.set(descriptor.id, entry);

    return entry;
  }

  /**
   * @description Fetches visible feature slices via IPC layers:queryExtent using zero-copy contiguous binary WKB packet deserialization and dynamic style projection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-16
   * @since 0.1.0-dev
   * @param {LayerDescriptor} descriptor - Spatial layer metadata descriptor.
   * @param {VectorSource} source - Target vector source.
   * @param {number[]} extent - Spatial query bounding box extent.
   * @param {any} projection - Viewport projection instance or authority string.
   * @returns {Promise<Feature[]>} Deserialized features loaded for extent.
   */
  public async loadFeaturesForExtent(
    descriptor: LayerDescriptor,
    source: VectorSource,
    extent: number[],
    projection: any
  ): Promise<Feature[]> {
    if (typeof window === 'undefined' || !window.electronAPI?.queryExtent) {
      return [];
    }

    // Skip redundant IPC query if all features are already loaded into the vector source
    if (
      descriptor.featureCount &&
      descriptor.featureCount > 0 &&
      source.getFeatures().length >= descriptor.featureCount
    ) {
      return [];
    }

    // Deduplicate in-flight queries for the same layer
    const inFlight = this.inFlightQueries.get(descriptor.id);
    if (inFlight) {
      return await inFlight;
    }

    const queryPromise = (async (): Promise<Feature[]> => {
      const projectionCode =
        typeof projection === 'string'
          ? projection
          : projection?.getCode?.() || 'EPSG:3857';

      const queryBox: BoundingBox = [extent[0], extent[1], extent[2], extent[3]];
      const newFeatures: Feature[] = [];

      try {
        const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
        if (!api?.queryExtent) {
          return [];
        }

        const activeStyle =
          layerStylesSignal.value[descriptor.id] ||
          (typeof descriptor.style === 'object' && descriptor.style !== null
            ? descriptor.style
            : getDefaultLayerStyle(descriptor.geometryKind));

        let fields: string[] | undefined;
        if (typeof activeStyle === 'function') {
          fields = undefined;
        } else if (activeStyle) {
          const extracted = extractStyleAttributes(activeStyle);
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

        const dataProjection = descriptor.crs?.authId || 'EPSG:4326';

        let buffer: ArrayBuffer | null = null;
        if ('buffer' in result && result.buffer) {
          if (result.buffer instanceof ArrayBuffer) {
            buffer = result.buffer;
          } else if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(result.buffer)) {
            const view = result.buffer as ArrayBufferView;
            const copy = new Uint8Array(view.byteLength);
            copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
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
                  console.warn(
                    `[MapController] Failed to parse WKB geometry for feature ${fid} in layer ${descriptor.id}:`,
                    geomErr
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
                  console.warn(
                    `[MapController] Failed to parse properties for feature ${fid} in layer ${descriptor.id}:`,
                    propsErr
                  );
                }
                offset += propsLen;
              }

              // Deduplicate by ID to prevent duplicate entities during pan overlaps
              if (geometry && !source.getFeatureById(fid)) {
                const feature = new Feature({
                  geometry,
                  ...properties,
                });
                feature.setId(fid);
                newFeatures.push(feature);
              }
            }
          } else {
            console.warn(`[MapController] Invalid WKB packet magic: 0x${magic.toString(16)}`);
          }
        } else if ('features' in result && Array.isArray(result.features)) {
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
              console.warn(
                `[MapController] Failed to parse feature ${featRecord.id} for layer ${descriptor.id}:`,
                geomErr
              );
            }
          }
        }

        if (newFeatures.length > 0) {
          source.addFeatures(newFeatures);
        }
      } catch (err) {
        console.error(
          `[MapController] Failed to load features for layer ${descriptor.id}:`,
          err
        );
        addConsoleLog(
          'error',
          `Failed to query features for layer "${descriptor.name || descriptor.id}": ${err}`,
          'OpenLayers'
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
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {LayerDescriptor} descriptor - Spatial layer metadata descriptor containing extent.
   * @returns {void}
   */
  public fitLayerExtent(descriptor: LayerDescriptor): void {
    if (!descriptor.extent || !Array.isArray(descriptor.extent) || descriptor.extent.length !== 4) {
      return;
    }

    const [minX, minY, maxX, maxY] = descriptor.extent;
    if (minX === 0 && minY === 0 && maxX === 0 && maxY === 0) {
      return;
    }

    try {
      const sourceCrs = descriptor.crs?.authId || 'EPSG:4326';
      const extent3857 = transformExtent(descriptor.extent, sourceCrs, 'EPSG:3857');

      if (!extent3857 || extent3857.some((val) => !isFinite(val))) {
        return;
      }

      const size = this.map.getSize();
      if (size && size[0] > 0 && size[1] > 0) {
        this.view.fit(extent3857, { size, padding: [40, 40, 40, 40], maxZoom: 16 });
      } else {
        this.view.fit(extent3857, { padding: [40, 40, 40, 40], maxZoom: 16 });
      }
    } catch (err) {
      console.warn(`[MapController] Failed to fit extent for layer "${descriptor.id}":`, err);
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
      'EPSG:3857',
      'EPSG:4326'
    );

    viewportExtentSignal.value = [
      Math.round(minLon * 100000) / 100000,
      Math.round(minLat * 100000) / 100000,
      Math.round(maxLon * 100000) / 100000,
      Math.round(maxLat * 100000) / 100000,
    ];

    const zoom = this.view.getZoom();
    if (zoom !== undefined && isFinite(zoom)) {
      zoomSignal.value = Math.round(zoom * 10) / 10;
      scaleDenominatorSignal.value = Math.round(500000000 / Math.pow(2, zoom));
    }
  }

  /**
   * @description Increases view zoom level by 1 step.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {void}
   */
  public zoomIn(): void {
    this.view.animate({ zoom: (this.view.getZoom() || 3) + 1, duration: 200 });
  }

  /**
   * @description Decreases view zoom level by 1 step.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {void}
   */
  public zoomOut(): void {
    this.view.animate({ zoom: (this.view.getZoom() || 3) - 1, duration: 200 });
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
   * @description Fits or sets viewport center, extent, zoom, and rotation on the OpenLayers view.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {Object} payload - Viewport configuration parameters.
   * @param {BoundingBox} [payload.extent] - Bounding envelope [minX, minY, maxX, maxY].
   * @param {{ x: number; y: number }} [payload.center] - Center point coordinate.
   * @param {number} [payload.zoom] - Zoom level.
   * @param {number} [payload.rotation] - Camera rotation.
   * @returns {void}
   */
  public setViewport(payload: {
    extent?: BoundingBox;
    center?: { x: number; y: number };
    zoom?: number;
    rotation?: number;
  }): void {
    if (payload.rotation !== undefined) {
      this.view.setRotation(payload.rotation);
    }
    if (payload.extent && payload.extent.length === 4) {
      const extent3857 = transformExtent(payload.extent, 'EPSG:4326', 'EPSG:3857');
      const size = this.map.getSize();
      if (size && size[0] > 0 && size[1] > 0) {
        this.view.fit(extent3857, { size, padding: [20, 20, 20, 20] });
      } else {
        this.view.fit(extent3857);
      }
      if (payload.zoom !== undefined) {
        this.view.setZoom(payload.zoom);
      }
    } else if (payload.center) {
      this.view.setCenter(fromLonLat([payload.center.x, payload.center.y]));
      if (payload.zoom !== undefined) {
        this.view.setZoom(payload.zoom);
      }
    } else if (payload.zoom !== undefined) {
      this.view.setZoom(payload.zoom);
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
   * @description Disposes all reactive signal subscriptions, clears layer sources, and detaches the map target.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
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

    for (const entry of this.vectorLayers.values()) {
      try {
        this.map.removeLayer(entry.layer);
        entry.source.clear();
      } catch {
        // Suppress layer cleanup errors
      }
    }
    this.vectorLayers.clear();

    try {
      this.map.setTarget(undefined);
    } catch {
      // Suppress unmount errors
    }
  }
}