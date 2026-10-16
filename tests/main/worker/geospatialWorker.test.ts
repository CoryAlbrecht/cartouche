/**
 * @file geospatialWorker.test.ts
 * @module tests/main/worker/geospatialWorker.test
 * @description Automated unit and integration tests for background geospatial utility process message routing, error traps, and lifecycle stability.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @see {@link initGeospatialWorker}
 * @see {@link postResponse}
 * @see {@link handleWorkerUncaughtException}
 * @see {@link handleWorkerUnhandledRejection}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import {
  initGeospatialWorker,
  postResponse,
  handleWorkerUncaughtException,
  handleWorkerUnhandledRejection
} from '../../../src/worker/geospatialWorker';
import type { WorkerRequest, WorkerResponse } from '../../../src/main/worker/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lakesGeoJsonPath = path.resolve(__dirname, '../../../../test/files/ne_10m_lakes_north_america.geojson');
const lakesShpPath = path.resolve(__dirname, '../../../../test/files/ne_10m_lakes.shp');

/**
 * @class MockParentPort
 * @description EventEmitter simulating Electron's process.parentPort MessagePortMain interface with queued asynchronous message awaiting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 */
class MockParentPort extends EventEmitter {
  public postedMessages: Array<{ response: WorkerResponse; transferList?: ArrayBuffer[] }> = [];
  private waiters: Array<(msg: { response: WorkerResponse; transferList?: ArrayBuffer[] }) => void> = [];

