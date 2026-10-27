/**
 * @file saveProject.test.ts
 * @module tests/main/api/project/saveProject.test
 * @description Unit tests for Main process project persistence API functions (saveProject, saveAsProject, closeProject).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-26
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { Layer } from '../../../../src/main/project/models/Layer';
import saveProject from '../../../../src/main/api/project/saveProject';
import saveAsProject from '../../../../src/main/api/project/saveAsProject';
import closeProject from '../../../../src/main/api/project/closeProject';
import newProject from '../../../../src/main/api/project/newProject';
import { setNodeSelection } from '../../../../src/main/api/project/layerTreeOperations';
import { serializeProjectLayersTree } from '../../../../src/main/project/ProjectBroadcaster';
import { CartoucheXmlLoader } from '../../../../src/main/project/loaders/CartoucheXmlLoader';

describe('saveProject, saveAsProject, closeProject Main API', () => {
  let tempDir: string;

  beforeEach(() => {
    projectStore.closeProject();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it('saveProject returns false when no project is open', async () => {
    assert.equal(projectStore.hasProject(), false);
    const result = await saveProject();
    assert.equal(result, false);
  });

  it('saveProject returns false when project is untitled and no targetPath is provided', async () => {
    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Untitled Project' },
      layers: []
    });
    assert.equal(projectStore.hasProject(), true);
    assert.equal(projectStore.getFilePath(), null);

    const result = await saveProject();
    assert.equal(result, false);
  });

  it('saveProject saves an existing project back to its disk path and resets dirty state', async () => {
    const tempPath = path.join(tempDir, 'temp-save-existing.cproj');

    projectStore.setProject(
      {
        format: 'cartouche-xml',
        metadata: { title: 'Existing Project' },
        layers: []
      },
      tempPath
    );
    projectStore.setProjectDirty(true);
    assert.equal(projectStore.isProjectDirty(), true);

    const layer = new Layer('Roads', '/data/roads.shp', 'vector', 'layer-roads');
    projectStore.getRootGroup().addChild(layer);

    const saved = await saveProject();
    assert.equal(saved, true);
    assert.equal(projectStore.isProjectDirty(), false);
    assert.equal(fs.existsSync(tempPath), true);

    const content = fs.readFileSync(tempPath, 'utf-8');
    assert.ok(content.includes('<dc:title>Existing Project</dc:title>'));
    assert.ok(content.includes('layer id="layer-roads"'));
  });

  it('saveProject with targetPath updates destination path and resets dirty state', async () => {
    const tempPath = path.join(tempDir, 'temp-save-as.cproj');

    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Untitled Project' },
      layers: []
    });
    projectStore.setProjectDirty(true);

    const saved = await saveProject(tempPath);
    assert.equal(saved, true);
    assert.equal(projectStore.getFilePath(), tempPath);
    assert.equal(projectStore.isProjectDirty(), false);
    assert.equal(fs.existsSync(tempPath), true);
  });

  it('saveAsProject delegates to saveProject and saves to specified path', async () => {
    const tempPath = path.join(tempDir, 'temp-save-as-delegated.cproj');

    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Original Project' },
      layers: []
    });

    const saved = await saveAsProject(tempPath);
    assert.equal(saved, true);
    assert.equal(projectStore.getFilePath(), tempPath);
    assert.equal(projectStore.isProjectDirty(), false);
  });

  it('closeProject resets projectStore state and disposes layers', () => {
    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Closing Project' },
      layers: []
    });
    projectStore.setProjectDirty(true);

    const layer = new Layer('Parcels', '/data/parcels.shp', 'vector', 'layer-parcels');
    projectStore.getRootGroup().addChild(layer);

    closeProject();
    assert.equal(projectStore.hasProject(), false);
    assert.equal(projectStore.getFilePath(), null);
    assert.equal(projectStore.isProjectDirty(), false);
    assert.equal(projectStore.getRootGroup().getChildCount(), 0);
  });

  it('preserves layers and does not clear them when selecting a layer and saving project', async () => {
    const tempPath = path.join(tempDir, 'temp-repro-layers.cproj');

    projectStore.setProject(
      {
        format: 'cartouche-xml',
        metadata: { title: 'Repro Project' },
        layers: [
          {
            id: 'layer-roads',
            name: 'Roads',
            type: 'vector',
            source: '/data/roads.shp',
            visible: true,
            selected: false,
            opacity: 1.0,
            selectable: true,
            readOnly: false
          }
        ]
      },
      tempPath
    );

    // User clicks on a layer, triggering setNodeSelection
    setNodeSelection(['layer-roads']);

    // The runtime layer tree must retain the layer
    const root = projectStore.getRootGroup();
    assert.equal(root.getChildCount(), 1, 'Root group should contain 1 layer');

    const tree = serializeProjectLayersTree();
    assert.equal(tree.length, 1, 'Serialized layer tree should contain 1 layer');
    assert.equal(tree[0].id, 'layer-roads');
    assert.equal(tree[0].selected, true);

    // Save project must not erase layers
    const saved = await saveProject();
    assert.equal(saved, true);

    const project = projectStore.getProject();
    assert.equal(project?.layers?.length, 1);
    assert.equal(project?.layers?.[0]?.id, 'layer-roads');
  });

  it('preserves nested groups and multiple layers when selecting nodes and saving', async () => {
    const tempPath = path.join(tempDir, 'temp-nested-groups.cproj');

    projectStore.setProject(
      {
        format: 'cartouche-xml',
        metadata: { title: 'Nested Groups Project' },
        layers: [
          {
            id: 'group-env',
            name: 'Environment',
            visible: true,
            selected: false,
            expanded: true,
            children: [
              {
                id: 'layer-rivers',
                name: 'Rivers',
                type: 'vector',
                source: '/data/rivers.geojson',
                visible: true,
                selected: false
              },
              {
                id: 'layer-forests',
                name: 'Forests',
                type: 'vector',
                source: '/data/forests.shp',
                visible: true,
                selected: false
              }
            ]
          },
          {
            id: 'layer-labels',
            name: 'Labels',
            type: 'vector',
            source: '/data/labels.geojson',
            visible: true,
            selected: false
          }
        ]
      },
      tempPath
    );

    // Select rivers inside the group
    setNodeSelection(['layer-rivers']);

    const root = projectStore.getRootGroup();
    assert.equal(root.getChildCount(), 2, 'Root should have group-env and layer-labels');

    const tree = serializeProjectLayersTree();
    assert.equal(tree.length, 2);
    assert.equal((tree[0] as any).children?.length, 2);
    assert.equal((tree[0] as any).children[0].id, 'layer-rivers');
    assert.equal((tree[0] as any).children[0].selected, true);

    const saved = await saveProject();
    assert.equal(saved, true);

    const content = fs.readFileSync(tempPath, 'utf-8');
    assert.ok(content.includes('group id="group-env"'));
    assert.ok(content.includes('layer id="layer-rivers"'));
    assert.ok(content.includes('layer id="layer-forests"'));
    assert.ok(content.includes('layer id="layer-labels"'));
  });

  it('serializes viewport extent and camera configuration when viewport is provided on saveProject', async () => {
    const tempPath = path.join(tempDir, 'temp-save-viewport.cproj');

    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Viewport Test Project' },
      layers: []
    });

    const viewport = {
      extent: { xmin: -122.5, ymin: 37.7, xmax: -122.3, ymax: 37.9 },
      center: { x: -122.4, y: 37.8 },
      scale: 25000,
      rotation: 0
    };

    const saved = await saveProject(tempPath, viewport);
    assert.equal(saved, true);
    assert.equal(fs.existsSync(tempPath), true);

    const content = fs.readFileSync(tempPath, 'utf-8');
    assert.ok(content.includes('<viewport>'), 'Saved XML must contain <viewport> root element');
    assert.ok(
      content.includes('<extent xmin="-122.5" ymin="37.7" xmax="-122.3" ymax="37.9" />'),
      'Saved XML must contain formatted <extent> element with exact coordinates'
    );
    assert.ok(
      content.includes('<center x="-122.4" y="37.8" />'),
      'Saved XML must contain formatted <center> element'
    );
    assert.ok(!content.includes('<zoom>'), 'Saved XML must not contain <zoom> element');
    assert.ok(content.includes('<scale>25000</scale>'), 'Saved XML must contain <scale> element');

    // Deserialization check via CartoucheXmlLoader
    const loader = new CartoucheXmlLoader();
    const reloaded = await loader.load(tempPath);
    assert.ok(reloaded.viewport, 'Loaded project must contain viewport');
    assert.deepEqual(reloaded.viewport?.extent, { xmin: -122.5, ymin: 37.7, xmax: -122.3, ymax: 37.9 });
    assert.deepEqual(reloaded.viewport?.center, { x: -122.4, y: 37.8 });
    assert.equal(reloaded.viewport?.scale, 25000);
  });

  it('preserves existing project.viewport when saveProject is invoked without explicit viewport override', async () => {
    const tempPath = path.join(tempDir, 'temp-preserve-viewport.cproj');

    projectStore.setProject(
      {
        format: 'cartouche-xml',
        metadata: { title: 'Preserve Viewport Project' },
        viewport: {
          extent: { xmin: 10, ymin: 20, xmax: 30, ymax: 40 },
          center: { x: 20, y: 30 }
        },
        layers: []
      },
      tempPath
    );

    const saved = await saveProject();
    assert.equal(saved, true);

    const content = fs.readFileSync(tempPath, 'utf-8');
    assert.ok(content.includes('<extent xmin="10" ymin="20" xmax="30" ymax="40" />'));
    assert.ok(!content.includes('<zoom>'), 'Saved XML must not contain <zoom> element');
  });

  it('newProject initializes empty project model in projectStore and saves empty <layers> element', async () => {
    const tempPath = path.join(tempDir, 'temp-save-new-empty.cproj');

    newProject();
    assert.equal(projectStore.hasProject(), true);
    assert.equal(projectStore.getFilePath(), null);
    assert.equal(projectStore.getProject()?.layers?.length, 0);

    const saved = await saveProject(tempPath);
    assert.equal(saved, true);
    assert.equal(fs.existsSync(tempPath), true);

    const content = fs.readFileSync(tempPath, 'utf-8');
    assert.ok(content.includes('<layers>'), 'Saved XML must contain opening <layers> tag');
    assert.ok(content.includes('</layers>'), 'Saved XML must contain closing </layers> tag');
    assert.ok(!content.includes('<layer '), 'Saved XML must not contain layer tags');
  });

  it('saveProject with targetPath creates and saves empty project even if projectStore was uninitialized', async () => {
    const tempPath = path.join(tempDir, 'temp-save-uninitialized.cproj');

    assert.equal(projectStore.hasProject(), false);

    const saved = await saveProject(tempPath);
    assert.equal(saved, true);
    assert.equal(fs.existsSync(tempPath), true);

    const content = fs.readFileSync(tempPath, 'utf-8');
    assert.ok(content.includes('<layers>'));
    assert.ok(content.includes('</layers>'));
  });
});

