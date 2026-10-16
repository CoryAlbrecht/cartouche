/**
 * @file MapController.test.ts
 * @module tests/renderer/map/MapController.test
 * @description Unit and integration tests for MapController isolated OpenLayers lifecycle, vector layer instantiation, WKB streaming loader, feature deduplication, and viewport auto-fitting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-15
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
import { MapController } from '../../../src/renderer/map/MapController';
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
});

