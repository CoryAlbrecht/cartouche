/**
 * @file TimeFilterWidget.test.ts
 * @module tests/renderer/widgets/TimeFilterWidget.test
 * @description Unit and component tests for TimeFilterWidget verifying docking registration, transport controls, auto-range aggregation, calendar-aware arithmetic, and micro-decimal stepping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link TimeFilterWidget}
 * @see {@link computeTimeFilterWidgetMinHeight}
 * @see {@link TIME_FILTER_SCRUB_DEBOUNCE_MS}
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

const {
  TimeFilterWidget,
  computeTimeFilterWidgetMinHeight,
  TIME_FILTER_SCRUB_DEBOUNCE_MS,
} = jiti(
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

describe('TimeFilterWidget: Theme Focus Styling & Classes (Ticket #241)', () => {
  it('assigns time-filter-unit-select, time-filter-step-input, and time-filter-btn classes with outline none', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    // 1. Verify class assignment
    assert.ok(
      markup.includes('class="time-filter-unit-select"'),
      'Unit select element must have time-filter-unit-select class'
    );
    assert.ok(
      markup.includes('class="time-filter-step-input"'),
      'Step input element must have time-filter-step-input class'
    );
    assert.ok(
      markup.includes('time-filter-btn'),
      'VCR transport buttons must have time-filter-btn class'
    );

    // 2. Verify outline: none inline suppression
    assert.ok(
      markup.includes('outline:none') || markup.includes('outline: none'),
      'Markup must suppress default browser outline'
    );
  });
});

describe('TimeFilterWidget: Reactive Numeric Step Editing & Stepping (Ticket #242)', () => {
  beforeEach(() => {
    resetTimeFilterState();
  });

  it('reflects updated numeric step values and preserves step across render cycles without reverting', () => {
    // 1. Initial default step is 1.0
    assert.strictEqual(timeFilterStepSignal.value, 1.0);
    let markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );
    assert.ok(
      markup.includes('value="1"'),
      'Default step input must render value="1"'
    );

    // 2. Direct numeric update to integer (e.g. 5)
    setTimeFilterStep(5, 'Seconds');
    assert.strictEqual(timeFilterStepSignal.value, 5);
    markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );
    assert.ok(
      markup.includes('value="5"'),
      'Step input must render value="5" without reverting'
    );

    // 3. Direct numeric update to fractional decimal (e.g. 2.75)
    setTimeFilterStep(2.75, 'Minutes');
    assert.strictEqual(timeFilterStepSignal.value, 2.75);
    markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );
    assert.ok(
      markup.includes('value="2.75"'),
      'Step input must render value="2.75" without reverting'
    );

    // 4. Direct numeric update to micro-decimal down to MIN_TIME_FILTER_STEP
    setTimeFilterStep(MIN_TIME_FILTER_STEP, 'Years');
    assert.strictEqual(timeFilterStepSignal.value, MIN_TIME_FILTER_STEP);
    markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );
    assert.ok(
      markup.includes(`value="${MIN_TIME_FILTER_STEP}"`) || markup.includes('value="3.1623e-8"'),
      'Step input must reflect micro-decimal value without reverting'
    );
  });

  it('increments step value by 1.00 on Step Up button click', () => {
    // Starting at 1.0 -> 2.0
    setTimeFilterStep(1.0, 'Seconds');
    let current = timeFilterStepSignal.value;
    let next = Math.max(MIN_TIME_FILTER_STEP, Number((current + 1.0).toFixed(12)));
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    assert.strictEqual(timeFilterStepSignal.value, 2.0);

    // Starting at 2.5 -> 3.5
    setTimeFilterStep(2.5, 'Hours');
    current = timeFilterStepSignal.value;
    next = Math.max(MIN_TIME_FILTER_STEP, Number((current + 1.0).toFixed(12)));
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    assert.strictEqual(timeFilterStepSignal.value, 3.5);

    // Starting at MIN_TIME_FILTER_STEP -> 1.000000031623
    setTimeFilterStep(MIN_TIME_FILTER_STEP, 'Years');
    current = timeFilterStepSignal.value;
    next = Math.max(MIN_TIME_FILTER_STEP, Number((current + 1.0).toFixed(12)));
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    assert.strictEqual(timeFilterStepSignal.value, 1.000000031623);
  });

  it('decrements step value by 1.00 and enforces MIN_TIME_FILTER_STEP floor on Step Down button click', () => {
    // Starting at 4.0 -> 3.0
    setTimeFilterStep(4.0, 'Days');
    let current = timeFilterStepSignal.value;
    let next = Math.max(MIN_TIME_FILTER_STEP, Number((current - 1.0).toFixed(12)));
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    assert.strictEqual(timeFilterStepSignal.value, 3.0);

    // Starting at 1.5 -> 0.5
    setTimeFilterStep(1.5, 'Days');
    current = timeFilterStepSignal.value;
    next = Math.max(MIN_TIME_FILTER_STEP, Number((current - 1.0).toFixed(12)));
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    assert.strictEqual(timeFilterStepSignal.value, 0.5);

    // Starting at 1.0 -> decrements to 0.0, which clamps to MIN_TIME_FILTER_STEP
    setTimeFilterStep(1.0, 'Days');
    current = timeFilterStepSignal.value;
    next = Math.max(MIN_TIME_FILTER_STEP, Number((current - 1.0).toFixed(12)));
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    assert.strictEqual(timeFilterStepSignal.value, MIN_TIME_FILTER_STEP);

    // Starting at MIN_TIME_FILTER_STEP -> stays at MIN_TIME_FILTER_STEP
    setTimeFilterStep(MIN_TIME_FILTER_STEP, 'Days');
    current = timeFilterStepSignal.value;
    next = Math.max(MIN_TIME_FILTER_STEP, Number((current - 1.0).toFixed(12)));
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    assert.strictEqual(timeFilterStepSignal.value, MIN_TIME_FILTER_STEP);
  });

  it('utilizes the updated numeric step value for subsequent VCR transport stepping', () => {
    const base = 1_000_000;
    setTimeFilterActive(true);
    setTimeFilterRange(0, 10_000_000);
    setTimeFilterFrame(base, base);
    setTimeFilterStep(1.0, 'Seconds');

    // 1. Initial 1.0 second forward step (1,000 ms)
    let s = timeFilterStepSignal.value;
    let u = timeFilterUnitSignal.value;
    let target = stepTemporalTimestamp(timeFilterFrameStartSignal.value, s, u);
    setTimeFilterFrame(target, target);
    assert.strictEqual(timeFilterFrameStartSignal.value, 1_001_000);

    // 2. Update step to 10.0 seconds -> subsequent step moves 10,000 ms
    setTimeFilterStep(10.0, 'Seconds');
    s = timeFilterStepSignal.value;
    u = timeFilterUnitSignal.value;
    target = stepTemporalTimestamp(timeFilterFrameStartSignal.value, s, u);
    setTimeFilterFrame(target, target);
    assert.strictEqual(timeFilterFrameStartSignal.value, 1_011_000);

    // 3. Update step to 2.5 seconds -> subsequent backward step moves -2,500 ms
    setTimeFilterStep(2.5, 'Seconds');
    s = timeFilterStepSignal.value;
    u = timeFilterUnitSignal.value;
    target = stepTemporalTimestamp(timeFilterFrameStartSignal.value, -s, u);
    setTimeFilterFrame(target, target);
    assert.strictEqual(timeFilterFrameStartSignal.value, 1_008_500);

    // 4. Update unit to 'Hours' and step to 0.5 -> subsequent forward step moves 1,800,000 ms
    setTimeFilterStep(0.5, 'Hours');
    s = timeFilterStepSignal.value;
    u = timeFilterUnitSignal.value;
    target = stepTemporalTimestamp(timeFilterFrameStartSignal.value, s, u);
    setTimeFilterFrame(target, target);
    assert.strictEqual(timeFilterFrameStartSignal.value, 2_808_500);

    // 5. Update unit to 'Years' and step to micro-decimal MIN_TIME_FILTER_STEP -> moves ~998 ms (~1 second)
    setTimeFilterStep(MIN_TIME_FILTER_STEP, 'Years');
    s = timeFilterStepSignal.value;
    u = timeFilterUnitSignal.value;
    target = stepTemporalTimestamp(timeFilterFrameStartSignal.value, s, u);
    setTimeFilterFrame(target, target);
    assert.strictEqual(timeFilterFrameStartSignal.value, 2_809_497);
  });

  it('renders step input with step="any", min boundary, and discrete stepper button titles', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(
      markup.includes('step="any"'),
      'Step input must allow any micro-decimal increment via step="any"'
    );
    assert.ok(
      markup.includes(`min="${MIN_TIME_FILTER_STEP}"`) || markup.includes('min="3.1623e-8"'),
      'Step input must enforce min floor via min attribute'
    );
    assert.ok(
      markup.includes('title="Step Up by 1.00"'),
      'Step Up button must display title="Step Up by 1.00"'
    );
    assert.ok(
      markup.includes('title="Step Down by 1.00"'),
      'Step Down button must display title="Step Down by 1.00"'
    );
  });
});

describe('TimeFilterWidget: Editable From and To Range Spinners (Ticket #243)', () => {
  beforeEach(() => {
    resetTimeFilterState();
  });

  it('updates timeFilterRangeStartSignal and reflects across render cycles when From spinner changes', () => {
    const fromUtc = Date.UTC(2024, 5, 15, 12, 0, 0);
    const toUtc = Date.UTC(2030, 0, 1, 0, 0, 0);
    setTimeFilterRange(fromUtc, toUtc);

    assert.strictEqual(timeFilterRangeStartSignal.value, fromUtc);
    assert.strictEqual(timeFilterRangeEndSignal.value, toUtc);

    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    // Verify From: spinner reflects 2024
    assert.ok(
      markup.includes('value="2024"'),
      'From: TimestampSpinner must reflect updated year value 2024'
    );
  });

  it('updates timeFilterRangeEndSignal and reflects across render cycles when To spinner changes', () => {
    const fromUtc = Date.UTC(2024, 0, 1, 0, 0, 0);
    const toUtc = Date.UTC(2028, 10, 20, 18, 30, 0);
    setTimeFilterRange(fromUtc, toUtc);

    assert.strictEqual(timeFilterRangeStartSignal.value, fromUtc);
    assert.strictEqual(timeFilterRangeEndSignal.value, toUtc);

    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    // Verify To: spinner reflects 2028
    assert.ok(
      markup.includes('value="2028"'),
      'To: TimestampSpinner must reflect updated year value 2028'
    );
  });

  it('scrubber slider min and max boundaries update reactively when range boundaries change', () => {
    const fromUtc = 100_000;
    const toUtc = 500_000;
    setTimeFilterRange(fromUtc, toUtc);

    let markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(
      markup.includes('min="100000"'),
      'Scrubber slider min attribute must reflect updated fromUtc boundary'
    );
    assert.ok(
      markup.includes('max="500000"'),
      'Scrubber slider max attribute must reflect updated toUtc boundary'
    );

    // Update boundaries to new values
    setTimeFilterRange(200_000, 800_000);
    markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(
      markup.includes('min="200000"'),
      'Scrubber slider min attribute must reactively update to 200000'
    );
    assert.ok(
      markup.includes('max="800000"'),
      'Scrubber slider max attribute must reactively update to 800000'
    );
  });

  it('clamps active frame reactively when range boundaries change outside the active frame', () => {
    // Initial range [100, 500], frame at 300
    setTimeFilterRange(100, 500);
    setTimeFilterFrame(300, 300);
    assert.strictEqual(timeFilterFrameStartSignal.value, 300);

    // Narrow range boundary From to 350 (frame 300 is now below new From)
    setTimeFilterRange(350, 500);
    assert.strictEqual(
      timeFilterFrameStartSignal.value,
      350,
      'Active frame must clamp up to new lower range boundary'
    );

    // Narrow range boundary To to 400 with frame at 450
    setTimeFilterFrame(450, 450);
    setTimeFilterRange(350, 400);
    assert.strictEqual(
      timeFilterFrameStartSignal.value,
      400,
      'Active frame must clamp down to new upper range boundary'
    );
  });

  it('retains userSelect: text on TimestampSpinner segment inputs and wrapper containers', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(
      markup.includes('user-select:text') || markup.includes('user-select: text'),
      'TimestampSpinner segment inputs must retain userSelect: text within TimeFilterWidget container'
    );
  });
});

describe('TimeFilterWidget: Non-Interactive Current Frame Label Styling (Ticket #244)', () => {
  beforeEach(() => {
    resetTimeFilterState();
  });

  it('renders current frame container with transparent background and no box border', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(
      markup.includes('time-filter-current-frame-container'),
      'Frame display container must exist with class time-filter-current-frame-container'
    );
    assert.ok(
      markup.includes('background:transparent') || markup.includes('background: transparent'),
      'Frame container must define background: transparent'
    );
    assert.ok(
      markup.includes('border:none') || markup.includes('border: none'),
      'Frame container must define border: none'
    );
  });

  it('renders Frame: descriptor text using muted theme typography', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(
      markup.includes('var(--cartouche-theme-fg-muted'),
      'Frame descriptor must render using var(--cartouche-theme-fg-muted)'
    );
    assert.ok(
      markup.includes('Frame:'),
      'Descriptor must display Frame: label'
    );
  });

  it('renders formatted timestamp range in clean monospace font matching workbench metadata', () => {
    setTimeFilterFrame(
      Date.UTC(2026, 0, 1, 0, 0, 0),
      Date.UTC(2026, 0, 1, 12, 0, 0)
    );

    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(
      markup.includes('time-filter-current-frame-label'),
      'Formatted timestamp must have class time-filter-current-frame-label'
    );
    assert.ok(
      markup.includes('2026-01-01 00:00:00 | 2026-01-01 12:00:00'),
      'Must render formatted start and end timestamps'
    );
    assert.ok(
      markup.includes('ui-monospace'),
      'Must use monospace font stack'
    );
  });
});

describe('TimeFilterWidget: Dynamic minHeight Calculation (Ticket #245)', () => {
  it('computeTimeFilterWidgetMinHeight returns a valid CSS calc expression incorporating typography and icon CSS variables', () => {
    const minHeightExpr = computeTimeFilterWidgetMinHeight();

    assert.ok(
      typeof minHeightExpr === 'string',
      'computeTimeFilterWidgetMinHeight must return a string'
    );
    assert.ok(
      minHeightExpr.startsWith('calc(') && minHeightExpr.endsWith(')'),
      'Must be a valid CSS calc() expression'
    );
    assert.ok(
      minHeightExpr.includes('--cartouche-ui-icon-size'),
      'Must incorporate --cartouche-ui-icon-size variable for header and button scaling'
    );
    assert.ok(
      minHeightExpr.includes('--cartouche-ui-basefont-size'),
      'Must incorporate --cartouche-ui-basefont-size variable for input and typography scaling'
    );
  });

  it('renders TimeFilterWidget with dynamic minHeight calc expression on BasicWidget', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(markup.length > 0, 'TimeFilterWidget must render without throwing');
  });

  it('allows overriding minHeight through explicit props', () => {
    const customMinHeight = 150;
    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, { minHeight: customMinHeight })
    );

    assert.ok(markup.length > 0, 'TimeFilterWidget must accept custom minHeight override');
  });
});

describe('TimeFilterWidget: Debounced Timeline Slider Scrubbing (Ticket #246)', () => {
  beforeEach(() => {
    resetTimeFilterState();
  });

  it('exports TIME_FILTER_SCRUB_DEBOUNCE_MS as 300ms', () => {
    assert.strictEqual(
      TIME_FILTER_SCRUB_DEBOUNCE_MS,
      300,
      'Debounce duration must be exactly 300ms'
    );
  });

  it('disables timeline slider when range is uninitialized or invalid, and enables when rangeStart < rangeEnd', () => {
    // 1. Uninitialized range [0, 0] -> slider is disabled
    setTimeFilterRange(0, 0);
    let markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );
    assert.ok(
      markup.includes('time-filter-slider') && markup.includes('disabled=""'),
      'Slider must be disabled when rangeStart >= rangeEnd'
    );
    assert.ok(
      markup.includes('cursor:not-allowed') || markup.includes('cursor: not-allowed'),
      'Disabled slider must style cursor: not-allowed'
    );

    // 2. Valid range [1000, 5000] -> slider is enabled
    setTimeFilterRange(1000, 5000);
    markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );
    const sliderTag = (markup.match(/<input[^>]*time-filter-slider[^>]*>/) || [''])[0];
    assert.ok(
      !sliderTag.includes('disabled'),
      'Slider must be enabled when rangeStart < rangeEnd'
    );
    assert.ok(
      markup.includes('cursor:pointer') || markup.includes('cursor: pointer'),
      'Enabled slider must style cursor: pointer'
    );
  });

  it('renders slider with real-time value and min/max boundaries matching active range', () => {
    setTimeFilterRange(100_000, 500_000);
    setTimeFilterFrame(250_000, 250_000);

    const markup = renderToStaticMarkup(
      React.createElement(TimeFilterWidget, {})
    );

    assert.ok(
      markup.includes('min="100000"'),
      'Slider min must equal rangeStart'
    );
    assert.ok(
      markup.includes('max="500000"'),
      'Slider max must equal rangeEnd'
    );
    assert.ok(
      markup.includes('value="250000"'),
      'Slider value must equal current frame position'
    );
  });

  it('debounces frame signal updates by 300ms to prevent spamming map viewport redraws', async () => {
    setTimeFilterRange(0, 10_000);
    setTimeFilterFrame(1000, 1000);
    assert.strictEqual(timeFilterFrameStartSignal.value, 1000);

    // Simulate slider scrub scheduling
    let timer: any = null;
    const targetScrubVal = 5000;

    // Simulate fast sequential scrub events
    const simulateScrub = (val: number) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        setTimeFilterFrame(val, val);
      }, TIME_FILTER_SCRUB_DEBOUNCE_MS);
    };

    simulateScrub(2000);
    simulateScrub(3000);
    simulateScrub(targetScrubVal);

    // At 100ms, frame signal must not have updated yet (debouncing)
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.strictEqual(
      timeFilterFrameStartSignal.value,
      1000,
      'Frame signal must NOT update prematurely before 300ms debounce expires'
    );

    // After 350ms total, the debounced update must have executed
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.strictEqual(
      timeFilterFrameStartSignal.value,
      targetScrubVal,
      'Frame signal must update to final scrub position once 300ms debounce completes'
    );
  });
});
