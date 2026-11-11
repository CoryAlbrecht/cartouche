/**
 * @file timeFilterMath.test.ts
 * @module tests/renderer/map/timeFilterMath.test
 * @description Unit tests for pure calendar-aware UTC temporal mathematics, stepping, range calculation, and auto-detection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @see {@link isLeapYearUtc}
 * @see {@link getDaysInMonthUtc}
 * @see {@link stepTemporalTimestamp}
 * @see {@link computeFrameEnd}
 * @see {@link snapToTemporalStep}
 * @see {@link computeTemporalStepAttribute}
 * @see {@link calculateActiveTemporalRange}
 * @see {@link autoDetectTemporalRange}
 * @see {@link extractFirstFeatureProperties}
 * @see {@link MIN_TIME_FILTER_STEP}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url, {
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
  },
});

const {
  isLeapYearUtc,
  getDaysInMonthUtc,
  stepTemporalTimestamp,
  computeFrameEnd,
  snapToTemporalStep,
  computeTemporalStepAttribute,
  calculateActiveTemporalRange,
  autoDetectTemporalRange,
  extractFirstFeatureProperties,
  MIN_TIME_FILTER_STEP,
} = jiti(
  '@renderer/map/timeFilterMath'
) as typeof import('@renderer/map/timeFilterMath');

const {
  setTimeFilterRange,
  timeFilterRangeStartSignal,
  timeFilterRangeEndSignal,
} = jiti(
  '@renderer/state/timeFilterSignals'
) as typeof import('@renderer/state/timeFilterSignals');

import type { LayerDescriptor, GisFeature } from '../../../src/shared/types';

describe('timeFilterMath: Calendar-Aware UTC Arithmetic & Stepping (Ticket #235)', () => {
  it('correctly determines leap years in UTC', () => {
    assert.strictEqual(isLeapYearUtc(2024), true);
    assert.strictEqual(isLeapYearUtc(2020), true);
    assert.strictEqual(isLeapYearUtc(2000), true);
    assert.strictEqual(isLeapYearUtc(2023), false);
    assert.strictEqual(isLeapYearUtc(2100), false);
    assert.strictEqual(isLeapYearUtc(1900), false);
  });

  it('correctly calculates days in month in UTC', () => {
    assert.strictEqual(getDaysInMonthUtc(2024, 1), 29); // Feb 2024 leap
    assert.strictEqual(getDaysInMonthUtc(2023, 1), 28); // Feb 2023 non-leap
    assert.strictEqual(getDaysInMonthUtc(2024, 0), 31); // Jan
    assert.strictEqual(getDaysInMonthUtc(2024, 3), 30); // Apr
  });

  it('steps milliseconds for Seconds, Minutes, Hours, and Days', () => {
    const base = Date.UTC(2026, 10, 10, 12, 0, 0, 0);

    // +5 Seconds
    assert.strictEqual(
      stepTemporalTimestamp(base, 5, 'Seconds'),
      base + 5000
    );

    // -2 Minutes
    assert.strictEqual(
      stepTemporalTimestamp(base, -2, 'Minutes'),
      base - 120000
    );

    // +3 Hours
    assert.strictEqual(
      stepTemporalTimestamp(base, 3, 'Hours'),
      base + 10800000
    );

    // +1 Day
    assert.strictEqual(
      stepTemporalTimestamp(base, 1, 'Days'),
      base + 86400000
    );
  });

  it('steps calendar months with month-end day clamping', () => {
    // Jan 31, 2024 + 1 Month -> Feb 29, 2024 (leap year clamping)
    const jan31Leap = Date.UTC(2024, 0, 31, 14, 0, 0, 0);
    const feb29 = stepTemporalTimestamp(jan31Leap, 1, 'Months');
    const dFeb = new Date(feb29);
    assert.strictEqual(dFeb.getUTCFullYear(), 2024);
    assert.strictEqual(dFeb.getUTCMonth(), 1); // Feb
    assert.strictEqual(dFeb.getUTCDate(), 29);
    assert.strictEqual(dFeb.getUTCHours(), 14);

    // Jan 31, 2023 + 1 Month -> Feb 28, 2023 (non-leap clamping)
    const jan31NonLeap = Date.UTC(2023, 0, 31, 14, 0, 0, 0);
    const feb28 = stepTemporalTimestamp(jan31NonLeap, 1, 'Months');
    const dFebNonLeap = new Date(feb28);
    assert.strictEqual(dFebNonLeap.getUTCFullYear(), 2023);
    assert.strictEqual(dFebNonLeap.getUTCMonth(), 1); // Feb
    assert.strictEqual(dFebNonLeap.getUTCDate(), 28);

    // Aug 31, 2024 + 1 Month -> Sep 30, 2024
    const aug31 = Date.UTC(2024, 7, 31, 10, 0, 0, 0);
    const sep30 = stepTemporalTimestamp(aug31, 1, 'Months');
    const dSep = new Date(sep30);
    assert.strictEqual(dSep.getUTCFullYear(), 2024);
    assert.strictEqual(dSep.getUTCMonth(), 8); // Sep
    assert.strictEqual(dSep.getUTCDate(), 30);
  });

  it('steps calendar years with Feb 29 leap day clamping', () => {
    // Feb 29, 2024 + 1 Year -> Feb 28, 2025
    const feb29Leap = Date.UTC(2024, 1, 29, 12, 0, 0, 0);
    const feb28Next = stepTemporalTimestamp(feb29Leap, 1, 'Years');
    const dNext = new Date(feb28Next);
    assert.strictEqual(dNext.getUTCFullYear(), 2025);
    assert.strictEqual(dNext.getUTCMonth(), 1);
    assert.strictEqual(dNext.getUTCDate(), 28);
    assert.strictEqual(dNext.getUTCHours(), 12);

    // Feb 29, 2024 + 4 Years -> Feb 29, 2028 (leap year retains Feb 29)
    const feb29Later = stepTemporalTimestamp(feb29Leap, 4, 'Years');
    const dLater = new Date(feb29Later);
    assert.strictEqual(dLater.getUTCFullYear(), 2028);
    assert.strictEqual(dLater.getUTCMonth(), 1);
    assert.strictEqual(dLater.getUTCDate(), 29);
  });

  it('supports micro-decimal stepping down to MIN_TIME_FILTER_STEP (0.000000031623 years ~ 1 second)', () => {
    const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
    const result = stepTemporalTimestamp(base, MIN_TIME_FILTER_STEP, 'Years');
    const deltaMs = result - base;
    // 0.000000031623 * 365 * 86400 * 1000 = 997.26 ms ≈ 1000 ms = 1 second
    assert.ok(
      Math.abs(deltaMs - 1000) <= 5,
      `Delta should be approximately 1000 ms, got ${deltaMs} ms`
    );
  });

  it('computeTemporalStepAttribute computes exact millisecond step for fixed units and 1 for calendar-variable units', () => {
    assert.strictEqual(computeTemporalStepAttribute(50, 'Milliseconds'), 50);
    assert.strictEqual(computeTemporalStepAttribute(5, 'Seconds'), 5000);
    assert.strictEqual(computeTemporalStepAttribute(2.5, 'Minutes'), 150000);
    assert.strictEqual(computeTemporalStepAttribute(3, 'Hours'), 10800000);
    assert.strictEqual(computeTemporalStepAttribute(1, 'Days'), 86400000);
    assert.strictEqual(computeTemporalStepAttribute(2, 'Weeks'), 1209600000);
    assert.strictEqual(computeTemporalStepAttribute(1, 'Months'), 1);
    assert.strictEqual(computeTemporalStepAttribute(1, 'Years'), 1);
  });

  it('computeFrameEnd clamps frame end to rangeEnd boundary', () => {
    const start = 1_000_000;
    const step = 5;
    const unit = 'Seconds';
    const rangeEnd = 1_003_000;

    const end = computeFrameEnd(start, step, unit, rangeEnd);
    assert.strictEqual(end, 1_003_000, 'End must be clamped to rangeEnd (1003000)');

    const wideRangeEnd = 1_010_000;
    const end2 = computeFrameEnd(start, step, unit, wideRangeEnd);
    assert.strictEqual(end2, 1_005_000, 'End must be 1005000 when within rangeEnd');
  });

  it('snapToTemporalStep snaps continuous timestamps to discrete calendar-stepped boundaries', () => {
    const start = Date.UTC(2026, 9, 20, 14, 0, 0); // 2026-10-20 14:00:00 UTC
    const end = Date.UTC(2027, 9, 20, 14, 0, 0);

    const plusOneMonth = stepTemporalTimestamp(start, 1, 'Months');
    assert.strictEqual(
      plusOneMonth,
      Date.UTC(2026, 10, 20, 14, 0, 0),
      'Adding 1 month to 2026-10-20 must produce 2026-11-20'
    );

    const midway = start + 25 * 86400000;
    const snapped = snapToTemporalStep(midway, start, end, 1, 'Months');
    assert.strictEqual(
      snapped,
      Date.UTC(2026, 10, 20, 14, 0, 0),
      'Snapping halfway through the month must land on exact calendar month date'
    );

    // Clamping checks
    const underflow = snapToTemporalStep(start - 100000, start, end, 1, 'Days');
    assert.strictEqual(underflow, start, 'Underflow must clamp to rangeStart');

    const overflow = snapToTemporalStep(end + 100000, start, end, 1, 'Days');
    assert.strictEqual(overflow, end, 'Overflow must clamp to rangeEnd');
  });
});

describe('timeFilterMath: calculateActiveTemporalRange (Ticket #235)', () => {
  it('returns null when no active temporal layers exist', () => {
    const layers: LayerDescriptor[] = [
      { id: 'l1', name: 'Non-temporal', temporalEnabled: false } as any,
    ];
    assert.strictEqual(calculateActiveTemporalRange(layers, []), null);
  });

  it('aggregates minimum and maximum timestamps across active temporal layer features', () => {
    const layers: LayerDescriptor[] = [
      {
        id: 'layer-events',
        name: 'Events',
        temporal: {
          enabled: true,
          mode: 'start_end',
          startField: 'began',
          endField: 'ended',
        },
      } as any,
    ];

    const features: GisFeature[] = [
      {
        id: 'f1',
        layerId: 'layer-events',
        geometryType: 'Point',
        coordinates: [0, 0],
        properties: { began: 1000, ended: 2000 },
      },
      {
        id: 'f2',
        layerId: 'layer-events',
        geometryType: 'Point',
        coordinates: [1, 1],
        properties: { began: 1500, ended: 3500 },
      },
      {
        id: 'f3',
        layerId: 'layer-events',
        geometryType: 'Point',
        coordinates: [2, 2],
        properties: { began: 500, ended: 1200 },
      },
    ];

    const range = calculateActiveTemporalRange(layers, features);
    assert.ok(range, 'Range must be calculated');
    assert.strictEqual(range.from, 500);
    assert.strictEqual(range.to, 3500);
  });

  it('safely handles missing, null, or unparseable temporal feature values', () => {
    const layers: LayerDescriptor[] = [
      {
        id: 'layer-sensors',
        name: 'Sensors',
        temporal: {
          enabled: true,
          mode: 'start',
          startField: 'recorded_at',
        },
      } as any,
    ];

    const features: GisFeature[] = [
      {
        id: 's1',
        layerId: 'layer-sensors',
        geometryType: 'Point',
        coordinates: [0, 0],
        properties: { recorded_at: null },
      },
      {
        id: 's2',
        layerId: 'layer-sensors',
        geometryType: 'Point',
        coordinates: [1, 1],
        properties: { recorded_at: '2026-11-10T14:00:00.000Z' },
      },
      {
        id: 's3',
        layerId: 'layer-sensors',
        geometryType: 'Point',
        coordinates: [2, 2],
        properties: { recorded_at: 'invalid-date' },
      },
    ];

    const range = calculateActiveTemporalRange(layers, features);
    assert.ok(range);
    const expected = Date.parse('2026-11-10T14:00:00.000Z');
    assert.strictEqual(range.from, expected);
    assert.strictEqual(range.to, expected);
  });
});

describe('timeFilterMath: autoDetectTemporalRange & IPC Sorted Queries (Ticket #238)', () => {
  it('extractFirstFeatureProperties extracts properties from structured features or binary packet', () => {
    // 1. Structured features object
    const structured = {
      features: [{ properties: { start_date: '1900-01-01', names: 'Test' } }],
    };
    assert.deepEqual(extractFirstFeatureProperties(structured), {
      start_date: '1900-01-01',
      names: 'Test',
    });

    // 2. Binary packet buffer (12-byte header, 8-byte fid, 4-byte wkbLen=0, 4-byte propsLen, JSON text)
    const jsonStr = JSON.stringify({ start_date: '0500-06-06' });
    const encoder = new TextEncoder();
    const jsonBytes = encoder.encode(jsonStr);
    const packetBuf = new ArrayBuffer(24 + 4 + jsonBytes.byteLength);
    const view = new DataView(packetBuf);
    view.setUint32(0, 0x43415254, true); // magic
    view.setUint16(4, 1, true); // version
    view.setUint16(6, 0x02, true); // flags (HAS_PROPERTIES)
    view.setUint32(8, 1, true); // count
    view.setBigInt64(12, 73n, true); // fid
    view.setUint32(20, 0, true); // wkbLen = 0
    view.setUint32(24, jsonBytes.byteLength, true); // propsLen
    new Uint8Array(packetBuf, 28).set(jsonBytes);

    assert.deepEqual(extractFirstFeatureProperties({ buffer: packetBuf }), {
      start_date: '0500-06-06',
    });
  });

  it('dispatches ASC and DESC queries per time-enabled layer and updates global range signals', async () => {
    const layers: LayerDescriptor[] = [
      {
        id: 'timeline-layer-1',
        name: 'Timeline 1',
        temporal: {
          enabled: true,
          mode: 'start_end',
          startField: 'start_date',
          endField: 'end_date',
        },
      } as any,
    ];

    const dispatchedQueries: Array<{ layerId: string; options: any }> = [];
    const mockQueryExtent = async (layerId: string, options: any) => {
      dispatchedQueries.push({ layerId, options });
      if (options.sortDirection === 'ASC') {
        return {
          features: [{ properties: { start_date: '0500-06-06' } }],
        };
      }
      return {
        features: [{ properties: { end_date: '2099-12-31' } }],
      };
    };

    const range = await autoDetectTemporalRange(layers, mockQueryExtent);
    assert.ok(range, 'Range must be resolved');

    // Verify 2 queries dispatched: ASC for start_date and DESC for end_date
    assert.equal(dispatchedQueries.length, 2);
    assert.deepEqual(dispatchedQueries[0], {
      layerId: 'timeline-layer-1',
      options: {
        sortBy: 'start_date',
        sortDirection: 'ASC',
        max: 1,
        includeGeometry: false,
        fields: ['start_date'],
      },
    });
    assert.deepEqual(dispatchedQueries[1], {
      layerId: 'timeline-layer-1',
      options: {
        sortBy: 'end_date',
        sortDirection: 'DESC',
        max: 1,
        includeGeometry: false,
        fields: ['end_date'],
      },
    });

    // Update global signals with resolved range
    setTimeFilterRange(range.from, range.to);
    assert.equal(timeFilterRangeStartSignal.value, range.from);
    assert.equal(timeFilterRangeEndSignal.value, range.to);
    assert.ok(timeFilterRangeStartSignal.value < timeFilterRangeEndSignal.value);
  });
});
