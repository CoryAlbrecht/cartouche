/**
 * @file activeLayerLifecycle.test.ts
 * @module tests/renderer/state/activeLayerLifecycle.test
 * @description Unit tests for Active Layer lifecycle, separation from Selected Layer, batch ingestion activation, and deletion reset (Ticket #92, ADR 0016).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @see {@link activeLayerIdSignal}
 * @see {@link selectedNodeIdsSignal}
 * @see docs/adr/0016-active-layer-vs-selected-layer-and-tree-node-title.md (ADR 0016)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectTreeSignal,
  activeLayerIdSignal,
  setActiveLayer,
  selectedNodeIdsSignal,
  selectSingleNode,
  clearNodeSelection,
  handleLayerAdded,
  projectLayersSignal
} from '../../../src/renderer/state/projectSignals';
import {
  activeLayerSignal,
  layersSignal,
  selectedFeatureIdsSignal,
  editedFeatureIdsSignal,
  editableLayerIdsSignal,
  toggleLayerEditingAction,
  saveActiveLayerAction
} from '../../../src/renderer/state/gisSignals';
import type { ProjectLayerItem, ProjectGroupItem, LayerDescriptor } from '../../../src/shared/types';

describe('Active Layer Lifecycle and Selection Separation (Ticket #92, ADR 0016)', () => {
  beforeEach(() => {
    projectTreeSignal.value = [];
    projectLayersSignal.value = [];
    activeLayerIdSignal.value = null;
    clearNodeSelection();
  });

  it('initializes with activeLayerIdSignal = null on project load without auto-activating the first layer', () => {
    const l1: ProjectLayerItem = { id: 'l1', name: 'Layer 1', type: 'vector', source: '' };
    const l2: ProjectLayerItem = { id: 'l2', name: 'Layer 2', type: 'vector', source: '' };

    // Setting tree representing project load
    projectTreeSignal.value = [l1, l2];

    // Per ADR 0016 and Acceptance Criteria 8, activeLayerIdSignal must remain null upon project open
    assert.strictEqual(activeLayerIdSignal.value, null, 'Active layer must be null upon project open');
  });

  it('sets the newly added layer as active on single layer ingestion', () => {
    const desc1: LayerDescriptor = {
      id: 'layer-roads',
      name: 'Roads',
      type: 'vector',
      source: '/data/roads.shp',
      geometryKind: 'LineString',
      featureCount: 150,
      extent: [0, 0, 10, 10]
    };

    handleLayerAdded(desc1);
    assert.strictEqual(activeLayerIdSignal.value, 'layer-roads', 'Newly added layer must become active');
  });

  it('sets the last added layer as active on batch layer ingestion', () => {
    const desc1: LayerDescriptor = {
      id: 'batch-l1',
      name: 'Layer 1',
      type: 'vector',
      source: '/data/l1.shp',
      geometryKind: 'Polygon',
      featureCount: 10,
      extent: [0, 0, 10, 10]
    };
    const desc2: LayerDescriptor = {
      id: 'batch-l2',
      name: 'Layer 2',
      type: 'vector',
      source: '/data/l2.shp',
      geometryKind: 'Point',
      featureCount: 20,
      extent: [0, 0, 10, 10]
    };
    const desc3: LayerDescriptor = {
      id: 'batch-l3',
      name: 'Layer 3',
      type: 'vector',
      source: '/data/l3.shp',
      geometryKind: 'LineString',
      featureCount: 30,
      extent: [0, 0, 10, 10]
    };

    // Sequential batch ingestion
    handleLayerAdded(desc1);
    handleLayerAdded(desc2);
    handleLayerAdded(desc3);

    assert.strictEqual(
      activeLayerIdSignal.value,
      'batch-l3',
      'Last layer in the ingested batch must become active'
    );
  });

  it('does not mutate activeLayerIdSignal when node selection changes', () => {
    const l1: ProjectLayerItem = { id: 'l1', name: 'Layer 1', type: 'vector', source: '' };
    const l2: ProjectLayerItem = { id: 'l2', name: 'Layer 2', type: 'vector', source: '' };
    const g1: ProjectGroupItem = { id: 'g1', name: 'Group 1', children: [] };
    projectTreeSignal.value = [l1, l2, g1];

    // Explicitly designate l1 as active
    setActiveLayer('l1');
    assert.strictEqual(activeLayerIdSignal.value, 'l1');

    // Selecting l2 must change selection without changing active layer
    selectSingleNode('l2');
    assert.deepEqual(selectedNodeIdsSignal.value, ['l2']);
    assert.strictEqual(activeLayerIdSignal.value, 'l1', 'Active layer must remain l1 despite selecting l2');

    // Selecting group g1 must not clear active layer programmatically
    selectSingleNode('g1');
    assert.deepEqual(selectedNodeIdsSignal.value, ['g1']);
    assert.strictEqual(activeLayerIdSignal.value, 'l1', 'Active layer must remain l1');

    // Clearing selection must not clear active layer
    clearNodeSelection();
    assert.deepEqual(selectedNodeIdsSignal.value, []);
    assert.strictEqual(activeLayerIdSignal.value, 'l1', 'Active layer must remain l1 when selection is cleared');
  });

  it('resets activeLayerIdSignal to null when the active layer is deleted from the tree', () => {
    const l1: ProjectLayerItem = { id: 'l1', name: 'Layer 1', type: 'vector', source: '' };
    const l2: ProjectLayerItem = { id: 'l2', name: 'Layer 2', type: 'vector', source: '' };
    projectTreeSignal.value = [l1, l2];

    setActiveLayer('l1');
    assert.strictEqual(activeLayerIdSignal.value, 'l1');

    // Remove l1 from projectTreeSignal
    projectTreeSignal.value = [l2];

    // activeLayerIdSignal must reset to null because l1 no longer exists
    assert.strictEqual(activeLayerIdSignal.value, null, 'Active layer must reset to null when removed');
  });

  it('preserves activeLayerIdSignal when an inactive layer is deleted from the tree', () => {
    const l1: ProjectLayerItem = { id: 'l1', name: 'Layer 1', type: 'vector', source: '' };
    const l2: ProjectLayerItem = { id: 'l2', name: 'Layer 2', type: 'vector', source: '' };
    projectTreeSignal.value = [l1, l2];

    setActiveLayer('l1');
    assert.strictEqual(activeLayerIdSignal.value, 'l1');

    // Remove l2 from projectTreeSignal
    projectTreeSignal.value = [l1];

    // activeLayerIdSignal must remain l1
    assert.strictEqual(activeLayerIdSignal.value, 'l1', 'Active layer must remain l1 when l2 is removed');
  });

  it('synchronizes selectedFeatureIdsSignal changes to Main via window.electronAPI.setFeatureSelection (#182)', () => {
    const calls: Array<{ layerId: string | null; ids: Array<string | number> }> = [];
    const prevWindow = (globalThis as any).window;
    (globalThis as any).window = {
      ...(prevWindow || {}),
      electronAPI: {
        ...(prevWindow?.electronAPI || {}),
        setFeatureSelection: async (layerId: string | null, selectedFeatureIds: Array<string | number>) => {
          calls.push({ layerId, ids: selectedFeatureIds });
        }
      }
    };

    try {
      activeLayerIdSignal.value = 'layer-parcels';
      selectedFeatureIdsSignal.value = new Set(['f-1', 'f-2']);

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].layerId, 'layer-parcels');
      assert.deepEqual(calls[0].ids, ['f-1', 'f-2']);

      selectedFeatureIdsSignal.value = new Set();
      assert.strictEqual(calls.length, 2);
      assert.deepEqual(calls[1].ids, []);
    } finally {
      (globalThis as any).window = prevWindow;
    }
  });

  it('enriches activeLayerSignal with fields schema from projectLayersSignal or projectTreeSignal (#182)', () => {
    layersSignal.value = [
      {
        id: 'layer-cities',
        name: 'Cities',
        kind: 'vector',
        geometryKind: 'Point',
        visible: true,
        opacity: 1,
        color: '#2563eb',
        featureCount: 5
      }
    ];
    projectLayersSignal.value = [
      {
        id: 'layer-cities',
        name: 'Cities',
        type: 'vector',
        source: '/data/cities.geojson',
        geometryKind: 'Point',
        featureCount: 5,
        extent: [0, 0, 10, 10],
        fields: [
          { name: 'city_name', nativeType: 'String', inferredType: 'string', nullable: false },
          { name: 'population', nativeType: 'Integer', inferredType: 'integer', nullable: true }
        ]
      }
    ];

    activeLayerIdSignal.value = 'layer-cities';
    const resolved = activeLayerSignal.value;
    assert.ok(resolved);
    assert.strictEqual(resolved.fields?.length, 2);
    assert.strictEqual(resolved.fields?.[0].name, 'city_name');
  });

  it('preserves editedFeatureIdsSignal when layer edit mode is toggled off via toggleLayerEditingAction (#182)', () => {
    activeLayerIdSignal.value = 'layer-parcels';
    editableLayerIdsSignal.value = new Set(['layer-parcels']);
    editedFeatureIdsSignal.value = new Set(['f-101', 'f-102']);

    // Toggling edit mode off must preserve editedFeatureIdsSignal
    toggleLayerEditingAction('layer-parcels', { force: true });
    assert.strictEqual(editableLayerIdsSignal.value.has('layer-parcels'), false);
    assert.deepEqual(Array.from(editedFeatureIdsSignal.value), ['f-101', 'f-102']);

    // Saving active layer clears editedFeatureIdsSignal and calls clearLayerEdits
    const clearedLayers: string[] = [];
    const prevWindow = (globalThis as any).window;
    (globalThis as any).window = {
      ...(prevWindow || {}),
      electronAPI: {
        ...(prevWindow?.electronAPI || {}),
        clearLayerEdits: async (layerId: string) => {
          clearedLayers.push(layerId);
        }
      }
    };
    try {
      saveActiveLayerAction();
      assert.strictEqual(editedFeatureIdsSignal.value.size, 0);
      assert.deepEqual(clearedLayers, ['layer-parcels']);
    } finally {
      (globalThis as any).window = prevWindow;
    }
  });
});
