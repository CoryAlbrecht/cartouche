/**
 * @file ColourButton.test.ts
 * @module tests/renderer/components/common/ColourButton.test
 * @description Component tests for ColourButton: independent width/height sizing with a swatch inset by the border and a 0.1rem padding, checkerboard under translucent colours, opening ColourPickerDialog by click/Enter/Space with the dialog title and the value's own format, commit on Apply only, disabled behaviour, and allowAlpha passthrough.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @see {@link ColourButton}
 * @see {@link ColourPickerDialog}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRendererJiti } from '../../rendererJiti';
import {
  installMockDom,
  teardownMockDom,
  findElementsByClass,
  textOf,
  type MockDom,
  type MockElement
} from '../../mockDom';

const jiti = createRendererJiti(import.meta.url);

const { ColourButton, DEFAULT_COLOUR_BUTTON_SIZE } = jiti('@renderer/components/common/ColourButton.tsx');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals.ts');

const WORKBENCH_CSS = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../src/renderer/styles/workbench.css'),
  'utf8'
);

/**
 * @function cssRule
 * @description Returns the declaration block of a selector in workbench.css.
 * @param {string} selector - Exact selector text.
 * @returns {string} Declarations between the braces, or an empty string.
 */
function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = WORKBENCH_CSS.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
}

/**
 * @function render
 * @description Renders a ColourButton into the mock DOM root.
 * @param {MockDom} dom - Installed harness.
 * @param {Record<string, unknown>} props - ColourButton props.
 */
async function render(dom: MockDom, props: Record<string, unknown>): Promise<void> {
  await act(async () => {
    dom.root.render(React.createElement(ColourButton, { onChange: () => {}, ...props }));
  });
}

/**
 * @function dispatch
 * @description Dispatches a bubbling mock event inside act().
 * @param {MockElement} el - Event target.
 * @param {Record<string, unknown>} event - Event fields.
 */
async function dispatch(el: MockElement, event: Record<string, unknown>): Promise<void> {
  await act(async () => {
    el.dispatchEvent({ bubbles: true, preventDefault: () => {}, ...event });
  });
}

describe('ColourButton sizing and swatch (Ticket #302)', () => {
  it('defaults to a button whose swatch is about 1rem square', () => {
    assert.equal(DEFAULT_COLOUR_BUTTON_SIZE, 'calc(1.2rem + 2px)', '1rem swatch + 2 × 0.1rem inset + 2 × 1px border');
    const html = renderToStaticMarkup(React.createElement(ColourButton, { value: '#3388ff', onChange: () => {} }));
    assert.ok(html.includes('width:calc(1.2rem + 2px)'), 'Default width');
    assert.ok(html.includes('height:calc(1.2rem + 2px)'), 'Default height');
  });

  it('applies width and height independently to the button', () => {
    const html = renderToStaticMarkup(
      React.createElement(ColourButton, { value: '#3388ff', width: '3rem', height: '1.5rem', onChange: () => {} })
    );
    assert.ok(html.includes('width:3rem'), 'Width prop sizes the button');
    assert.ok(html.includes('height:1.5rem'), 'Height prop sizes the button');
  });

  it('insets the swatch by a 1px border and a 0.1rem padding, filling the rest', () => {
    const button = cssRule('.colour-button');
    assert.match(button, /box-sizing:\s*border-box/);
    assert.match(button, /border:\s*1px solid/);
    assert.match(button, /padding:\s*0\.1rem/);
    const swatch = cssRule('.colour-button-swatch');
    assert.match(swatch, /width:\s*100%/);
    assert.match(swatch, /height:\s*100%/);
  });

  it('draws the colour over a checkerboard so translucent colours read as translucent', () => {
    const html = renderToStaticMarkup(React.createElement(ColourButton, { value: '#00ff0080', onChange: () => {} }));
    assert.ok(html.includes('class="colour-button-swatch"'), 'Swatch element');
    assert.ok(html.includes('style="background-color:#00ff0080"'), 'Fill keeps the alpha channel');
    assert.match(cssRule('.colour-button-swatch'), /background-image:[^;]*gradient/, 'Checkerboard behind the fill');
  });

  it('renders opaque colours as six-digit hex and resolves named colours', () => {
    assert.ok(
      renderToStaticMarkup(React.createElement(ColourButton, { value: 'navy', onChange: () => {} })).includes(
        'style="background-color:#000080"'
      )
    );
  });
});

