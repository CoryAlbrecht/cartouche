/**
 * @file MapController.test.ts
 * @module tests/renderer/map/MapController.test
 * @description Unit and integration tests for MapController isolated OpenLayers lifecycle, vector layer instantiation, WKB streaming loader, feature deduplication, and viewport auto-fitting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link MapController}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectLayersSignal,
  layerStylesSignal,
  currentProjectSignal,
  mapBackgroundColourSignal,
  selectionColourSignal,
  measurementSettingsSignal,
  projectCrsSignal,
} from '../../../src/renderer/state/projectSignals';
import { cursorCoordsSignal, selectedFeatureIdsSignal, activeLayerIdSignal, scaleDenominatorSignal } from '../../../src/renderer/state/gisSignals';
import { preferencesMapSignal } from '../../../src/renderer/state/preferencesSignals';
import {
  MapController,
  extractStyleAttributes,
  attachFeaturePropertiesWithLazyGetters,
} from '../../../src/renderer/map/MapController';
import Feature from 'ol/Feature.js';
import VectorImageLayer from 'ol/layer/VectorImage.js';
import { fromLonLat, transformExtent, transform } from 'ol/proj.js';
import { generateDefaultVectorStyleJson } from '../../../src/shared/styles/defaultLayerStyles';
import { NO_CRS_CODE } from '../../../src/renderer/map/projectionRegistry';
import { WKB_PACKET_MAGIC } from '../../../src/shared/types';
import type { LayerDescriptor } from '../../../src/shared/types';

// Setup headless mock browser/DOM environment for OpenLayers
function setupMockDom(): void {
  (globalThis as any).ShadowRoot = class ShadowRoot {};
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (globalThis as any).getComputedStyle = () => ({
    getPropertyValue: () => '',
    paddingLeft: '0px',
    paddingRight: '0px',
    paddingTop: '0px',
    paddingBottom: '0px',
  });
  (globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

  const makeElement = (tag: string): any => {
    const el: any = {
      tagName: tag.toUpperCase(),
      style: {},
      className: '',
      ownerDocument: null,
      parentNode: null,
      childNodes: [],
      firstChild: null,
      appendChild: (child: any) => {
        el.childNodes.push(child);
        child.parentNode = el;
        el.firstChild = el.childNodes[0] || null;
        return child;
      },
      insertBefore: (child: any, _ref: any) => {
        el.childNodes.push(child);
        child.parentNode = el;
        el.firstChild = el.childNodes[0] || null;
        return child;
      },
      removeChild: (child: any) => {
        el.childNodes = el.childNodes.filter((c: any) => c !== child);
        el.firstChild = el.childNodes[0] || null;
        return child;
      },
      setAttribute: () => {},
      getAttribute: () => null,
      getRootNode: () => (globalThis as any).document,
      addEventListener: () => {},
      removeEventListener: () => {},
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
      },
      clientWidth: 800,
      clientHeight: 600,
      offsetWidth: 800,
      offsetHeight: 600,
      getContext: () => ({
        fillStyle: '',
        strokeStyle: '',
        fillRect: () => {},
        clearRect: () => {},
        getImageData: () => ({ data: [0, 0, 0, 0] })
      }),
    };
    el.ownerDocument = (globalThis as any).document;
    return el;
  };

  (globalThis as any).document = {
    createElement: makeElement,
    createTextNode: (t: string) => ({ textContent: t }),
    body: makeElement('body'),
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  (globalThis as any).window = {
    ...globalThis,
    addEventListener: () => {},
    removeEventListener: () => {},
    document: (globalThis as any).document,
    electronAPI: undefined,
  };
}

setupMockDom();

// Sample Point WKB buffers (Little Endian OGC WKB)
// Point 1: [-85, 45] -> 01 01000000 00000000004055c0 0000000000804640
const pointWkb1 = new Uint8Array(
  Buffer.from('010100000000000000004055c00000000000804640', 'hex')
);

// Point 2: [-84, 46] -> 01 01000000 00000000000055c0 0000000000004740
const pointWkb2 = new Uint8Array(
  Buffer.from('010100000000000000000055c00000000000004740', 'hex')
);

/**
 * @description Helper utility constructing a contiguous binary WKB packet conforming to ADR 0004 for test mocks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @param {Array<{ fid: number | bigint; wkb?: Uint8Array; properties?: Record<string, any> }>} features - Feature records to serialize.
 * @param {number} [magic=WKB_PACKET_MAGIC] - Header magic number.
 * @returns {ArrayBuffer} Contiguous binary packet buffer.
 */
function createMockBinaryPacket(
  features: Array<{ fid: number | bigint; wkb?: Uint8Array; properties?: Record<string, any> }>,
  magic: number = WKB_PACKET_MAGIC
): ArrayBuffer {
  const encoder = new TextEncoder();
  let totalSize = 12;
  const records = features.map((f) => {
    const fid = BigInt(f.fid);
    const wkbBytes = f.wkb || null;
    const wkbLen = wkbBytes ? wkbBytes.byteLength : 0;
    const propsBytes = f.properties ? encoder.encode(JSON.stringify(f.properties)) : null;
    const propsLen = propsBytes ? propsBytes.byteLength : 0;
    totalSize += 8 + 4 + wkbLen + 4 + propsLen;
    return { fid, wkbBytes, wkbLen, propsBytes, propsLen };
  });

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  view.setUint32(0, magic, true);
  view.setUint16(4, 1, true);
  view.setUint16(6, 0x03, true);
  view.setUint32(8, features.length, true);

  let offset = 12;
  for (const r of records) {
    view.setBigInt64(offset, r.fid, true);
    offset += 8;
    view.setUint32(offset, r.wkbLen, true);
    offset += 4;
    if (r.wkbBytes && r.wkbLen > 0) {
      new Uint8Array(buffer, offset, r.wkbLen).set(r.wkbBytes);
      offset += r.wkbLen;
    }
    view.setUint32(offset, r.propsLen, true);
    offset += 4;
    if (r.propsBytes && r.propsLen > 0) {
      new Uint8Array(buffer, offset, r.propsLen).set(r.propsBytes);
      offset += r.propsLen;
    }
  }

  return buffer;
}

