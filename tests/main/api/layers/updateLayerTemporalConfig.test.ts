/**
 * @file updateLayerTemporalConfig.test.ts
 * @module tests/main/api/layers/updateLayerTemporalConfig.test
 * @description Unit and integration tests for Main process updateLayerTemporalConfig API function, ProjectStore temporal persistence, ProjectBroadcaster serialization, and XML persistence of layer temporal configuration.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link updateLayerTemporalConfig}
 * @see {@link projectStore}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { onBroadcast, serializeLayerTreeNode } from '../../../../src/main/project/ProjectBroadcaster';
import { Layer } from '../../../../src/main/project/models/Layer';
import { updateLayerTemporalConfig } from '../../../../src/main/api/layers/updateLayerTemporalConfig';
import { findNode } from '../../../../src/main/api/project/layerTreeOperations';
import saveProject from '../../../../src/main/api/project/saveProject';
import openProject from '../../../../src/main/api/project/openProject';
import type { LayerTemporalConfig, ProjectLayerItem } from '../../../../src/shared/types';

describe('Main Process updateLayerTemporalConfig API (Ticket #254)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-update-temporal-'));
    projectStore.closeProject();
  });

  afterEach(() => {
    projectStore.closeProject();
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  });

  it('updates temporal configuration and enabled status on target Layer and sets Project Dirty State', async () => {
    const layer = new Layer('Telemetry Points', '/data/telemetry.geojson', 'vector', 'layer-telemetry-1');
    projectStore.getRootGroup().addChild(layer);
    projectStore.setProjectDirty(false);
    assert.equal(projectStore.isProjectDirty(), false);

    const temporalConfig: LayerTemporalConfig = {
      enabled: true,
      mode: 'start_end',
      startField: 'timestamp_start',
      startOp: '>=',
      endField: 'timestamp_end',
      endOp: '<=',
    };

    const result = await updateLayerTemporalConfig('layer-telemetry-1', temporalConfig, true);
    assert.equal(result, true);
    assert.equal(projectStore.isProjectDirty(), true, 'Must set Project Dirty State to true');
    assert.equal(layer.temporalEnabled, true);
    assert.deepEqual(layer.temporal, temporalConfig);
  });

  it('defaults temporalEnabled to temporal.enabled when temporalEnabled argument is undefined', async () => {
    const layer = new Layer('Sensor Layer', '/data/sensor.geojson', 'vector', 'layer-sensor-1');
    projectStore.getRootGroup().addChild(layer);

    const temporalConfig: LayerTemporalConfig = {
      enabled: true,
      mode: 'start',
      startField: 'recorded_at',
      startOp: '>',
    };

    await updateLayerTemporalConfig('layer-sensor-1', temporalConfig);
    assert.equal(layer.temporalEnabled, true);
    assert.deepEqual(layer.temporal, temporalConfig);

    const disabledConfig: LayerTemporalConfig = {
      enabled: false,
      mode: 'start',
      startField: 'recorded_at',
      startOp: '>',
    };

    await updateLayerTemporalConfig('layer-sensor-1', disabledConfig);
    assert.equal(layer.temporalEnabled, false);
    assert.deepEqual(layer.temporal, disabledConfig);
  });

  it('broadcasts updated layer tree to renderer windows when temporal config is updated', async () => {
    const layer = new Layer('Events Layer', '/data/events.geojson', 'vector', 'layer-events-1');
    projectStore.getRootGroup().addChild(layer);

    let broadcastTriggered = false;
    let receivedPayload: any = null;

    const unsubscribe = onBroadcast((channel, payload) => {
      if (channel === 'project:layers-tree-updated') {
        broadcastTriggered = true;
        receivedPayload = payload;
      }
    });

    try {
      const temporalConfig: LayerTemporalConfig = {
        enabled: true,
        mode: 'start_end',
        startField: 'start_time',
        startOp: '>=',
        endField: 'end_time',
        endOp: '<=',
      };

      await updateLayerTemporalConfig('layer-events-1', temporalConfig, true);
      assert.equal(broadcastTriggered, true, 'Must trigger project:layers-tree broadcast');
      assert.ok(receivedPayload && Array.isArray(receivedPayload), 'Payload must be LayerTreeNode array');
      const broadcastLayer = receivedPayload.find((item: any) => item.id === 'layer-events-1');
      assert.ok(broadcastLayer, 'Broadcast payload must include updated layer');
      assert.equal(broadcastLayer.temporalEnabled, true);
      assert.deepEqual(broadcastLayer.temporal, temporalConfig);
    } finally {
      unsubscribe();
    }
  });

  it('throws descriptive error if layerId is missing or layer does not exist', async () => {
    await assert.rejects(
      async () => {
        await updateLayerTemporalConfig('');
      },
      { message: 'Layer ID is required.' }
    );

    await assert.rejects(
      async () => {
        await updateLayerTemporalConfig('nonexistent-layer');
      },
      { message: 'Layer "nonexistent-layer" not found in active project.' }
    );
  });

  it('ProjectStore.deserializeNode() preserves temporal and temporalEnabled when opening projects', () => {
    const temporalConfig: LayerTemporalConfig = {
      enabled: true,
      mode: 'start_end',
      startField: 't_start',
      startOp: '>=',
      endField: 't_end',
      endOp: '<=',
    };

    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Temporal Test Project' },
      layers: [
        {
          id: 'layer-loaded-temporal',
          name: 'Loaded Temporal Layer',
          type: 'vector',
          source: '/data/loaded.geojson',
          visible: true,
          temporalEnabled: true,
          temporal: temporalConfig,
        },
      ],
    });

    const root = projectStore.getRootGroup();
    const layer = findNode(root, 'layer-loaded-temporal') as Layer;
    assert.ok(layer, 'Layer must be deserialized into root group');
    assert.equal(layer.temporalEnabled, true);
    assert.deepEqual(layer.temporal, temporalConfig);
  });

  it('ProjectBroadcaster.serializeLayerTreeNode() includes temporal and temporalEnabled on serialized items', () => {
    const layer = new Layer('Serialized Layer', '/data/serialized.shp', 'vector', 'layer-serialized-1');
    const temporalConfig: LayerTemporalConfig = {
      enabled: true,
      mode: 'end',
      endField: 'expiry_date',
      endOp: '<',
    };
    layer.temporal = temporalConfig;
    layer.temporalEnabled = true;

    const serialized = serializeLayerTreeNode(layer) as ProjectLayerItem;
    assert.equal(serialized.temporalEnabled, true);
    assert.deepEqual(serialized.temporal, temporalConfig);
  });

  it('persists <temporal ... /> and temporalEnabled into .cproj XML and restores them upon saveProject and openProject', async () => {
    const destinationPath = path.join(tempDir, 'project-temporal-roundtrip.cproj');

    const initialTemporal: LayerTemporalConfig = {
      enabled: true,
      mode: 'start_end',
      startField: 'began_at',
      startOp: '>=',
      endField: 'ended_at',
      endOp: '<=',
    };

    // Initialize in projectStore
    projectStore.setProject(
      {
        format: 'cartouche-xml',
        metadata: { title: 'Temporal Roundtrip Test' },
        layers: [
          {
            id: 'layer-temporal-save',
            name: 'Temporal Save Layer',
            type: 'vector',
            source: '/data/flight_paths.geojson',
            visible: true,
            temporalEnabled: false,
          },
        ],
      },
      destinationPath
    );

    // Update temporal config on target Layer via API
    await updateLayerTemporalConfig('layer-temporal-save', initialTemporal, true);
    assert.equal(projectStore.isProjectDirty(), true);

    // Save project
    const saveResult = await saveProject(destinationPath);
    assert.equal(saveResult, true);
    assert.equal(projectStore.isProjectDirty(), false);

    // Verify XML content directly
    const xmlContent = fs.readFileSync(destinationPath, 'utf8');
    assert.ok(
      xmlContent.includes('temporalEnabled="true"'),
      'Must serialize temporalEnabled="true" attribute on <layer>'
    );
    assert.ok(
      xmlContent.includes('<temporal enabled="true" mode="start_end" startField="began_at" startOp="&gt;=" endField="ended_at" endOp="&lt;=" />'),
      'Must serialize <temporal ... /> XML element with attributes'
    );

    // Reopen project from disk and verify Layer nodes
    await openProject(destinationPath);
    const root = projectStore.getRootGroup();
    const reloadedLayer = findNode(root, 'layer-temporal-save') as Layer;
    assert.ok(reloadedLayer, 'Reloaded layer must exist');
    assert.equal(reloadedLayer.temporalEnabled, true);
    assert.ok(reloadedLayer.temporal, 'Reloaded layer must contain temporal config');
    assert.equal(reloadedLayer.temporal.enabled, true);
    assert.equal(reloadedLayer.temporal.mode, 'start_end');
    assert.equal(reloadedLayer.temporal.startField, 'began_at');
    assert.equal(reloadedLayer.temporal.startOp, '>=');
    assert.equal(reloadedLayer.temporal.endField, 'ended_at');
    assert.equal(reloadedLayer.temporal.endOp, '<=');
  });
});
