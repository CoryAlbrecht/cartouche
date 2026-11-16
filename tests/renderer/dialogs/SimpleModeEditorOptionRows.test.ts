/**
 * @file SimpleModeEditorOptionRows.test.ts
 * @module tests/renderer/dialogs/SimpleModeEditorOptionRows.test
 * @description Characterisation tests pinning the markup of the labelled option rows in SimpleModeEditor: the Fill Colour, Stroke Colour and Gradient Stops picker rows (element id and class, `<span>` label); the Simple Line rows Stroke Width, Line Offset, Line Cap, Line Join, Dash Pattern, Dash Offset and Dash Array; and the Simple Marker rows Point Shape, Radius, Fill Colour, Stroke Colour and Stroke Width (`<label htmlFor>` paired with the row's control). Every row is a flex row with a 1rem gap and a 9rem label column; the Dash Array row aligns to the top and pads its label, which names the first dash input when there is one.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link SimpleModeEditor}
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRendererJiti } from '../rendererJiti';

const jiti = createRendererJiti(import.meta.url);

const { SimpleModeEditor } = jiti('@renderer/workbench/dialogs/SimpleModeEditor.tsx');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals.ts');

/**
 * @function render
 * @description Renders SimpleModeEditor to static HTML with one style component selected.
 * @param {Record<string, unknown>} component - The style component.
 * @param {string} geometryKind - Geometry kind of the layer.
 * @returns {string} HTML.
 */
function render(component: Record<string, unknown>, geometryKind: string): string {
  return renderToStaticMarkup(
    React.createElement(SimpleModeEditor, {
      styleContent: JSON.stringify({ format: 'simple', version: 1, components: [{ id: 'c1', enabled: true, ...component }] }),
      geometryKind,
      onChange: () => {}
    })
  );
}

/**
 * @function row
 * @description Matches the opening markup of a labelled option row, through the opening tag of its control button.
 * @param {string} id - Element id and class of the option row.
 * @param {string} label - Localized label text.
 * @param {string} controlClass - Class attribute of the row's control.
 * @returns {RegExp} Pattern for the row.
 */
function row(id: string, label: string, controlClass: string): RegExp {
  return new RegExp(
    `<div id="${id}" class="${id}" style="display:flex;align-items:center;gap:1rem">` +
    `<span style="width:9rem;font-size:0.8125rem;color:#334155">${label}:</span>` +
    `<button type="button"[^>]* class="${controlClass}"[^>]*>`
  );
}

describe('SimpleModeEditor labelled option rows (Ticket #311)', () => {
  afterEach(() => {
    dictionarySignal.value = {};
  });

  it('renders the Fill Colour row', () => {
    dictionarySignal.value = { layer_properties_styling_fill_color: 'Fill Colour' };
    const html = render({ type: 'simple-fill', color: '#ff0000ff' }, 'Polygon');
    assert.match(html, row('layer-prop-fill-colour-row', 'Fill Colour', 'picker-button colour-button'));
  });

  it('renders the Stroke Colour row', () => {
    dictionarySignal.value = { layer_properties_styling_stroke_color: 'Stroke Colour' };
    const html = render({ type: 'simple-line', color: '#000000ff', width: 1 }, 'LineString');
    assert.match(html, row('layer-prop-stroke-colour-row', 'Stroke Colour', 'picker-button colour-button'));
  });

  it('renders the Gradient Stops row', () => {
    dictionarySignal.value = { layer_properties_styling_gradient_stops: 'Gradient Stops' };
    const html = render({ type: 'gradient-fill', angle: 0, stops: ['#ff0000ff 0%', '#0000ffff 100%'] }, 'Polygon');
    assert.match(html, row('layer-prop-gradient-stops-row', 'Gradient Stops', 'picker-button gradient-button'));
  });
});

/** Inline style of the 9rem label column. */
const LABEL_STYLE = 'width:9rem;font-size:0.8125rem;color:#334155';

/**
 * @function labelledRow
 * @description Matches a labelled option row with no id of its own whose `<label for>` names its control, through the opening of that control.
 * @param {string} htmlFor - Id of the labelled control.
 * @param {string} label - Localized label text.
 * @param {string} controlStart - Literal opening markup of the row's control.
 * @returns {string} Literal markup for the row's opening.
 */
function labelledRow(htmlFor: string, label: string, controlStart: string): string {
  return (
    '<div style="display:flex;align-items:center;gap:1rem">' +
    `<label for="${htmlFor}" style="${LABEL_STYLE}">${label}:</label>` +
    controlStart
  );
}

/**
 * @function includesRow
 * @description Asserts that the rendered HTML contains the given literal row markup.
 * @param {string} html - Rendered HTML.
 * @param {string} expected - Literal row markup.
 */
function includesRow(html: string, expected: string): void {
  assert.ok(html.includes(expected), `Expected row markup:\n${expected}`);
}

/**
 * @function numberInput
 * @description Builds the opening markup of a number input with the shared styling editor field classes (#318).
 * @param {string} id - Element id of the input.
 * @param {string} attrs - Literal attributes after `type` (e.g. `min="0" step="0.1"`).
 * @returns {string} Literal opening markup, without the closing of the tag.
 */
function numberInput(id: string, attrs: string): string {
  return `<input class="styling-editor-field styling-editor-number" id="${id}" type="number" ${attrs}`;
}