describe('ColourButton dialog flow (Ticket #302)', () => {
  let dom: MockDom | null = null;

  beforeEach(() => {
    dom = installMockDom();
  });

  afterEach(() => {
    dictionarySignal.value = {};
    teardownMockDom(dom);
    dom = null;
  });

  const button = (): MockElement => findElementsByClass(dom!.container, 'colour-button')[0];
  const dialogs = (): MockElement[] => findElementsByClass(dom!.doc.body, 'colour-picker-dialog-backdrop');

  it('opens the dialog on click with dialogTitle, and Apply commits the colour', async () => {
    let committed: string | null = null;
    await render(dom!, { value: '#ff0000', dialogTitle: 'Fill Colour', onChange: (c: string) => (committed = c) });

    assert.equal(dialogs().length, 0);
    await dispatch(button(), { type: 'click' });
    assert.equal(dialogs().length, 1, 'Click opens ColourPickerDialog');
    const header = findElementsByClass(dom!.doc.body, 'colour-picker-dialog-header')[0];
    assert.equal(textOf(header.childNodes[0]), 'Fill Colour');

    await dispatch(findElementsByClass(dom!.doc.body, 'colour-picker-dialog-apply-btn')[0], { type: 'click' });
    assert.equal(committed, '#ff0000', 'Apply calls onChange');
    assert.equal(dialogs().length, 0, 'Apply closes the dialog');
  });

  it('uses the localized "Pick Colour" title when no dialogTitle is given', async () => {
    dictionarySignal.value = { colour_picker_dialog_title: 'Pick Colour' };
    await render(dom!, { value: '#ff0000' });
    await dispatch(button(), { type: 'click' });
    const header = findElementsByClass(dom!.doc.body, 'colour-picker-dialog-header')[0];
    assert.equal(textOf(header.childNodes[0]), 'Pick Colour');
  });

  it('opens on Enter and on Space', async () => {
    await render(dom!, { value: '#ff0000' });
    await dispatch(button(), { type: 'keydown', key: 'Enter' });
    assert.equal(dialogs().length, 1, 'Enter opens');
    await dispatch(findElementsByClass(dom!.doc.body, 'colour-picker-dialog-cancel-btn')[0], { type: 'click' });
    await dispatch(button(), { type: 'keydown', key: ' ' });
    assert.equal(dialogs().length, 1, 'Space opens');
  });

  it('Cancel, Escape and clicking outside close without calling onChange', async () => {
    let calls = 0;
    await render(dom!, { value: '#ff0000', onChange: () => calls++ });

    await dispatch(button(), { type: 'click' });
    await dispatch(findElementsByClass(dom!.doc.body, 'colour-picker-dialog-cancel-btn')[0], { type: 'click' });
    assert.equal(dialogs().length, 0, 'Cancel closes');

    await dispatch(button(), { type: 'click' });
    await act(async () => {
      dom!.win.dispatchEvent({ type: 'keydown', key: 'Escape', defaultPrevented: false, preventDefault: () => {} });
    });
    assert.equal(dialogs().length, 0, 'Escape closes');

    await dispatch(button(), { type: 'click' });
    await dispatch(dialogs()[0], { type: 'click' });
    assert.equal(dialogs().length, 0, 'Clicking the backdrop closes');

    assert.equal(calls, 0, 'onChange is never called without Apply');
  });

  it('opens the dialog in the format of the current value', async () => {
    await render(dom!, { value: 'rgb(10 20 30)' });
    await dispatch(button(), { type: 'click' });
    const select = findElementsByClass(dom!.doc.body, 'colour-picker-format-select')[0];
    const selected = select.options.find((o: MockElement) => o.selected);
    assert.equal(selected?.value, 'RGB');
  });

  it('portals the dialog into the document that owns the button', async () => {
    await render(dom!, { value: '#ff0000' });
    await dispatch(button(), { type: 'click' });
    assert.equal(findElementsByClass(dom!.container, 'colour-picker-dialog-backdrop').length, 0, 'Not inside the button container');
    assert.equal(dialogs().length, 1, 'Portaled into ownerDocument.body');
  });

  it('when disabled, is dimmed with a not-allowed cursor and never opens', async () => {
    await render(dom!, { value: '#ff0000', disabled: true });
    const btn = button();
    assert.equal(btn.disabled, true);
    assert.match(cssRule('.colour-button:disabled'), /cursor:\s*not-allowed/);
    assert.match(cssRule('.colour-button:disabled'), /opacity:/);
    await dispatch(btn, { type: 'click' });
    await dispatch(btn, { type: 'keydown', key: 'Enter' });
    assert.equal(dialogs().length, 0);
  });

  it('passes allowAlpha to the dialog', async () => {
    await render(dom!, { value: '#ff000080', allowAlpha: false });
    await dispatch(button(), { type: 'click' });
    assert.equal(findElementsByClass(dom!.doc.body, 'colour-picker-alpha-strip').length, 0, 'Alpha strip hidden');
  });

  it('labels the button with ariaLabel, falling back to the dialog title', async () => {
    await render(dom!, { value: '#ff0000', ariaLabel: 'Stroke colour' });
    assert.equal(button().getAttribute('aria-label'), 'Stroke colour');
    await render(dom!, { value: '#ff0000', dialogTitle: 'Fill Colour' });
    assert.equal(button().getAttribute('aria-label'), 'Fill Colour');
  });
});
