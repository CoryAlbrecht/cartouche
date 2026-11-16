/**
 * @file SimpleModeEditorOptionRows.test.ts
 * @module tests/renderer/dialogs/SimpleModeEditorOptionRows.test
 * @description Characterisation tests pinning the markup of the labelled option rows in SimpleModeEditor (Fill Colour, Stroke Colour and Gradient Stops): the element id and class of each row, the flex layout with a 1rem gap, and the 9rem label column ahead of the row's picker button.
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
    assert.match(html, row('layer-prop-fill-colour-row', 'Fill Colour', 'colour-button'));
  });

  it('renders the Stroke Colour row', () => {
    dictionarySignal.value = { layer_properties_styling_stroke_color: 'Stroke Colour' };
    const html = render({ type: 'simple-line', color: '#000000ff', width: 1 }, 'LineString');
    assert.match(html, row('layer-prop-stroke-colour-row', 'Stroke Colour', 'colour-button'));
  });

  it('renders the Gradient Stops row', () => {
    dictionarySignal.value = { layer_properties_styling_gradient_stops: 'Gradient Stops' };
    const html = render({ type: 'gradient-fill', angle: 0, stops: ['#ff0000ff 0%', '#0000ffff 100%'] }, 'Polygon');
    assert.match(html, row('layer-prop-gradient-stops-row', 'Gradient Stops', 'colour-button gradient-button'));
  });
});
