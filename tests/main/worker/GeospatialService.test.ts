/**
 * @file GeospatialService.test.ts
 * @module tests/main/worker/GeospatialService.test
 * @description Unit and integration tests for GeospatialService process lifecycle, correlated request-response message bridge, timeout handling, and in-process fallback.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link GeospatialService}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import WKB from 'ol/format/WKB.js';
import {
  GeospatialService,
  geospatialService,
  resolveWorkerExecArgv
} from '../../../src/main/worker/GeospatialService';
import type { WorkerRequest, WorkerResponse } from '../../../src/main/worker/types';
import type { BoundingBox } from '../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lakesGeoJsonPath = path.resolve(__dirname, '../../data/ne_10m_lakes_north_america.geojson');
const lakesShpPath = path.resolve(__dirname, '../../data/ne_10m_lakes.shp');

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

describe('resolveWorkerExecArgv worker debugger port', () => {
  it('forks the worker with its debugger on the main debugger port + 1 when unpackaged', () => {
    assert.deepEqual(resolveWorkerExecArgv(false, 'ws://127.0.0.1:5860/0f6c1d2e-aaaa-bbbb-cccc-123456789abc'), [
      '--inspect=5861'
    ]);
  });

  it('opens no worker debugger in a packaged app even when the main process has a debugger', () => {
    assert.deepEqual(resolveWorkerExecArgv(true, 'ws://127.0.0.1:5858/0f6c1d2e-aaaa-bbbb-cccc-123456789abc'), []);
  });

  it('opens no worker debugger when the main process has no debugger', () => {
    assert.deepEqual(resolveWorkerExecArgv(false, undefined), []);
  });
});

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

  it('pings in-process engine and resolves with pong result', async () => {
    const result = await service.ping();
    assert.deepEqual(result, { pong: true });
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

  it('pings worker process and resolves with pong result', async () => {
    const pingPromise = service.ping();
    assert.equal(service.getPendingCount(), 1);

    const sent = mockWorker.messages[mockWorker.messages.length - 1];
    assert.equal(sent.type, 'ping');

    mockWorker.replySuccess(sent.id, { pong: true });

    const result = await pingPromise;
    assert.deepEqual(result, { pong: true });
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

describe('GeospatialService Worker Crash Recovery, Rehydration & Circuit Breaker', () => {
  it('auto-respawns worker, rehydrates active layers, and transparently retries in-flight query upon crash', async () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      defaultTimeoutMs: 1000
    });

    assert.equal(spawnedWorkers.length, 1);
    const worker1 = spawnedWorkers[0];

    // 1. Open layer-1 on worker 1
    const openPromise = service.openDataset('layer-1', '/data/lake.shp');
    assert.equal(worker1.messages.length, 1);
    assert.equal(worker1.messages[0].type, 'openDataset');

    worker1.replySuccess(worker1.messages[0].id, {
      layerId: 'layer-1',
      name: 'lake',
      extent: [-100, 40, -80, 50],
      featureCount: 50,
      geometryKind: 'Polygon'
    });

    const meta = await openPromise;
    assert.equal(meta.layerId, 'layer-1');
    assert.deepEqual(service.getActiveLayerIds(), ['layer-1']);

    // 2. Launch query on layer-1
    const queryPromise = service.queryExtent('layer-1', [-100, 40, -80, 50]);
    assert.equal(worker1.messages.length, 2);
    assert.equal(worker1.messages[1].type, 'queryExtent');

    // 3. Simulate unexpected crash on worker 1
    worker1.emit('exit', 139);

    // 4. Assert worker 2 was spawned automatically
    assert.equal(spawnedWorkers.length, 2);
    const worker2 = spawnedWorkers[1];

    // Worker 2 should receive atomic rehydrate message first
    const rehydrateMsg = worker2.messages.find((m) => m.type === 'rehydrate');
    assert.ok(rehydrateMsg, 'Worker 2 must receive rehydrate message');
    assert.deepEqual((rehydrateMsg as any).layers, [{ layerId: 'layer-1', filePath: '/data/lake.shp' }]);

    // Worker 2 completes rehydration
    worker2.replySuccess(rehydrateMsg.id, { rehydrated: ['layer-1'], failed: [] });

    // Allow microtasks to complete rehydration and re-dispatch query
    await new Promise((resolve) => setImmediate(resolve));

    // Worker 2 receives the retried queryExtent message
    const retriedQueryMsg = worker2.messages.find((m) => m.type === 'queryExtent');
    assert.ok(retriedQueryMsg, 'Worker 2 must receive retried queryExtent message');
    assert.equal((retriedQueryMsg as any).layerId, 'layer-1');

    // Worker 2 replies success with features
    worker2.replySuccess(retriedQueryMsg.id, {
      layerId: 'layer-1',
      features: [{ id: 1, wkb: new Uint8Array([1, 2, 3]) }]
    });

    // Caller's queryPromise resolves transparently without UI error
    const queryRes = await queryPromise;
    assert.equal(queryRes.layerId, 'layer-1');
    assert.equal(queryRes.features.length, 1);
    assert.equal(service.getFailureCount('layer-1'), 0);

    service.dispose();
  });

  it('aborts retries and trips circuit breaker after 3 consecutive failures on a specific layer', async () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      maxConsecutiveFailures: 3,
      defaultTimeoutMs: 1000
    });

    // Launch query on poison-pill layer
    const poisonPromise = service.queryExtent('poison-layer');
    assert.equal(spawnedWorkers.length, 1);

    // Crash 1
    spawnedWorkers[0].emit('exit', 139);
    assert.equal(service.getFailureCount('poison-layer'), 1);
    assert.equal(spawnedWorkers.length, 2);

    // Crash 2
    spawnedWorkers[1].emit('exit', 139);
    assert.equal(service.getFailureCount('poison-layer'), 2);
    assert.equal(spawnedWorkers.length, 3);

    // Crash 3 -> Trips circuit breaker!
    spawnedWorkers[2].emit('exit', 139);
    assert.equal(service.getFailureCount('poison-layer'), 3);

    // Pending query must reject with explicit circuit breaker error
    await assert.rejects(
      poisonPromise,
      /Query failed: circuit breaker tripped after 3 consecutive failures for layer "poison-layer"/
    );

    service.dispose();
  });

  it('resets consecutive failure count on a layer upon query success', async () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      maxConsecutiveFailures: 3,
      defaultTimeoutMs: 1000
    });

    const queryPromise = service.queryExtent('recover-layer');

    // Crash once -> count = 1
    spawnedWorkers[0].emit('exit', 139);
    assert.equal(service.getFailureCount('recover-layer'), 1);
    assert.equal(spawnedWorkers.length, 2);

    // Worker 2 answers retried query successfully
    const retriedMsg = spawnedWorkers[1].messages.find((m) => m.type === 'queryExtent');
    assert.ok(retriedMsg);
    spawnedWorkers[1].replySuccess(retriedMsg.id, { layerId: 'recover-layer', features: [] });

    await queryPromise;
    // Failure count must be reset to 0
    assert.equal(service.getFailureCount('recover-layer'), 0);

    service.dispose();
  });

  it('tracks active layers and cleans up on closeDataset and closeAll', async () => {
    const mockWorker = new MockWorker();
    const service = new GeospatialService({ mockWorker });

    const p1 = service.openDataset('l1', '/path/1.shp');
    mockWorker.replySuccess(mockWorker.messages[0].id, { layerId: 'l1', name: '1', extent: [0, 0, 1, 1], featureCount: 1, geometryKind: 'Point' });
    await p1;

    const p2 = service.openDataset('l2', '/path/2.shp');
    mockWorker.replySuccess(mockWorker.messages[1].id, { layerId: 'l2', name: '2', extent: [0, 0, 1, 1], featureCount: 1, geometryKind: 'Point' });
    await p2;

    assert.deepEqual(service.getActiveLayerIds().sort(), ['l1', 'l2'].sort());

    const pClose1 = service.closeDataset('l1');
    mockWorker.replySuccess(mockWorker.messages[2].id, { closed: true });
    await pClose1;

    assert.deepEqual(service.getActiveLayerIds(), ['l2']);

    const pCloseAll = service.closeAll();
    mockWorker.replySuccess(mockWorker.messages[3].id, { closed: true });
    await pCloseAll;

    assert.deepEqual(service.getActiveLayerIds(), []);

    service.dispose();
  });

  it('resolves valid worker candidate path in development and preview environments', () => {
    const service = new GeospatialService({ forceInProcess: true });
    const resolved = (service as any).resolveWorkerPath();
    assert.ok(resolved.endsWith('geospatialWorker.cjs'), 'Must resolve to geospatialWorker.cjs');
    service.dispose();
  });

  it('enforces rapid crash threshold (5 consecutive crashes) at zero-layer startup and stops respawning', () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      maxConsecutiveWorkerCrashes: 5
    });

    // Zero layers are loaded: service.getActiveLayerIds() is empty []
    assert.deepEqual(service.getActiveLayerIds(), []);
    assert.equal(spawnedWorkers.length, 1);
    assert.equal(service.getConsecutiveWorkerCrashes(), 0);

    // Crash 1
    spawnedWorkers[0].emit('exit', 1);
    assert.equal(service.getConsecutiveWorkerCrashes(), 1);
    assert.equal(spawnedWorkers.length, 2);

    // Crash 2
    spawnedWorkers[1].emit('exit', 1);
    assert.equal(service.getConsecutiveWorkerCrashes(), 2);
    assert.equal(spawnedWorkers.length, 3);

    // Crash 3
    spawnedWorkers[2].emit('exit', 1);
    assert.equal(service.getConsecutiveWorkerCrashes(), 3);
    assert.equal(spawnedWorkers.length, 4);

    // Crash 4
    spawnedWorkers[3].emit('exit', 1);
    assert.equal(service.getConsecutiveWorkerCrashes(), 4);
    assert.equal(spawnedWorkers.length, 5);

    // Crash 5 -> Threshold reached! Must abort auto-respawn and not spawn worker 6
    spawnedWorkers[4].emit('exit', 1);
    assert.equal(service.getConsecutiveWorkerCrashes(), 5);
    assert.equal(spawnedWorkers.length, 5);
    assert.equal(service.isUtilityProcessActive(), false);

    service.dispose();
  });

  it('resets consecutive crash counter only after worker demonstrates operational health via successful response', async () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      maxConsecutiveWorkerCrashes: 5
    });

    // Crash twice
    spawnedWorkers[0].emit('exit', 1);
    spawnedWorkers[1].emit('exit', 1);
    assert.equal(service.getConsecutiveWorkerCrashes(), 2);
    assert.equal(spawnedWorkers.length, 3);

    // Worker 3 demonstrates operational health by successfully answering a ping
    const pingPromise = service.ping();
    const currentWorker = spawnedWorkers[2];
    const pingMsg = currentWorker.messages[currentWorker.messages.length - 1];
    assert.equal(pingMsg.type, 'ping');

    currentWorker.replySuccess(pingMsg.id, { pong: true });
    await pingPromise;

    // Consecutive crash counter must now be reset to 0!
    assert.equal(service.getConsecutiveWorkerCrashes(), 0);

    service.dispose();
  });

  it('does not initiate auto-respawn upon clean process termination with exit code 0', () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory
    });

    assert.equal(spawnedWorkers.length, 1);

    // Emit clean exit code 0
    spawnedWorkers[0].emit('exit', 0);

    // Must not spawn a new worker
    assert.equal(spawnedWorkers.length, 1);
    assert.equal(service.isUtilityProcessActive(), false);
    assert.equal(service.getConsecutiveWorkerCrashes(), 0);

    service.dispose();
  });
});

describe('GeospatialService In-Process Engine Fallback on Repeated Crashes', () => {
  it('activates in-process GeospatialEngine fallback upon exceeding maxConsecutiveWorkerCrashes and rehydrates open layers', async () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      maxConsecutiveWorkerCrashes: 2,
      defaultTimeoutMs: 2000
    });

    assert.equal(spawnedWorkers.length, 1);
    const worker1 = spawnedWorkers[0];

    // Open real dataset on worker 1
    const openPromise = service.openDataset('fallback-lake', lakesGeoJsonPath);
    assert.equal(worker1.messages.length, 1);
    worker1.replySuccess(worker1.messages[0].id, {
      layerId: 'fallback-lake',
      name: 'lakes',
      extent: [-180, -90, 180, 90],
      featureCount: 1200,
      geometryKind: 'Polygon'
    });
    await openPromise;

    assert.deepEqual(service.getActiveLayerIds(), ['fallback-lake']);
    assert.equal(service.isInProcessFallback(), false);
    assert.equal(service.isUtilityProcessActive(), true);

    // Crash 1: Auto-respawn occurs (1 crash out of 2)
    worker1.emit('exit', 139);
    assert.equal(spawnedWorkers.length, 2);
    assert.equal(service.getConsecutiveWorkerCrashes(), 1);

    const worker2 = spawnedWorkers[1];
    // Complete rehydrate on worker 2
    const rehydrateMsg = worker2.messages.find((m) => m.type === 'rehydrate');
    assert.ok(rehydrateMsg);
    worker2.replySuccess(rehydrateMsg.id, { rehydrated: ['fallback-lake'], failed: [] });

    // Allow microtasks to complete rehydration
    await new Promise((resolve) => setImmediate(resolve));

    // Crash 2: Exceeds maxConsecutiveWorkerCrashes (2 >= 2) -> Activates in-process fallback!
    worker2.emit('exit', 139);

    // Ensure worker auto-respawn stopped
    assert.equal(spawnedWorkers.length, 2);
    assert.equal(service.isUtilityProcessActive(), false);
    assert.equal(service.isInProcessFallback(), true);

    // Verify active layer was rehydrated in-process and can be queried directly
    const queryResult = await service.queryExtent('fallback-lake', [-100, 40, -80, 50]);
    assert.equal(queryResult.layerId, 'fallback-lake');
    assert.ok(queryResult.features.length > 0);

    // Verify subsequent openDataset operates in-process seamlessly
    const meta2 = await service.openDataset('fallback-shp', lakesShpPath);
    assert.equal(meta2.layerId, 'fallback-shp');
    assert.equal(meta2.geometryKind, 'Polygon');

    service.dispose();
  });

  it('transparently executes in-flight pending queries against fallback engine when crash threshold is reached', async () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      maxConsecutiveWorkerCrashes: 1,
      defaultTimeoutMs: 2000
    });

    // Seed active layer
    const openP = service.openDataset('lake-inflight', lakesGeoJsonPath);
    // Worker 1 replies
    spawnedWorkers[0].replySuccess(spawnedWorkers[0].messages[0].id, {
      layerId: 'lake-inflight',
      name: 'lakes',
      extent: [-180, -90, 180, 90],
      featureCount: 1200,
      geometryKind: 'Polygon'
    });
    await openP;

    // Launch in-flight query
    const inflightQueryPromise = service.queryExtent('lake-inflight', [-100, 40, -80, 50]);
    assert.equal(service.getPendingCount(), 1);

    // Crash 1: Immediately hits crash threshold (1 >= 1) -> Fallback executes inflight query
    spawnedWorkers[0].emit('exit', 139);

    const result = await inflightQueryPromise;
    assert.equal(result.layerId, 'lake-inflight');
    assert.ok(result.features.length > 0);
    assert.equal(service.isInProcessFallback(), true);
    assert.equal(service.isUtilityProcessActive(), false);

    service.dispose();
  });

  it('activates in-process fallback when worker factory fails to produce a worker on respawn', async () => {
    let spawnCount = 0;
    const mockWorkerFactory = () => {
      spawnCount++;
      if (spawnCount > 1) {
        return null;
      }
      return new MockWorker();
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      defaultTimeoutMs: 2000
    });

    // Open dataset
    const pOpen = service.openDataset('lake-spawn-fail', lakesGeoJsonPath);
    (service as any).worker.replySuccess((service as any).worker.messages[0].id, {
      layerId: 'lake-spawn-fail',
      name: 'lakes',
      extent: [-180, -90, 180, 90],
      featureCount: 1200,
      geometryKind: 'Polygon'
    });
    await pOpen;

    // Crash worker: respawn factory returns null
    (service as any).worker.emit('exit', 1);

    // Service falls back to in-process engine
    assert.equal(service.isInProcessFallback(), true);
    assert.equal(service.isUtilityProcessActive(), false);

    // Query succeeds on fallback engine
    const res = await service.queryExtent('lake-spawn-fail');
    assert.equal(res.layerId, 'lake-spawn-fail');
    assert.equal(res.features.length, 1200);

    service.dispose();
  });

  it('maintains authoritative edit cache in Main process, forwards edits to Worker, and replays all cached edits on Worker crash recovery before retrying queries', async () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      defaultTimeoutMs: 1000
    });

    const worker1 = spawnedWorkers[0];

    // 1. Open layer on worker 1
    const openP = service.openDataset('layer-edits-1', lakesShpPath);
    worker1.replySuccess(worker1.messages[0].id, {
      layerId: 'layer-edits-1',
      name: 'lakes',
      extent: [-180, -90, 180, 90],
      featureCount: 1353,
      geometryKind: 'Polygon'
    });
    await openP;

    assert.deepEqual(service.getDirtyLayerIds(), []);

    // 2. Stage a modified feature and a newly added feature
    const stage1P = service.stageFeatureEdit('layer-edits-1', {
      id: 0,
      properties: { name: 'Crash Resilient Lake' }
    });
    const stageMsg1 = worker1.messages[worker1.messages.length - 1];
    assert.equal(stageMsg1.type, 'stageFeatureEdit');
    assert.equal((stageMsg1 as any).layerId, 'layer-edits-1');
    assert.deepEqual((stageMsg1 as any).edit, {
      id: 0,
      properties: { name: 'Crash Resilient Lake' }
    });
    worker1.replySuccess(stageMsg1.id, { success: true });
    await stage1P;

    const stage2P = service.stageFeatureEdit('layer-edits-1', {
      id: 888888,
      isNew: true,
      properties: { name: 'New Staged Lake' }
    });
    const stageMsg2 = worker1.messages[worker1.messages.length - 1];
    assert.equal(stageMsg2.type, 'stageFeatureEdit');
    worker1.replySuccess(stageMsg2.id, { success: true });
    await stage2P;

    assert.deepEqual(service.getDirtyLayerIds(), ['layer-edits-1']);

    // 3. Issue a paginated query and simulate Worker 1 crash while query is in flight
    const queryP = service.queryExtent('layer-edits-1', { start: 0, max: 10 });
    worker1.emit('exit', 139);

    assert.equal(spawnedWorkers.length, 2);
    const worker2 = spawnedWorkers[1];

    // 4. Worker 2 receives rehydrate first
    const rehydrateMsg = worker2.messages.find((m) => m.type === 'rehydrate');
    assert.ok(rehydrateMsg, 'Worker 2 must receive rehydrate first');
    worker2.replySuccess(rehydrateMsg.id, { rehydrated: ['layer-edits-1'], failed: [] });

    await new Promise((resolve) => setImmediate(resolve));

    // 5. Worker 2 must receive replayed stageFeatureEdit messages BEFORE the retried queryExtent
    const replayEdit1 = worker2.messages.find(
      (m) => m.type === 'stageFeatureEdit' && (m as any).edit?.id === 0
    );
    assert.ok(replayEdit1, 'Worker 2 must receive replayed modified feature edit');
    worker2.replySuccess(replayEdit1.id, { success: true });

    await new Promise((resolve) => setImmediate(resolve));

    const replayEdit2 = worker2.messages.find(
      (m) => m.type === 'stageFeatureEdit' && (m as any).edit?.id === 888888
    );
    assert.ok(replayEdit2, 'Worker 2 must receive replayed added feature edit');
    worker2.replySuccess(replayEdit2.id, { success: true });

    await new Promise((resolve) => setImmediate(resolve));

    // 6. Now Worker 2 receives the retried queryExtent
    const retriedQuery = worker2.messages.find((m) => m.type === 'queryExtent');
    assert.ok(retriedQuery, 'Worker 2 must receive retried queryExtent after edit replay');
    worker2.replySuccess(retriedQuery.id, {
      layerId: 'layer-edits-1',
      features: [{ id: 0, properties: { name: 'Crash Resilient Lake' } }],
      totalMatched: 1354
    });

    const queryRes = await queryP;
    assert.equal(queryRes.features[0].properties?.name, 'Crash Resilient Lake');
    assert.equal(queryRes.totalMatched, 1354);

    // 7. Clearing layer edits removes layer from dirty list and forwards clearLayerEdits
    const clearP = service.clearLayerEdits('layer-edits-1');
    const clearMsg = worker2.messages[worker2.messages.length - 1];
    assert.equal(clearMsg.type, 'clearLayerEdits');
    worker2.replySuccess(clearMsg.id, { success: true });
    await clearP;

    assert.deepEqual(service.getDirtyLayerIds(), []);

    service.dispose();
  });

  it('replays cached edits into in-process fallback engine when worker crash threshold is exceeded', async () => {
    const spawnedWorkers: MockWorker[] = [];
    const mockWorkerFactory = () => {
      const w = new MockWorker();
      spawnedWorkers.push(w);
      return w;
    };

    const service = new GeospatialService({
      mockWorkerFactory,
      maxConsecutiveWorkerCrashes: 1,
      defaultTimeoutMs: 2000
    });

    const openP = service.openDataset('lake-fallback-edits', lakesShpPath);
    spawnedWorkers[0].replySuccess(spawnedWorkers[0].messages[0].id, {
      layerId: 'lake-fallback-edits',
      name: 'lakes',
      extent: [-180, -90, 180, 90],
      featureCount: 1353,
      geometryKind: 'Polygon'
    });
    await openP;

    const stageP = service.stageFeatureEdit('lake-fallback-edits', {
      id: 0,
      properties: { name: 'Fallback Edited Lake' }
    });
    const stageMsg = spawnedWorkers[0].messages[spawnedWorkers[0].messages.length - 1];
    spawnedWorkers[0].replySuccess(stageMsg.id, { success: true });
    await stageP;

    // Trigger crash hitting threshold (1 >= 1) -> activates in-process fallback and replays edits
    const queryP = service.queryExtent('lake-fallback-edits', { start: 0, max: 5 });
    spawnedWorkers[0].emit('exit', 139);

    const res = await queryP;
    assert.equal(service.isInProcessFallback(), true);
    assert.equal(res.features.length, 5);
    assert.equal(res.features[0].properties?.name, 'Fallback Edited Lake');

    service.dispose();
  });
});

