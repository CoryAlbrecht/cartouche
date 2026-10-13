/**
 * @file layerTreeOperations.test.ts
 * @module tests/main/api/project/layerTreeOperations.test
 * @description Unit tests for Main process layer tree mutation API handlers (visibility, selection, deletion, group creation, reordering).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { LayerGroup } from '../../../../src/main/project/models/LayerGroup';
import { Layer } from '../../../../src/main/project/models/Layer';
import {
  setNodeVisibility,
  setNodeSelection,
  removeNodes,
  createGroup,
  reorderNodes
} from '../../../../src/main/api/project/layerTreeOperations';

describe('layerTreeOperations', () => {
  beforeEach(() => {
    projectStore.closeProject();
    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Test Project' },
      layers: []
    });
  });

  it('setNodeVisibility toggles node visibility and flags project dirty', () => {
    const root = projectStore.getRootGroup();
    const layer = new Layer('Roads', '/path/to/roads.shp', 'vector', 'layer-roads');
    root.addChild(layer);

    assert.equal(layer.visible, true);
    setNodeVisibility('layer-roads', false);
    assert.equal(layer.visible, false);
    assert.equal(projectStore.isProjectDirty(), true);

    setNodeVisibility('layer-roads', true);
    assert.equal(layer.visible, true);
  });

  it('setNodeSelection updates selected property across the tree', () => {
    const root = projectStore.getRootGroup();
    const g1 = new LayerGroup('Group 1', 'group-1');
    const l1 = new Layer('L1', '/path/l1.shp', 'vector', 'l-1');
    const l2 = new Layer('L2', '/path/l2.shp', 'vector', 'l-2');
    g1.addChild(l1);
    root.addChild(g1);
    root.addChild(l2);

    setNodeSelection(['l-1', 'group-1']);
    assert.equal(g1.selected, true);
    assert.equal(l1.selected, true);
    assert.equal(l2.selected, false);

    setNodeSelection(['l-2']);
    assert.equal(g1.selected, false);
    assert.equal(l1.selected, false);
    assert.equal(l2.selected, true);
  });

  it('removeNodes removes nodes and disposes native resources', () => {
    const root = projectStore.getRootGroup();
    let disposed = false;
    const layer = new Layer('L1', '/path/l1.shp', 'vector', 'l-1');
    layer.attachNativeObject({
      dispose: () => {
        disposed = true;
      }
    });
    root.addChild(layer);

    removeNodes(['l-1']);
    assert.equal(root.getChildCount(), 0);
    assert.equal(disposed, true);
    assert.equal(projectStore.isProjectDirty(), true);
  });

  it('createGroup creates new group before target and reparents actionable nodes', () => {
    const root = projectStore.getRootGroup();
    const l1 = new Layer('L1', '/path/l1.shp', 'vector', 'l-1');
    const l2 = new Layer('L2', '/path/l2.shp', 'vector', 'l-2');
    const l3 = new Layer('L3', '/path/l3.shp', 'vector', 'l-3');
    root.addChild(l1);
    root.addChild(l2);
    root.addChild(l3);

    // Group l1 and l3 into "New Group", targeting l2 position
    createGroup('New Group', 'l-2', ['l-1', 'l-3']);

    const children = root.getAllChildren();
    assert.equal(children.length, 2);
    const newGroup = children[0] as LayerGroup;
    assert.equal(newGroup.name, 'New Group');
    assert.equal(children[1].id, 'l-2');

    const groupChildren = newGroup.getAllChildren();
    assert.equal(groupChildren.length, 2);
    assert.equal(groupChildren[0].id, 'l-1');
    assert.equal(groupChildren[1].id, 'l-3');
    assert.equal(newGroup.selected, true);
    assert.equal(groupChildren[0].selected, false);
    assert.equal(groupChildren[1].selected, false);
    assert.equal(projectStore.isProjectDirty(), true);
  });

  it('reorderNodes reorders nodes before target and prevents cycles', () => {
    const root = projectStore.getRootGroup();
    const g1 = new LayerGroup('Group 1', 'g-1');
    const l1 = new Layer('L1', '/path/l1.shp', 'vector', 'l-1');
    const l2 = new Layer('L2', '/path/l2.shp', 'vector', 'l-2');
    g1.addChild(l1);
    root.addChild(g1);
    root.addChild(l2);

    // Move l2 before l1 inside g1
    reorderNodes(['l-2'], 'l-1', 'before');
    assert.equal(g1.getAllChildren().length, 2);
    assert.equal(g1.getAllChildren()[0].id, 'l-2');
    assert.equal(g1.getAllChildren()[1].id, 'l-1');
    assert.equal(root.getAllChildren().length, 1);

    // Attempt cyclical move: move g1 into its child l1 (should be prevented)
    reorderNodes(['g-1'], 'l-1', 'into');
    assert.equal(g1.parent, root); // g1 remains child of root

    // Test dropping multiple nodes into empty group preserves sequential order
    const g2 = new LayerGroup('Group 2', 'g-2');
    root.addChild(g2);
    const l3 = new Layer('L3', '/path/l3.shp', 'vector', 'l-3');
    const l4 = new Layer('L4', '/path/l4.shp', 'vector', 'l-4');
    root.addChild(l3);
    root.addChild(l4);
    reorderNodes(['l-3', 'l-4'], 'g-2', 'into');
    assert.equal(g2.getAllChildren().length, 2);
    assert.equal(g2.getAllChildren()[0].id, 'l-3');
    assert.equal(g2.getAllChildren()[1].id, 'l-4');

    // Test moving earlier sibling before later sibling without index offset error
    const l5 = new Layer('L5', '/path/l5.shp', 'vector', 'l-5');
    const l6 = new Layer('L6', '/path/l6.shp', 'vector', 'l-6');
    const l7 = new Layer('L7', '/path/l7.shp', 'vector', 'l-7');
    root.addChild(l5);
    root.addChild(l6);
    root.addChild(l7);
    // Move l5 before l7 (l5 is index 2, l7 is index 4)
    reorderNodes(['l-5'], 'l-7', 'before');
    const rootChildren = root.getAllChildren();
    const l5Index = rootChildren.findIndex((c) => c.id === 'l-5');
    const l7Index = rootChildren.findIndex((c) => c.id === 'l-7');
    assert.equal(l5Index + 1, l7Index); // l5 is immediately before l7
    assert.equal(projectStore.isProjectDirty(), true);
  });

  it('notifies onDirtyChange listeners whenever project dirty state transitions', () => {
    projectStore.setProjectDirty(false);
    const notifications: boolean[] = [];
    const unsubscribe = projectStore.onDirtyChange((dirty) => {
      notifications.push(dirty);
    });

    projectStore.setProjectDirty(true);
    assert.deepEqual(notifications, [true]);

    // Redundant call with same state should not trigger
    projectStore.setProjectDirty(true);
    assert.deepEqual(notifications, [true]);

    projectStore.setProjectDirty(false);
    assert.deepEqual(notifications, [true, false]);

    unsubscribe();
    projectStore.setProjectDirty(true);
    assert.deepEqual(notifications, [true, false]);
  });
});

