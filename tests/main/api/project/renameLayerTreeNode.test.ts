/**
 * @file renameLayerTreeNode.test.ts
 * @module tests/main/api/project/renameLayerTreeNode.test
 * @description Unit tests for renameLayerTreeNode Main Process API handler verifying layer, group, and project root renaming, dirty state tracking, and whitespace handling.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @see {@link renameLayerTreeNode}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { LayerGroup } from '../../../../src/main/project/models/LayerGroup';
import { Layer } from '../../../../src/main/project/models/Layer';
import { renameLayerTreeNode } from '../../../../src/main/api/project/renameLayerTreeNode';

describe('renameLayerTreeNode', () => {
  beforeEach(() => {
    projectStore.closeProject();
    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Initial Project Title' },
      layers: []
    });
  });

  it('renames a layer node, trims whitespace, and marks project dirty', () => {
    const root = projectStore.getRootGroup();
    const layer = new Layer('Roads', '/path/to/roads.shp', 'vector', 'layer-roads');
    root.addChild(layer);

    projectStore.setDirty(false);
    assert.equal(projectStore.isDirty(), false);

    renameLayerTreeNode('layer-roads', '  Highways & Freeways  ');

    assert.equal(layer.name, 'Highways & Freeways');
    assert.equal(layer.filePath, '/path/to/roads.shp');
    assert.equal(projectStore.isDirty(), true);
  });

  it('renames a group node and marks project dirty', () => {
    const root = projectStore.getRootGroup();
    const group = new LayerGroup('Old Group', 'group-1');
    root.addChild(group);

    projectStore.setDirty(false);

    renameLayerTreeNode('group-1', 'Renamed Group');

    assert.equal(group.name, 'Renamed Group');
    assert.equal(projectStore.isDirty(), true);
  });

  it('renames the project root metadata title and marks project dirty when nodeId is "project"', () => {
    projectStore.setDirty(false);

    renameLayerTreeNode('project', 'My Awesome Project');

    const project = projectStore.getProject();
    assert.ok(project);
    assert.equal(project.metadata.title, 'My Awesome Project');
    assert.equal(projectStore.isDirty(), true);
  });

  it('does nothing and preserves dirty state if name is empty or whitespace-only', () => {
    const root = projectStore.getRootGroup();
    const layer = new Layer('Rivers', '/path/to/rivers.shp', 'vector', 'layer-rivers');
    root.addChild(layer);

    projectStore.setDirty(false);

    renameLayerTreeNode('layer-rivers', '   ');
    assert.equal(layer.name, 'Rivers');
    assert.equal(projectStore.isDirty(), false);

    renameLayerTreeNode('project', '');
    const project = projectStore.getProject();
    assert.ok(project);
    assert.equal(project.metadata.title, 'Initial Project Title');
    assert.equal(projectStore.isDirty(), false);
  });

  it('does nothing and preserves dirty state if the trimmed name is identical to existing name', () => {
    const root = projectStore.getRootGroup();
    const layer = new Layer('Lakes', '/path/to/lakes.shp', 'vector', 'layer-lakes');
    root.addChild(layer);

    projectStore.setDirty(false);

    renameLayerTreeNode('layer-lakes', 'Lakes');
    assert.equal(projectStore.isDirty(), false);

    renameLayerTreeNode('project', 'Initial Project Title');
    assert.equal(projectStore.isDirty(), false);
  });

  it('does not alter or move the physical dataset file path when renaming a layer', () => {
    const root = projectStore.getRootGroup();
    const filePath = '/data/spatial/waterways.gpkg';
    const layer = new Layer('Waterways', filePath, 'vector', 'layer-water');
    root.addChild(layer);

    renameLayerTreeNode('layer-water', 'Hydrology Network');

    assert.equal(layer.name, 'Hydrology Network');
    assert.equal(layer.filePath, filePath);
  });

  it('sanitizes newlines and carriage returns, converting multiline input to a clean single line', () => {
    const root = projectStore.getRootGroup();
    const layer = new Layer('Parcels', '/path/to/parcels.shp', 'vector', 'layer-parcels');
    root.addChild(layer);

    renameLayerTreeNode('layer-parcels', 'Cadastral\r\nParcels\n2026');
    assert.equal(layer.name, 'Cadastral Parcels 2026');

    renameLayerTreeNode('project', 'Metro\r\nRegion\nMaster');
    const project = projectStore.getProject();
    assert.ok(project);
    assert.equal(project.metadata.title, 'Metro Region Master');
  });

  it('does nothing and safely returns when called with missing or invalid parameters', () => {
    projectStore.setDirty(false);
    assert.doesNotThrow(() => {
      // Testing parameterless execution matching ActionRegistry functionCall signature
      renameLayerTreeNode();
      renameLayerTreeNode('layer-parcels', undefined as unknown as string);
    });
    assert.equal(projectStore.isDirty(), false);
  });
});

