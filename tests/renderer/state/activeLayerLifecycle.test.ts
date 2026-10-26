/**
 * @file activeLayerLifecycle.test.ts
 * @module tests/renderer/state/activeLayerLifecycle.test
 * @description Unit tests for Active Layer lifecycle, separation from Selected Layer, batch ingestion activation, and deletion reset (Ticket #92, ADR 0016).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
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
});
