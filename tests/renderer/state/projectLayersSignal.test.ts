/**
 * @file projectLayersSignal.test.ts
 * @module tests/renderer/state/projectLayersSignal.test
 * @description Unit and integration tests for renderer projectLayersSignal, layerStylesSignal, handleLayerAdded, and onLayerAdded IPC event synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectLayersSignal,
  layerStylesSignal,
  projectTreeSignal,
  hasProjectSignal,
  projectNameSignal,
  activeLayerIdSignal,
  handleLayerAdded
} from '../../../src/renderer/state/projectSignals';
import type { LayerDescriptor } from '../../../src/shared/types';

describe('projectLayersSignal & layerStylesSignal', () => {
  beforeEach(() => {
    projectLayersSignal.value = [];
    layerStylesSignal.value = {};
    projectTreeSignal.value = [];
    hasProjectSignal.value = false;
    projectNameSignal.value = null;
    activeLayerIdSignal.value = null;
  });

  it('initializes projectLayersSignal as empty array and layerStylesSignal as empty map', () => {
    assert.deepEqual(projectLayersSignal.value, []);
    assert.deepEqual(layerStylesSignal.value, {});
  });

  it('handleLayerAdded populates projectLayersSignal, layerStylesSignal, and projectTreeSignal', () => {
    const descriptor: LayerDescriptor = {
      id: 'layer-lakes-1',
      name: 'Lakes',
      type: 'esri-shapefile',
      source: '/path/to/ne_10m_lakes.shp',
      layerKind: 'vector',
      geometryKind: 'Polygon',
      extent: [-165.96, -50.66, 177.15, 81.95],
      featureCount: 1353,
      visible: true,
      style: {
        'fill-color': '#1e293b',
        'stroke-color': '#1b446c',
        'stroke-width': 4
      }
    };

    handleLayerAdded(descriptor);

    assert.equal(projectLayersSignal.value.length, 1);
    assert.equal(projectLayersSignal.value[0].id, 'layer-lakes-1');
    assert.equal(projectLayersSignal.value[0].featureCount, 1353);
    assert.equal(projectLayersSignal.value[0].geometryKind, 'Polygon');

    assert.deepEqual(layerStylesSignal.value['layer-lakes-1'], {
      'fill-color': '#1e293b',
      'stroke-color': '#1b446c',
      'stroke-width': 4
    });

    // Verify added to tree
    assert.equal(projectTreeSignal.value.length, 1);
    assert.equal(projectTreeSignal.value[0].id, 'layer-lakes-1');

    // Verify active layer and project presence
    assert.equal(activeLayerIdSignal.value, 'layer-lakes-1');
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectNameSignal.value, 'Untitled Project');
  });

  it('handleLayerAdded correctly parses string-encoded flat style rules', () => {
    const descriptor: LayerDescriptor = {
      id: 'layer-rivers-1',
      name: 'Rivers',
      type: 'geojson',
      source: '/data/rivers.geojson',
      layerKind: 'vector',
      geometryKind: 'LineString',
      extent: [-100, 20, -80, 45],
      featureCount: 42,
      style: JSON.stringify({
        'stroke-color': '#0284c7',
        'stroke-width': 2
      })
    };

    handleLayerAdded(descriptor);

    assert.deepEqual(layerStylesSignal.value['layer-rivers-1'], {
      'stroke-color': '#0284c7',
      'stroke-width': 2
    });
  });

  it('handleLayerAdded updates existing layer descriptor and styles in-place', () => {
    const d1: LayerDescriptor = {
      id: 'layer-1',
      name: 'Layer One',
      type: 'geojson',
      source: '/data/l1.json',
      layerKind: 'vector',
      geometryKind: 'Point',
      extent: [0, 0, 10, 10],
      featureCount: 50,
      style: { 'circle-radius': 8, 'circle-fill-color': '#0369a1' }
    };

    handleLayerAdded(d1);
    assert.equal(projectLayersSignal.value.length, 1);
    assert.equal(projectLayersSignal.value[0].name, 'Layer One');

    const d1Updated: LayerDescriptor = {
      ...d1,
      name: 'Layer One Renamed',
      featureCount: 75,
      style: { 'circle-radius': 12, 'circle-fill-color': '#ff0000' }
    };

    handleLayerAdded(d1Updated);
    assert.equal(projectLayersSignal.value.length, 1);
    assert.equal(projectLayersSignal.value[0].name, 'Layer One Renamed');
    assert.equal(projectLayersSignal.value[0].featureCount, 75);
    assert.deepEqual(layerStylesSignal.value['layer-1'], {
      'circle-radius': 12,
      'circle-fill-color': '#ff0000'
    });
  });
});

