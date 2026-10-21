/**
 * @file processLoggingTransport.test.ts
 * @module tests/main/logging/processLoggingTransport.test
 * @description Unit tests verifying Workbench IPC logging forwarding, Geospatial Worker message routing, and worker stream line buffering.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link LoggingHub}
 * @see {@link GeospatialService}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { LoggingHub } from '../../../src/main/logging/LoggingHub';
import { GeospatialService } from '../../../src/main/worker/GeospatialService';
import type { LogPayload } from '../../../src/shared/logging';

describe('Process Boundary Logging Transports', () => {
  let testHub: LoggingHub;

  beforeEach(() => {
    testHub = new LoggingHub();
    testHub.configure({ level: 'debug' });
  });

  it('routes structured Workbench log payloads through LoggingHub', () => {
    const workbenchPayload: LogPayload = {
      timestamp: new Date().toISOString(),
      source: 'Workbench',
      level: 'error',
      numericLevel: 2,
      message: 'WebGL context lost on canvas',
      meta: [{ rendererId: 'canvas-1' }]
    };

    testHub.handleLogPayload(workbenchPayload);

    const formatted = testHub.formatLogLine(workbenchPayload, false);
    assert.ok(formatted.includes('[Workbench] ERROR: WebGL context lost on canvas'));
    assert.ok(formatted.includes('{"rendererId":"canvas-1"}'));
  });

  it('routes worker parentPort log messages through GeospatialService to LoggingHub', () => {
    const mockWorker: any = new EventEmitter();
    mockWorker.stdout = new EventEmitter();
    mockWorker.stderr = new EventEmitter();

    let handledPayload: LogPayload | null = null;
    const customHub = new LoggingHub();
    customHub.handleLogPayload = (payload: LogPayload) => {
      handledPayload = payload;
    };

    const service = new GeospatialService({
      mockWorker,
      workerPath: '/mock/path',
      loggingHub: customHub as any
    });

    // Simulate worker sending a log message over IPC
    const workerPayload: LogPayload = {
      timestamp: new Date().toISOString(),
      source: 'GeospatialWorker',
      level: 'info',
      numericLevel: 4,
      message: 'GDAL dataset initialized: 120 features'
    };

    mockWorker.emit('message', {
      type: 'log',
      payload: workerPayload
    });

    const resultPayload = handledPayload as LogPayload | null;
    assert.ok(resultPayload);
    assert.equal(resultPayload.source, 'GeospatialWorker');
    assert.equal(resultPayload.message, 'GDAL dataset initialized: 120 features');

    service.dispose();
  });

  it('line-buffers chunked worker stderr and forwards atomic log messages', () => {
    const mockWorker: any = new EventEmitter();
    mockWorker.stdout = new EventEmitter();
    mockWorker.stderr = new EventEmitter();

    const loggedMessages: string[] = [];
    const customHub = new LoggingHub();
    customHub.handleLogPayload = (payload: LogPayload) => {
      loggedMessages.push(payload.message);
    };

    const service = new GeospatialService({
      mockWorker,
      workerPath: '/mock/path',
      loggingHub: customHub as any
    });

    // Emit partial chunks
    mockWorker.stderr.emit('data', Buffer.from('ERROR 1: PROJ: proj_create: unrecognized'));
    assert.equal(loggedMessages.length, 0, 'Should buffer partial chunk without newline');

    mockWorker.stderr.emit('data', Buffer.from(' format\nERROR 2: Invalid SRS\n'));
    assert.equal(loggedMessages.length, 2, 'Should flush 2 complete buffered lines');
    assert.equal(loggedMessages[0], 'ERROR 1: PROJ: proj_create: unrecognized format');
    assert.equal(loggedMessages[1], 'ERROR 2: Invalid SRS');

    service.dispose();
  });
});
