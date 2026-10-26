/**
 * @file projectSignals.test.ts
 * @module tests/renderer/state/projectSignals.test
 * @description Unit tests for Preact project signals, hierarchical visibility counting, selection manipulation, and context menu hooks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-26
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
  layerTreeContextMenuHooksSignal,
  projectNameSignal,
  renameNode,
  editingNodeIdSignal,
  requestRenameSelectedNode,
  activeLayerIdSignal,
  setActiveLayer,
  isProjectDirtySignal,
  extractLeafLayerIds
} from '../../../src/renderer/state/projectSignals';
import type { ProjectLayerItem, ProjectGroupItem } from '../../../src/shared/types';

describe('projectSignals', () => {
  beforeEach(() => {
    projectVisibleSignal.value = true;
    projectTreeSignal.value = [];
    projectNameSignal.value = 'Initial Project';
    editingNodeIdSignal.value = null;
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

  it('maintains activeLayerIdSignal independently from node selection', () => {
    const l1: ProjectLayerItem = { id: 'l1', name: 'Layer 1', type: 'vector', source: '' };
    const g1: ProjectGroupItem = { id: 'g1', name: 'Group 1', children: [] };
    projectTreeSignal.value = [l1, g1];

    // Select layer l1 and mark it active
    selectSingleNode('l1');
    setActiveLayer('l1');
    assert.equal(activeLayerIdSignal.value, 'l1');

    // Selecting group g1 changes selection but does not overwrite active layer
    selectSingleNode('g1');
    assert.deepEqual(selectedNodeIdsSignal.value, ['g1']);
    assert.equal(activeLayerIdSignal.value, 'l1');

    // Deselecting all does not overwrite active layer
    clearNodeSelection();
    assert.equal(activeLayerIdSignal.value, 'l1');
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

  it('renameNode renames layer or group node and trims whitespace', () => {
    const l1: ProjectLayerItem = { id: 'l1', name: 'Old Layer', type: 'vector', source: '' };
    projectTreeSignal.value = [l1];

    renameNode('l1', '  New Layer Name  ');
    assert.equal(projectTreeSignal.value[0].name, 'New Layer Name');

    // Sanitizes newlines and carriage returns
    renameNode('l1', 'Boundary\r\nSurvey\nLines');
    assert.equal(projectTreeSignal.value[0].name, 'Boundary Survey Lines');

    // Blank name is ignored
    renameNode('l1', '   ');
    assert.equal(projectTreeSignal.value[0].name, 'Boundary Survey Lines');
  });

  it('renameNode updates projectNameSignal when nodeId is "project"', () => {
    projectNameSignal.value = 'My Project';

    renameNode('project', 'Renamed Project Title');
    assert.equal(projectNameSignal.value, 'Renamed Project Title');

    // Blank name is ignored
    renameNode('project', '   ');
    assert.equal(projectNameSignal.value, 'Renamed Project Title');
  });

  it('requestRenameSelectedNode sets editingNodeIdSignal only when exactly one node is selected', () => {
    const l1: ProjectLayerItem = { id: 'node-1', name: 'Node 1', type: 'vector', source: '' };
    const l2: ProjectLayerItem = { id: 'node-2', name: 'Node 2', type: 'vector', source: '' };
    projectTreeSignal.value = [l1, l2];

    // 0 nodes selected
    clearNodeSelection();
    requestRenameSelectedNode();
    assert.equal(editingNodeIdSignal.value, null);

    // 1 node selected
    selectSingleNode('node-1');
    requestRenameSelectedNode();
    assert.equal(editingNodeIdSignal.value, 'node-1');

    // Project root selected
    selectSingleNode('project');
    assert.deepEqual(selectedNodeIdsSignal.value, ['project']);
    requestRenameSelectedNode();
    assert.equal(editingNodeIdSignal.value, 'project');

    // Multi-selection (more than 1) does nothing
    editingNodeIdSignal.value = null;
    setNodeSelection(['node-1', 'node-2']);
    requestRenameSelectedNode();
    assert.equal(editingNodeIdSignal.value, null);
  });

  it('toggleNodeVisibility and renameNode mark isProjectDirtySignal true', () => {
    isProjectDirtySignal.value = false;
    const l1: ProjectLayerItem = { id: 'l1', name: 'Layer 1', type: 'vector', source: '', visible: true };
    projectTreeSignal.value = [l1];

    toggleNodeVisibility('l1');
    assert.equal(isProjectDirtySignal.value, true);

    isProjectDirtySignal.value = false;
    renameNode('l1', 'New Name');
    assert.equal(isProjectDirtySignal.value, true);
  });

  it('extractLeafLayerIds recursively collects leaf layer IDs excluding group nodes', () => {
    const l1: ProjectLayerItem = { id: 'layer-1', name: 'Layer 1', type: 'vector', source: '' };
    const l2: ProjectLayerItem = { id: 'layer-2', name: 'Layer 2', type: 'vector', source: '' };
    const l3: ProjectLayerItem = { id: 'layer-3', name: 'Layer 3', type: 'vector', source: '' };
    const nestedGroup: ProjectGroupItem = { id: 'group-nested', name: 'Nested', visible: true, children: [l3] };
    const parentGroup: ProjectGroupItem = { id: 'group-parent', name: 'Parent', visible: true, children: [l2, nestedGroup] };

    const tree = [l1, parentGroup];
    const idSet = new Set<string>();
    extractLeafLayerIds(tree, idSet);

    assert.equal(idSet.size, 3);
    assert.ok(idSet.has('layer-1'));
    assert.ok(idSet.has('layer-2'));
    assert.ok(idSet.has('layer-3'));
    assert.ok(!idSet.has('group-parent'));
    assert.ok(!idSet.has('group-nested'));
  });
});