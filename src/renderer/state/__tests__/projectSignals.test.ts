/**
 * @file projectSignals.test.ts
 * @module renderer/state/__tests__/projectSignals.test
 * @description Unit tests for Preact project signals, hierarchical visibility counting, selection manipulation, and context menu hooks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectTreeSignal,
  projectVisibleSignal,
  projectTreeStatsSignal,
  toggleNodeVisibility,
  setNodeSelection,
  selectSingleNode,
  toggleNodeSelection,
  clearNodeSelection,
  selectRangeNodes,
  selectedNodeIdsSignal,
  registerLayerTreeContextMenuHook,
  layerTreeContextMenuHooksSignal
} from '../projectSignals';
import type { ProjectLayerItem, ProjectGroupItem } from '../../../shared/types';

describe('projectSignals', () => {
  beforeEach(() => {
    projectVisibleSignal.value = true;
    projectTreeSignal.value = [];
    clearNodeSelection();
  });

  it('projectTreeStatsSignal excludes children of unchecked groups and respects projectVisibleSignal', () => {
    const l1: ProjectLayerItem = { id: 'l1', name: 'Layer 1', type: 'vector', source: '', visible: true };
    const l2: ProjectLayerItem = { id: 'l2', name: 'Layer 2', type: 'vector', source: '', visible: true };
    const g1: ProjectGroupItem = { id: 'g1', name: 'Group 1', visible: true, children: [l1] };
    projectTreeSignal.value = [g1, l2];

    // Both visible
    assert.deepEqual(projectTreeStatsSignal.value, { total: 2, visible: 2 });

    // Uncheck group: l1 is excluded from visible count even though l1.visible === true
    toggleNodeVisibility('g1');
    assert.deepEqual(projectTreeStatsSignal.value, { total: 2, visible: 1 });

    // Re-check group
    toggleNodeVisibility('g1');
    assert.deepEqual(projectTreeStatsSignal.value, { total: 2, visible: 2 });

    // Hide entire project
    projectVisibleSignal.value = false;
    assert.deepEqual(projectTreeStatsSignal.value, { total: 2, visible: 0 });
  });

  it('setNodeSelection, toggleNodeSelection, selectRangeNodes manipulate selection correctly', () => {
    const l1: ProjectLayerItem = { id: 'l1', name: 'Layer 1', type: 'vector', source: '', visible: true };
    const l2: ProjectLayerItem = { id: 'l2', name: 'Layer 2', type: 'vector', source: '', visible: true };
    const l3: ProjectLayerItem = { id: 'l3', name: 'Layer 3', type: 'vector', source: '', visible: true };
    projectTreeSignal.value = [l1, l2, l3];

    selectSingleNode('l1');
    assert.deepEqual(selectedNodeIdsSignal.value, ['l1']);

    setNodeSelection(['l1', 'l2']);
    assert.deepEqual(selectedNodeIdsSignal.value, ['l1', 'l2']);

    toggleNodeSelection('l3');
    assert.deepEqual(selectedNodeIdsSignal.value, ['l1', 'l2', 'l3']);

    selectRangeNodes('l1', 'l3');
    assert.deepEqual(selectedNodeIdsSignal.value, ['l1', 'l2', 'l3']);

    clearNodeSelection();
    assert.deepEqual(selectedNodeIdsSignal.value, []);
  });

  it('registerLayerTreeContextMenuHook adds and removes menu contribution hooks', () => {
    layerTreeContextMenuHooksSignal.value = [];
    const unsubscribe = registerLayerTreeContextMenuHook(() => [
      { id: 'custom-1', label: 'Custom Item' }
    ]);

    assert.equal(layerTreeContextMenuHooksSignal.value.length, 1);
    const items = layerTreeContextMenuHooksSignal.value[0]({ actionableNodes: [], isMultiple: false });
    assert.equal(items[0].label, 'Custom Item');

    unsubscribe();
    assert.equal(layerTreeContextMenuHooksSignal.value.length, 0);
  });
});
