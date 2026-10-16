/**
 * @file GeospatialService.test.ts
 * @module tests/main/worker/GeospatialService.test
 * @description Unit and integration tests for GeospatialService process lifecycle, correlated request-response message bridge, timeout handling, and in-process fallback.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @see {@link GeospatialService}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import WKB from 'ol/format/WKB.js';
import { GeospatialService, geospatialService } from '../../../src/main/worker/GeospatialService';
import type { WorkerRequest, WorkerResponse } from '../../../src/main/worker/types';
import type { BoundingBox } from '../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lakesGeoJsonPath = path.resolve(__dirname, '../../../../test/files/ne_10m_lakes_north_america.geojson');
const lakesShpPath = path.resolve(__dirname, '../../../../test/files/ne_10m_lakes.shp');

/**
 * @class MockWorker
 * @description EventEmitter simulating an Electron UtilityProcess for IPC messaging tests.
 */
class MockWorker extends EventEmitter {
  public messages: WorkerRequest[] = [];
  public killed = false;

  public postMessage(message: WorkerRequest): void {
    this.messages.push(message);
  }

  public kill(): void {
    this.killed = true;
    this.emit('exit', 0);
  }

  public replySuccess(id: string, result: any): void {
    const res: WorkerResponse = { id, success: true, result };
    this.emit('message', res);
  }

  public replyError(id: string, error: string): void {
    const res: WorkerResponse = { id, success: false, error };
    this.emit('message', res);
  }
}

describe('GeospatialService In-Process Headless Fallback', () => {
  let service: GeospatialService;

  beforeEach(() => {
    service = new GeospatialService({ forceInProcess: true });
  });

  afterEach(async () => {
    await service.closeAll();
    service.dispose();
  });

  it('detects headless environment and initializes in-process fallback', () => {
    assert.equal(service.isInProcessFallback(), true);
    assert.equal(service.isUtilityProcessActive(), false);
    assert.equal(geospatialService.isInProcessFallback(), true);
  });

  it('opens dataset and extracts layer metadata in-process', async () => {
    const metadata = await service.openDataset('lake-1', lakesGeoJsonPath);

    assert.equal(metadata.layerId, 'lake-1');
    assert.equal(metadata.name, 'ne_10m_lakes_north_america');
    assert.equal(metadata.featureCount, 1200);
    assert.equal(metadata.geometryKind, 'Polygon');
    assert.equal(metadata.crs?.authId, 'EPSG:4326');
    assert.equal(metadata.extent.length, 4);
  });

  it('queries spatial extent and returns features with valid OGC WKB buffers in-process', async () => {
    await service.openDataset('lake-shp-1', lakesShpPath);

    // Filter over Great Lakes region
    const bbox: BoundingBox = [-100, 40, -80, 50];
    const result = await service.queryExtent('lake-shp-1', bbox);

    assert.equal(result.layerId, 'lake-shp-1');
    assert.equal(result.features.length, 34);

    const first = result.features[0];
    assert.ok(first.wkb instanceof Uint8Array, 'Feature geometry must be Uint8Array');
    assert.ok(first.wkb.byteLength > 0, 'WKB buffer must have non-zero length');

    // Deserialization via OpenLayers
    const olWkb = new WKB();
    const geom = olWkb.readGeometry(first.wkb);
    assert.ok(geom, 'OpenLayers must parse WKB geometry');
  });

  it('closes single layer and all layers in-process', async () => {
    await service.openDataset('lake-a', lakesGeoJsonPath);
    await service.openDataset('lake-b', lakesShpPath);

    const closedA = await service.closeDataset('lake-a');
    assert.equal(closedA, true);

    await service.closeAll();
    // After closeAll, closing again returns false
    const closedB = await service.closeDataset('lake-b');
    assert.equal(closedB, false);
  });

  it('rehydrates batch of layer file paths in-process', async () => {
    const result = await service.rehydrate([
      { layerId: 'l1', filePath: lakesGeoJsonPath },
      { layerId: 'l2', filePath: '/non/existent/path.shp' }
    ]);

    assert.deepEqual(result.rehydrated, ['l1']);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].layerId, 'l2');
  });
});