  /**
   * @description Simulates parentPort.postMessage sending a message to the parent process.
   * @param {WorkerResponse} response - Message payload.
   * @param {ArrayBuffer[]} [transferList] - Optional transferable buffers.
   * @returns {void}
   */
  public postMessage(response: WorkerResponse, transferList?: ArrayBuffer[]): void {
    const entry = { response, transferList };
    this.postedMessages.push(entry);
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(entry);
    }
  }

  /**
   * @description Waits for the next message posted from the worker.
   * @param {number} [timeoutMs] - Maximum duration in milliseconds to wait.
   * @returns {Promise<{ response: WorkerResponse; transferList?: ArrayBuffer[] }>}
   */
  public waitForNextMessage(timeoutMs: number = 5000): Promise<{ response: WorkerResponse; transferList?: ArrayBuffer[] }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for worker message after ${timeoutMs}ms`));
      }, timeoutMs);

      this.waiters.push((entry) => {
        clearTimeout(timer);
        resolve(entry);
      });
    });
  }

  /**
   * @description Dispatches an incoming request event from the parent process and awaits the correlated response.
   * @param {WorkerRequest} request - Incoming request payload.
   * @param {number} [timeoutMs] - Maximum duration in milliseconds to wait.
   * @returns {Promise<{ response: WorkerResponse; transferList?: ArrayBuffer[] }>}
   */
  public async dispatchAndAwait(
    request: WorkerRequest,
    timeoutMs: number = 5000
  ): Promise<{ response: WorkerResponse; transferList?: ArrayBuffer[] }> {
    const waitPromise = this.waitForNextMessage(timeoutMs);
    this.emit('message', { data: request });
    return waitPromise;
  }
}

describe('Geospatial Worker Process Message Bridge & Request Processing', () => {
  let port: MockParentPort;

  beforeEach(() => {
    port = new MockParentPort();
    initGeospatialWorker(port);
  });

  it('listens for incoming ping message on parentPort and responds with pong payload', async () => {
    const { response } = await port.dispatchAndAwait({
      id: 'req-ping-1',
      type: 'ping'
    });

    assert.equal(response.id, 'req-ping-1');
    assert.equal(response.success, true);
    assert.deepEqual(response.result, { pong: true });
  });

  it('processes openDataset requests and returns accurate layer metadata', async () => {
    const { response } = await port.dispatchAndAwait({
      id: 'req-open-1',
      type: 'openDataset',
      layerId: 'layer-lakes',
      filePath: lakesGeoJsonPath
    });

    assert.equal(response.id, 'req-open-1');
    assert.equal(response.success, true);
    assert.ok(response.result);

    const result = response.result as any;
    assert.equal(result.layerId, 'layer-lakes');
    assert.equal(result.name, 'ne_10m_lakes_north_america');
    assert.equal(result.featureCount, 1200);
    assert.equal(result.geometryKind, 'Polygon');
    assert.equal(result.crs?.authId, 'EPSG:4326');
    assert.equal(result.extent.length, 4);
  });

  it('processes queryExtent requests and includes transferable WKB ArrayBuffers', async () => {
    await port.dispatchAndAwait({
      id: 'req-open-shp',
      type: 'openDataset',
      layerId: 'layer-shp-lakes',
      filePath: lakesShpPath
    });

    const { response, transferList } = await port.dispatchAndAwait({
      id: 'req-query-shp',
      type: 'queryExtent',
      layerId: 'layer-shp-lakes',
      extent: [-100, 40, -80, 50]
    });

    assert.equal(response.id, 'req-query-shp');
    assert.equal(response.success, true);

    const queryResult = response.result as any;
    assert.equal(queryResult.layerId, 'layer-shp-lakes');
    assert.equal(queryResult.features.length, 34);

    assert.ok(Array.isArray(transferList));
    assert.ok(transferList.length > 0);
  });

  it('processes closeDataset and closeAll requests', async () => {
    await port.dispatchAndAwait({
      id: 'req-open-close',
      type: 'openDataset',
      layerId: 'layer-close',
      filePath: lakesGeoJsonPath
    });

    const { response: closeRes } = await port.dispatchAndAwait({
      id: 'req-close-1',
      type: 'closeDataset',
      layerId: 'layer-close'
    });

    assert.deepEqual(closeRes, {
      id: 'req-close-1',
      success: true,
      result: { closed: true }
    });

    const { response: closeAllRes } = await port.dispatchAndAwait({
      id: 'req-close-all',
      type: 'closeAll'
    });

    assert.deepEqual(closeAllRes, {
      id: 'req-close-all',
      success: true,
      result: { closed: true }
    });
  });

  it('processes rehydrate requests for batch dataset restoration', async () => {
    const { response } = await port.dispatchAndAwait({
      id: 'req-rehydrate-1',
      type: 'rehydrate',
      layers: [
        { layerId: 'rehydrate-1', filePath: lakesGeoJsonPath },
        { layerId: 'rehydrate-2', filePath: '/invalid/nonexistent.shp' }
      ]
    });

    assert.equal(response.id, 'req-rehydrate-1');
    assert.equal(response.success, true);

    const result = response.result as any;
    assert.deepEqual(result.rehydrated, ['rehydrate-1']);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].layerId, 'rehydrate-2');
  });

  it('returns error response when request type is unrecognized', async () => {
    const { response } = await port.dispatchAndAwait({
      id: 'req-bad-1',
      type: 'unsupportedOperation' as any
    });

    assert.equal(response.id, 'req-bad-1');
    assert.equal(response.success, false);
    assert.match(response.error || '', /Unknown worker request type/);
  });

  it('returns formatted error when dataset file cannot be opened', async () => {
    const { response } = await port.dispatchAndAwait({
      id: 'req-err-1',
      type: 'openDataset',
      layerId: 'invalid-layer',
      filePath: '/does/not/exist/lakes.geojson'
    });

    assert.equal(response.id, 'req-err-1');
    assert.equal(response.success, false);
    assert.ok(response.error && response.error.length > 0);
  });

  it('safely ignores null or malformed message events without error', async () => {
    port.emit('message', { data: null });
    port.emit('message', { data: {} });
    port.emit('message', { data: { id: 'only-id' } });

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(port.postedMessages.length, 0);
  });
});

describe('Geospatial Worker Process Error Traps & Resilient Messaging', () => {
  it('traps uncaughtException and posts formatted error payload to parentPort', () => {
    const port = new MockParentPort();
    const testError = new Error('Simulated fatal worker exception');

    handleWorkerUncaughtException(port, testError);

    assert.equal(port.postedMessages.length, 1);
    const msg = port.postedMessages[0].response;
    assert.equal(msg.id, 'worker-uncaught-exception');
    assert.equal(msg.success, false);
    assert.match(msg.error || '', /Simulated fatal worker exception/);
  });

  it('traps unhandledRejection and posts formatted error payload to parentPort', () => {
    const port = new MockParentPort();
    const testReason = new Error('Simulated unhandled promise rejection');

    handleWorkerUnhandledRejection(port, testReason);

    assert.equal(port.postedMessages.length, 1);
    const msg = port.postedMessages[0].response;
    assert.equal(msg.id, 'worker-unhandled-rejection');
    assert.equal(msg.success, false);
    assert.match(msg.error || '', /Simulated unhandled promise rejection/);
  });

  it('postResponse gracefully handles null or invalid ports without throwing', () => {
    assert.doesNotThrow(() => {
      postResponse(null, { id: 'test', success: true });
      postResponse(undefined, { id: 'test', success: true });
      postResponse({} as any, { id: 'test', success: true });
    });
  });

  it('postResponse falls back to standard postMessage if transferList fails', () => {
    let callCount = 0;
    const failingTransferPort = {
      postMessage: (_msg: any, transfer?: any[]) => {
        callCount++;
        if (transfer && transfer.length > 0) {
          throw new Error('Transferable buffers not supported on this port');
        }
      }
    };

    const buf = new ArrayBuffer(16);
    assert.doesNotThrow(() => {
      postResponse(failingTransferPort, { id: 'test-fallback', success: true }, [buf]);
    });

    // First attempt with transfer threw, second call succeeded as standard postMessage
    assert.equal(callCount, 2);
  });
});

