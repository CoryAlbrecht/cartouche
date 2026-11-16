/**
 * @file SimpleModeEditorGradient.test.ts
 * @module tests/renderer/dialogs/SimpleModeEditorGradient.test
 * @description Interaction tests for the Gradient Stops row of the Gradient Fill options, both in SimpleModeEditor (Layer Properties) and in the Project Default Styles tab: the GradientButton opens a GradientPickerDialog titled "Gradient Stops", Apply writes the stops into the draft, Cancel leaves it unchanged, the angle spinner stays outside the dialog, and a locked component's button never opens.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link SimpleModeEditor}
 * @see {@link ProjectDefaultStylesTab}
 * @see {@link GradientButton}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRendererJiti } from '../rendererJiti';
import { installMockDom, teardownMockDom, findElementsByClass, findById, textOf, type MockDom, type MockElement } from '../mockDom';

const jiti = createRendererJiti(import.meta.url);

const { SimpleModeEditor } = jiti('@renderer/workbench/dialogs/SimpleModeEditor.tsx');
const { ProjectDefaultStylesTab } = jiti('@renderer/workbench/dialogs/ProjectDefaultStylesTab.tsx');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals.ts');
const {
  beginProjectPropertiesDraft,
  setDraftUseApplicationDefault,
  updateDraftDefaultStyle,
  styleEditorValueFor,
  projectPropertiesDraftSignal
} = jiti('@renderer/state/projectPropertiesSignals.ts');

const LABELS = { layer_properties_styling_gradient_stops: 'Gradient Stops' };
const STOPS = ['#ff0000ff 0%', '#0000ffff 100%'];

/**
 * @function gradientStyle
 * @description Builds a Simple Cartouche style document holding one Gradient Fill component.
 * @param {Record<string, unknown>} [extra] - Extra component fields.
 * @returns {string} Serialized style content.
 */
function gradientStyle(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: 'simple',
    version: 1,
    components: [{ id: 'g1', type: 'gradient-fill', enabled: true, angle: 30, stops: STOPS, ...extra }]
  });
}

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
 * @function editFirstStop
 * @description Types a hex colour into the open dialog's selected-stop colour field (the first stop).
 * @param {MockDom} dom - Installed harness.
 * @param {string} hex - Colour to enter.
 */
async function editFirstStop(dom: MockDom, hex: string): Promise<void> {
  const input = findElementsByClass(dom.doc.body, 'colour-picker-hex-input')[0];
  assert.ok(input, 'The dialog edits the selected stop in HEX');
  input.value = hex;
  await act(async () => {
    input.dispatchEvent({ type: 'input', bubbles: true, target: input });
  });
}

/**
 * @function gradientButtonIn
 * @description Finds the GradientButton in the Gradient Stops row, checking no GradientPickerWidget is embedded in the form.
 * @param {MockElement} root - Search root.
 * @returns {MockElement} The button.
 */
function gradientButtonIn(root: MockElement): MockElement {
  assert.equal(findElementsByClass(root, 'gradient-picker-widget').length, 0, 'No embedded GradientPickerWidget');
  const row = findElementsByClass(root, 'layer-prop-gradient-stops-row')[0];
  assert.ok(row, 'Gradient Stops row is rendered');
  return findElementsByClass(row, 'gradient-button')[0];
}

/**
 * @function dialogPart
 * @description Finds a part of the open GradientPickerDialog.
 * @param {MockDom} dom - Installed harness.
 * @param {string} name - Part suffix, e.g. `apply-btn`.
 * @returns {MockElement | undefined} The element.
 */
function dialogPart(dom: MockDom, name: string): MockElement | undefined {
  return findElementsByClass(dom.doc.body, `gradient-picker-dialog-${name}`)[0];
}