describe('GeospatialService Worker Process Bridge & IPC Routing', () => {
  let mockWorker: MockWorker;
  let service: GeospatialService;

  beforeEach(() => {
    mockWorker = new MockWorker();
    service = new GeospatialService({
      mockWorker,
      defaultTimeoutMs: 500
    });
  });

  afterEach(() => {
    service.dispose();
  });

  it('attaches to utility process and reports active status', () => {
    assert.equal(service.isUtilityProcessActive(), true);
    assert.equal(service.isInProcessFallback(), false);
  });

  it('dispatches typed openDataset request and resolves correlated response', async () => {
    const promise = service.openDataset('layer-worker-1', '/data/test.shp');
    assert.equal(service.getPendingCount(), 1);
    assert.equal(mockWorker.messages.length, 1);

    const sent = mockWorker.messages[0];
    assert.equal(sent.type, 'openDataset');
    assert.equal((sent as any).layerId, 'layer-worker-1');
    assert.equal((sent as any).filePath, '/data/test.shp');

    const expectedMetadata = {
      layerId: 'layer-worker-1',
      name: 'test',
      extent: [-10, -10, 10, 10] as BoundingBox,
      featureCount: 100,
      geometryKind: 'Polygon' as const
    };

    mockWorker.replySuccess(sent.id, expectedMetadata);

    const result = await promise;
    assert.deepEqual(result, expectedMetadata);
    assert.equal(service.getPendingCount(), 0);
  });

  it('correlates multiple concurrent queries in arbitrary response order', async () => {
    const p1 = service.queryExtent('layer-1', [-100, 40, -80, 50]);
    const p2 = service.queryExtent('layer-2', [-160, 60, -140, 70]);

    assert.equal(service.getPendingCount(), 2);
    assert.equal(mockWorker.messages.length, 2);

    const req1 = mockWorker.messages[0];
    const req2 = mockWorker.messages[1];

    // Reply to req2 first, then req1
    mockWorker.replySuccess(req2.id, { layerId: 'layer-2', features: [{ id: 2 }] });
    mockWorker.replySuccess(req1.id, { layerId: 'layer-1', features: [{ id: 1 }] });

    const [res1, res2] = await Promise.all([p1, p2]);

    assert.equal(res1.layerId, 'layer-1');
    assert.equal(res2.layerId, 'layer-2');
    assert.equal(service.getPendingCount(), 0);
  });

  it('rejects query when worker returns error response', async () => {
    const promise = service.openDataset('bad-layer', '/bad/file.shp');
    const req = mockWorker.messages[0];

    mockWorker.replyError(req.id, 'Corrupt shapefile header');

    await assert.rejects(promise, /Corrupt shapefile header/);
    assert.equal(service.getPendingCount(), 0);
  });

  it('rejects query when request exceeds timeout threshold', async () => {
    // Override timeout to 50ms for rapid test execution
    const promise = service.openDataset('timeout-layer', '/hang/file.shp', 50);

    await assert.rejects(promise, /timed out after 50ms/);
    assert.equal(service.getPendingCount(), 0);
  });

  it('rejects all in-flight queries and clears pending map when worker exits unexpectedly', async () => {
    const p1 = service.queryExtent('layer-crash-1');
    const p2 = service.queryExtent('layer-crash-2');

    assert.equal(service.getPendingCount(), 2);

    // Simulate unexpected crash
    mockWorker.emit('exit', 139);

    await assert.rejects(p1, /Worker process exited unexpectedly \(code 139\)/);
    await assert.rejects(p2, /Worker process exited unexpectedly \(code 139\)/);

    assert.equal(service.getPendingCount(), 0);
    assert.equal(service.isUtilityProcessActive(), false);
  });

  it('rejects queries and cleans up when service is disposed', async () => {
    const p1 = service.queryExtent('layer-pending');

    service.dispose();

    await assert.rejects(p1, /GeospatialService disposed/);
    assert.equal(mockWorker.killed, true);

    // New calls immediately reject
    await assert.rejects(
      service.openDataset('layer-after', '/path.shp'),
      /GeospatialService has been disposed/
    );
  });
});

