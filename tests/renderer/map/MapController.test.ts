/**
 * @file MapController.test.ts
 * @module tests/renderer/map/MapController.test
 * @description Unit and integration tests for MapController isolated OpenLayers lifecycle, vector layer instantiation, WKB streaming loader, feature deduplication, and viewport auto-fitting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @see {@link MapController}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectLayersSignal,
  layerStylesSignal,
  currentProjectSignal,
} from '../../../src/renderer/state/projectSignals';
import {
  MapController,
  extractStyleAttributes,
} from '../../../src/renderer/map/MapController';
import { generateDefaultVectorStyleJson } from '../../../src/shared/styles/defaultLayerStyles';
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
    (globalThis as any).window.electronAPI = undefined;
  });

  it('mounts OpenLayers map in unmanaged container with default EPSG:3857 view', () => {
    assert.equal(controller.getContainer(), container);
    assert.ok(controller.getMap(), 'Map instance must be initialized');

    const view = controller.getView();
    assert.ok(view, 'View instance must be initialized');
    assert.equal(view.getProjection().getCode(), 'EPSG:3857');
    assert.equal(view.getZoom(), 3);
  });

  it('instantiates VectorLayer and VectorSource backed by bboxStrategy on layer addition', () => {
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
    assert.ok(entry.layer, 'OpenLayers VectorLayer must exist');
    assert.ok(entry.source, 'OpenLayers VectorSource must exist');
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
});

