/**
 * @file addLayer.test.ts
 * @module tests/main/api/layers/addLayer.test
 * @description Integration tests for vector layer ingestion via GeospatialService, LayerDescriptor extraction, and IPC broadcasting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-16
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { geospatialService } from '../../../../src/main/worker/GeospatialService';
import { addLayer, addLayers } from '../../../../src/main/api/layers/addLayer';
import { queryExtent } from '../../../../src/main/api/layers/queryExtent';
import { onBroadcast } from '../../../../src/main/project/ProjectBroadcaster';
import type { LayerDescriptor } from '../../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleShpPath = path.resolve(__dirname, '../../../../../test/files/ne_10m_lakes.shp');

describe('addLayer API & Ingestion Pipeline', () => {
  let sentEvents: Array<{ channel: string; payload: any }> = [];
  let unsubscribeBroadcast: (() => void) | null = null;

  beforeEach(async () => {
    projectStore.closeProject();
    await geospatialService.closeAll();
    sentEvents = [];

    unsubscribeBroadcast = onBroadcast((channel: string, payload: any) => {
      sentEvents.push({ channel, payload });
    });
  });

  afterEach(async () => {
    if (unsubscribeBroadcast) {
      unsubscribeBroadcast();
      unsubscribeBroadcast = null;
    }
    await geospatialService.closeAll();
    projectStore.closeProject();
  });

  it('inspects vector files via GeospatialService and extracts LayerDescriptor', async () => {
    const layer = await addLayer({
      sourceType: 'vector',
      filePath: sampleShpPath,
      layerName: 'Natural Earth Lakes'
    });

    assert.ok(layer, 'Layer should be instantiated');
    assert.equal(layer.name, 'Natural Earth Lakes');
    assert.equal(layer.layerKind, 'vector');
    assert.equal(layer.geometryKind, 'Polygon');
    assert.equal(layer.crs?.authId, 'EPSG:4326');

    // Verify session registered in GeospatialService by querying extent
    const queryRes = await queryExtent(layer.id, [-100, 40, -80, 50]);
    assert.equal(queryRes.layerId, layer.id);
    assert.equal(queryRes.features.length, 34);

    // Verify default styling attached
    assert.ok(layer.style, 'Default styling must be attached to layer');
    const styleObj = typeof layer.style === 'string' ? JSON.parse(layer.style) : layer.style;
    assert.equal(styleObj['fill-color'], '#1e293b');
    assert.equal(styleObj['stroke-color'], '#1b446c');
    assert.equal(styleObj['stroke-width'], 4);

    // Verify IPC broadcasts dispatched
    const addedEvents = sentEvents.filter((e) => e.channel === 'project:layer-added');
    assert.equal(addedEvents.length, 1, 'project:layer-added IPC event must be broadcast');

    const descriptor: LayerDescriptor = addedEvents[0].payload;
    assert.equal(descriptor.id, layer.id);
    assert.equal(descriptor.name, 'Natural Earth Lakes');
    assert.equal(descriptor.geometryKind, 'Polygon');
    assert.equal(descriptor.featureCount, 1353, 'Feature count must match shapefile records');
    assert.ok(Array.isArray(descriptor.extent), 'Extent must be BoundingBox array');
    assert.equal(descriptor.extent.length, 4);
    assert.ok(descriptor.extent[0] < -160 && descriptor.extent[0] > -170); // minX ~ -165.96
    assert.ok(descriptor.extent[2] > 170 && descriptor.extent[2] < 180); // maxX ~ 177.15

    const treeEvents = sentEvents.filter((e) => e.channel === 'project:layers-tree-updated');
    assert.ok(treeEvents.length >= 1, 'project:layers-tree-updated must be broadcast');

    // Verify resource disposal
    layer[Symbol.dispose]();
  });

  it('addLayers sequentially ingests multiple layers and updates tree and registry', async () => {
    const layers = await addLayers([
      {
        sourceType: 'vector',
        filePath: sampleShpPath,
        layerName: 'Lakes Batch 1'
      },
      {
        sourceType: 'vector',
        filePath: sampleShpPath,
        layerName: 'Lakes Batch 2'
      }
    ]);

    assert.equal(layers.length, 2);
    assert.notEqual(layers[0].id, layers[1].id);

    const q1 = await queryExtent(layers[0].id, [-100, 40, -80, 50]);
    const q2 = await queryExtent(layers[1].id, [-100, 40, -80, 50]);
    assert.equal(q1.features.length, 34);
    assert.equal(q2.features.length, 34);

    const addedEvents = sentEvents.filter((e) => e.channel === 'project:layer-added');
    assert.equal(addedEvents.length, 2);
    assert.equal(addedEvents[0].payload.name, 'Lakes Batch 1');
    assert.equal(addedEvents[1].payload.name, 'Lakes Batch 2');
  });
});