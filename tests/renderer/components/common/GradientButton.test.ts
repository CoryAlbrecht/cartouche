/**
 * @file GradientButton.test.ts
 * @module tests/renderer/components/common/GradientButton.test
 * @description Component tests for GradientButton: the 8rem × 2rem default and independent width/height, a left-to-right strip over the shared picker-button frame and checkerboard, opening GradientPickerDialog by click/Enter/Space with the dialog title and the first stop's format, commit on Apply only, the default gradient for an empty value, disabled behaviour, and the accessible label.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link GradientButton}
 * @see {@link GradientPickerDialog}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
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

const { GradientButton, DEFAULT_GRADIENT_BUTTON_WIDTH, DEFAULT_GRADIENT_BUTTON_HEIGHT } = jiti('@renderer/components/common/GradientButton.tsx');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals.ts');

const STOPS = ['#ff0000ff 0%', '#00ff0080 50%', '#0000ffff 100%'];

/**
 * @function markup
 * @description Renders a GradientButton to static HTML.
 * @param {Record<string, unknown>} props - Extra props.
 * @returns {string} HTML.
 */
function markup(props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(React.createElement(GradientButton, { value: STOPS, onChange: () => {}, ...props }));
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

describe('GradientButton sizing and strip (Ticket #307)', () => {
  it('defaults to 8rem wide × 2rem tall', () => {
    assert.equal(DEFAULT_GRADIENT_BUTTON_WIDTH, '8rem');
    assert.equal(DEFAULT_GRADIENT_BUTTON_HEIGHT, '2rem');
    assert.ok(markup().includes('style="width:8rem;height:2rem"'));
  });

  it('applies width and height independently', () => {
    assert.ok(markup({ width: '10rem', height: '1.5rem' }).includes('style="width:10rem;height:1.5rem"'));
  });

  it('reuses the shared picker-button frame and checkerboard', () => {
    const html = markup();
    assert.ok(html.includes('class="picker-button gradient-button"'), 'Shared button styling');
    assert.ok(html.includes('class="picker-button-swatch"'), 'Checkerboard swatch');
    assert.ok(html.includes('class="picker-button-swatch-fill gradient-button-strip"'), 'Shared fill plus the strip class');
  });

  it('draws the stops left to right, in offset order', () => {
    const html = markup({ value: ['#0000ffff 100%', '#ff0000ff 0%'] });
    assert.ok(html.includes('background-image:linear-gradient(to right, #ff0000ff 0%, #0000ffff 100%)'), html);
  });

  it('draws the black-to-green default gradient for an empty value (#314)', () => {
    const html = markup({ value: [] });
    assert.ok(html.includes('background-image:linear-gradient(to right, #000000ff 0%, #00ff00ff 100%)'), html);
  });

  it('keeps translucent stops translucent', () => {
    assert.ok(markup().includes('#00ff0080 50%'));
  });
});

describe('GradientButton dialog flow (Ticket #307)', () => {
  let dom: MockDom | null = null;

  beforeEach(() => {
    dom = installMockDom();
  });

  afterEach(() => {
    dictionarySignal.value = {};
    teardownMockDom(dom);
    dom = null;
  });

  /**
   * @function render
   * @description Renders a GradientButton into the mock DOM root.
   * @param {Record<string, unknown>} props - Extra props.
   */
  async function render(props: Record<string, unknown>): Promise<void> {
    await act(async () => {
      dom!.root.render(React.createElement(GradientButton, { value: STOPS, onChange: () => {}, ...props }));
    });
  }

  const button = (): MockElement => findElementsByClass(dom!.container, 'gradient-button')[0];
  const dialogs = (): MockElement[] => findElementsByClass(dom!.doc.body, 'gradient-picker-dialog-backdrop');
  const part = (name: string): MockElement => findElementsByClass(dom!.doc.body, `gradient-picker-dialog-${name}`)[0];

  it('opens on click with dialogTitle, and Apply commits the stops', async () => {
    let committed: string[] | null = null;
    await render({ dialogTitle: 'Gradient Stops', onChange: (s: string[]) => (committed = s) });
    assert.equal(dialogs().length, 0);
    await dispatch(button(), { type: 'click' });
    assert.equal(dialogs().length, 1);
    assert.equal(textOf(part('header').childNodes[0]), 'Gradient Stops');

    const hex = findElementsByClass(dom!.doc.body, 'colour-picker-hex-input')[0];
    hex.value = '#123456ff';
    await act(async () => {
      hex.dispatchEvent({ type: 'input', bubbles: true, target: hex });
    });
    assert.equal(committed, null, 'Editing does not commit');

    await dispatch(part('apply-btn'), { type: 'click' });
    assert.deepEqual(committed, ['#123456ff 0%', '#00ff0080 50%', '#0000ffff 100%']);
    assert.equal(dialogs().length, 0, 'Apply closes');
  });

  it('uses the localized "Pick Gradient" title when no dialogTitle is given', async () => {
    dictionarySignal.value = { gradient_picker_dialog_title: 'Pick Gradient' };
    await render({});
    await dispatch(button(), { type: 'click' });
    assert.equal(textOf(part('header').childNodes[0]), 'Pick Gradient');
  });

  it('opens on Enter and on Space', async () => {
    await render({});
    await dispatch(button(), { type: 'keydown', key: 'Enter' });
    assert.equal(dialogs().length, 1, 'Enter opens');
    await dispatch(part('cancel-btn'), { type: 'click' });
    await dispatch(button(), { type: 'keydown', key: ' ' });
    assert.equal(dialogs().length, 1, 'Space opens');
  });

  it('Cancel, Escape and a backdrop click close without calling onChange', async () => {
    let calls = 0;
    await render({ onChange: () => calls++ });
    await dispatch(button(), { type: 'click' });
    await dispatch(part('cancel-btn'), { type: 'click' });
    assert.equal(dialogs().length, 0, 'Cancel closes');
    await dispatch(button(), { type: 'click' });
    await act(async () => {
      dom!.win.dispatchEvent({ type: 'keydown', key: 'Escape', defaultPrevented: false, preventDefault: () => {} });
    });
    assert.equal(dialogs().length, 0, 'Escape closes');
    await dispatch(button(), { type: 'click' });
    await dispatch(dialogs()[0], { type: 'click' });
    assert.equal(dialogs().length, 0, 'Backdrop closes');
    assert.equal(calls, 0);
  });

  it('opens the dialog in the first stop\'s colour format', async () => {
    await render({ value: ['rgb(255 0 0) 0%', 'rgb(0 0 255) 100%'] });
    await dispatch(button(), { type: 'click' });
    const select = findElementsByClass(dom!.doc.body, 'colour-picker-format-select')[0];
    assert.equal(select.options.find((o: MockElement) => o.selected)?.value, 'RGB');
  });

  it('portals the dialog into the document that owns the button', async () => {
    await render({});
    await dispatch(button(), { type: 'click' });
    assert.equal(findElementsByClass(dom!.container, 'gradient-picker-dialog-backdrop').length, 0);
    assert.equal(dialogs().length, 1);
  });

  it('when disabled, never opens', async () => {
    await render({ disabled: true });
    assert.equal(button().disabled, true);
    await dispatch(button(), { type: 'click' });
    await dispatch(button(), { type: 'keydown', key: 'Enter' });
    assert.equal(dialogs().length, 0);
  });

  it('labels the button with ariaLabel, falling back to the dialog title', async () => {
    await render({ ariaLabel: 'Fill gradient' });
    assert.equal(button().getAttribute('aria-label'), 'Fill gradient');
    await render({ dialogTitle: 'Gradient Stops' });
    assert.equal(button().getAttribute('aria-label'), 'Gradient Stops');
  });
});
