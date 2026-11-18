/**
 * @file SimpleModeEditorColour.test.ts
 * @module tests/renderer/dialogs/SimpleModeEditorColour.test
 * @description Interaction tests for the Simple Fill and Simple Line colour rows in SimpleModeEditor (Layer Properties) and the Project Default Styles tab: the ColourButton opens a ColourPickerDialog titled with the field label, Apply writes the colour into the draft, Cancel leaves it unchanged, and a locked component's button never opens.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @see {@link SimpleModeEditor}
 * @see {@link ProjectDefaultStylesTab}
 * @see {@link ColourButton}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRendererJiti } from "../rendererJiti";
import {
  installMockDom,
  teardownMockDom,
  findElementsByClass,
  textOf,
  type MockDom,
  type MockElement,
} from "../mockDom";

const jiti = createRendererJiti(import.meta.url);

const { SimpleModeEditor } = jiti(
  "@renderer/workbench/dialogs/SimpleModeEditor.tsx"
);
const { ProjectDefaultStylesTab } = jiti(
  "@renderer/workbench/dialogs/ProjectDefaultStylesTab.tsx"
);
const { dictionarySignal } = jiti("@renderer/state/i18nSignals.ts");
const {
  beginProjectPropertiesDraft,
  setDraftUseApplicationDefault,
  projectPropertiesDraftSignal,
} = jiti("@renderer/state/projectPropertiesSignals.ts");

const LABELS = {
  layer_properties_styling_fill_color: "Fill Colour",
  layer_properties_styling_stroke_color: "Stroke Colour",
};

/**
 * @function styleWith
 * @description Builds a Simple Cartouche style document holding one component.
 * @param {Record<string, unknown>} component - The component.
 * @returns {string} Serialized style content.
 */
function styleWith(component: Record<string, unknown>): string {
  return JSON.stringify({
    format: "simple",
    version: 1,
    components: [component],
  });
}

/**
 * @function click
 * @description Dispatches a bubbling click inside act().
 * @param {MockElement} el - Target element.
 */
async function click(el: MockElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent({
      type: "click",
      bubbles: true,
      preventDefault: () => {},
    });
  });
}

/**
 * @function typeHex
 * @description Types a hex colour into the open dialog's ColourPickerWidget hex field.
 * @param {MockDom} dom - Installed harness.
 * @param {string} hex - Colour to enter.
 */
async function typeHex(dom: MockDom, hex: string): Promise<void> {
  const input = findElementsByClass(dom.doc.body, "colour-picker-hex-input")[0];
  assert.ok(input, "Dialog opens in HEX with a hex input");
  input.value = hex;
  await act(async () => {
    input.dispatchEvent({ type: "input", bubbles: true, target: input });
  });
}

/**
 * @function dialogButton
 * @description Finds an Apply or Cancel button of the open ColourPickerDialog.
 * @param {MockDom} dom - Installed harness.
 * @param {'apply' | 'cancel'} which - Button to find.
 * @returns {MockElement} The button.
 */
function dialogButton(dom: MockDom, which: "apply" | "cancel"): MockElement {
  return findElementsByClass(
    dom.doc.body,
    `colour-picker-dialog-${which}-btn`
  )[0];
}

/**
 * @function colourButtonIn
 * @description Finds the ColourButton inside a SimpleModeEditor colour row.
 * @param {MockElement} root - Search root.
 * @param {string} rowClass - Row class, e.g. `layer-prop-fill-colour-row`.
 * @returns {MockElement} The button.
 */
function colourButtonIn(root: MockElement, rowClass: string): MockElement {
  const row = findElementsByClass(root, rowClass)[0];
  assert.ok(row, `Row ${rowClass} is rendered`);
  return findElementsByClass(row, "colour-button")[0];
}

