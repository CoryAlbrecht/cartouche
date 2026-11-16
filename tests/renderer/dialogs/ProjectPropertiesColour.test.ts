/**
 * @file ProjectPropertiesColour.test.ts
 * @module tests/renderer/dialogs/ProjectPropertiesColour.test
 * @description Interaction tests for the Selection Colour and Map Background Colour ColourButtons on the Project Properties General tab: each opens a ColourPickerDialog titled with its label, Apply writes the draft (the background normalized to opaque hex), Cancel leaves it unchanged, and only the selection dialog offers transparency.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @see {@link ProjectPropertiesDialog}
 * @see {@link ColourButton}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRendererJiti } from '../rendererJiti';
import { installMockDom, teardownMockDom, findElementsByClass, textOf, type MockDom, type MockElement } from '../mockDom';

const jiti = createRendererJiti(import.meta.url);

const { ProjectPropertiesDialog } = jiti('@renderer/workbench/dialogs/ProjectPropertiesDialog.tsx');
const {
  activeProjectPropertiesTabSignal,
  projectPropertiesDraftSignal,
  openProjectPropertiesDialog,
  closeProjectPropertiesDialog,
  updateProjectPropertiesDraft
} = jiti('@renderer/state/projectPropertiesSignals.ts');
const { currentProjectSignal, hasProjectSignal } = jiti('@renderer/state/projectSignals.ts');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals.ts');

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
 * @description Types a hex colour into the open dialog's ColourPickerWidget hex field.
 * @param {MockDom} dom - Installed harness.
 * @param {string} hex - Colour to enter.
 */
async function typeHex(dom: MockDom, hex: string): Promise<void> {
  const input = findElementsByClass(dom.doc.body, 'colour-picker-hex-input')[0];
  assert.ok(input, 'Dialog opens in HEX with a hex input');
  input.value = hex;
  await act(async () => {
    input.dispatchEvent({ type: 'input', bubbles: true, target: input });
  });
}

describe('Project Properties General tab colour buttons (Ticket #304)', () => {
  let dom: MockDom | null = null;

  beforeEach(async () => {
    dom = installMockDom();
    dom.win.electronAPI = { updateProjectProperties: async () => true };
    dictionarySignal.value = {
      project_properties_label_selection_colour: 'Selection Colour',
      project_properties_label_background_colour: 'Map Background Colour'
    };
    currentProjectSignal.value = { format: 'cartouche-xml', metadata: { title: 'World Atlas' }, layers: [] };
    hasProjectSignal.value = true;
    openProjectPropertiesDialog();
    activeProjectPropertiesTabSignal.value = 'general';
    updateProjectPropertiesDraft({ selectionColour: '#0080ff66', backgroundColour: '#336699' });
    await act(async () => {
      dom!.root.render(React.createElement(ProjectPropertiesDialog));
    });
  });

  afterEach(() => {
    closeProjectPropertiesDialog();
    hasProjectSignal.value = false;
    dictionarySignal.value = {};
    teardownMockDom(dom);
    dom = null;
  });

  /**
   * @function buttonIn
   * @description Finds the ColourButton in a General tab colour row.
   * @param {string} rowClass - Row class.
   * @returns {MockElement} The button.
   */
  function buttonIn(rowClass: string): MockElement {
    const row = findElementsByClass(dom!.doc.body, rowClass)[0];
    assert.ok(row, `Row ${rowClass} is rendered`);
    assert.equal(findElementsByClass(row, 'colour-picker-widget').length, 0, 'No embedded ColourPickerWidget');
    const button = findElementsByClass(row, 'colour-button')[0];
    assert.ok(button, 'Row holds a ColourButton');
    return button;
  }

  /**
   * @function dialogTitle
   * @description Reads the title of the open ColourPickerDialog.
   * @returns {string} Header text.
   */
  function dialogTitle(): string {
    return textOf(findElementsByClass(dom!.doc.body, 'colour-picker-dialog-header')[0].childNodes[0]);
  }

  it('Selection Colour opens a transparency-capable dialog and Apply writes the draft', async () => {
    await click(buttonIn('project-prop-selection-colour-row'));
    assert.equal(dialogTitle(), 'Selection Colour');
    assert.equal(findElementsByClass(dom!.doc.body, 'colour-picker-alpha-strip').length, 1, 'Transparency allowed');
    await typeHex(dom!, '#ff000080');
    await click(findElementsByClass(dom!.doc.body, 'colour-picker-dialog-apply-btn')[0]);

    assert.equal(projectPropertiesDraftSignal.value.selectionColour, '#ff000080', 'Translucent colour kept');
  });

  it('Map Background Colour opens an opaque-only dialog and Apply stores opaque hex', async () => {
    await click(buttonIn('project-prop-background-colour-row'));
    assert.equal(dialogTitle(), 'Map Background Colour');
    assert.equal(findElementsByClass(dom!.doc.body, 'colour-picker-alpha-strip').length, 0, 'Opaque only');

    await typeHex(dom!, '#ff8800ff');
    await click(findElementsByClass(dom!.doc.body, 'colour-picker-dialog-apply-btn')[0]);
    assert.equal(projectPropertiesDraftSignal.value.backgroundColour, '#ff8800', 'Normalized to six-digit hex');
  });

  it('Cancel leaves both colours unchanged', async () => {
    await click(buttonIn('project-prop-background-colour-row'));
    await typeHex(dom!, '#ff8800ff');
    await click(findElementsByClass(dom!.doc.body, 'colour-picker-dialog-cancel-btn')[0]);
    await click(buttonIn('project-prop-selection-colour-row'));
    await click(findElementsByClass(dom!.doc.body, 'colour-picker-dialog-cancel-btn')[0]);

    assert.equal(projectPropertiesDraftSignal.value.backgroundColour, '#336699');
    assert.equal(projectPropertiesDraftSignal.value.selectionColour, '#0080ff66');
  });
});
