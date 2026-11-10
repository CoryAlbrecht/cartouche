/**
 * @file temporalPredicate.test.ts
 * @module tests/renderer/map/temporalPredicate.test
 * @description Unit tests for temporal predicate engine verifying Start Field, End Field, and Start and End Fields modes, comparison operators, boundary clamping, and null handling.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link evaluateTemporalPredicate}
 * @see {@link parseTemporalValue}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Feature from 'ol/Feature.js';
import {
  evaluateTemporalPredicate,
  parseTemporalValue,
} from '../../../src/renderer/map/temporalPredicate';
import type { LayerTemporalConfig } from '../../../src/shared/types/project';

describe('temporalPredicate: parseTemporalValue (Ticket #234)', () => {
  it('parses numeric epoch milliseconds, Date instances, and string formats', () => {
    const epoch = 1762783200000;
    assert.strictEqual(parseTemporalValue(epoch), epoch);

    const date = new Date('2026-11-10T14:00:00.000Z');
    assert.strictEqual(parseTemporalValue(date), date.getTime());

    assert.strictEqual(
      parseTemporalValue('2026-11-10T14:00:00.000Z'),
      date.getTime()
    );
    assert.strictEqual(
      parseTemporalValue('2026-11-10 14:00:00'),
      Date.parse('2026-11-10 14:00:00')
    );
    assert.strictEqual(parseTemporalValue('1762783200000'), 1762783200000);
  });

  it('returns null for null, undefined, empty, or unparseable strings', () => {
    assert.strictEqual(parseTemporalValue(null), null);
    assert.strictEqual(parseTemporalValue(undefined), null);
    assert.strictEqual(parseTemporalValue(''), null);
    assert.strictEqual(parseTemporalValue('   '), null);
    assert.strictEqual(parseTemporalValue('not-a-valid-date'), null);
    assert.strictEqual(parseTemporalValue(NaN), null);
    assert.strictEqual(parseTemporalValue(Infinity), null);
  });
});

describe('temporalPredicate: evaluateTemporalPredicate Modes & Operators (Ticket #234)', () => {
  const tStart = 1000;
  const tEnd = 2000;

  it('renders unconditionally when dynamic temporal control is disabled on layer or globally inactive', () => {
    const feature = { start_time: 5000 };

    // Layer temporal disabled
    assert.strictEqual(
      evaluateTemporalPredicate(feature, null, { frameStartUtc: 1000, globalEnabled: true }),
      true,
      'Null config must render unconditionally'
    );
    assert.strictEqual(
      evaluateTemporalPredicate(feature, { enabled: false, mode: 'start_end' }, { frameStartUtc: 1000, globalEnabled: true }),
      true,
      'Disabled layer config must render unconditionally'
    );

    // Global filtering inactive
    const activeConfig: LayerTemporalConfig = {
      enabled: true,
      mode: 'start',
      startField: 'start_time',
      startOp: '>=',
    };
    assert.strictEqual(
      evaluateTemporalPredicate(feature, activeConfig, { frameStartUtc: 1000, globalEnabled: false }),
      true,
      'Global inactive filter must render unconditionally'
    );
  });

  it('evaluates Start Field mode with > and >= comparators', () => {
    const configGte: LayerTemporalConfig = {
      enabled: true,
      mode: 'start',
      startField: 'start_time',
      startOp: '>=',
    };
    const configGt: LayerTemporalConfig = {
      enabled: true,
      mode: 'start',
      startField: 'start_time',
      startOp: '>',
    };

    // Frame start = 1000, F_start = 1000
    assert.strictEqual(
      evaluateTemporalPredicate({ start_time: 1000 }, configGte, { frameStartUtc: 1000, globalEnabled: true }),
      true,
      'T_frame_start >= F_start must be visible when equal'
    );
    assert.strictEqual(
      evaluateTemporalPredicate({ start_time: 1000 }, configGt, { frameStartUtc: 1000, globalEnabled: true }),
      false,
      'T_frame_start > F_start must be hidden when equal'
    );

    // Frame start = 1001, F_start = 1000
    assert.strictEqual(
      evaluateTemporalPredicate({ start_time: 1000 }, configGt, { frameStartUtc: 1001, globalEnabled: true }),
      true,
      'T_frame_start > F_start must be visible when frame start is greater'
    );

    // Frame start = 999, F_start = 1000
    assert.strictEqual(
      evaluateTemporalPredicate({ start_time: 1000 }, configGte, { frameStartUtc: 999, globalEnabled: true }),
      false,
      'T_frame_start >= F_start must be hidden when frame start is less'
    );
  });

  it('evaluates End Field mode with < and <= comparators', () => {
    const configLte: LayerTemporalConfig = {
      enabled: true,
      mode: 'end',
      endField: 'end_time',
      endOp: '<=',
    };
    const configLt: LayerTemporalConfig = {
      enabled: true,
      mode: 'end',
      endField: 'end_time',
      endOp: '<',
    };

    // Frame start = 2000, F_end = 2000
    assert.strictEqual(
      evaluateTemporalPredicate({ end_time: 2000 }, configLte, { frameStartUtc: 2000, globalEnabled: true }),
      true,
      'T_frame_start <= F_end must be visible when equal'
    );
    assert.strictEqual(
      evaluateTemporalPredicate({ end_time: 2000 }, configLt, { frameStartUtc: 2000, globalEnabled: true }),
      false,
      'T_frame_start < F_end must be hidden when equal'
    );

    // Frame start = 1999, F_end = 2000
    assert.strictEqual(
      evaluateTemporalPredicate({ end_time: 2000 }, configLt, { frameStartUtc: 1999, globalEnabled: true }),
      true,
      'T_frame_start < F_end must be visible when frame start is less'
    );

    // Frame start = 2001, F_end = 2000
    assert.strictEqual(
      evaluateTemporalPredicate({ end_time: 2000 }, configLte, { frameStartUtc: 2001, globalEnabled: true }),
      false,
      'T_frame_start <= F_end must be hidden when frame start is greater'
    );
  });

  it('evaluates Start and End Fields mode across boundary combinations', () => {
    const configClosed: LayerTemporalConfig = {
      enabled: true,
      mode: 'start_end',
      startField: 'valid_from',
      startOp: '>=',
      endField: 'valid_to',
      endOp: '<=',
    };
    const configOpen: LayerTemporalConfig = {
      enabled: true,
      mode: 'start_end',
      startField: 'valid_from',
      startOp: '>',
      endField: 'valid_to',
      endOp: '<',
    };

    const feature = { valid_from: tStart, valid_to: tEnd };

    // Within range (1500)
    assert.strictEqual(
      evaluateTemporalPredicate(feature, configClosed, { frameStartUtc: 1500, globalEnabled: true }),
      true,
      'Inside window must be visible'
    );
    assert.strictEqual(
      evaluateTemporalPredicate(feature, configOpen, { frameStartUtc: 1500, globalEnabled: true }),
      true,
      'Inside window must be visible for open interval'
    );

    // Exactly at start boundary (1000)
    assert.strictEqual(
      evaluateTemporalPredicate(feature, configClosed, { frameStartUtc: 1000, globalEnabled: true }),
      true,
      'Closed interval at start must be visible'
    );
    assert.strictEqual(
      evaluateTemporalPredicate(feature, configOpen, { frameStartUtc: 1000, globalEnabled: true }),
      false,
      'Open interval at start must be hidden'
    );

    // Exactly at end boundary (2000)
    assert.strictEqual(
      evaluateTemporalPredicate(feature, configClosed, { frameStartUtc: 2000, globalEnabled: true }),
      true,
      'Closed interval at end must be visible'
    );
    assert.strictEqual(
      evaluateTemporalPredicate(feature, configOpen, { frameStartUtc: 2000, globalEnabled: true }),
      false,
      'Open interval at end must be hidden'
    );

    // Before start (999) or after end (2001)
    assert.strictEqual(
      evaluateTemporalPredicate(feature, configClosed, { frameStartUtc: 999, globalEnabled: true }),
      false,
      'Before start must be hidden'
    );
    assert.strictEqual(
      evaluateTemporalPredicate(feature, configClosed, { frameStartUtc: 2001, globalEnabled: true }),
      false,
      'After end must be hidden'
    );
  });

  it('hides features with missing, null, undefined, or unparseable attribute values', () => {
    const config: LayerTemporalConfig = {
      enabled: true,
      mode: 'start_end',
      startField: 'begin',
      endField: 'finish',
    };

    assert.strictEqual(
      evaluateTemporalPredicate({}, config, { frameStartUtc: 1500, globalEnabled: true }),
      false,
      'Missing fields must evaluate to false'
    );
    assert.strictEqual(
      evaluateTemporalPredicate({ begin: null, finish: 2000 }, config, { frameStartUtc: 1500, globalEnabled: true }),
      false,
      'Null start field must evaluate to false'
    );
    assert.strictEqual(
      evaluateTemporalPredicate({ begin: 1000, finish: undefined }, config, { frameStartUtc: 1500, globalEnabled: true }),
      false,
      'Undefined end field must evaluate to false'
    );
    assert.strictEqual(
      evaluateTemporalPredicate({ begin: 'invalid-date', finish: 2000 }, config, { frameStartUtc: 1500, globalEnabled: true }),
      false,
      'Unparseable date string must evaluate to false'
    );
  });

  it('evaluates OpenLayers Feature instances identically to plain property bags', () => {
    const config: LayerTemporalConfig = {
      enabled: true,
      mode: 'start_end',
      startField: 'timestamp_from',
      endField: 'timestamp_to',
    };

    const olFeature = new Feature({
      timestamp_from: '2026-01-01T00:00:00.000Z',
      timestamp_to: '2026-12-31T23:59:59.000Z',
    });

    const mid2026 = Date.parse('2026-06-15T12:00:00.000Z');
    const in2027 = Date.parse('2027-02-01T00:00:00.000Z');

    assert.strictEqual(
      evaluateTemporalPredicate(olFeature, config, { frameStartUtc: mid2026, globalEnabled: true }),
      true,
      'OpenLayers Feature inside interval must evaluate to true'
    );
    assert.strictEqual(
      evaluateTemporalPredicate(olFeature, config, { frameStartUtc: in2027, globalEnabled: true }),
      false,
      'OpenLayers Feature outside interval must evaluate to false'
    );
  });
});
