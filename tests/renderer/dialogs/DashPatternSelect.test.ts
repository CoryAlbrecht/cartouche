/**
 * @file DashPatternSelect.test.ts
 * @module tests/renderer/dialogs/DashPatternSelect.test
 * @description Unit and rendering tests for DashPatternSelect and DashPatternSample components verifying 128px stroke sample rendering, preset dash arrays, blank space for no-line, custom dash arrays, and trigger button state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see {@link DashPatternSelect}
 * @see {@link DashPatternSample}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRendererJiti } from '../rendererJiti';

const jiti = createRendererJiti(import.meta.url);

const React = jiti('react');
const { renderToStaticMarkup } = jiti('react-dom/server');
const {
  DashPatternSelect,
  DashPatternSample,
} = jiti('../../../src/renderer/workbench/dialogs/DashPatternSelect.tsx');

describe('DashPatternSample Component (Ticket #159)', () => {
  it('renders solid line as unbroken 128px SVG stroke with strokeWidth 2', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashPatternSample, { pattern: 'solid' })
    );
    assert.ok(html.includes('<svg'), 'Must render svg');
    assert.ok(html.includes('width="128"'), 'SVG width must be 128');
    assert.ok(html.includes('stroke="#000000"'), 'Stroke color must be #000000');
    assert.ok(html.includes('stroke-width="2"'), 'Stroke width must be 2');
    assert.ok(html.includes('stroke-dasharray="none"'), 'Solid stroke-dasharray must be none');
  });

  it('renders blank 128px container for no-line pattern', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashPatternSample, { pattern: 'no-line' })
    );
    assert.ok(!html.includes('<line'), 'no-line must NOT render a line element');
    assert.ok(html.includes('128px'), 'Must render 128px width placeholder');
    assert.ok(html.includes('data-testid="dash-sample-no-line"'), 'Must have no-line testid');
  });

  it('renders preset dash patterns with exact stroke-dasharray values over 128px', () => {
    const presets = [
      { pattern: 'dash', expected: '10 5' },
      { pattern: 'dot', expected: '2 3' },
      { pattern: 'dash-dot', expected: '10 4 2 4' },
      { pattern: 'dash-dot-dot', expected: '10 4 2 4 2 4' },
      { pattern: 'long-dash', expected: '18 6' },
      { pattern: 'long-dash-dot', expected: '18 5 2 5' },
      { pattern: 'sparse-dot', expected: '2 6' },
    ];

    for (const { pattern, expected } of presets) {
      const html = renderToStaticMarkup(
        React.createElement(DashPatternSample, { pattern })
      );
      assert.ok(
        html.includes(`stroke-dasharray="${expected}"`),
        `Pattern ${pattern} must use stroke-dasharray="${expected}"`
      );
      assert.ok(html.includes('width="128"'), 'Must have width 128');
    }
  });

  it('renders custom pattern using provided dashArray over 128px', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashPatternSample, {
        pattern: 'custom',
        dashArray: [14.5, 4.5, 3.0, 4.5],
      })
    );
    assert.ok(
      html.includes('stroke-dasharray="14.5 4.5 3 4.5"'),
      'Custom pattern must format dashArray into stroke-dasharray'
    );
  });
});

describe('DashPatternSelect Component (Ticket #159)', () => {
  const dummyT = (key: string) => {
    const dict: Record<string, string> = {
      layer_properties_dash_pattern_solid: 'Solid Line',
      layer_properties_dash_pattern_no_line: 'No Line',
      layer_properties_dash_pattern_dash: 'Dash',
      layer_properties_dash_pattern_dot: 'Dot',
      layer_properties_dash_pattern_dash_dot: 'Dash Dot',
      layer_properties_dash_pattern_dash_dot_dot: 'Dash Dot Dot',
      layer_properties_dash_pattern_long_dash: 'Long Dash',
      layer_properties_dash_pattern_long_dash_dot: 'Long Dash Dot',
      layer_properties_dash_pattern_sparse_dot: 'Sparse Dot',
      layer_properties_dash_pattern_custom: 'Custom',
    };
    return dict[key] ?? key;
  };

  it('renders closed trigger button with label on left and 128px stroke sample on right', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashPatternSelect, {
        id: 'layer-prop-dash-pattern',
        value: 'dash-dot',
        disabled: false,
        onChange: () => {},
        t: dummyT,
      })
    );

    assert.ok(html.includes('id="layer-prop-dash-pattern"'), 'Must render trigger with id');
    assert.ok(html.includes('Dash Dot'), 'Must display selected pattern label');
    assert.ok(html.includes('width="128"'), 'Must display 128px sample in trigger');
    assert.ok(html.includes('stroke-dasharray="10 4 2 4"'), 'Sample must reflect dash-dot pattern');
  });

  it('disables trigger button when disabled prop is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashPatternSelect, {
        id: 'layer-prop-dash-pattern',
        value: 'solid',
        disabled: true,
        onChange: () => {},
        t: dummyT,
      })
    );

    assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'Trigger button must be disabled');
  });

  it('renders dropdown list items with label on left and 128px sample on right when initially open', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashPatternSelect, {
        id: 'layer-prop-dash-pattern',
        value: 'solid',
        disabled: false,
        initialOpen: true,
        onChange: () => {},
        t: dummyT,
      })
    );

    assert.ok(html.includes('role="listbox"'), 'Must render listbox role');
    assert.ok(html.includes('Solid Line'), 'Must include Solid Line option');
    assert.ok(html.includes('No Line'), 'Must include No Line option');
    assert.ok(html.includes('Dash Dot Dot'), 'Must include Dash Dot Dot option');
    assert.ok(html.includes('Custom'), 'Must include Custom option');
    assert.ok(html.includes('data-testid="dash-sample-no-line"'), 'Must include blank space for No Line');
  });
});