describe("SimpleModeEditor colour rows (Ticket #303)", () => {
  let dom: MockDom | null = null;

  beforeEach(() => {
    dom = installMockDom();
    dictionarySignal.value = { ...LABELS };
  });

  afterEach(() => {
    dictionarySignal.value = {};
    teardownMockDom(dom);
    dom = null;
  });

  /**
   * @function renderEditor
   * @description Renders SimpleModeEditor with one component and records every onChange payload.
   * @param {Record<string, unknown>} component - The style component.
   * @param {string} geometryKind - Layer geometry kind.
   * @returns {Promise<string[]>} Collected onChange payloads.
   */
  async function renderEditor(
    component: Record<string, unknown>,
    geometryKind: string
  ): Promise<string[]> {
    const changes: string[] = [];
    await act(async () => {
      dom!.root.render(
        React.createElement(SimpleModeEditor, {
          styleContent: styleWith(component),
          geometryKind,
          onChange: (c: string) => changes.push(c),
        })
      );
    });
    return changes;
  }

  it("Fill Colour: the button opens a dialog titled with the label, and Apply writes the colour", async () => {
    const changes = await renderEditor(
      { id: "f1", type: "simple-fill", enabled: true, color: "#123456" },
      "Polygon"
    );
    await click(colourButtonIn(dom!.container, "layer-prop-fill-colour-row"));

    const header = findElementsByClass(
      dom!.doc.body,
      "colour-picker-dialog-header"
    )[0];
    assert.equal(
      textOf(header.childNodes[0]),
      "Fill Colour",
      "Dialog title is the field label"
    );

    await typeHex(dom!, "#ff0000ff");
    assert.equal(
      changes.length,
      0,
      "Editing in the dialog does not touch the draft"
    );
    await click(dialogButton(dom!, "apply"));

    assert.equal(changes.length, 1, "Apply commits once");
    assert.equal(JSON.parse(changes[0]).components[0].color, "#ff0000ff");
  });

  it("Stroke Colour: Cancel leaves the line colour unchanged", async () => {
    const changes = await renderEditor(
      {
        id: "l1",
        type: "simple-line",
        enabled: true,
        color: "#654321",
        width: 2,
      },
      "LineString"
    );
    await click(colourButtonIn(dom!.container, "layer-prop-stroke-colour-row"));
    const header = findElementsByClass(
      dom!.doc.body,
      "colour-picker-dialog-header"
    )[0];
    assert.equal(textOf(header.childNodes[0]), "Stroke Colour");

    await typeHex(dom!, "#00ff00ff");
    await click(dialogButton(dom!, "cancel"));

    assert.equal(changes.length, 0, "Cancel does not change the draft");
    assert.equal(
      findElementsByClass(dom!.doc.body, "colour-picker-dialog-backdrop")
        .length,
      0,
      "Dialog closed"
    );
  });

  it("Stroke Colour: Apply writes the line colour", async () => {
    const changes = await renderEditor(
      {
        id: "l1",
        type: "simple-line",
        enabled: true,
        color: "#654321",
        width: 2,
      },
      "LineString"
    );
    await click(colourButtonIn(dom!.container, "layer-prop-stroke-colour-row"));
    await typeHex(dom!, "#00ff00ff");
    await click(dialogButton(dom!, "apply"));
    assert.equal(JSON.parse(changes[0]).components[0].color, "#00ff00ff");
  });

  it("a locked component has a disabled colour button that never opens", async () => {
    await renderEditor(
      {
        id: "f1",
        type: "simple-fill",
        enabled: true,
        locked: true,
        color: "#123456",
      },
      "Polygon"
    );
    const button = colourButtonIn(dom!.container, "layer-prop-fill-colour-row");
    assert.equal(button.disabled, true);
    await click(button);
    assert.equal(
      findElementsByClass(dom!.doc.body, "colour-picker-dialog-backdrop")
        .length,
      0
    );
  });
});

describe("Project Default Styles colour rows (Ticket #303)", () => {
  let dom: MockDom | null = null;

  beforeEach(() => {
    dom = installMockDom();
    dictionarySignal.value = { ...LABELS };
    beginProjectPropertiesDraft();
  });

  afterEach(() => {
    dictionarySignal.value = {};
    teardownMockDom(dom);
    dom = null;
  });

  it("Apply in the polygon default style updates the project draft", async () => {
    setDraftUseApplicationDefault("polygon", false);
    await act(async () => {
      dom!.root.render(React.createElement(ProjectDefaultStylesTab));
    });

    const polygon = findElementsByClass(dom!.container, "polygon")[0];
    assert.ok(polygon, "Polygon default style section is rendered");
    const row =
      findElementsByClass(polygon, "layer-prop-fill-colour-row")[0]
      ?? findElementsByClass(polygon, "layer-prop-stroke-colour-row")[0];
    assert.ok(row, "The active component shows a colour row");

    await click(findElementsByClass(row, "colour-button")[0]);
    await typeHex(dom!, "#abcdefff");
    await click(dialogButton(dom!, "apply"));

    const content =
      projectPropertiesDraftSignal.value.defaultStyles.polygon.styleContent;
    assert.ok(
      content.includes("#abcdefff"),
      "The applied colour reaches the project draft"
    );
  });
});