describe('SimpleModeEditor Simple Line option rows (Ticket #315)', () => {
  afterEach(() => {
    dictionarySignal.value = {};
  });

  const LINE = { type: 'simple-line', color: '#000000ff', width: 2 };

  it('renders Stroke Width, Line Offset and Dash Offset as labelled number inputs', () => {
    dictionarySignal.value = {
      layer_properties_styling_stroke_width: 'Stroke Width',
      layer_properties_styling_line_offset: 'Line Offset',
      layer_properties_styling_dash_offset: 'Dash Offset'
    };
    const html = render(LINE, 'LineString');
    includesRow(html, labelledRow('layer-prop-stroke-width', 'Stroke Width', numberInput('layer-prop-stroke-width', 'min="0" step="0.1"')));
    includesRow(html, labelledRow('layer-prop-line-offset', 'Line Offset', numberInput('layer-prop-line-offset', 'step="0.1"')));
    includesRow(html, labelledRow('layer-prop-dash-offset', 'Dash Offset', numberInput('layer-prop-dash-offset', 'min="0" step="0.1"')));
  });

  it('renders Line Cap and Line Join as labelled selects', () => {
    dictionarySignal.value = {
      layer_properties_styling_line_cap: 'Line Cap',
      layer_properties_styling_line_join: 'Line Join'
    };
    const html = render(LINE, 'LineString');
    includesRow(html, labelledRow('layer-prop-line-cap', 'Line Cap', '<select class="styling-editor-field" id="layer-prop-line-cap">'));
    includesRow(html, labelledRow('layer-prop-line-join', 'Line Join', '<select class="styling-editor-field" id="layer-prop-line-join">'));
  });

  it('renders the Dash Pattern row labelling its pattern select', () => {
    dictionarySignal.value = { layer_properties_styling_dash_pattern: 'Dash Pattern' };
    const html = render(LINE, 'LineString');
    includesRow(html, labelledRow('layer-prop-dash-pattern', 'Dash Pattern', '<div style="position:relative;display:inline-block;width:20rem">'));
  });

  it('renders the Dash Array row top-aligned, its padded label naming the first dash input', () => {
    dictionarySignal.value = { layer_properties_styling_dash_array: 'Dash Array' };
    const html = render({ ...LINE, dashPattern: 'custom', dashArray: [5, 2, 1, 3] }, 'LineString');
    includesRow(
      html,
      '<div style="display:flex;align-items:flex-start;gap:1rem">' +
      `<label for="layer-prop-dash-array-line-0" style="${LABEL_STYLE};padding-top:0.25rem">Dash Array:</label>` +
      '<div style="display:flex;gap:0.5rem;align-items:flex-start">'
    );
    assert.match(html, /<input class="styling-editor-dash-cell" id="layer-prop-dash-array-line-0" type="number"[^>]* aria-label="layer_properties_dash_array_col_line 1"/);
    assert.match(html, /<input class="styling-editor-dash-cell" id="layer-prop-dash-array-line-1" type="number"[^>]* aria-label="layer_properties_dash_array_col_line 2"/);
  });

  it('renders the Dash Array label as a span when there are no dashes to name (#315)', () => {
    dictionarySignal.value = { layer_properties_styling_dash_array: 'Dash Array' };
    includesRow(
      render(LINE, 'LineString'),
      '<div style="display:flex;align-items:flex-start;gap:1rem">' +
      `<span style="${LABEL_STYLE};padding-top:0.25rem">Dash Array:</span>`
    );
  });

  it('keeps the disabled state of a locked component', () => {
    const html = render({ ...LINE, locked: true }, 'LineString');
    includesRow(html, numberInput('layer-prop-stroke-width', 'min="0" step="0.1" disabled=""'));
  });
});

describe('SimpleModeEditor Simple Marker option rows (Ticket #315)', () => {
  afterEach(() => {
    dictionarySignal.value = {};
  });

  const MARKER = { type: 'simple-marker', fillColor: '#ff0000', strokeColor: '#0000ff', radius: 4, strokeWidth: 2 };

  it('renders Point Shape as a labelled select', () => {
    dictionarySignal.value = { layer_properties_styling_point_shape: 'Point Shape' };
    includesRow(
      render(MARKER, 'Point'),
      labelledRow(
        'layer-prop-point-shape',
        'Point Shape',
        '<select class="styling-editor-field" id="layer-prop-point-shape">'
      )
    );
  });

  it('renders Radius and Stroke Width as labelled number inputs', () => {
    dictionarySignal.value = {
      layer_properties_styling_point_radius: 'Radius',
      layer_properties_styling_stroke_width: 'Stroke Width'
    };
    const html = render(MARKER, 'Point');
    includesRow(html, labelledRow('layer-prop-marker-radius', 'Radius', numberInput('layer-prop-marker-radius', 'min="1" max="100"')));
    includesRow(html, labelledRow('layer-prop-marker-stroke-width', 'Stroke Width', numberInput('layer-prop-marker-stroke-width', 'min="0" max="50"')));
  });

  it('renders Fill Colour and Stroke Colour as labelled colour inputs', () => {
    dictionarySignal.value = {
      layer_properties_styling_fill_color: 'Fill Colour',
      layer_properties_styling_stroke_color: 'Stroke Colour'
    };
    const html = render(MARKER, 'Point');
    const colourInput = '<div class="color-input-container" style="display:inline-flex;align-items:center;gap:0.375rem">';
    includesRow(html, labelledRow('layer-prop-marker-fill-color', 'Fill Colour', colourInput));
    includesRow(html, labelledRow('layer-prop-marker-stroke-color', 'Stroke Colour', colourInput));
  });
});
