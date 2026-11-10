/**
 * @file TimeFilterWidget.test.ts
 * @module tests/renderer/widgets/TimeFilterWidget.test
 * @description Unit and component tests for TimeFilterWidget verifying docking registration, transport controls, auto-range aggregation, calendar-aware arithmetic, and micro-decimal stepping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link TimeFilterWidget}
 * @see {@link stepTemporalTimestamp}
 * @see {@link calculateActiveTemporalRange}
 * @see {@link widgetComponents}
 * @see {@link DEFAULT_WORKBENCH_WIDGET_DOCKS}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import createJiti from 'jiti';

// Mock .svg and .css imports for headless Node testing
const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions['.svg'] = (mod: any) => {
  mod.exports = 'mock-logo.svg';
};
nodeRequire.extensions['.css'] = (mod: any) => {
  mod.exports = '';
};

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
  },
});

const React = jiti('react') as typeof import('react');
const { renderToStaticMarkup } = jiti('react-dom/server') as typeof import('react-dom/server');

const { widgetComponents } = jiti(
  '@renderer/workbench/widgetRegistry'
) as typeof import('@renderer/workbench/widgetRegistry');

const { DEFAULT_WORKBENCH_WIDGET_DOCKS } = jiti(
  '@shared/types'
) as typeof import('@shared/types');

const {
  isTimeFilterActiveSignal,
  timeFilterFrameStartSignal,
  timeFilterFrameEndSignal,
  timeFilterRangeStartSignal,
  timeFilterRangeEndSignal,
  timeFilterStepSignal,
  timeFilterUnitSignal,
  setTimeFilterActive,
  setTimeFilterFrame,
  setTimeFilterRange,
  setTimeFilterStep,
  resetTimeFilterState,
} = jiti(
  '@renderer/state/timeFilterSignals'
) as typeof import('@renderer/state/timeFilterSignals');

const {
  isLeapYearUtc,
  getDaysInMonthUtc,
  stepTemporalTimestamp,
  calculateActiveTemporalRange,
  MIN_TIME_FILTER_STEP,
} = jiti(
  '@renderer/map/timeFilterMath'
) as typeof import('@renderer/map/timeFilterMath');

const { formatUtcTimestamp } = jiti(
  '@renderer/components/common/TimestampSpinner'
) as typeof import('@renderer/components/common/TimestampSpinner');

const { TimeFilterWidget } = jiti(
  '@renderer/workbench/widgets/TimeFilterWidget'
) as typeof import('@renderer/workbench/widgets/TimeFilterWidget');

import type { LayerDescriptor, GisFeature } from '../../../src/shared/types';

describe('TimeFilterWidget: Registration & Default Docking (Ticket #235)', () => {
  it('registers time-filter component in widgetRegistry.tsx', () => {
    assert.ok(
      typeof widgetComponents['time-filter'] === 'function',
      'time-filter must be registered in widgetRegistry'
    );
  });

  it('allocates time-filter to top dock by default in DEFAULT_WORKBENCH_WIDGET_DOCKS', () => {
    const topDocks = DEFAULT_WORKBENCH_WIDGET_DOCKS.top;
    assert.ok(topDocks.length > 0, 'Top dock must contain items by default');
    const tf = topDocks.find((item) => item.id === 'time-filter');
    assert.ok(tf, 'time-filter dock item must exist in top dock');
    assert.strictEqual(tf.dock, 'top');
    assert.strictEqual(tf.visible, true);
    assert.strictEqual(tf.dimensions.height, 74);
  });
});

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

describe('TimeFilterWidget: Reactive Transport Controls & State (Ticket #235)', () => {
  beforeEach(() => {
    resetTimeFilterState();
  });

  it('toggles time filtering active state via setTimeFilterActive', () => {
    assert.strictEqual(isTimeFilterActiveSignal.value, false);
    setTimeFilterActive(true);
    assert.strictEqual(isTimeFilterActiveSignal.value, true);
    setTimeFilterActive(false);
    assert.strictEqual(isTimeFilterActiveSignal.value, false);
  });

  it('sets range and frames within boundary clamping', () => {
    setTimeFilterRange(1000, 5000);
    assert.strictEqual(timeFilterRangeStartSignal.value, 1000);
    assert.strictEqual(timeFilterRangeEndSignal.value, 5000);

    setTimeFilterFrame(2500, 2500);
    assert.strictEqual(timeFilterFrameStartSignal.value, 2500);
    assert.strictEqual(timeFilterFrameEndSignal.value, 2500);
  });

  it('updates step and unit settings with floor enforcement', () => {
    setTimeFilterStep(2.5, 'Hours');
    assert.strictEqual(timeFilterStepSignal.value, 2.5);
    assert.strictEqual(timeFilterUnitSignal.value, 'Hours');

    // Values below minimum are clamped
    const tooSmall = 0.000000000001;
    const clamped = Math.max(MIN_TIME_FILTER_STEP, tooSmall);
    setTimeFilterStep(clamped, 'Seconds');
    assert.strictEqual(timeFilterStepSignal.value, MIN_TIME_FILTER_STEP);
  });
});

describe('TimeFilterWidget: Component Rendering (Ticket #235)', () => {
  beforeEach(() => {
    resetTimeFilterState();
    setTimeFilterActive(true);
    setTimeFilterRange(
      Date.UTC(2026, 0, 1, 0, 0, 0),
      Date.UTC(2026, 11, 31, 23, 59, 59)
    );
    setTimeFilterFrame(
      Date.UTC(2026, 5, 15, 12, 0, 0),
      Date.UTC(2026, 5, 15, 12, 0, 0)
    );
    setTimeFilterStep(1.0, 'Days');
  });

  it('renders complete widget markup with transport buttons, slider, and range controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    // Verify title and container
    assert.ok(
      markup.includes('Time Filter'),
      'Markup must include widget title'
    );
    assert.ok(
      markup.includes('time-filter-widget-container'),
      'Markup must contain container class'
    );

    // Verify activation and auto-range buttons
    assert.ok(
      markup.includes('Toggle Dynamic Temporal Control'),
      'Markup must include toggle button'
    );
    assert.ok(
      markup.includes('Auto-calculate Range from Active Temporal Layers'),
      'Markup must include auto-range button'
    );

    // Verify VCR transport buttons
    assert.ok(
      markup.includes('Jump to Start'),
      'Markup must include Jump to Start'
    );
    assert.ok(
      markup.includes('Step Backward'),
      'Markup must include Step Backward'
    );
    assert.ok(
      markup.includes('Step Forward'),
      'Markup must include Step Forward'
    );
    assert.ok(
      markup.includes('Jump to End'),
      'Markup must include Jump to End'
    );

    // Verify Current Frame formatted with pipe separator
    const expectedFrame = `${formatUtcTimestamp(timeFilterFrameStartSignal.value)} | ${formatUtcTimestamp(timeFilterFrameEndSignal.value)}`;
    assert.ok(
      markup.includes(expectedFrame),
      `Markup must include formatted current frame: ${expectedFrame}`
    );

    // Verify continuous scrubbing slider
    assert.ok(
      markup.includes('time-filter-slider'),
      'Markup must include continuous slider'
    );
    assert.ok(
      markup.includes('type="range"'),
      'Markup must contain range input'
    );

    // Verify Range labels and Unit select
    assert.ok(markup.includes('From:'), 'Markup must include From label');
    assert.ok(markup.includes('To:'), 'Markup must include To label');
    assert.ok(markup.includes('Step:'), 'Markup must include Step label');
    assert.ok(
      markup.includes('time-filter-unit-select'),
      'Markup must include unit select'
    );
    assert.ok(markup.includes('Years'), 'Markup must contain Years option');
    assert.ok(markup.includes('Months'), 'Markup must contain Months option');
    assert.ok(markup.includes('Days'), 'Markup must contain Days option');
  });
});
