/**
 * @file MapControllerReactivity.test.ts
 * @module tests/renderer/map/MapControllerReactivity.test
 * @description Unit and integration tests for MapController visual reactivity: dynamic tree stacking order (zIndex = 1000 - flatIndex), 60 FPS live styling updates, layer/group visibility cascading, and opacity adjustments.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link MapController}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import {
  projectLayersSignal,
  layerStylesSignal,
  projectTreeSignal,
  projectVisibleSignal,
  currentProjectSignal,
} from '../../../src/renderer/state/projectSignals';
import { MapController } from '../../../src/renderer/map/MapController';
import type {
  LayerDescriptor,
  ProjectGroupItem,
} from '../../../src/shared/types';

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

describe('MapController Reactivity & Visual Synchronization', () => {
  let container: any;
  let controller: MapController;

  const desc1: LayerDescriptor = {
    id: 'layer-top',
    name: 'Top Layer',
    type: 'geojson',
    source: '/path/to/top.geojson',
    geometryKind: 'Point',
    layerKind: 'vector',
    extent: [-90, 40, -80, 50],
    featureCount: 5,
  };

  const desc2: LayerDescriptor = {
    id: 'layer-middle',
    name: 'Middle Layer',
    type: 'geojson',
    source: '/path/to/middle.geojson',
    geometryKind: 'Polygon',
    layerKind: 'vector',
    extent: [-90, 40, -80, 50],
    featureCount: 10,
  };

  const desc3: LayerDescriptor = {
    id: 'layer-bottom',
    name: 'Bottom Layer',
    type: 'geojson',
    source: '/path/to/bottom.geojson',
    geometryKind: 'LineString',
    layerKind: 'vector',
    extent: [-90, 40, -80, 50],
    featureCount: 15,
  };

  beforeEach(() => {
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    projectTreeSignal.value = [];
    projectVisibleSignal.value = true;
    currentProjectSignal.value = null;

    container = (globalThis as any).document.createElement('div');
    controller = new MapController(container);
  });

  afterEach(() => {
    controller.dispose();
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    projectTreeSignal.value = [];
    projectVisibleSignal.value = true;
    currentProjectSignal.value = null;
    (globalThis as any).window.electronAPI = undefined;
  });

  it('computes layer zIndex inversely from flattened tree order (1000 - flatIndex)', () => {
    // Register 3 layers in projectLayersSignal
    projectLayersSignal.value = [desc1, desc2, desc3];

    // Tree order: desc1 (top), desc2 (middle), desc3 (bottom)
    projectTreeSignal.value = [
      { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source },
      { id: desc2.id, name: desc2.name, type: desc2.type, source: desc2.source },
      { id: desc3.id, name: desc3.name, type: desc3.type, source: desc3.source },
    ];

    const entryTop = controller.getLayer(desc1.id)!;
    const entryMid = controller.getLayer(desc2.id)!;
    const entryBtm = controller.getLayer(desc3.id)!;

    assert.ok(entryTop && entryMid && entryBtm);
    assert.equal(entryTop.layer.getZIndex(), 1000, 'Top layer in tree must have zIndex 1000');
    assert.equal(entryMid.layer.getZIndex(), 999, 'Second layer in tree must have zIndex 999');
    assert.equal(entryBtm.layer.getZIndex(), 998, 'Third layer in tree must have zIndex 998');
  });

  it('immediately updates layer zIndex on canvas when layers are reordered or moved into groups', () => {
    projectLayersSignal.value = [desc1, desc2, desc3];

    // Initial tree order: desc1, desc2, desc3
    projectTreeSignal.value = [
      { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source },
      { id: desc2.id, name: desc2.name, type: desc2.type, source: desc2.source },
      { id: desc3.id, name: desc3.name, type: desc3.type, source: desc3.source },
    ];

    const entryTop = controller.getLayer(desc1.id)!;
    const entryMid = controller.getLayer(desc2.id)!;
    const entryBtm = controller.getLayer(desc3.id)!;

    // Now user drags desc3 to top, and groups desc1 and desc2
    const groupItem: ProjectGroupItem = {
      name: 'Group 1',
      children: [
        { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source },
        { id: desc2.id, name: desc2.name, type: desc2.type, source: desc2.source },
      ],
    };

    projectTreeSignal.value = [
      { id: desc3.id, name: desc3.name, type: desc3.type, source: desc3.source },
      groupItem,
    ];

    // Order is now: desc3 (0 -> 1000), desc1 (1 -> 999), desc2 (2 -> 998)
    assert.equal(entryBtm.layer.getZIndex(), 1000, 'Reordered desc3 must now have zIndex 1000');
    assert.equal(entryTop.layer.getZIndex(), 999, 'desc1 inside group must now have zIndex 999');
    assert.equal(entryMid.layer.getZIndex(), 998, 'desc2 inside group must now have zIndex 998');
  });

  it('applies live dynamic Flat Style changes from layerStylesSignal at 60 FPS without clearing feature caches', () => {
    let queryCalls = 0;
    (globalThis as any).window.electronAPI = {
      queryExtent: async () => {
        queryCalls++;
        return { layerId: desc1.id, features: [] };
      },
    };

    projectLayersSignal.value = [desc1];
    projectTreeSignal.value = [
      { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source },
    ];

    const entry = controller.getLayer(desc1.id)!;
    // Pre-populate source with a feature
    const testFeature = new Feature(new Point([0, 0]));
    testFeature.setId('f1');
    entry.source.addFeature(testFeature);

    assert.equal(entry.source.getFeatures().length, 1);
    const initialQueryCalls = queryCalls;

    // Mutate layerStylesSignal with updated styling rules
    const updatedStyle = {
      'circle-radius': 16,
      'circle-fill-color': '#00ff00',
      'circle-stroke-color': '#004400',
      'circle-stroke-width': 3,
    };

    layerStylesSignal.value = {
      [desc1.id]: updatedStyle,
    };

    // Verify style updated on OpenLayers layer
    assert.deepEqual(entry.layer.getStyle(), updatedStyle);

    // Verify feature caches were not invalidated and no IPC queries occurred
    assert.equal(entry.source.getFeatures().length, 1, 'Feature cache must remain intact');
    assert.equal(queryCalls, initialQueryCalls, 'No IPC spatial queries should be triggered on style update');
  });

  it('cascades layer visibility toggles from LayerTreeWidget without clearing feature caches', () => {
    projectLayersSignal.value = [desc1, desc2];

    projectTreeSignal.value = [
      { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source, visible: true },
      { id: desc2.id, name: desc2.name, type: desc2.type, source: desc2.source, visible: true },
    ];

    const entry1 = controller.getLayer(desc1.id)!;
    const entry2 = controller.getLayer(desc2.id)!;

    // Pre-populate features
    entry1.source.addFeature(new Feature(new Point([10, 20])));
    entry2.source.addFeature(new Feature(new Point([30, 40])));

    assert.equal(entry1.layer.getVisible(), true);
    assert.equal(entry2.layer.getVisible(), true);

    // Toggle desc1 to visible: false
    projectTreeSignal.value = [
      { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source, visible: false },
      { id: desc2.id, name: desc2.name, type: desc2.type, source: desc2.source, visible: true },
    ];

    assert.equal(entry1.layer.getVisible(), false, 'desc1 must be hidden');
    assert.equal(entry2.layer.getVisible(), true, 'desc2 must remain visible');
    assert.equal(entry1.source.getFeatures().length, 1, 'Features must remain cached in source');

    // Toggle group visibility off
    const group: ProjectGroupItem = {
      name: 'Folder',
      visible: false,
      children: [
        { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source, visible: true },
        { id: desc2.id, name: desc2.name, type: desc2.type, source: desc2.source, visible: true },
      ],
    };

    projectTreeSignal.value = [group];

    assert.equal(entry1.layer.getVisible(), false, 'Group hidden must hide child layer desc1');
    assert.equal(entry2.layer.getVisible(), false, 'Group hidden must hide child layer desc2');
    assert.equal(entry1.source.getFeatures().length, 1);
    assert.equal(entry2.source.getFeatures().length, 1);

    // Toggle global project visibility off
    projectVisibleSignal.value = false;
    assert.equal(entry1.layer.getVisible(), false);
    assert.equal(entry2.layer.getVisible(), false);
  });

  it('updates layer opacity without invalidating feature caches', () => {
    projectLayersSignal.value = [desc1];
    projectTreeSignal.value = [
      { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source, opacity: 1.0 },
    ];

    const entry = controller.getLayer(desc1.id)!;
    entry.source.addFeature(new Feature(new Point([1, 2])));

    assert.equal(entry.layer.getOpacity(), 1.0);

    // Adjust layer opacity in tree
    projectTreeSignal.value = [
      { id: desc1.id, name: desc1.name, type: desc1.type, source: desc1.source, opacity: 0.65 },
    ];

    assert.equal(entry.layer.getOpacity(), 0.65, 'Layer opacity must update to 0.65');
    assert.equal(entry.source.getFeatures().length, 1, 'Features must remain in source');
  });
});