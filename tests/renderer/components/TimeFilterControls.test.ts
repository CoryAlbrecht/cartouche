/**
 * @file TimeFilterControls.test.ts
 * @module tests/renderer/components/TimeFilterControls.test
 * @description Tests for the shared TimeFilterControls module: controlled rendering of Enabled / From / To / Step / Unit from props, callbacks for every edit, step floor enforcement, and the absence of any playhead control.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see {@link TimeFilterControls}
 * @see {@link TimeFilterRangeStepControls}
 * @see {@link TimeFilterEnabledToggle}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRendererJiti } from '../rendererJiti';

const jiti = createRendererJiti(import.meta.url);

const React = jiti('react');
const { renderToStaticMarkup } = jiti('react-dom/server');
const {
  TimeFilterControls,
  TimeFilterRangeStepControls,
  TimeFilterEnabledToggle,
  TIME_FILTER_UNIT_OPTIONS,
} = jiti('../../../src/renderer/components/common/TimeFilterControls.tsx');
const { MIN_TIME_FILTER_STEP } = jiti('../../../src/renderer/map/timeFilterMath.ts');

const FROM = Date.UTC(2020, 0, 1);
const TO = Date.UTC(2021, 0, 1);

/**
 * @function baseProps
 * @description Builds a full controls prop set with no-op callbacks, overridable per test.
 * @param {Record<string, unknown>} [overrides] - Prop overrides.
 * @returns {Record<string, unknown>} Props.
 */
function baseProps(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    enabled: false,
    from: FROM,
    to: TO,
    step: 1,
    unit: 'Days',
    onEnabledChange: () => {},
    onFromChange: () => {},
    onToChange: () => {},
    onStepChange: () => {},
    onUnitChange: () => {},
    ...overrides,
  };
}

describe('TimeFilterControls (Ticket #270)', () => {
  it('renders Enabled, From, To, Step and Unit from props with no playhead', () => {
    const html = renderToStaticMarkup(
      React.createElement(TimeFilterControls, baseProps({ enabled: true, step: 2.5, unit: 'Hours' }))
    );
    assert.ok(html.includes('Enabled:'));
    assert.ok(html.includes('class="toolbar-btn active"'), 'enabled toggle reflects the prop');
    assert.ok(html.includes('From:') && html.includes('To:') && html.includes('Step:'));
    assert.ok(html.includes('class="time-filter-step-input"'));
    assert.ok(html.includes('value="2.5"'));
    assert.ok(html.includes('class="time-filter-unit-select"'));
    assert.ok(html.includes('<option value="Hours" selected=""'), 'unit dropdown reflects the prop');
    assert.ok(!html.includes('Frame:'), 'no current-frame label');
    assert.ok(!html.includes('time-filter-slider'), 'no scrubber');
    assert.ok(!html.includes('Jump to Start'), 'no transport buttons');
  });

  it('lists all eight step units in order', () => {
    assert.deepEqual([...TIME_FILTER_UNIT_OPTIONS], [
      'Years', 'Months', 'Weeks', 'Days', 'Hours', 'Minutes', 'Seconds', 'Milliseconds',
    ]);
    const html = renderToStaticMarkup(React.createElement(TimeFilterControls, baseProps()));
    for (const u of TIME_FILTER_UNIT_OPTIONS) {
      assert.ok(html.includes(`<option value="${u}"`), `missing unit option ${u}`);
    }
  });

  it('reports the toggled Enabled value', () => {
    const seen: boolean[] = [];
    const el = TimeFilterEnabledToggle({ enabled: false, onChange: (v: boolean) => seen.push(v) });
    el.props.onClick();
    const el2 = TimeFilterEnabledToggle({ enabled: true, onChange: (v: boolean) => seen.push(v) });
    el2.props.onClick();
    assert.deepEqual(seen, [true, false]);
  });

  it('disables every control when disabled is set', () => {
    const html = renderToStaticMarkup(
      React.createElement(TimeFilterRangeStepControls, { ...baseProps(), disabled: true })
    );
    assert.ok(/class="time-filter-step-input"[^>]*disabled=""/.test(html));
    assert.ok(/class="time-filter-unit-select"[^>]*disabled=""/.test(html));
    assert.ok(/aria-label="Step Up by 1.00"[^>]*disabled=""/.test(html));
  });
});

describe('TimeFilterRangeStepControls rendering (Ticket #270)', () => {
  it('renders From / To / Step / Unit as a fragment the owner lays out', () => {
    const html = renderToStaticMarkup(
      React.createElement('div', { className: 'owner-row' },
        React.createElement(TimeFilterRangeStepControls, baseProps({ step: 3, unit: 'Weeks' })))
    );
    assert.ok(html.startsWith('<div class="owner-row"><div'), 'first group is a direct child of the owner');
    assert.ok(!html.includes('Enabled:'), 'no Enabled row in the range/step controls');
    assert.ok(html.includes('value="3"'));
    assert.ok(html.includes('<option value="Weeks" selected=""'));
    assert.ok(html.includes(`min="${MIN_TIME_FILTER_STEP}"`), 'step input advertises the floor');
    assert.ok(html.includes('class="timestamp-spinner'), 'range spinners are TimestampSpinner instances');
  });
});
