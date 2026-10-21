/**
 * @file logging.test.ts
 * @module tests/shared/logging/logging.test
 * @description Unit tests verifying universal logging facade ergonomics, level normalization, error serialization, and sink dispatch.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link logging}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  logging,
  setLogSink,
  resetLogSink,
  serializeError,
  LOG_LEVEL_NAMES,
  LOG_LEVEL_VALUES,
  type LogLevel,
  type LogPayload
} from '../../../src/shared/logging/index';

describe('Universal Logging Facade', () => {
  let capturedLogs: LogPayload[] = [];

  beforeEach(() => {
    capturedLogs = [];
    setLogSink((payload) => {
      capturedLogs.push(payload);
    });
  });

  it('exposes canonical log level mappings ascending by verbosity', () => {
    assert.equal(LOG_LEVEL_NAMES[0], 'none');
    assert.equal(LOG_LEVEL_NAMES[1], 'critical');
    assert.equal(LOG_LEVEL_NAMES[2], 'error');
    assert.equal(LOG_LEVEL_NAMES[3], 'warn');
    assert.equal(LOG_LEVEL_NAMES[4], 'info');
    assert.equal(LOG_LEVEL_NAMES[5], 'debug');

    assert.equal(LOG_LEVEL_VALUES.none, 0);
    assert.equal(LOG_LEVEL_VALUES.critical, 1);
    assert.equal(LOG_LEVEL_VALUES.error, 2);
    assert.equal(LOG_LEVEL_VALUES.warn, 3);
    assert.equal(LOG_LEVEL_VALUES.info, 4);
    assert.equal(LOG_LEVEL_VALUES.debug, 5);
  });

  it('supports equivalent invocations across numeric level, string name, and helper method', () => {
    logging(1, 'Critical message via number', { code: 500 });
    logging('critical', 'Critical message via name', { code: 500 });
    logging.critical('Critical message via method', { code: 500 });

    assert.equal(capturedLogs.length, 3);
    for (const entry of capturedLogs) {
      assert.equal(entry.level, 'critical');
      assert.equal(entry.numericLevel, 1);
      assert.deepEqual(entry.meta, [{ code: 500 }]);
      assert.ok(entry.timestamp);
    }
    assert.equal(capturedLogs[0].message, 'Critical message via number');
    assert.equal(capturedLogs[1].message, 'Critical message via name');
    assert.equal(capturedLogs[2].message, 'Critical message via method');
  });

  it('supports all level helper methods: critical, error, warn, info, and debug', () => {
    logging.critical('crit test');
    logging.error('error test');
    logging.warn('warn test');
    logging.info('info test');
    logging.debug('debug test');

    assert.equal(capturedLogs.length, 5);
    const levels: LogLevel[] = ['critical', 'error', 'warn', 'info', 'debug'];
    const expectedNumerics = [1, 2, 3, 4, 5];

    levels.forEach((lvl, idx) => {
      assert.equal(capturedLogs[idx].level, lvl);
      assert.equal(capturedLogs[idx].numericLevel, expectedNumerics[idx]);
      assert.equal(capturedLogs[idx].message, `${lvl === 'critical' ? 'crit' : lvl} test`);
    });
  });

  it('ignores none (0) level messages from dispatching payloads', () => {
    logging(0, 'should be suppressed');
    logging('none', 'should also be suppressed');

    assert.equal(capturedLogs.length, 0);
  });

  it('normalizes out-of-range numeric levels by clamping to [0, 5]', () => {
    logging(99, 'Clamped to debug');
    logging(-5, 'Suppressed as none');

    assert.equal(capturedLogs.length, 1);
    assert.equal(capturedLogs[0].level, 'debug');
    assert.equal(capturedLogs[0].numericLevel, 5);
  });

  it('serializes Error instances preserving name, message, stack, and custom properties', () => {
    const error = new Error('Database connection failed');
    (error as any).code = 'ECONNREFUSED';

    const serialized = serializeError(error);
    assert.equal(serialized.name, 'Error');
    assert.equal(serialized.message, 'Database connection failed');
    assert.ok(typeof serialized.stack === 'string');
    assert.equal(serialized.code, 'ECONNREFUSED');
  });

  it('automatically serializes Error instances passed in meta arguments', () => {
    const err = new TypeError('Invalid CRS projection string');
    logging.error('Projection failed', err, { layerId: 'layer-123' });

    assert.equal(capturedLogs.length, 1);
    const entry = capturedLogs[0];
    assert.equal(entry.level, 'error');
    assert.equal(entry.message, 'Projection failed');
    assert.equal(entry.meta?.length, 2);

    const serializedErr = entry.meta![0];
    assert.equal(serializedErr.name, 'TypeError');
    assert.equal(serializedErr.message, 'Invalid CRS projection string');
    assert.ok(typeof serializedErr.stack === 'string');
    assert.deepEqual(entry.meta![1], { layerId: 'layer-123' });
  });

  it('falls back safely without throwing when no sink is registered in headless environments', () => {
    resetLogSink();
    assert.doesNotThrow(() => {
      logging.info('Headless message with no sink');
    });
  });
});