describe('SimpleModeEditor Gradient Stops row (Ticket #308)', () => {
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
   * @description Renders SimpleModeEditor with one Gradient Fill component and records every onChange payload.
   * @param {Record<string, unknown>} [extra] - Extra component fields.
   * @returns {Promise<string[]>} Collected onChange payloads.
   */
  async function renderEditor(extra: Record<string, unknown> = {}): Promise<string[]> {
    const changes: string[] = [];
    await act(async () => {
      dom!.root.render(
        React.createElement(SimpleModeEditor, {
          styleContent: gradientStyle(extra),
          geometryKind: 'Polygon',
          onChange: (c: string) => changes.push(c)
        })
      );
    });
    return changes;
  }

  it('the button opens a dialog titled "Gradient Stops", and Apply writes the stops', async () => {
    const changes = await renderEditor();
    await click(gradientButtonIn(dom!.container));
    assert.equal(textOf(dialogPart(dom!, 'header')!.childNodes[0]), 'Gradient Stops');
    assert.equal(findElementsByClass(dom!.doc.body, 'gradient-picker-dialog-body')[0].childNodes.length, 1, 'Dialog hosts only the picker');

    await editFirstStop(dom!, '#00ff00ff');
    assert.equal(changes.length, 0, 'Editing in the dialog does not touch the draft');
    await click(dialogPart(dom!, 'apply-btn')!);

    assert.equal(changes.length, 1, 'Apply commits once');
    const component = JSON.parse(changes[0]).components[0];
    assert.deepEqual(component.stops, ['#00ff00ff 0%', '#0000ffff 100%']);
    assert.equal(component.angle, 30, 'The angle is not touched');
  });

  it('Cancel leaves the stops unchanged', async () => {
    const changes = await renderEditor();
    await click(gradientButtonIn(dom!.container));
    await editFirstStop(dom!, '#00ff00ff');
    await click(dialogPart(dom!, 'cancel-btn')!);
    assert.equal(changes.length, 0);
    assert.equal(dialogPart(dom!, 'backdrop'), undefined, 'Dialog closed');
  });

  it('the angle spinner stays in the editor, not in the dialog', async () => {
    await renderEditor();
    assert.ok(findById(dom!.container, 'layer-prop-gradient-angle'), 'Angle spinner in the editor');
    await click(gradientButtonIn(dom!.container));
    const box = findElementsByClass(dom!.doc.body, 'gradient-picker-dialog-box')[0];
    assert.ok(box, 'Dialog is open');
    assert.equal(findById(box, 'layer-prop-gradient-angle'), null, 'No angle control in the dialog');
  });

  it('a locked component has a disabled gradient button that never opens', async () => {
    await renderEditor({ locked: true });
    const button = gradientButtonIn(dom!.container);
    assert.equal(button.disabled, true);
    await click(button);
    assert.equal(dialogPart(dom!, 'backdrop'), undefined);
  });
});

describe('Project Default Styles Gradient Stops row (Tickets #308, #313)', () => {
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

  /**
   * @function renderPolygonDefault
   * @description Puts a Gradient Fill polygon default style into the project draft, renders the Default Styles tab and returns the polygon section.
   * @param {Record<string, unknown>} [extra] - Extra component fields.
   * @returns {Promise<MockElement>} The polygon default style section.
   */
  async function renderPolygonDefault(extra: Record<string, unknown> = {}): Promise<MockElement> {
    setDraftUseApplicationDefault('polygon', false);
    updateDraftDefaultStyle('polygon', styleEditorValueFor(gradientStyle(extra)));
    await act(async () => {
      dom!.root.render(React.createElement(ProjectDefaultStylesTab));
    });
    const polygon = findElementsByClass(dom!.container, 'polygon')[0];
    assert.ok(polygon, 'Polygon default style section is rendered');
    return polygon;
  }

  /**
   * @function draftStyle
   * @description Reads the polygon default style content from the project draft.
   * @returns {string} Serialized style content.
   */
  const draftStyle = (): string => projectPropertiesDraftSignal.value.defaultStyles.polygon.styleContent;

  it('the button opens a dialog titled "Gradient Stops", and Apply writes the stops into the project draft', async () => {
    const polygon = await renderPolygonDefault();
    const before = draftStyle();
    await click(gradientButtonIn(polygon));
    assert.equal(textOf(dialogPart(dom!, 'header')!.childNodes[0]), 'Gradient Stops');

    await editFirstStop(dom!, '#abcdefff');
    assert.equal(draftStyle(), before, 'Editing in the dialog does not touch the draft');
    await click(dialogPart(dom!, 'apply-btn')!);

    assert.equal(dialogPart(dom!, 'backdrop'), undefined, 'Apply closes the dialog');
    const component = JSON.parse(draftStyle()).components[0];
    assert.deepEqual(component.stops, ['#abcdefff 0%', '#0000ffff 100%']);
    assert.equal(component.angle, 30, 'The angle is not touched');
  });

  it('Cancel leaves the project draft unchanged', async () => {
    const polygon = await renderPolygonDefault();
    const before = draftStyle();
    await click(gradientButtonIn(polygon));
    await editFirstStop(dom!, '#abcdefff');
    await click(dialogPart(dom!, 'cancel-btn')!);

    assert.equal(dialogPart(dom!, 'backdrop'), undefined, 'Dialog closed');
    assert.equal(draftStyle(), before);
  });

  it('a locked GradientFillComponent has a disabled button that never opens', async () => {
    const polygon = await renderPolygonDefault({ locked: true });
    const button = gradientButtonIn(polygon);
    assert.equal(button.disabled, true);
    await click(button);
    assert.equal(dialogPart(dom!, 'backdrop'), undefined);
  });
});
