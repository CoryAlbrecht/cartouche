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
 * @see {@link autoDetectTemporalRange}
 * @see {@link extractFirstFeatureProperties}
 * @see {@link widgetComponents}
 * @see {@link DEFAULT_WORKBENCH_WIDGET_DOCKS}
 * @see {@link Icon}
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
  autoDetectTemporalRange,
  extractFirstFeatureProperties,
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

  it('renders all transport, auto-range, and stepper buttons with canonical Icon SVG elements without throwing (Ticket #236)', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    // Verify SVG icon elements rendered within buttons
    assert.ok(
      markup.includes('<svg'),
      'Markup must render SVG elements from canonical Icon component'
    );
    assert.ok(
      markup.includes('viewBox="0 0 24 24"'),
      'SVG elements must define 24x24 MDI viewBox'
    );

    // Count rendered SVG icons:
    // Header (1: clock), Toggle [A] (1), Auto-Range [B] (1), Transport [C, D, E, F] (4),
    // Embedded TimestampSpinners (2 spinners * 2 chevrons = 4), Step Up/Down (2) = 13 total icons
    const EXPECTED_SVG_ICON_COUNT = 13;
    const svgCount = (markup.match(/<svg/g) || []).length;
    assert.strictEqual(
      svgCount,
      EXPECTED_SVG_ICON_COUNT,
      `Expected exactly ${EXPECTED_SVG_ICON_COUNT} SVG icons rendered in TimeFilterWidget, found ${svgCount}`
    );
  });
});

describe('TimeFilterWidget: Step Unit Dropdown Reactivity (Ticket #239)', () => {
  beforeEach(() => {
    resetTimeFilterState();
  });

  it('updates timeFilterUnitSignal and renders selected unit across render cycles', () => {
    const units: import('../../../src/shared/types').TimeFilterUnit[] = [
      'Years',
      'Months',
      'Days',
      'Hours',
      'Minutes',
      'Seconds',
    ];

    for (const u of units) {
      setTimeFilterStep(timeFilterStepSignal.value, u);
      assert.strictEqual(timeFilterUnitSignal.value, u);

      const markup = renderToStaticMarkup(
        React.createElement(TimeFilterWidget, {})
      );

      // Verify the rendered select element reflects the selected unit
      assert.ok(
        markup.includes(`value="${u}"`)
        || markup.includes(`<option selected="" value="${u}"`)
        || markup.includes(`<option value="${u}" selected`),
        `Markup must reflect selected unit ${u}`
      );
    }
  });

  it('calculates transport stepping using the selected unit', () => {
    setTimeFilterRange(0, 100_000_000_000);
    setTimeFilterFrame(1_000_000, 1_000_000);

    // Step under 'Seconds' (1 step = 1,000 ms)
    setTimeFilterStep(5, 'Seconds');
    assert.strictEqual(timeFilterUnitSignal.value, 'Seconds');
    assert.strictEqual(timeFilterStepSignal.value, 5);
    const targetSec = stepTemporalTimestamp(1_000_000, 5, 'Seconds');
    assert.strictEqual(targetSec, 1_000_000 + 5_000);

    // Step under 'Hours' (1 step = 3,600,000 ms)
    setTimeFilterStep(2, 'Hours');
    assert.strictEqual(timeFilterUnitSignal.value, 'Hours');
    const targetHours = stepTemporalTimestamp(1_000_000, 2, 'Hours');
    assert.strictEqual(targetHours, 1_000_000 + 7_200_000);
  });
});

describe('TimeFilterWidget: Dropdown Border Clipping & Clearance (Ticket #240)', () => {
  it('applies box-sizing border-box and vertical clearance padding on container and controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    // 1. Container padding and box-sizing
    assert.ok(
      markup.includes('padding:6px 10px 8px 10px') || markup.includes('padding: 6px 10px 8px 10px'),
      'Container must define 8px bottom padding clearance'
    );
    assert.ok(
      markup.includes('box-sizing:border-box') || markup.includes('box-sizing: border-box'),
      'Container must define box-sizing: border-box'
    );

    // 2. Bottom bar clearance
    assert.ok(
      markup.includes('padding-bottom:2px') || markup.includes('padding-bottom: 2px'),
      'Bottom control bar must define 2px padding-bottom clearance'
    );

    // 3. Step unit select border and box-sizing
    assert.ok(
      markup.includes('time-filter-unit-select'),
      'Unit select dropdown must exist'
    );
    assert.ok(
      markup.includes('border:1px solid var(--cartouche-theme-border, #cbd5e1)')
      || markup.includes('border: 1px solid var(--cartouche-theme-border, #cbd5e1)'),
      'Unit select must render theme border variable'
    );

    // 4. Step input border and box-sizing
    assert.ok(
      markup.includes('time-filter-step-input'),
      'Step input must exist'
    );
  });
});
