/**
 * @file LayerSessionRegistry.test.ts
 * @module tests/main/project/LayerSessionRegistry.test
 * @description Unit tests verifying in-memory native GDAL dataset session lifecycle management, sequential query queues, and deterministic disposal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-24
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import gdal from 'gdal-async';
import { layerSessionRegistry } from '../../../src/main/project/LayerSessionRegistry';
import { Layer } from '../../../src/main/project/models/Layer';

describe('LayerSessionRegistry', () => {
  beforeEach(() => {
    layerSessionRegistry.clear();
  });

  afterEach(() => {
    layerSessionRegistry.clear();
  });

  it('registers and retrieves paired native dataset and layer handles', async () => {
    const ds = await gdal.openAsync('../test/files/ne_10m_lakes.shp');
    const layer = ds.layers.get(0);
    const layerId = 'test-layer-1';

    layerSessionRegistry.register(layerId, ds, layer);

    assert.equal(layerSessionRegistry.has(layerId), true);
    const session = layerSessionRegistry.get(layerId);
    assert.ok(session);
    assert.equal(session.dataset, ds);
    assert.equal(session.layer, layer);
  });

  it('removes session and closes native dataset deterministically', async () => {
    let closed = false;
    const fakeDataset = {
      close: () => {
        closed = true;
      }
    } as any;
    const fakeLayer = {} as any;
    const layerId = 'test-fake-layer';

    layerSessionRegistry.register(layerId, fakeDataset, fakeLayer);
    assert.equal(layerSessionRegistry.has(layerId), true);

    layerSessionRegistry.remove(layerId);
    assert.equal(layerSessionRegistry.has(layerId), false);
    assert.equal(closed, true);
  });

  it('clear() closes all registered native datasets', async () => {
    let closeCount = 0;
    const ds1 = { close: () => { closeCount++; } } as any;
    const ds2 = { close: () => { closeCount++; } } as any;

    layerSessionRegistry.register('l1', ds1, {} as any);
    layerSessionRegistry.register('l2', ds2, {} as any);
    assert.equal(layerSessionRegistry.size, 2);

    layerSessionRegistry.clear();
    assert.equal(layerSessionRegistry.size, 0);
    assert.equal(closeCount, 2);
  });

  it('executes concurrent queries sequentially per layer to protect spatial filter state', async () => {
    const layerId = 'seq-layer';
    const executionOrder: number[] = [];

    const ds = { close: () => {} } as any;
    const layer = {} as any;
    layerSessionRegistry.register(layerId, ds, layer);

    const task1 = layerSessionRegistry.executeSequential(layerId, async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      executionOrder.push(1);
      return 'task1-done';
    });

    const task2 = layerSessionRegistry.executeSequential(layerId, async () => {
      executionOrder.push(2);
      return 'task2-done';
    });

    const [res1, res2] = await Promise.all([task1, task2]);

    assert.equal(res1, 'task1-done');
    assert.equal(res2, 'task2-done');
    assert.deepEqual(executionOrder, [1, 2]);
  });

  it('integrates with Layer[Symbol.dispose]() for automatic session cleanup', async () => {
    let datasetClosed = false;
    const ds = {
      close: () => {
        datasetClosed = true;
      }
    } as any;
    const layerHandle = {} as any;

    const layer = new Layer('Lakes', '/path/to/lakes.shp', 'vector', 'lake-uuid-123');
    layerSessionRegistry.register(layer.id, ds, layerHandle);

    assert.equal(layerSessionRegistry.has(layer.id), true);

    // Explicit disposal
    layer[Symbol.dispose]();

    assert.equal(layerSessionRegistry.has(layer.id), false);
    assert.equal(datasetClosed, true);
  });

  it('rekeys registered session to a new identifier without closing native dataset', async () => {
    let closed = false;
    const fakeDataset = {
      close: () => {
        closed = true;
      }
    } as any;
    const fakeLayer = { name: 'Fake' } as any;
    const oldId = 'old-layer-id';
    const newId = 'new-layer-id';

    layerSessionRegistry.register(oldId, fakeDataset, fakeLayer);
    assert.equal(layerSessionRegistry.has(oldId), true);
    assert.equal(layerSessionRegistry.has(newId), false);

    layerSessionRegistry.rekey(oldId, newId);

    assert.equal(layerSessionRegistry.has(oldId), false);
    assert.equal(layerSessionRegistry.has(newId), true);
    assert.equal(closed, false, 'Native dataset must not be closed during re-key');

    const session = layerSessionRegistry.get(newId);
    assert.ok(session);
    assert.equal(session.dataset, fakeDataset);
    assert.equal(session.layer, fakeLayer);
  });

  it('throws descriptive error when rekeying to an already registered identifier', async () => {
    const ds1 = { close: () => {} } as any;
    const ds2 = { close: () => {} } as any;

    layerSessionRegistry.register('id-1', ds1, {} as any);
    layerSessionRegistry.register('id-2', ds2, {} as any);

    assert.throws(
      () => {
        layerSessionRegistry.rekey('id-1', 'id-2');
      },
      (err: any) => {
        return err.message.includes('already exists');
      }
    );
  });
});