describe('MapController Isolated Canvas Engine', () => {
  let container: any;
  let controller: MapController;

  beforeEach(() => {
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    currentProjectSignal.value = null;

    container = (globalThis as any).document.createElement('div');
    controller = new MapController(container);
  });

  afterEach(() => {
    controller.dispose();
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    currentProjectSignal.value = null;
    selectedFeatureIdsSignal.value = new Set();
    activeLayerIdSignal.value = null;
    (globalThis as any).window.electronAPI = undefined;
  });

  it('paints the Map Background Colour on the viewport container and follows signal changes (Ticket #272)', () => {
    assert.equal(container.style.backgroundColor, '#ffffff', 'default background is white');
    mapBackgroundColourSignal.value = '#123456';
    assert.equal(container.style.backgroundColor, '#123456', 'background follows the signal');
    mapBackgroundColourSignal.value = 'rgb(10, 20, 30)';
    assert.equal(container.style.backgroundColor, 'rgb(10, 20, 30)');
    mapBackgroundColourSignal.value = '#ffffff';
  });

  it('recomputes the status bar scale with the project Scale Calculation method (Ticket #275)', () => {
    const view = controller.getView();
    view.setCenter(fromLonLat([0, 60]));
    view.setResolution(100);
    measurementSettingsSignal.value = { ...measurementSettingsSignal.value, scaleMethod: 'middle' };
    const middle = scaleDenominatorSignal.value;
    measurementSettingsSignal.value = { ...measurementSettingsSignal.value, scaleMethod: 'equator' };
    const equator = scaleDenominatorSignal.value;
    assert.notEqual(middle, equator, 'equator method changes the displayed scale at 60°N');
    assert.ok(equator > middle, 'equator denominator is larger than the 60°N middle denominator in Mercator');
    measurementSettingsSignal.value = { ...measurementSettingsSignal.value, scaleMethod: 'middle' };
    assert.equal(scaleDenominatorSignal.value, middle, 'Middle of Map matches the previous output');
  });

  it('mounts OpenLayers map in unmanaged container with default EPSG:3857 view and empty layers', () => {
    assert.equal(controller.getContainer(), container);
    assert.ok(controller.getMap(), 'Map instance must be initialized');
    assert.equal(
      controller.getMap().getLayers().getLength(),
      0,
      'Map must initialize with an empty layers array'
    );

    const view = controller.getView();
    assert.ok(view, 'View instance must be initialized');
    assert.equal(view.getProjection().getCode(), 'EPSG:3857');
    assert.equal(view.getZoom(), 3);
  });

  it('instantiates VectorImageLayer and VectorSource with wrapX: false on layer addition', () => {
    const descriptor: LayerDescriptor = {
      id: 'layer-points-1',
      name: 'Sample Points',
      type: 'geojson',
      source: '/path/to/points.geojson',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 10,
    };

    projectLayersSignal.value = [descriptor];

    assert.equal(controller.getVectorLayers().size, 1);
    const entry = controller.getLayer('layer-points-1');
    assert.ok(entry, 'Vector layer entry must be created');
    assert.ok(
      entry.layer instanceof VectorImageLayer,
      'OpenLayers layer must be an instance of VectorImageLayer for image-cached panning'
    );
    assert.ok(entry.source, 'OpenLayers VectorSource must exist');
    assert.equal(
      entry.source.getWrapX(),
      false,
      'VectorSource must set wrapX: false to prevent 3-world-width replay expansion'
    );
    assert.equal(entry.descriptor.id, 'layer-points-1');
  });

  it('applies custom Flat Style rules from layerStylesSignal when creating layer', () => {
    const customStyle = {
      'circle-radius': 12,
      'circle-fill-color': '#ff0000',
    };
    layerStylesSignal.value = {
      'layer-styled-1': customStyle,
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-styled-1',
      name: 'Styled Layer',
      type: 'geojson',
      source: '/path/to/styled.geojson',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 5,
    };

    projectLayersSignal.value = [descriptor];

    const entry = controller.getLayer('layer-styled-1');
    assert.ok(entry);
    assert.deepEqual(entry.layer.getStyle(), customStyle);
  });

  it('instantiates VectorLayer without error when descriptor has style with { content, format: "openlayers" } (Ticket #87 regression)', () => {
    const defaultJson = generateDefaultVectorStyleJson(['firebrick', 'cornflowerblue', 'limegreen']);
    const descriptor: LayerDescriptor = {
      id: 'layer-unwrapped-1',
      name: 'Unwrapped Style Layer',
      type: 'geojson',
      source: '/path/to/layer.geojson',
      geometryKind: 'Polygon',
      layerKind: 'vector',
      style: {
        content: defaultJson,
        format: 'openlayers'
      },
      extent: [-90, 40, -80, 50],
      featureCount: 5,
    };

    // Setting projectLayersSignal triggers syncLayers -> createVectorLayer synchronously
    projectLayersSignal.value = [descriptor];

    const entry = controller.getLayer('layer-unwrapped-1');
    assert.ok(entry, 'Vector layer entry must be created successfully without symbolizer errors');
    assert.ok(entry.layer, 'OpenLayers VectorLayer must exist');
    assert.deepEqual(entry.layer.getStyle(), JSON.parse(defaultJson));
  });

  it('instantiates VectorLayer and resolves shared style when descriptor has { href: "#shared-style", format: "openlayers" }', () => {
    const sharedRules = [{ filter: ['==', ['geometry-type'], 'Polygon'], style: { 'fill-color': 'teal' } }];
    currentProjectSignal.value = {
      format: 'cartouche-xml',
      metadata: { title: 'Test Project' },
      layers: [],
      styles: [
        {
          id: 'shared-style-1',
          format: 'openlayers',
          content: JSON.stringify(sharedRules)
        }
      ]
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-shared-1',
      name: 'Shared Style Layer',
      type: 'geojson',
      source: '/path/to/shared.geojson',
      geometryKind: 'Polygon',
      layerKind: 'vector',
      style: {
        href: '#shared-style-1',
        format: 'openlayers'
      },
      extent: [-90, 40, -80, 50],
      featureCount: 5,
    };

    projectLayersSignal.value = [descriptor];

    const entry = controller.getLayer('layer-shared-1');
    assert.ok(entry, 'Vector layer entry must resolve shared style');
    assert.deepEqual(entry.layer.getStyle(), sharedRules);
  });

  it('streams feature slices via window.electronAPI.queryExtent and deserializes OGC WKB buffers', async () => {
    const queryCalls: Array<{ layerId: string; extent: any; projection: string }> = [];

    (globalThis as any).window.electronAPI = {
      queryExtent: async (layerId: string, extent: any, targetProjection: string) => {
        queryCalls.push({ layerId, extent, projection: targetProjection });
        return {
          layerId,
          features: [
            {
              id: 101,
              wkb: pointWkb1,
              properties: { name: 'Point A', category: 'monitoring' },
            },
          ],
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-query-test',
      name: 'Query Test',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
      crs: { authId: 'EPSG:4326' }, // lon/lat data: ADR 0033 treats a layer with no CRS as EPSG:3857
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-query-test')!;
    assert.ok(entry);

    // Trigger loading features for extent
    const loaded = await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-10000000, 4000000, -8000000, 6000000],
      'EPSG:3857'
    );

    assert.equal(queryCalls.length, 1);
    assert.equal(queryCalls[0].layerId, 'layer-query-test');
    assert.equal(queryCalls[0].projection, 'EPSG:3857');

    assert.equal(loaded.length, 1);
    const features = entry.source.getFeatures();
    assert.equal(features.length, 1);

    const feature = features[0];
    assert.equal(feature.getId(), 101);
    assert.equal(feature.get('name'), 'Point A');
    assert.equal(feature.get('category'), 'monitoring');

    // Verify coordinates reprojected from EPSG:4326 to EPSG:3857
    const geom = feature.getGeometry();
    assert.ok(geom);
    assert.equal(geom.getType(), 'Point');
    const coords = (geom as any).getCoordinates();
    assert.ok(Math.abs(coords[0] - -9462156.7) < 1, 'X coordinate must be reprojected to EPSG:3857');
    assert.ok(Math.abs(coords[1] - 5621521.4) < 1, 'Y coordinate must be reprojected to EPSG:3857');
  });

  it('streams feature slices formatted as GeoJSON geometry and reprojects coordinates', async () => {
    (globalThis as any).window.electronAPI = {
      queryExtent: async (layerId: string) => {
        return {
          layerId,
          features: [
            {
              id: 201,
              geojson: { type: 'Point', coordinates: [-85, 45] },
              properties: { name: 'Lake Point' },
            },
          ],
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-geojson-test',
      name: 'GeoJSON Test',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
      crs: { authId: 'EPSG:4326' }, // lon/lat data: ADR 0033 treats a layer with no CRS as EPSG:3857
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-geojson-test')!;
    assert.ok(entry);

    const loaded = await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-10000000, 4000000, -8000000, 6000000],
      'EPSG:3857'
    );

    assert.equal(loaded.length, 1);
    const feature = entry.source.getFeatureById(201);
    assert.ok(feature);
    assert.equal(feature.get('name'), 'Lake Point');
    const geom = feature.getGeometry();
    assert.ok(geom);
    assert.equal(geom.getType(), 'Point');
    const coords = (geom as any).getCoordinates();
    assert.ok(Math.abs(coords[0] - -9462156.7) < 1, 'X coordinate must be reprojected to EPSG:3857');
  });

  it('deduplicates features by ID on VectorSource during spatial pan overlaps', async () => {
    (globalThis as any).window.electronAPI = {
      queryExtent: async (layerId: string) => {
        return {
          layerId,
          features: [
            { id: 101, wkb: pointWkb1, properties: { name: 'Point A' } },
            { id: 102, wkb: pointWkb2, properties: { name: 'Point B' } },
          ],
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-dedup-test',
      name: 'Dedup Test',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 2,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-dedup-test')!;

    // Initial load
    await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-10000000, 4000000, -8000000, 6000000],
      'EPSG:3857'
    );
    assert.equal(entry.source.getFeatures().length, 2);

    // Overlapping pan load returning the same features
    await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-9500000, 4500000, -7500000, 6500000],
      'EPSG:3857'
    );

    // Still exactly 2 features because duplicates by ID were ignored
    assert.equal(entry.source.getFeatures().length, 2, 'Features must be deduplicated by ID');
  });

  it('highlights selected features of the active layer with the Selection Colour and follows selection and colour changes (Ticket #273)', async () => {
    (globalThis as any).window.electronAPI = {
      queryExtent: async (layerId: string) => ({
        layerId,
        features: [
          { id: 101, wkb: pointWkb1, properties: { name: 'Point A' } },
          { id: 102, wkb: pointWkb2, properties: { name: 'Point B' } },
        ],
      }),
    };
    const descriptor: LayerDescriptor = {
      id: 'layer-selection-test',
      name: 'Selection Test',
      type: 'shp',
      source: '/path/to/sel.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 2,
    };
    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-selection-test')!;
    assert.equal(controller.getSelectionHighlightLayer(), null, 'no overlay while nothing is selected');

    // Selecting before features are loaded: the overlay appears once the features arrive.
    activeLayerIdSignal.value = 'layer-selection-test';
    selectedFeatureIdsSignal.value = new Set([101]);
    await controller.loadFeaturesForExtent(descriptor, entry.source, [-10000000, 4000000, -8000000, 6000000], 'EPSG:3857');

    const overlay = controller.getSelectionHighlightLayer();
    assert.ok(overlay, 'overlay layer created');
    assert.ok(overlay!.getZIndex()! > 1000, 'overlay draws above every layer');
    const overlaySource = overlay!.getSource()!;
    assert.equal(overlaySource.getFeatures().length, 1, 'one highlight for the one selected feature');
    const highlighted = overlaySource.getFeatures()[0];
    assert.equal(highlighted.getGeometry(), entry.source.getFeatureById(101)!.getGeometry(), 'highlight shares the selected geometry');

    // Point markers are filled with the Selection Colour (default semi-transparent yellow).
    const styleFn = overlay!.getStyle() as any;
    let style = styleFn(highlighted, 1);
    assert.equal(style.getImage().getFill().getColor(), 'rgba(255,255,0,0.6)');

    // Selection change: two features highlighted.
    selectedFeatureIdsSignal.value = new Set([101, 102]);
    assert.equal(overlaySource.getFeatures().length, 2);

    // Applying a new Selection Colour restyles the overlay.
    selectionColourSignal.value = 'rgba(255,0,0,0.5)';
    style = (controller.getSelectionHighlightLayer()!.getStyle() as any)(highlighted, 1);
    assert.equal(style.getImage().getFill().getColor(), 'rgba(255,0,0,0.5)');

    // Clearing the selection removes the overlay.
    selectedFeatureIdsSignal.value = new Set();
    assert.equal(controller.getSelectionHighlightLayer(), null);

    selectionColourSignal.value = 'rgba(255,255,0,0.6)';
    activeLayerIdSignal.value = null;
  });

  it('automatically fits and centers viewport to first imported layer on empty canvas', () => {
    const view = controller.getView();
    const initialCenter = view.getCenter();

    const descriptor: LayerDescriptor = {
      id: 'layer-first-import',
      name: 'Great Lakes',
      type: 'shp',
      source: '/path/to/lakes.shp',
      geometryKind: 'Polygon',
      layerKind: 'vector',
      extent: [-92, 41, -76, 49],
      featureCount: 34,
      crs: { authId: 'EPSG:4326' }, // lon/lat data: ADR 0033 treats a layer with no CRS as EPSG:3857
    };

    projectLayersSignal.value = [descriptor];

    const updatedCenter = view.getCenter();
    assert.ok(updatedCenter, 'View center must be defined');
    // Center of [-92, 41, -76, 49] in EPSG:4326 is [-84, 45]
    // In EPSG:3857, -84 is approx -9.35e6, 45 is approx 5.62e6
    assert.notDeepEqual(
      updatedCenter,
      initialCenter,
      'Viewport camera must auto-fit to first imported layer'
    );
    assert.ok(Math.abs(updatedCenter[0] - -9350791) < 50000);
    assert.ok(Math.abs(updatedCenter[1] - 5621521) < 50000);
  });

  it('removes vector layers when deleted from projectLayersSignal', () => {
    const d1: LayerDescriptor = {
      id: 'layer-keep',
      name: 'Keep Layer',
      type: 'geojson',
      source: '/path/1',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };
    const d2: LayerDescriptor = {
      id: 'layer-remove',
      name: 'Remove Layer',
      type: 'geojson',
      source: '/path/2',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [d1, d2];
    assert.equal(controller.getVectorLayers().size, 2);

    // Remove d2
    projectLayersSignal.value = [d1];
    assert.equal(controller.getVectorLayers().size, 1);
    assert.ok(controller.getLayer('layer-keep'));
    assert.equal(controller.getLayer('layer-remove'), undefined);
  });

  it('cleans up resources and unmounts map target upon dispose()', () => {
    const descriptor: LayerDescriptor = {
      id: 'layer-dispose-test',
      name: 'Dispose Test',
      type: 'geojson',
      source: '/path/to/test.geojson',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    assert.equal(controller.getVectorLayers().size, 1);

    controller.dispose();

    assert.equal(controller.getVectorLayers().size, 0);
    assert.equal(controller.getMap().getTarget(), undefined);
  });

  it('skips redundant queryExtent IPC calls when all features are already loaded in VectorSource', async () => {
    let callCount = 0;
    (globalThis as any).window.electronAPI = {
      queryExtent: async (layerId: string) => {
        callCount++;
        return {
          layerId,
          features: [
            { id: 401, wkb: pointWkb1, properties: { name: 'Lake Point 1' } },
          ],
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-redundant-test',
      name: 'Redundant Test',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-redundant-test')!;

    // Initial load
    await controller.loadFeaturesForExtent(descriptor, entry.source, [-1000, -1000, 1000, 1000], 'EPSG:3857');
    assert.equal(callCount, 1);
    assert.equal(entry.source.getFeatures().length, 1);

    // Subsequent pan load with different extent
    const secondLoaded = await controller.loadFeaturesForExtent(descriptor, entry.source, [-2000, -2000, 2000, 2000], 'EPSG:3857');
    assert.equal(callCount, 1, 'queryExtent must NOT be called again when all features are already loaded');
    assert.equal(secondLoaded.length, 0);
  });

  it('streams feature slices via contiguous binary WKB packet and decodes zero-copy geometries', async () => {
    const binaryPacket = createMockBinaryPacket([
      {
        fid: 501,
        wkb: pointWkb1,
        properties: { name: 'Zero Copy Point', depth: 42 },
      },
    ]);

    (globalThis as any).window.electronAPI = {
      queryExtent: async (layerId: string) => {
        return {
          layerId,
          buffer: binaryPacket,
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-binary-test',
      name: 'Binary Test',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
      crs: { authId: 'EPSG:4326' }, // lon/lat data: ADR 0033 treats a layer with no CRS as EPSG:3857
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-binary-test')!;
    assert.ok(entry);

    const loaded = await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-10000000, 4000000, -8000000, 6000000],
      'EPSG:3857'
    );

    assert.equal(loaded.length, 1);
    const feature = entry.source.getFeatureById(501);
    assert.ok(feature);
    assert.equal(feature.getId(), 501);
    assert.equal(feature.get('name'), 'Zero Copy Point');
    assert.equal(feature.get('depth'), 42);

    const geom = feature.getGeometry();
    assert.ok(geom);
    assert.equal(geom.getType(), 'Point');
    const coords = (geom as any).getCoordinates();
    assert.ok(Math.abs(coords[0] - -9462156.7) < 1, 'X coordinate must be reprojected to EPSG:3857');
    assert.ok(Math.abs(coords[1] - 5621521.4) < 1, 'Y coordinate must be reprojected to EPSG:3857');
  });

  it('dynamically projects fields: [] when active layer style does not reference attributes', async () => {
    let capturedOptions: any = null;

    (globalThis as any).window.electronAPI = {
      queryExtent: async (_layerId: string, options: any) => {
        capturedOptions = options;
        return {
          layerId: 'layer-no-attr-style',
          buffer: createMockBinaryPacket([
            { fid: 502, wkb: pointWkb1 },
          ]),
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-no-attr-style',
      name: 'No Attr Style Layer',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-no-attr-style')!;

    await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-10000000, 4000000, -8000000, 6000000],
      'EPSG:3857'
    );

    assert.ok(capturedOptions, 'QueryExtentOptions must be passed to queryExtent');
    assert.deepEqual(capturedOptions.fields, [], 'fields must be an empty array when style has no attribute references');
    assert.equal(capturedOptions.includeGeometry, true);
  });

  it('dynamically extracts and requests only attributes referenced in layer style', async () => {
    let capturedOptions: any = null;

    layerStylesSignal.value = {
      'layer-attr-style': {
        'circle-radius': ['get', 'scalerank'],
        'circle-fill-color': ['get', 'color_code'],
      },
    };

    (globalThis as any).window.electronAPI = {
      queryExtent: async (_layerId: string, options: any) => {
        capturedOptions = options;
        return {
          layerId: 'layer-attr-style',
          buffer: createMockBinaryPacket([
            { fid: 503, wkb: pointWkb1, properties: { scalerank: 5, color_code: '#ff00ff' } },
          ]),
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-attr-style',
      name: 'Attr Style Layer',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-attr-style')!;

    await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-10000000, 4000000, -8000000, 6000000],
      'EPSG:3857'
    );

    assert.ok(capturedOptions);
    assert.ok(Array.isArray(capturedOptions.fields));
    assert.equal(capturedOptions.fields.length, 2);
    assert.ok(capturedOptions.fields.includes('scalerank'));
    assert.ok(capturedOptions.fields.includes('color_code'));

    const feature = entry.source.getFeatureById(503);
    assert.ok(feature);
    assert.equal(feature.get('scalerank'), 5);
    assert.equal(feature.get('color_code'), '#ff00ff');
  });

  it('deduplicates binary packet features by 64-bit FID during overlapping pan queries', async () => {
    let queryCount = 0;
    (globalThis as any).window.electronAPI = {
      queryExtent: async (layerId: string) => {
        queryCount++;
        if (queryCount === 1) {
          return {
            layerId,
            buffer: createMockBinaryPacket([
              { fid: 601, wkb: pointWkb1, properties: { name: 'P1' } },
              { fid: 602, wkb: pointWkb2, properties: { name: 'P2' } },
            ]),
          };
        }
        return {
          layerId,
          buffer: createMockBinaryPacket([
            { fid: 601, wkb: pointWkb1, properties: { name: 'P1' } },
            { fid: 602, wkb: pointWkb2, properties: { name: 'P2' } },
            { fid: 603, wkb: pointWkb1, properties: { name: 'P3' } },
          ]),
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-binary-dedup',
      name: 'Binary Dedup',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 3,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-binary-dedup')!;

    await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-10000000, 4000000, -8000000, 6000000],
      'EPSG:3857'
    );
    assert.equal(entry.source.getFeatures().length, 2);

    await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-9000000, 4500000, -7000000, 6500000],
      'EPSG:3857'
    );
    assert.equal(entry.source.getFeatures().length, 3, 'Must have exactly 3 features without duplicate FIDs 601 and 602');
  });

  it('safely handles invalid binary packet magic number without throwing', async () => {
    const invalidBuffer = createMockBinaryPacket(
      [{ fid: 701, wkb: pointWkb1 }],
      0xdeadbeef // invalid magic
    );

    (globalThis as any).window.electronAPI = {
      queryExtent: async (layerId: string) => {
        return {
          layerId,
          buffer: invalidBuffer,
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-invalid-magic',
      name: 'Invalid Magic',
      type: 'shp',
      source: '/path/to/test.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-invalid-magic')!;

    const loaded = await controller.loadFeaturesForExtent(
      descriptor,
      entry.source,
      [-10000000, 4000000, -8000000, 6000000],
      'EPSG:3857'
    );

    assert.equal(loaded.length, 0);
    assert.equal(entry.source.getFeatures().length, 0);
  });

  it('rekeyLayer rekeys active vector layer entry without disposing source or recreating layer', () => {
    const container = (globalThis as any).document.createElement('div');
    const controller = new MapController(container);

    const descriptor: LayerDescriptor = {
      id: 'layer-old-id',
      name: 'Test Vector Layer',
      type: 'shp',
      source: '/data/test.shp',
      layerKind: 'vector',
      geometryKind: 'Polygon',
      featureCount: 50,
      crs: { authId: 'EPSG:4326', description: 'WGS 84' },
      extent: [-10, -10, 10, 10],
    };

    projectLayersSignal.value = [descriptor];
    controller.syncLayers([descriptor]);

    const oldEntry = controller.getLayer('layer-old-id');
    assert.ok(oldEntry, 'Layer entry must be registered');

    // Rekey layer
    controller.rekeyLayer('layer-old-id', 'layer-new-id');

    assert.equal(controller.getLayer('layer-old-id'), undefined);
    const newEntry = controller.getLayer('layer-new-id');
    assert.ok(newEntry, 'Layer entry must be registered under new ID');
    assert.equal(newEntry.layer, oldEntry.layer, 'OpenLayers VectorLayer instance must be preserved');
    assert.equal(newEntry.source, oldEntry.source, 'VectorSource instance must be preserved');
    assert.equal(newEntry.descriptor.id, 'layer-new-id', 'Descriptor ID must be updated');

    controller.dispose();
  });

  it('steps view resolution using default zoomAmount (1.0) on zoomIn and zoomOut', () => {
    preferencesMapSignal.value = {};
    const view = controller.getMap().getView();
    view.setResolution(1000);
    const initialRes = view.getResolution()!;
    assert.equal(initialRes, 1000);

    let animatedOptions: any = null;
    view.animate = (options: any) => {
      animatedOptions = options;
    };

    controller.zoomIn();
    assert.ok(animatedOptions);
    assert.equal(animatedOptions.resolution, initialRes / 2);

    controller.zoomOut();
    assert.ok(animatedOptions);
    assert.equal(animatedOptions.resolution, initialRes * 2);
  });

  it('steps view resolution using configured general.mapViewport.zoomAmount preference', () => {
    preferencesMapSignal.value = {
      'general.mapViewport.zoomAmount': {
        displayName: 'Map Zoom Step Amount',
        value: 2.0,
      } as any,
    };

    const view = controller.getMap().getView();
    view.setResolution(1000);
    const initialRes = view.getResolution()!;

    let animatedOptions: any = null;
    view.animate = (options: any) => {
      animatedOptions = options;
    };

    controller.zoomIn();
    assert.ok(animatedOptions);
    // 2^2.0 = 4, so 1000 / 4 = 250
    assert.equal(animatedOptions.resolution, initialRes / 4);

    controller.zoomOut();
    assert.ok(animatedOptions);
    // 1000 * 4 = 4000
    assert.equal(animatedOptions.resolution, initialRes * 4);

    // Clean up
    preferencesMapSignal.value = {};
  });

  it('falls back to 1.0 when zoomAmount preference is negative, zero, or non-number', () => {
    preferencesMapSignal.value = {
      'general.mapViewport.zoomAmount': {
        displayName: 'Map Zoom Step Amount',
        value: -2.0,
      } as any,
    };
    assert.equal(controller.getZoomAmount(), 1.0);

    preferencesMapSignal.value = {
      'general.mapViewport.zoomAmount': {
        displayName: 'Map Zoom Step Amount',
        value: 0,
      } as any,
    };
    assert.equal(controller.getZoomAmount(), 1.0);

    preferencesMapSignal.value = {
      'general.mapViewport.zoomAmount': {
        displayName: 'Map Zoom Step Amount',
        value: 'invalid' as any,
      } as any,
    };
    assert.equal(controller.getZoomAmount(), 1.0);

    preferencesMapSignal.value = {};
  });

  it('retrieves zoomAmount from mapTools.mapViewport.zoomAmount with fallback to general.mapViewport.zoomAmount and default 1.0', () => {
    // 1. Both defined: mapTools takes precedence
    preferencesMapSignal.value = {
      'mapTools.mapViewport.zoomAmount': {
        displayName: 'Zoom Step Factor',
        value: 2.5,
      } as any,
      'general.mapViewport.zoomAmount': {
        displayName: 'Map Zoom Step Amount',
        value: 1.5,
      } as any,
    };
    assert.equal(controller.getZoomAmount(), 2.5);

    // 2. mapTools invalid: falls back to general
    preferencesMapSignal.value = {
      'mapTools.mapViewport.zoomAmount': {
        displayName: 'Zoom Step Factor',
        value: 0,
      } as any,
      'general.mapViewport.zoomAmount': {
        displayName: 'Map Zoom Step Amount',
        value: 1.5,
      } as any,
    };
    assert.equal(controller.getZoomAmount(), 1.5);

    // 3. mapTools absent: falls back to general
    preferencesMapSignal.value = {
      'general.mapViewport.zoomAmount': {
        displayName: 'Map Zoom Step Amount',
        value: 1.75,
      } as any,
    };
    assert.equal(controller.getZoomAmount(), 1.75);

    // 4. Both absent: defaults to 1.0
    preferencesMapSignal.value = {};
    assert.equal(controller.getZoomAmount(), 1.0);
  });

  it('fitExtent fits extent width on landscape viewports (W >= H), centers on midpoint, and clips height', () => {
    const rawExtent: [number, number, number, number] = [-10, 10, 10, 40];
    const [minX, minY, maxX, maxY] = transformExtent(rawExtent, 'EPSG:4326', 'EPSG:3857');
    const deltaX = Math.abs(maxX - minX);
    const deltaY = Math.abs(maxY - minY);
    const expectedCenterX = (minX + maxX) / 2;
    const expectedCenterY = (minY + maxY) / 2;
    const landscapeSize: [number, number] = [1000, 500];
    const expectedResolution = deltaX / 1000;

    controller.fitExtent(rawExtent, landscapeSize);

    const view = controller.getMap().getView();
    const center = view.getCenter()!;
    const res = view.getResolution()!;

    assert.ok(Math.abs(center[0] - expectedCenterX) < 1e-4, 'Center X must match extent midpoint');
    assert.ok(Math.abs(center[1] - expectedCenterY) < 1e-4, 'Center Y must match extent midpoint');
    assert.ok(Math.abs(res - expectedResolution) < 1e-4, 'Resolution must equal deltaX / viewportWidth');

    // Visible viewport width matches deltaX exactly
    const visibleWidth = landscapeSize[0] * res;
    assert.ok(Math.abs(visibleWidth - deltaX) < 1e-4, 'Visible width must match extent width');

    // Visible viewport height is 500 * res = 0.5 * deltaX, which is less than deltaY (clipped)
    const visibleHeight = landscapeSize[1] * res;
    assert.ok(visibleHeight < deltaY, 'Extent height must be clipped when secondary axis exceeds viewport ratio');
  });

  it('fitExtent fits extent height on portrait viewports (H > W), centers on midpoint, and clips width', () => {
    const rawExtent: [number, number, number, number] = [-20, 10, 20, 30];
    const [minX, minY, maxX, maxY] = transformExtent(rawExtent, 'EPSG:4326', 'EPSG:3857');
    const deltaX = Math.abs(maxX - minX);
    const deltaY = Math.abs(maxY - minY);
    const expectedCenterX = (minX + maxX) / 2;
    const expectedCenterY = (minY + maxY) / 2;
    const portraitSize: [number, number] = [500, 1000];
    const expectedResolution = deltaY / 1000;

    controller.fitExtent(rawExtent, portraitSize);

    const view = controller.getMap().getView();
    const center = view.getCenter()!;
    const res = view.getResolution()!;

    assert.ok(Math.abs(center[0] - expectedCenterX) < 1e-4, 'Center X must match extent midpoint');
    assert.ok(Math.abs(center[1] - expectedCenterY) < 1e-4, 'Center Y must match extent midpoint');
    assert.ok(Math.abs(res - expectedResolution) < 1e-4, 'Resolution must equal deltaY / viewportHeight');

    // Visible viewport height matches deltaY exactly
    const visibleHeight = portraitSize[1] * res;
    assert.ok(Math.abs(visibleHeight - deltaY) < 1e-4, 'Visible height must match extent height');

    // Visible viewport width is 500 * res = 0.5 * deltaY, which is less than deltaX (clipped)
    const visibleWidth = portraitSize[0] * res;
    assert.ok(visibleWidth < deltaX, 'Extent width must be clipped when secondary axis exceeds viewport ratio');
  });

  it('fitExtent fits width and centers on midpoint on square viewports (W == H)', () => {
    const rawExtent: [number, number, number, number] = [-15, 20, 15, 50];
    const [minX, , maxX] = transformExtent(rawExtent, 'EPSG:4326', 'EPSG:3857');
    const deltaX = Math.abs(maxX - minX);
    const squareSize: [number, number] = [800, 800];
    const expectedResolution = deltaX / 800;

    controller.fitExtent(rawExtent, squareSize);

    const view = controller.getMap().getView();
    const res = view.getResolution()!;
    assert.ok(Math.abs(res - expectedResolution) < 1e-4, 'Square viewport must match width resolution deltaX / width');
  });

  it('setViewport delegates to fitExtent for extent payloads and sets center for point payloads', () => {
    const rawExtent: [number, number, number, number] = [-10, -5, 10, 5];
    controller.setViewport({ extent: rawExtent });

    const view = controller.getMap().getView();
    assert.ok(view.getResolution()! > 0, 'Resolution must be set via fitExtent');

    controller.setViewport({ center: { x: 25, y: 35 }, rotation: 0.15 });
    assert.equal(view.getRotation(), 0.15, 'Rotation must be applied');
  });

  it('fitExtent delegates to view.fit with padding and duration options', () => {
    const rawExtent: [number, number, number, number] = [-10, -5, 10, 5];
    const view = controller.getMap().getView();

    let fitOptions: any = null;
    let fitExtentPassed: any = null;
    view.fit = (ext: any, opts: any) => {
      fitExtentPassed = ext;
      fitOptions = opts;
    };

    controller.fitExtent(rawExtent, { padding: [8, 8, 8, 8], duration: 200 });
    assert.ok(fitExtentPassed);
    assert.ok(fitOptions);
    assert.deepEqual(fitOptions.padding, [8, 8, 8, 8]);
    assert.equal(fitOptions.duration, 200);
  });

  it('ignores pointermove events while dragging without evaluating lazy coordinate or pixel getters', () => {
    cursorCoordsSignal.value = null;
    let coordinateAccessed = false;
    let pixelAccessed = false;

    const dragEvent: any = {
      type: 'pointermove',
      dragging: true,
    };
    Object.defineProperty(dragEvent, 'coordinate', {
      get() {
        coordinateAccessed = true;
        return fromLonLat([10, 20]);
      },
    });
    Object.defineProperty(dragEvent, 'pixel', {
      get() {
        pixelAccessed = true;
        return [100, 200];
      },
    });

    const map = controller.getMap() as any;
    map.dispatchEvent(dragEvent);

    assert.equal(
      coordinateAccessed,
      false,
      'evt.coordinate getter must not be accessed when evt.dragging is true'
    );
    assert.equal(
      pixelAccessed,
      false,
      'evt.pixel getter must not be accessed when evt.dragging is true'
    );
    assert.equal(
      cursorCoordsSignal.value,
      null,
      'cursorCoordsSignal must not be updated while dragging'
    );
  });

  it('updates cursorCoordsSignal synchronously on non-dragging pointermove without scheduling requestAnimationFrame', () => {
    const origRaf = (globalThis as any).requestAnimationFrame;
    let rafScheduled = false;

    (globalThis as any).requestAnimationFrame = () => {
      rafScheduled = true;
      return 1;
    };

    cursorCoordsSignal.value = null;

    try {
      const map = controller.getMap() as any;
      map.dispatchEvent({
        type: 'pointermove',
        dragging: false,
        coordinate: fromLonLat([-75.5, 40.25]),
        pixel: [320, 480],
      });

      assert.equal(
        rafScheduled,
        false,
        'pointermove must not defer cursorCoordsSignal into requestAnimationFrame'
      );
      assert.deepEqual(cursorCoordsSignal.value, {
        lon: -75.5,
        lat: 40.25,
        x: 320,
        y: 480,
      });
    } finally {
      (globalThis as any).requestAnimationFrame = origRaf;
    }
  });
});

describe('extractStyleAttributes', () => {
  it('returns empty Set for null, undefined, primitives, or styles without attribute expressions', () => {
    assert.equal(extractStyleAttributes(null).size, 0);
    assert.equal(extractStyleAttributes(undefined).size, 0);
    assert.equal(extractStyleAttributes('color').size, 0);
    assert.equal(extractStyleAttributes(123).size, 0);
    assert.equal(extractStyleAttributes({ 'fill-color': '#ff0000', 'stroke-width': 2 }).size, 0);
  });

  it('extracts attribute name from a single get expression', () => {
    const style = {
      'text-value': ['get', 'name'],
    };
    const extracted = extractStyleAttributes(style);
    assert.equal(extracted.size, 1);
    assert.ok(extracted.has('name'));
  });

  it('extracts all attribute names from nested conditional and interpolation expressions', () => {
    const style = {
      'fill-color': [
        'case',
        ['>', ['get', 'population'], 1000000],
        '#ff0000',
        ['<', ['get', 'population'], 10000],
        '#00ff00',
        ['get', 'default_color'],
      ],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'elevation'],
        0,
        4,
        5000,
        20,
      ],
    };
    const extracted = extractStyleAttributes(style);
    assert.equal(extracted.size, 3);
    assert.ok(extracted.has('population'));
    assert.ok(extracted.has('default_color'));
    assert.ok(extracted.has('elevation'));
  });

  it('extracts attribute names across array of rule objects with filters', () => {
    const rules = [
      {
        filter: ['==', ['get', 'featureclass'], 'Lake'],
        style: {
          'fill-color': '#0000ff',
          'stroke-width': ['get', 'boundary_width'],
        },
      },
      {
        filter: ['==', ['get', 'status'], 'active'],
        style: {
          'stroke-color': '#00ff00',
        },
      },
    ];
    const extracted = extractStyleAttributes(rules);
    assert.equal(extracted.size, 3);
    assert.ok(extracted.has('featureclass'));
    assert.ok(extracted.has('boundary_width'));
    assert.ok(extracted.has('status'));
  });

  it('extracts attribute names from ProjectLayerStyleItem container with content JSON', () => {
    const wrapper = {
      content: JSON.stringify({
        'stroke-color': ['get', 'road_color'],
        'stroke-width': ['get', 'road_lanes'],
      }),
      format: 'openlayers' as const,
    };
    const extracted = extractStyleAttributes(wrapper);
    assert.equal(extracted.size, 2);
    assert.ok(extracted.has('road_color'));
    assert.ok(extracted.has('road_lanes'));
  });

  it('returns empty Set for ProjectLayerStyleItem with href reference or invalid JSON', () => {
    const hrefWrapper = { href: '#external-style', format: 'openlayers' as const };
    assert.equal(extractStyleAttributes(hrefWrapper).size, 0);

    const invalidWrapper = { content: 'not valid json', format: 'openlayers' as const };
    assert.equal(extractStyleAttributes(invalidWrapper).size, 0);
  });

  it('extracts attribute names from SLD 1.0.0 and 1.1.0 ProjectLayerStyleItem containers', () => {
    const sldWrapper = {
      format: 'sld' as const,
      version: '1.1.0' as const,
      content: `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.1.0" xmlns="http://www.opengis.net/sld" xmlns:se="http://www.opengis.net/se" xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer>
    <se:Name>Rivers</se:Name>
    <UserStyle>
      <se:FeatureTypeStyle>
        <se:Rule>
          <ogc:Filter>
            <ogc:PropertyIsGreaterThan>
              <ogc:PropertyName>scalerank</ogc:PropertyName>
              <ogc:Literal>2</ogc:Literal>
            </ogc:PropertyIsGreaterThan>
          </ogc:Filter>
          <se:TextSymbolizer>
            <se:Label><ogc:PropertyName>river_name</ogc:PropertyName></se:Label>
          </se:TextSymbolizer>
        </se:Rule>
      </se:FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`,
    };

    const extracted = extractStyleAttributes(sldWrapper);
    assert.equal(extracted.size, 2);
    assert.ok(extracted.has('scalerank'));
    assert.ok(extracted.has('river_name'));
  });
});

describe('MapController SLD Compilation & Delayed Field-Subset Reload', () => {
  let container: any;
  let controller: MapController;

  beforeEach(() => {
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    currentProjectSignal.value = null;
    container = (globalThis as any).document.createElement('div');
    controller = new MapController(container);
  });

  afterEach(() => {
    controller.dispose();
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    currentProjectSignal.value = null;
    (globalThis as any).window.electronAPI = undefined;
  });

  it('compiles SLD 1.0.0 and 1.1.0 styles via SldStyleParser and OlStyleParser and applies them to VectorImageLayer', async () => {
    const sld100 = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
  <NamedLayer>
    <Name>Polygons</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#336699</CssParameter></Fill>
          </PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;

    const descriptor: LayerDescriptor = {
      id: 'layer-sld-100',
      name: 'SLD 1.0.0 Layer',
      type: 'geojson',
      source: '/path/to/poly.geojson',
      geometryKind: 'Polygon',
      layerKind: 'vector',
      style: {
        content: sld100,
        format: 'sld',
        version: '1.0.0',
      },
      extent: [-90, 40, -80, 50],
      featureCount: 2,
    };

    projectLayersSignal.value = [descriptor];
    await controller.waitForPendingStyleUpdates();

    const entry = controller.getLayer('layer-sld-100')!;
    assert.ok(entry);
    const appliedStyle100 = entry.layer.getStyle();
    assert.ok(
      typeof appliedStyle100 === 'function' || typeof appliedStyle100 === 'object',
      'SLD 1.0.0 must compile to an OpenLayers Style or style function'
    );
    assert.equal(Array.isArray(appliedStyle100), false, 'Compiled SLD style must not be a raw flat style rule array');

    // Switch to SLD 1.1.0 via layerStylesSignal
    const sld110 = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.1.0" xmlns="http://www.opengis.net/sld" xmlns:se="http://www.opengis.net/se">
  <NamedLayer>
    <se:Name>Lines</se:Name>
    <UserStyle>
      <se:FeatureTypeStyle>
        <se:Rule>
          <se:LineSymbolizer>
            <se:Stroke><se:SvgParameter name="stroke">#cc0000</se:SvgParameter></se:Stroke>
          </se:LineSymbolizer>
        </se:Rule>
      </se:FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;

    layerStylesSignal.value = {
      'layer-sld-100': {
        content: sld110,
        format: 'sld',
        version: '1.1.0',
      } as any,
    };
    await controller.waitForPendingStyleUpdates();

    const appliedStyle110 = entry.layer.getStyle();
    assert.ok(appliedStyle110);
    assert.notEqual(appliedStyle110, appliedStyle100, 'Layer style must update when SLD 1.1.0 is applied');
  });

  it('applies new style immediately without re-querying Main when requiredFields is a subset of loadedFields', async () => {
    let queryCount = 0;
    const pointWkb = new Uint8Array([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 240, 63, 0, 0, 0, 0, 0, 0, 0, 64]);

    layerStylesSignal.value = {
      'layer-subset': {
        'circle-radius': ['get', 'scalerank'],
        'circle-fill-color': ['get', 'category'],
      },
    };

    (globalThis as any).window.electronAPI = {
      queryExtent: async (_layerId: string, _options: any) => {
        queryCount++;
        return {
          layerId: 'layer-subset',
          buffer: createMockBinaryPacket([
            { fid: 1, wkb: pointWkb, properties: { scalerank: 4, category: 'major' } },
          ]),
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-subset',
      name: 'Subset Layer',
      type: 'shp',
      source: '/path/to/subset.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-subset')!;
    await controller.loadFeaturesForExtent(descriptor, entry.source, [-100, 30, -70, 60], 'EPSG:3857');
    assert.equal(queryCount, 1);
    assert.ok(entry.loadedFields.has('scalerank'));
    assert.ok(entry.loadedFields.has('category'));

    // Apply a new style requiring only 'scalerank' (subset of {'scalerank', 'category'})
    const subsetStyle = {
      'circle-radius': ['get', 'scalerank'],
      'circle-fill-color': '#123456',
    };
    layerStylesSignal.value = {
      'layer-subset': subsetStyle,
    };

    // Must be applied immediately and must NOT trigger another queryExtent call
    assert.deepEqual(entry.layer.getStyle(), subsetStyle);
    assert.equal(queryCount, 1, 'queryExtent must not be called when requiredFields ⊆ loadedFields');
  });

  it('delays layer.setStyle until layers:queryExtent reloads missing fields when requiredFields is not a subset of loadedFields', async () => {
    let queryCount = 0;
    let lastRequestedFields: string[] | undefined;
    let resolvePendingQuery: (() => void) | null = null;
    const pointWkb = new Uint8Array([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 240, 63, 0, 0, 0, 0, 0, 0, 0, 64]);

    const initialStyle = {
      'circle-radius': 6,
      'circle-fill-color': '#333333',
    };
    layerStylesSignal.value = {
      'layer-delayed': initialStyle,
    };

    (globalThis as any).window.electronAPI = {
      queryExtent: async (_layerId: string, options: any) => {
        queryCount++;
        lastRequestedFields = options?.fields;
        if (queryCount === 2) {
          await new Promise<void>((resolve) => {
            resolvePendingQuery = resolve;
          });
        }
        return {
          layerId: 'layer-delayed',
          buffer: createMockBinaryPacket([
            { fid: 10, wkb: pointWkb, properties: { population: 500000 } },
          ]),
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-delayed',
      name: 'Delayed Reload Layer',
      type: 'shp',
      source: '/path/to/delayed.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-delayed')!;
    await controller.loadFeaturesForExtent(descriptor, entry.source, [-100, 30, -70, 60], 'EPSG:3857');
    assert.equal(queryCount, 1);
    assert.equal(entry.loadedFields.has('population'), false);

    // Apply a new style referencing unloaded field 'population'
    const newAttrStyle = {
      'circle-radius': ['get', 'population'],
      'circle-fill-color': '#ff0000',
    };
    layerStylesSignal.value = {
      'layer-delayed': newAttrStyle,
    };

    // While queryExtent #2 is still in-flight, layer.getStyle() MUST still be initialStyle!
    assert.equal(queryCount, 2, 'queryExtent must be invoked to reload missing attribute fields');
    assert.ok(lastRequestedFields?.includes('population'), 'Reload query must request missing field "population"');
    assert.deepEqual(
      entry.layer.getStyle(),
      initialStyle,
      'layer.setStyle must be delayed while missing fields are being reloaded from Main'
    );

    // Now finish the pending queryExtent call
    assert.ok(resolvePendingQuery);
    (resolvePendingQuery as () => void)();
    await controller.waitForPendingStyleUpdates();

    // Now the new style must be applied and 'population' recorded in loadedFields
    assert.deepEqual(entry.layer.getStyle(), newAttrStyle);
    assert.equal(entry.loadedFields.has('population'), true);
    assert.equal(entry.source.getFeatureById(10)?.get('population'), 500000);
  });

  it('reloads missing fields over the full extent for allStrategy layers so features outside the view are not dropped (Ticket #261)', async () => {
    const requestedExtents: number[][] = [];
    const pointWkb = (x: number, y: number): Uint8Array => {
      const bytes = new Uint8Array(21);
      const view = new DataView(bytes.buffer);
      view.setUint8(0, 1);
      view.setUint32(1, 1, true);
      view.setFloat64(5, x, true);
      view.setFloat64(13, y, true);
      return bytes;
    };
    // Feature 2 lies far outside the layer's own extent; the mock honours the requested
    // spatial filter, so it is only returned when the reload queries the full extent.
    const farX = 170;

    (globalThis as any).window.electronAPI = {
      queryExtent: async (_layerId: string, options: any) => {
        const extent: number[] = options?.extent;
        requestedExtents.push(extent);
        const features = [{ fid: 1, wkb: pointWkb(-85, 45), properties: { start_date: 0 } }];
        if (extent[0] <= farX && extent[2] >= farX) {
          features.push({ fid: 2, wkb: pointWkb(farX, 80), properties: { start_date: 0 } });
        }
        return { layerId: 'layer-all', buffer: createMockBinaryPacket(features) };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-all',
      name: 'Small Temporal Layer',
      type: 'shp',
      source: '/path/to/small.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 2,
    };
    layerStylesSignal.value = { 'layer-all': { 'circle-radius': 6 } };
    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-all')!;

    layerStylesSignal.value = { 'layer-all': { 'circle-radius': ['get', 'start_date'] } };
    await controller.waitForPendingStyleUpdates();

    assert.equal(requestedExtents.length, 1, 'Field reload must issue exactly one queryExtent call');
    assert.ok(
      requestedExtents[0].every((v) => !Number.isFinite(v)),
      `Field reload of an allStrategy layer must query the full (infinite) extent, got ${JSON.stringify(requestedExtents[0])}`
    );
    assert.equal(entry.loadedFields.has('start_date'), true);
    assert.equal(
      entry.source.getFeatures().length,
      2,
      'Every feature, including those outside the viewport, must remain loaded after the field reload'
    );
  });

  it('reloads missing fields over a finite viewport extent for bboxStrategy layers (Ticket #261)', async () => {
    const requestedExtents: number[][] = [];

    (globalThis as any).window.electronAPI = {
      queryExtent: async (_layerId: string, options: any) => {
        requestedExtents.push(options?.extent);
        return { layerId: 'layer-bbox', buffer: createMockBinaryPacket([]) };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-bbox',
      name: 'Large Temporal Layer',
      type: 'gpkg',
      source: '/path/to/large.gpkg',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 60000,
    };
    layerStylesSignal.value = { 'layer-bbox': { 'circle-radius': 6 } };
    projectLayersSignal.value = [descriptor];

    layerStylesSignal.value = { 'layer-bbox': { 'circle-radius': ['get', 'start_date'] } };
    await controller.waitForPendingStyleUpdates();

    assert.equal(requestedExtents.length, 1, 'Field reload must issue exactly one queryExtent call');
    assert.ok(
      requestedExtents[0].every((v) => Number.isFinite(v)),
      `Field reload of a bboxStrategy layer must query a finite viewport extent, got ${JSON.stringify(requestedExtents[0])}`
    );
  });

  it('falls back to the 3-rule default random-color style when unstyled or when style compilation fails', async () => {
    const descriptor: LayerDescriptor = {
      id: 'layer-fallback',
      name: 'Fallback Layer',
      type: 'geojson',
      source: '/path/to/fallback.geojson',
      geometryKind: 'Polygon',
      layerKind: 'vector',
      style: {
        content: '<malformed-sld-xml',
        format: 'sld',
      },
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    await controller.waitForPendingStyleUpdates();

    const entry = controller.getLayer('layer-fallback')!;
    const fallbackStyle = entry.layer.getStyle() as any[];
    assert.ok(Array.isArray(fallbackStyle), 'Fallback style must be the 3-rule multi-geometry flat style array');
    assert.equal(fallbackStyle.length, 3);
  });

  it('delays SLD style application until layers:queryExtent reloads unloaded SLD filter/label fields', async () => {
    let queryCount = 0;
    let lastRequestedFields: string[] | undefined;
    let resolvePendingQuery: (() => void) | null = null;
    const pointWkb = new Uint8Array([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 240, 63, 0, 0, 0, 0, 0, 0, 0, 64]);

    const initialStyle = { 'circle-radius': 5, 'circle-fill-color': '#112233' };
    layerStylesSignal.value = { 'layer-sld-delayed': initialStyle };

    (globalThis as any).window.electronAPI = {
      queryExtent: async (_layerId: string, options: any) => {
        queryCount++;
        lastRequestedFields = options?.fields;
        if (queryCount === 2) {
          await new Promise<void>((resolve) => {
            resolvePendingQuery = resolve;
          });
        }
        return {
          layerId: 'layer-sld-delayed',
          buffer: createMockBinaryPacket([
            { fid: 20, wkb: pointWkb, properties: { city_name: 'Ottawa', rank: 1 } },
          ]),
        };
      },
    };

    const descriptor: LayerDescriptor = {
      id: 'layer-sld-delayed',
      name: 'SLD Delayed Layer',
      type: 'shp',
      source: '/path/to/cities.shp',
      geometryKind: 'Point',
      layerKind: 'vector',
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    const entry = controller.getLayer('layer-sld-delayed')!;
    await controller.loadFeaturesForExtent(descriptor, entry.source, [-100, 30, -70, 60], 'EPSG:3857');
    assert.equal(queryCount, 1);

    const sldWithFields = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer>
    <Name>Cities</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>rank</ogc:PropertyName>
              <ogc:Literal>1</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <TextSymbolizer>
            <Label><ogc:PropertyName>city_name</ogc:PropertyName></Label>
          </TextSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;

    layerStylesSignal.value = {
      'layer-sld-delayed': {
        content: sldWithFields,
        format: 'sld',
        version: '1.0.0',
      } as any,
    };

    // Wait until SldStyleParser finishes reading and triggers queryExtent #2
    while (queryCount < 2) {
      await new Promise((r) => setTimeout(r, 5));
    }

    assert.equal(queryCount, 2);
    assert.ok(lastRequestedFields?.includes('rank'));
    assert.ok(lastRequestedFields?.includes('city_name'));
    assert.deepEqual(
      entry.layer.getStyle(),
      initialStyle,
      'SLD style must not be applied before missing fields finish reloading'
    );

    (resolvePendingQuery as unknown as () => void)();
    await controller.waitForPendingStyleUpdates();

    assert.notDeepEqual(entry.layer.getStyle(), initialStyle);
    assert.equal(entry.loadedFields.has('rank'), true);
    assert.equal(entry.loadedFields.has('city_name'), true);
  });

  it('compiles and applies format="cartouche" styles to VectorImageLayer on layer creation and update', async () => {
    const cartoucheJson = JSON.stringify({
      format: 'simple',
      version: 1,
      components: [
        { id: 'fill-1', type: 'simple-fill', enabled: true, color: '#123456' },
        { id: 'line-1', type: 'simple-line', enabled: true, color: '#abcdef', width: 3 }
      ]
    });

    const descriptor: LayerDescriptor = {
      id: 'layer-cartouche-test',
      name: 'Cartouche Layer',
      type: 'geojson',
      source: '/path/to/cartouche.geojson',
      geometryKind: 'Polygon',
      layerKind: 'vector',
      style: {
        content: cartoucheJson,
        format: 'cartouche'
      },
      extent: [-90, 40, -80, 50],
      featureCount: 1,
    };

    projectLayersSignal.value = [descriptor];
    await controller.waitForPendingStyleUpdates();

    const entry = controller.getLayer('layer-cartouche-test');
    assert.ok(entry, 'Layer entry must exist in controller');
    const styleFunction = entry.layer.getStyle() as any;
    assert.equal(typeof styleFunction, 'function', 'Layer style must be compiled into a StyleFunction');

    const styles = styleFunction(new Feature(), 1);
    assert.ok(Array.isArray(styles));
    assert.equal(styles.length, 2);
    assert.equal(styles[0].getFill()?.getColor(), '#123456');
    assert.equal(styles[1].getStroke()?.getColor(), '#abcdef');
    assert.equal(styles[1].getStroke()?.getWidth(), 3);
  });

  describe('Ticket #140: Viewport Lazy Deserialization Bridge for Complex Attributes', () => {
    it('attachFeaturePropertiesWithLazyGetters defines lazy memoizing getters for json and array fields', () => {
      const feature = new Feature();
      const schema = {
        meta: 'json' as const,
        tags: 'string[]' as const,
        scores: 'real[]' as const,
        title: 'string' as const,
        count: 'integer' as const,
      };

      const rawProperties = {
        meta: '{"version":1,"author":"Cory"}',
        tags: '["alpha","beta","gamma"]',
        scores: '[98.5,87.2,91.0]',
        title: 'Test Feature',
        count: 42,
      };

      let jsonParseCount = 0;
      const originalJsonParse = JSON.parse;
      JSON.parse = function (...args: any[]) {
        jsonParseCount++;
        return (originalJsonParse as any).apply(this, args);
      };

      try {
        attachFeaturePropertiesWithLazyGetters(feature, rawProperties, schema);

        // Verify JSON.parse has NOT been called upon feature creation
        assert.equal(jsonParseCount, 0, 'No JSON.parse calls upon property attachment');

        // Access primitive non-lazy properties
        assert.equal(feature.get('title'), 'Test Feature');
        assert.equal(feature.get('count'), 42);
        assert.equal(jsonParseCount, 0, 'Primitive properties must not trigger JSON.parse');

        // Access tags for the first time
        const tags = feature.get('tags');
        assert.deepEqual(tags, ['alpha', 'beta', 'gamma']);
        assert.equal(jsonParseCount, 1, 'First access to tags must invoke JSON.parse once');

        // Access tags a second time -> should use memoized cache
        const tagsAgain = feature.get('tags');
        assert.deepEqual(tagsAgain, ['alpha', 'beta', 'gamma']);
        assert.equal(jsonParseCount, 1, 'Subsequent access to tags must return cached object without JSON.parse');

        // Access meta for the first time
        const meta = feature.get('meta');
        assert.deepEqual(meta, { version: 1, author: 'Cory' });
        assert.equal(jsonParseCount, 2, 'First access to meta must invoke JSON.parse once');

        // scores was never accessed
        assert.equal(jsonParseCount, 2, 'Unaccessed scores property must never invoke JSON.parse');

        // getProperties() returns all properties including memoized lazy properties
        const allProps = feature.getProperties();
        assert.equal(allProps.title, 'Test Feature');
        assert.deepEqual(allProps.tags, ['alpha', 'beta', 'gamma']);
        assert.deepEqual(allProps.meta, { version: 1, author: 'Cory' });
        // Reading scores via getProperties invokes JSON.parse once for scores
        assert.deepEqual(allProps.scores, [98.5, 87.2, 91.0]);
        assert.equal(jsonParseCount, 3, 'Reading scores via getProperties evaluates its lazy getter');
      } finally {
        JSON.parse = originalJsonParse;
      }
    });

    it('attachFeaturePropertiesWithLazyGetters handles corrupted JSON and null values gracefully', () => {
      const feature = new Feature();
      const schema = {
        corrupt_json: 'json' as const,
        null_json: 'json' as const,
      };

      const rawProperties = {
        corrupt_json: '{ invalid json ]',
        null_json: null,
      };

      attachFeaturePropertiesWithLazyGetters(feature, rawProperties, schema);

      // Corrupted JSON returns the raw string without throwing
      assert.equal(feature.get('corrupt_json'), '{ invalid json ]');
      // Null stays null
      assert.equal(feature.get('null_json'), null);
    });

    it('stores fieldSchema on VectorLayerEntry upon syncLayers and createVectorLayer', () => {
      const descriptor: LayerDescriptor = {
        id: 'layer-schema-test',
        name: 'Schema Layer',
        type: 'geojson',
        source: '/path/to/schema.geojson',
        geometryKind: 'Point',
        layerKind: 'vector',
        extent: [-90, 40, -80, 50],
        featureCount: 1,
        fields: [
          { name: 'poi_name', nativeType: 'String', inferredType: 'string' },
          { name: 'tags', nativeType: 'StringList', inferredType: 'string[]' },
          { name: 'metadata', nativeType: 'String', inferredType: 'json' },
        ],
      };

      projectLayersSignal.value = [descriptor];
      const entry = controller.getLayer('layer-schema-test');
      assert.ok(entry, 'VectorLayerEntry must exist');
      assert.ok(entry.fieldSchema, 'fieldSchema must be registered on entry');
      assert.equal(entry.fieldSchema.poi_name, 'string');
      assert.equal(entry.fieldSchema.tags, 'string[]');
      assert.equal(entry.fieldSchema.metadata, 'json');

      // Update schema via syncLayers
      const updatedDescriptor: LayerDescriptor = {
        ...descriptor,
        fields: [
          { name: 'poi_name', nativeType: 'String', inferredType: 'string' },
          { name: 'tags', nativeType: 'StringList', inferredType: 'string[]' },
          { name: 'metadata', nativeType: 'String', inferredType: 'json' },
          { name: 'ratings', nativeType: 'RealList', inferredType: 'real[]' },
        ],
      };

      controller.syncLayers([updatedDescriptor]);
      assert.equal(entry.fieldSchema.ratings, 'real[]');
    });

    it('loadFeaturesForExtent attaches lazy getters for json and array fields deserialized from WKB packet', async () => {
      const pointWkb = new Uint8Array([
        1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36, 64, 0, 0, 0, 0, 0, 0, 41, 64,
      ]);

      const descriptor: LayerDescriptor = {
        id: 'layer-wkb-lazy-test',
        name: 'Lazy WKB Layer',
        type: 'geojson',
        source: '/path/to/lazy.geojson',
        geometryKind: 'Point',
        layerKind: 'vector',
        extent: [-90, 40, -80, 50],
        featureCount: 1,
        fields: [
          { name: 'station_id', nativeType: 'Integer', inferredType: 'integer' },
          { name: 'sensor_readings', nativeType: 'RealList', inferredType: 'real[]' },
          { name: 'config_json', nativeType: 'String', inferredType: 'json' },
        ],
      };

      (window as any).electronAPI = {
        queryExtent: async () => ({
          layerId: 'layer-wkb-lazy-test',
          buffer: createMockBinaryPacket([
            {
              fid: 101,
              wkb: pointWkb,
              properties: {
                station_id: 42,
                sensor_readings: '[21.5,22.1,23.0]',
                config_json: '{"calibrated":true,"model":"X-1"}',
              },
            },
          ]),
        }),
      };

      projectLayersSignal.value = [descriptor];
      const entry = controller.getLayer('layer-wkb-lazy-test')!;
      assert.ok(entry);

      let jsonParseCount = 0;
      const originalJsonParse = JSON.parse;
      JSON.parse = function (...args: any[]) {
        jsonParseCount++;
        return (originalJsonParse as any).apply(this, args);
      };

      try {
        const features = await controller.loadFeaturesForExtent(
          descriptor,
          entry.source,
          [-100, 30, -70, 60],
          'EPSG:3857'
        );

        assert.equal(features.length, 1);
        const feat = features[0];

        // During extent loading: WKB packet decoder calls JSON.parse on propsSlice (once per feature payload)
        const parseCountAfterLoad = jsonParseCount;
        assert.equal(parseCountAfterLoad, 1, 'Only one JSON.parse call to decode WKB property slice');

        // Access station_id (scalar)
        assert.equal(feat.get('station_id'), 42);
        assert.equal(jsonParseCount, parseCountAfterLoad, 'Scalar field does not invoke JSON.parse');

        // Access sensor_readings for the first time
        const readings = feat.get('sensor_readings');
        assert.deepEqual(readings, [21.5, 22.1, 23.0]);
        assert.equal(jsonParseCount, parseCountAfterLoad + 1, 'First access to sensor_readings triggers lazy JSON.parse');

        // Access sensor_readings second time (memoized)
        const readings2 = feat.get('sensor_readings');
        assert.deepEqual(readings2, [21.5, 22.1, 23.0]);
        assert.equal(jsonParseCount, parseCountAfterLoad + 1, 'Second access to sensor_readings uses memoized cache');

        // config_json was never accessed
        assert.equal(jsonParseCount, parseCountAfterLoad + 1, 'Unread config_json remains unparsed');
      } finally {
        JSON.parse = originalJsonParse;
      }
    });
  });

  describe('Ticket #221: Screen-Anchored Gradient Fill Viewport Navigation Invalidation and Re-Anchoring', () => {
    let container: any;
    let controller: MapController;

    beforeEach(() => {
      projectLayersSignal.value = [];
      layerStylesSignal.value = {};
      currentProjectSignal.value = null;

      container = (globalThis as any).document.createElement('div');
      controller = new MapController(container);
    });

    afterEach(() => {
      controller.dispose();
      projectLayersSignal.value = [];
      layerStylesSignal.value = {};
      currentProjectSignal.value = null;
    });

    it('tracks hasGradientFill on vector layers configured with Cartouche gradient fill styles', () => {
      const gradientStyle = {
        version: 1,
        format: 'simple' as const,
        components: [
          {
            type: 'gradient-fill' as const,
            id: 'grad-1',
            enabled: true,
            angle: 45,
            stops: ['#ffffff 0%', '#3388ff 100%'],
          },
        ],
      };

      const plainStyle = {
        version: 1,
        format: 'simple' as const,
        components: [
          {
            type: 'simple-fill' as const,
            id: 'fill-1',
            enabled: true,
            color: '#ff0000',
          },
        ],
      };

      const gradLayerDesc: LayerDescriptor = {
        id: 'layer-grad-1',
        name: 'Gradient Layer',
        type: 'geojson',
        source: '/path/to/grad.geojson',
        geometryKind: 'Polygon',
        layerKind: 'vector',
        style: gradientStyle,
        extent: [-100, 30, -70, 60],
        featureCount: 10,
      };

      const plainLayerDesc: LayerDescriptor = {
        id: 'layer-plain-1',
        name: 'Plain Layer',
        type: 'geojson',
        source: '/path/to/plain.geojson',
        geometryKind: 'Polygon',
        layerKind: 'vector',
        style: plainStyle,
        extent: [-100, 30, -70, 60],
        featureCount: 10,
      };

      const gradEntry = controller.createVectorLayer(gradLayerDesc);
      const plainEntry = controller.createVectorLayer(plainLayerDesc);

      assert.equal(gradEntry.hasGradientFill, true, 'Layer with gradient-fill component must have hasGradientFill === true');
      assert.equal(plainEntry.hasGradientFill, false, 'Layer with simple-fill component must have hasGradientFill === false');
    });

    it('triggers changed() on gradient fill layers upon moveend and change:size events', () => {
      const gradientStyle = {
        version: 1,
        format: 'simple' as const,
        components: [
          {
            type: 'gradient-fill' as const,
            id: 'grad-2',
            enabled: true,
            angle: 90,
            stops: ['#ffffff 0%', '#000000 100%'],
          },
        ],
      };

      const plainStyle = {
        version: 1,
        format: 'simple' as const,
        components: [
          {
            type: 'simple-fill' as const,
            id: 'fill-2',
            enabled: true,
            color: '#00ff00',
          },
        ],
      };

      const gradEntry = controller.createVectorLayer({
        id: 'layer-grad-2',
        name: 'Gradient 2',
        type: 'geojson',
        source: '/path/to/grad2.geojson',
        geometryKind: 'Polygon',
        layerKind: 'vector',
        style: gradientStyle,
        extent: [-100, 30, -70, 60],
        featureCount: 10,
      });

      const plainEntry = controller.createVectorLayer({
        id: 'layer-plain-2',
        name: 'Plain 2',
        type: 'geojson',
        source: '/path/to/plain2.geojson',
        geometryKind: 'Polygon',
        layerKind: 'vector',
        style: plainStyle,
        extent: [-100, 30, -70, 60],
        featureCount: 10,
      });

      let gradChangedCount = 0;
      let plainChangedCount = 0;

      const origGradChanged = gradEntry.layer.changed.bind(gradEntry.layer);
      gradEntry.layer.changed = () => {
        gradChangedCount++;
        origGradChanged();
      };

      const origPlainChanged = plainEntry.layer.changed.bind(plainEntry.layer);
      plainEntry.layer.changed = () => {
        plainChangedCount++;
        origPlainChanged();
      };

      // Dispatch moveend on OpenLayers Map
      controller.getMap().dispatchEvent('moveend');

      assert.equal(gradChangedCount, 1, 'Gradient layer changed() must be called on moveend');
      assert.equal(plainChangedCount, 0, 'Plain layer changed() must NOT be called on moveend');

      // Dispatch change:size on OpenLayers Map
      controller.getMap().dispatchEvent('change:size');

      assert.equal(gradChangedCount, 2, 'Gradient layer changed() must be called on change:size');
      assert.equal(plainChangedCount, 0, 'Plain layer changed() must NOT be called on change:size');
    });

    it('bypasses style invalidation and layer.changed() during active pointerdrag gestures to preserve 60 FPS pan performance', () => {
      const gradientStyle = {
        version: 1,
        format: 'simple' as const,
        components: [
          {
            type: 'gradient-fill' as const,
            id: 'grad-3',
            enabled: true,
            angle: 0,
            stops: ['#ffff00 0%', '#ff0000 100%'],
          },
        ],
      };

      const gradEntry = controller.createVectorLayer({
        id: 'layer-grad-3',
        name: 'Gradient 3',
        type: 'geojson',
        source: '/path/to/grad3.geojson',
        geometryKind: 'Polygon',
        layerKind: 'vector',
        style: gradientStyle,
        extent: [-100, 30, -70, 60],
        featureCount: 10,
      });

      let gradChangedCount = 0;
      const origGradChanged = gradEntry.layer.changed.bind(gradEntry.layer);
      gradEntry.layer.changed = () => {
        gradChangedCount++;
        origGradChanged();
      };

      // Dispatch pointerdrag on OpenLayers Map (simulating active mouse dragging during pan)
      controller.getMap().dispatchEvent('pointerdrag');

      assert.equal(gradChangedCount, 0, 'layer.changed() must NOT be called during active pointerdrag gestures');
    });

    it('updates hasGradientFill dynamically when layer style transitions to and from gradient-fill', () => {
      const plainStyle = {
        version: 1,
        format: 'simple' as const,
        components: [
          {
            type: 'simple-fill' as const,
            id: 'fill-dyn',
            enabled: true,
            color: '#123456',
          },
        ],
      };

      const entry = controller.createVectorLayer({
        id: 'layer-dyn-1',
        name: 'Dynamic Style Layer',
        type: 'geojson',
        source: '/path/to/dyn.geojson',
        geometryKind: 'Polygon',
        layerKind: 'vector',
        style: plainStyle,
        extent: [-100, 30, -70, 60],
        featureCount: 10,
      });

      assert.equal(entry.hasGradientFill, false);

      // Transition to gradient fill style
      const gradientStyle = {
        version: 1,
        format: 'simple' as const,
        components: [
          {
            type: 'gradient-fill' as const,
            id: 'grad-dyn',
            enabled: true,
            angle: 180,
            stops: ['#ffffff 0%', '#0000ff 100%'],
          },
        ],
      };

      controller.applyLayerStyles({ 'layer-dyn-1': gradientStyle });
      assert.equal(entry.hasGradientFill, true, 'hasGradientFill transitions to true when gradient style is applied');

      // Transition back to solid flat style
      const flatStyle = {
        'fill-color': '#abcdef',
      };

      controller.applyLayerStyles({ 'layer-dyn-1': flatStyle });
      assert.equal(entry.hasGradientFill, false, 'hasGradientFill transitions to false when flat style is applied');
    });
  });
});

describe('MapController draws in the Project CRS (Ticket #278)', () => {
  let controller: MapController | null = null;
  const LAMBERT_93 = '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
  const newContainer = () => (globalThis as any).document.createElement('div');

  beforeEach(() => {
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    currentProjectSignal.value = null;
    projectCrsSignal.value = null;
  });

  afterEach(() => {
    controller?.dispose();
    controller = null;
    projectCrsSignal.value = null;
    currentProjectSignal.value = null;
  });

  it('starts in EPSG:3857 without a Project CRS and in the Project CRS when one is set', () => {
    controller = new MapController(newContainer());
    assert.equal(controller.getView().getProjection().getCode(), 'EPSG:3857');
    controller.dispose();

    projectCrsSignal.value = { authId: 'EPSG:2154', proj4: LAMBERT_93 };
    controller = new MapController(newContainer());
    assert.equal(controller.getView().getProjection().getCode(), 'EPSG:2154');
  });

  it('switches the view to a new Project CRS and keeps the camera on the same place', async () => {
    controller = new MapController(newContainer());
    controller.getMap().setSize([800, 600]);
    controller.getView().fit(transformExtent([2, 45, 4, 47], 'EPSG:4326', 'EPSG:3857'), { size: [800, 600] });
    const before = transform(controller.getView().getCenter()!, 'EPSG:3857', 'EPSG:4326');

    projectCrsSignal.value = { authId: 'EPSG:4326' };
    await controller.whenDisplayCrsSettled();
    assert.equal(controller.getView().getProjection().getCode(), 'EPSG:4326');
    const after = controller.getView().getCenter()!;
    assert.ok(Math.abs(after[0] - before[0]) < 0.05 && Math.abs(after[1] - before[1]) < 0.05, `camera kept: ${before} vs ${after}`);
  });

  it('draws raw cartesian coordinates under No CRS', async () => {
    controller = new MapController(newContainer());
    projectCrsSignal.value = { authId: '', none: true };
    await controller.whenDisplayCrsSettled();
    assert.equal(controller.getView().getProjection().getCode(), NO_CRS_CODE);
    assert.equal(controller.getDisplayCrs().none, true);
  });

  it('saves <viewport> in Project CRS units, and in lon/lat for projects without a Project CRS', async () => {
    controller = new MapController(newContainer());
    controller.getMap().setSize([800, 600]);
    const legacy = controller.getViewportForSave()!;
    assert.ok(legacy.extent!.xmin >= -180 && legacy.extent!.xmax <= 180, 'lon/lat without a Project CRS');

    projectCrsSignal.value = { authId: 'EPSG:2154', proj4: LAMBERT_93 };
    await controller.whenDisplayCrsSettled();
    controller.getView().fit([600000, 6500000, 800000, 6700000], { size: [800, 600] });
    const projected = controller.getViewportForSave()!;
    assert.ok(projected.center!.x > 600000 && projected.center!.x < 800000, 'centre in Lambert-93 metres');
    assert.ok(projected.center!.y > 6500000 && projected.center!.y < 6700000);
  });

  it('applies a Project CRS viewport after the view has switched, and reads legacy viewports as lon/lat', async () => {
    controller = new MapController(newContainer());
    controller.getMap().setSize([800, 600]);
    // Legacy: lon/lat centre on an EPSG:3857 view
    controller.setViewport({ units: 'lonlat', center: { x: 10, y: 50 } });
    const legacyCentre = transform(controller.getView().getCenter()!, 'EPSG:3857', 'EPSG:4326');
    assert.ok(Math.abs(legacyCentre[0] - 10) < 1e-6 && Math.abs(legacyCentre[1] - 50) < 1e-6);

    // Project units: deferred until the view is in the Project CRS
    projectCrsSignal.value = { authId: 'EPSG:2154', proj4: LAMBERT_93 };
    controller.setViewport({ units: 'project', center: { x: 700000, y: 6600000 } });
    await controller.whenDisplayCrsSettled();
    const c = controller.getView().getCenter()!;
    assert.ok(Math.abs(c[0] - 700000) < 1e-6 && Math.abs(c[1] - 6600000) < 1e-6, `pending project viewport applied: ${c}`);
  });
});
