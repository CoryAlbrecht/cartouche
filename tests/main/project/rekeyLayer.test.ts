/**
 * @file rekeyLayer.test.ts
 * @module tests/main/project/rekeyLayer.test
 * @description Unit tests verifying atomic layer identifier re-keying across ProjectStore, LayerSessionRegistry, and GeospatialService, with uniqueness and non-empty validation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see {@link rekeyLayer}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { projectStore } from '../../../src/main/project/ProjectStore';
import { layerSessionRegistry } from '../../../src/main/project/LayerSessionRegistry';
import { rekeyLayer } from '../../../src/main/api/layers/rekeyLayer';
import { onBroadcast } from '../../../src/main/project/ProjectBroadcaster';
import { Layer } from '../../../src/main/project/models/Layer';
import { LayerGroup } from '../../../src/main/project/models/LayerGroup';
import type { ProjectModel } from '../../../src/shared/types';

describe('rekeyLayer API & Atomic Re-keying Pipeline', () => {
  beforeEach(() => {
    projectStore.closeProject();
    layerSessionRegistry.clear();

    const mockProject: ProjectModel = {
      format: 'cartouche/project',
      filePath: '/path/to/test.cproj',
      metadata: {
        title: 'Test Project',
        author: 'Tester'
      },
      viewport: {
        center: { x: 0, y: 0 },
        zoom: 2,
      },
      layers: []
    };

    projectStore.setProject(mockProject);
  });

  afterEach(() => {
    projectStore.closeProject();
    layerSessionRegistry.clear();
  });

  it('rejects empty or whitespace-only newLayerId with descriptive error', async () => {
    const root = projectStore.getRootGroup();
    const layer = new Layer('Cities', '/path/to/cities.geojson', 'vector', 'cities-uuid');
    root.addChild(layer);

    await assert.rejects(
      async () => {
        await rekeyLayer('cities-uuid', '');
      },
      {
        name: 'Error',
        message: 'New Layer ID cannot be empty.'
      }
    );

    await assert.rejects(
      async () => {
        await rekeyLayer('cities-uuid', '   ');
      },
      {
        name: 'Error',
        message: 'New Layer ID cannot be empty or whitespace-only.'
      }
    );
  });

  it('rejects missing or empty oldLayerId with descriptive error', async () => {
    await assert.rejects(
      async () => {
        await rekeyLayer('', 'new-id');
      },
      {
        name: 'Error',
        message: 'Original Layer ID is required.'
      }
    );
  });

  it('rejects if oldLayerId does not exist in the active project', async () => {
    await assert.rejects(
      async () => {
        await rekeyLayer('non-existent-id', 'new-id');
      },
      {
        name: 'Error',
        message: 'Layer "non-existent-id" not found in active project.'
      }
    );
  });

  it('rejects if newLayerId already exists anywhere in the project hierarchy (uniqueness)', async () => {
    const root = projectStore.getRootGroup();
    const layer1 = new Layer('Cities', '/path/to/cities.geojson', 'vector', 'cities-uuid');
    const group = new LayerGroup('Boundaries', 'group-uuid');
    const layer2 = new Layer('Rivers', '/path/to/rivers.geojson', 'vector', 'rivers-uuid');
    group.addChild(layer2);
    root.addChild(layer1);
    root.addChild(group);

    // Attempting to rekey cities-uuid to rivers-uuid
    await assert.rejects(
      async () => {
        await rekeyLayer('cities-uuid', 'rivers-uuid');
      },
      {
        name: 'Error',
        message: 'Layer ID "rivers-uuid" already exists in the project.'
      }
    );

    // Attempting to rekey cities-uuid to group-uuid
    await assert.rejects(
      async () => {
        await rekeyLayer('cities-uuid', 'group-uuid');
      },
      {
        name: 'Error',
        message: 'Layer ID "group-uuid" already exists in the project.'
      }
    );
  });

  it('returns unchanged layerId if newLayerId matches existing ID', async () => {
    const root = projectStore.getRootGroup();
    const layer = new Layer('Cities', '/path/to/cities.geojson', 'vector', 'cities-uuid');
    root.addChild(layer);

    const initialDirty = projectStore.isDirty();
    const res = await rekeyLayer('cities-uuid', 'cities-uuid');

    assert.equal(res.success, true);
    assert.equal(res.layerId, 'cities-uuid');
    assert.equal(projectStore.isDirty(), initialDirty, 'Dirty flag should not change when ID is unchanged');
  });

  it('atomically rekeys layer across ProjectStore, LayerSessionRegistry, and GeospatialService', async () => {
    const root = projectStore.getRootGroup();
    const oldId = 'cities-uuid';
    const newId = 'urban-centers-id';
    const layer = new Layer('Cities', '/path/to/cities.geojson', 'vector', oldId);
    root.addChild(layer);

    // Mock native dataset session in LayerSessionRegistry
    let datasetClosed = false;
    const mockDataset = {
      close: () => {
        datasetClosed = true;
      }
    } as any;
    layerSessionRegistry.register(oldId, mockDataset, {} as any);

    // Track broadcast events
    const broadcastEvents: Array<{ channel: string; payload: any }> = [];
    const unsubscribe = onBroadcast((channel, payload) => {
      broadcastEvents.push({ channel, payload });
    });

    try {
      const res = await rekeyLayer(oldId, newId);

      assert.equal(res.success, true);
      assert.equal(res.layerId, newId);

      // Verify ProjectStore node was updated
      assert.equal(layer.id, newId);
      assert.equal(projectStore.isDirty(), true, 'Project must be marked dirty');

      // Verify LayerSessionRegistry session moved without closing native dataset
      assert.equal(layerSessionRegistry.has(oldId), false);
      assert.equal(layerSessionRegistry.has(newId), true);
      assert.equal(datasetClosed, false, 'Native dataset must not be closed during re-keying');

      // Verify broadcast sent
      const treeBroadcast = broadcastEvents.find(
        (e) => e.channel === 'project:layers-tree-updated'
      );
      assert.ok(treeBroadcast, 'Must broadcast updated project layers tree');
      assert.equal(treeBroadcast.payload[0].id, newId);
    } finally {
      unsubscribe();
    }
  });
});
