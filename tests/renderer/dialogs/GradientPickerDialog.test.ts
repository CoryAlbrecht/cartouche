/**
 * @file GradientPickerDialog.test.ts
 * @module tests/renderer/dialogs/GradientPickerDialog.test
 * @description Component tests for GradientPickerDialog: closed renders nothing, the hosted GradientPickerWidget is seeded with the starting stops, explicit and localized default titles, edits reach the caller only on Apply, Cancel / close button / Escape / backdrop cancel without applying, the dialog portals into the given container, and the Apply / Cancel labels and close-button tooltip are localized.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link GradientPickerDialog}
 * @see {@link PickerDialogFrame}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRendererJiti } from '../rendererJiti';
import { installMockDom, teardownMockDom, findElementsByClass, textOf, type MockDom, type MockElement } from '../mockDom';

const jiti = createRendererJiti(import.meta.url);

const { GradientPickerDialog } = jiti('@renderer/workbench/dialogs/GradientPickerDialog.tsx');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals.ts');

const STOPS = ['#ff0000ff 0%', '#0000ffff 100%'];

/**
 * @function click
 * @description Dispatches a bubbling click inside act().
 * @param {MockElement} el - Target element.
 */
async function click(el: MockElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent({ type: 'click', bubbles: true, preventDefault: () => {} });
  });
}

/**
 * @function typeHex
 * @description Types a hex colour into the selected stop's embedded ColourPickerWidget hex field.
 * @param {MockDom} dom - Installed harness.
 * @param {string} hex - Colour to enter.
 */
async function typeHex(dom: MockDom, hex: string): Promise<void> {
  const input = findElementsByClass(dom.doc.body, 'colour-picker-hex-input')[0];
  assert.ok(input, 'The selected stop is edited in HEX');
  input.value = hex;
  await act(async () => {
    input.dispatchEvent({ type: 'input', bubbles: true, target: input });
  });
}

describe('GradientPickerDialog (Ticket #306)', () => {
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
   * @description Renders the dialog with the given props and records Apply / Cancel calls.
   * @param {Record<string, unknown>} props - Extra props.
   * @returns {Promise<{ applied: string[][]; cancels: number }>} Live call record.
   */
  async function render(props: Record<string, unknown> = {}): Promise<{ applied: string[][]; cancels: number }> {
    const calls = { applied: [] as string[][], cancels: 0 };
    await act(async () => {
      dom!.root.render(
        React.createElement(GradientPickerDialog, {
          isOpen: true,
          initialStops: STOPS,
          onApply: (stops: string[]) => calls.applied.push(stops),
          onCancel: () => calls.cancels++,
          ...props
        })
      );
    });
    return calls;
  }

  const backdrops = (): MockElement[] => findElementsByClass(dom!.doc.body, 'gradient-picker-dialog-backdrop');
  const button = (part: string): MockElement => findElementsByClass(dom!.doc.body, `gradient-picker-dialog-${part}`)[0];
  const title = (): string => textOf(button('header').childNodes[0]);

  it('renders nothing when closed', async () => {
    await render({ isOpen: false });
    assert.equal(backdrops().length, 0);
  });

  it('hosts a GradientPickerWidget and shows an explicit title', async () => {
    await render({ title: 'Gradient Stops' });
    assert.equal(backdrops().length, 1);
    assert.equal(findElementsByClass(dom!.doc.body, 'gradient-picker-widget').length, 1, 'Hosted widget');
    assert.equal(title(), 'Gradient Stops');
  });

  it('uses the localized "Pick Gradient" title when no title is given', async () => {
    dictionarySignal.value = { gradient_picker_dialog_title: 'Pick Gradient' };
    await render();
    assert.equal(title(), 'Pick Gradient');
  });

  it('localizes the Apply and Cancel buttons and the close-button tooltip (Ticket #309)', async () => {
    dictionarySignal.value = { dialog_apply: 'Appliquer', dialog_cancel: 'Annuler' };
    await render();
    assert.equal(textOf(button('apply-btn')), 'Appliquer');
    assert.equal(textOf(button('cancel-btn')), 'Annuler');
    assert.equal(button('close-btn').getAttribute('title'), 'Annuler');
  });

  it('applies the edited stops once, and only on Apply', async () => {
    const calls = await render();
    await typeHex(dom!, '#00ff00ff');
    assert.equal(calls.applied.length, 0, 'Editing does not reach the caller');
    await click(button('apply-btn'));
    assert.deepEqual(calls.applied, [['#00ff00ff 0%', '#0000ffff 100%']]);
    assert.equal(calls.cancels, 0);
  });

  it('an untouched Apply returns the starting stops', async () => {
    const calls = await render();
    await click(button('apply-btn'));
    assert.deepEqual(calls.applied, [STOPS]);
  });

  it('with no starting stops, Apply returns the widget default stops', async () => {
    const calls = await render({ initialStops: undefined });
    await click(button('apply-btn'));
    assert.deepEqual(calls.applied, [['#000000ff 0%', '#00ff00ff 100%']]);
  });

  it('Cancel, the close button, Escape and a backdrop click cancel without applying', async () => {
    const calls = await render();
    await typeHex(dom!, '#00ff00ff');
    await click(button('cancel-btn'));
    await click(button('close-btn'));
    await act(async () => {
      dom!.win.dispatchEvent({ type: 'keydown', key: 'Escape', defaultPrevented: false, preventDefault: () => {} });
    });
    await click(backdrops()[0]);
    assert.equal(calls.cancels, 4);
    assert.equal(calls.applied.length, 0);
  });

  it('a click inside the dialog box does not cancel', async () => {
    const calls = await render();
    await click(button('box'));
    assert.equal(calls.cancels, 0);
  });

  it('portals into the given container', async () => {
    const host = dom!.doc.createElement('div') as MockElement;
    dom!.doc.body.appendChild(host);
    await render({ container: host });
    assert.equal(findElementsByClass(host, 'gradient-picker-dialog-backdrop').length, 1, 'Inside the container');
    assert.equal(findElementsByClass(dom!.container, 'gradient-picker-dialog-backdrop').length, 0, 'Not in the render root');
  });
});
