/**
 * @file DashArrayControl.test.ts
 * @module tests/renderer/dialogs/DashArrayControl.test
 * @description Tests for the Dash Array Composite Control (Spec #322 / Ticket #332): dash array ↔ pair conversion, the edit validation rules, and, headlessly, the embedded TableWidget's single-row selection, in-place editing with rejected edits marked by a class and tooltip until the next accepted change, the Add / Remove / Move Up / Move Down buttons keeping the selection on the right pair, Add opening the new pair's Line cell for editing, and the read-only state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see {@link DashArrayControl}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useState } from 'react';
import { createRendererJiti } from '../rendererJiti';
import { installMockDom, teardownMockDom, findElementsByClass, findById, textOf, type MockDom, type MockElement } from '../mockDom';

const jiti = createRendererJiti(import.meta.url);

const { DashArrayControl, dashPairs, flattenDashPairs, checkDashEdit } = jiti(
  '@renderer/workbench/dialogs/DashArrayControl.tsx'
);

describe('Dash array pairs and edit validation (Ticket #332)', () => {
  it('splits a dash array into positioned pairs and joins them back', () => {
    assert.deepEqual(dashPairs([5, 2, 1, 3]), [
      { index: 0, line: 5, gap: 2 },
      { index: 1, line: 1, gap: 3 }
    ]);
    assert.deepEqual(dashPairs([4]), [{ index: 0, line: 4, gap: 0 }], 'a missing last gap reads as 0');
    assert.deepEqual(flattenDashPairs(dashPairs([5, 2, 1, 3])), [5, 2, 1, 3]);
  });

  it('accepts finite numbers of 0 or more, as numbers or text', () => {
    const pairs = dashPairs([5, 2, 1, 3]);
    assert.deepEqual(checkDashEdit(pairs, 1, 'gap', 0), { dashArray: [5, 2, 1, 0] });
    assert.deepEqual(checkDashEdit(pairs, 0, 'line', '2,5'), { dashArray: [2.5, 2, 1, 3] });
    assert.deepEqual(checkDashEdit(pairs, 0, 'line', '0'), { dashArray: [0, 2, 1, 3] }, 'a 0 line draws dots');
  });

  it('rejects negative, non-numeric, empty and non-finite values', () => {
    const pairs = dashPairs([5, 2]);
    for (const value of [-1, '-0.5', 'abc', '', Infinity, NaN]) {
      assert.deepEqual(checkDashEdit(pairs, 0, 'line', value), { problem: 'invalid-value' }, String(value));
    }
  });

  it('rejects an edit that would make every value 0', () => {
    assert.deepEqual(checkDashEdit(dashPairs([0, 2]), 0, 'gap', 0), { problem: 'all-zero' });
  });
});

/** Dictionary used by the control: each key maps to itself, except the problem tooltips. */
const t = (key: string): string =>
  ({
    layer_properties_dash_array_invalid_value: 'Enter a number of 0 or more.',
    layer_properties_dash_array_all_zero: 'A dash array needs at least one value above 0.'
  })[key] ?? key;

let dom: MockDom | null = null;
/** Every dash array the control reported, in order. */
let changes: number[][];

/**
 * @function Host
 * @description Holds a dash array in state like SimpleModeEditor does, passing every change back into the control.
 * @param {Object} props - The initial dash array and read-only flag.
 * @returns {React.ReactElement} The control.
 */
function Host({ initial, readOnly = false }: { initial: number[]; readOnly?: boolean }): React.ReactElement {
  const [dashArray, setDashArray] = useState(initial);
  return React.createElement(DashArrayControl, {
    dashArray,
    readOnly,
    t,
    labelledBy: 'dash-label',
    onChange: (next: number[]) => {
      changes.push(next);
      setDashArray(next);
    }
  });
}

/**
 * @function render
 * @description Renders the control inside its host.
 * @param {number[]} initial - Initial dash array.
 * @param {boolean} [readOnly] - Whether the control is read-only.
 */
async function render(initial: number[], readOnly = false): Promise<void> {
  await act(async () => {
    dom!.root.render(React.createElement(Host, { initial, readOnly }));
  });
}

/**
 * @function fire
 * @description Dispatches a bubbling native event on an element inside `act`.
 * @param {MockElement} el - Target element.
 * @param {string} type - Event type.
 * @param {Record<string, unknown>} [fields] - Event fields.
 */
async function fire(el: MockElement, type: string, fields: Record<string, unknown> = {}): Promise<void> {
  const event: Record<string, unknown> = {
    type,
    bubbles: true,
    defaultPrevented: false,
    button: 0,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    altKey: false,
    ...fields
  };
  event.preventDefault = () => {
    event.defaultPrevented = true;
  };
  await act(async () => {
    el.dispatchEvent(event);
  });
}

/**
 * @function cellTexts
 * @description Returns the table's cell texts, row by row.
 * @returns {string[][]} Line and gap text of each row.
 */
function cellTexts(): string[][] {
  return findElementsByClass(dom!.container, 'table-widget-row').map((row) =>
    findElementsByClass(row, 'table-widget-cell').map((c) => textOf(c))
  );
}

/**
 * @function cell
 * @description Returns a data cell by pair position and column index.
 * @param {number} index - Pair position.
 * @param {number} columnIndex - 0 for Line, 1 for Gap.
 * @returns {MockElement} Data cell.
 */
function cell(index: number, columnIndex: number): MockElement {
  const row = findElementsByClass(dom!.container, 'table-widget-row').find(
    (r) => r.getAttribute('data-row-id') === String(index)
  );
  assert.ok(row, `row ${index} rendered`);
  return findElementsByClass(row, 'table-widget-cell')[columnIndex];
}

/**
 * @function selectedRows
 * @description Returns the positions of the rows shown as selected.
 * @returns {number[]} Selected pair positions.
 */
function selectedRows(): number[] {
  return findElementsByClass(dom!.container, 'table-widget-row--selected').map((r) => Number(r.getAttribute('data-row-id')));
}

/**
 * @function button
 * @description Returns one of the action buttons.
 * @param {string} name - `add`, `remove`, `move-up` or `move-down`.
 * @returns {MockElement} The button.
 */
function button(name: string): MockElement {
  const found = findById(dom!.container, `layer-prop-dash-array-${name}`);
  assert.ok(found, `${name} button rendered`);
  return found;
}

/**
 * @function editors
 * @description Returns every open cell editor.
 * @returns {MockElement[]} Editor inputs.
 */
function editors(): MockElement[] {
  return findElementsByClass(dom!.container, 'table-widget-editor');
}

/**
 * @function editCellTo
 * @description Double-clicks a cell, types text into its editor and presses Enter.
 * @param {number} index - Pair position.
 * @param {number} columnIndex - 0 for Line, 1 for Gap.
 * @param {string} text - Text to type.
 */
async function editCellTo(index: number, columnIndex: number, text: string): Promise<void> {
  await fire(cell(index, columnIndex), 'click');
  await fire(cell(index, columnIndex), 'dblclick');
  const [input] = editors();
  assert.ok(input, 'editor open');
  const propsKey = Object.keys(input).find((k) => k.startsWith('__reactProps'))!;
  await act(async () => {
    input.value = text;
    (input as any)[propsKey].onChange({ target: input, currentTarget: input });
  });
  await fire(input, 'focusin');
  await fire(input, 'keydown', { key: 'Enter' });
}

describe('DashArrayControl (Ticket #332)', () => {
  beforeEach(() => {
    dom = installMockDom();
    changes = [];
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('shows the pairs in a single-selection table without a Row Number Column, named by the label, first pair selected', async () => {
    await render([5, 2, 1, 3]);
    assert.deepEqual(cellTexts(), [['5', '2'], ['1', '3']]);
    assert.equal(findElementsByClass(dom!.container, 'table-widget-row-number').length, 0);
    assert.equal(findElementsByClass(dom!.container, 'table-widget-resize-handle').length, 0);
    const table = findElementsByClass(dom!.container, 'table-widget-table')[0];
    assert.equal(table.getAttribute('id'), 'layer-prop-dash-array-table');
    assert.equal(table.getAttribute('aria-labelledby'), 'dash-label');
    assert.deepEqual(selectedRows(), [0]);
    await fire(cell(1, 0), 'click', { ctrlKey: true });
    assert.deepEqual(selectedRows(), [1], 'Ctrl+click still selects one pair');
  });

  it('saves a valid edit as a custom dash array', async () => {
    await render([5, 2, 1, 3]);
    await editCellTo(1, 1, '4.5');
    assert.deepEqual(changes, [[5, 2, 1, 4.5]]);
    assert.deepEqual(cellTexts(), [['5', '2'], ['1', '4.5']]);
  });

  it('rejects an invalid value, keeping the old one and marking the cell with a tooltip until the next accepted edit', async () => {
    await render([5, 2, 1, 3]);
    await editCellTo(0, 0, '-1');
    assert.deepEqual(changes, []);
    assert.equal(textOf(cell(0, 0)), '5');
    assert.ok(cell(0, 0).getAttribute('class')!.split(' ').includes('dash-array-cell--invalid'));
    const [tip] = findElementsByClass(dom!.container, 'dash-array-cell--invalid');
    assert.match(JSON.stringify(tip.childNodes.map((n: any) => n.getAttribute?.('title'))), /Enter a number of 0 or more\./);
    await editCellTo(1, 0, '2');
    assert.deepEqual(changes, [[5, 2, 2, 3]]);
    assert.equal(findElementsByClass(dom!.container, 'dash-array-cell--invalid').length, 0);
  });

  it('rejects an edit that would make every value 0', async () => {
    await render([0, 2]);
    await editCellTo(0, 1, '0');
    assert.deepEqual(changes, []);
    const [marked] = findElementsByClass(dom!.container, 'dash-array-cell--invalid');
    assert.ok(marked, 'gap cell marked');
    assert.match(JSON.stringify(marked.childNodes.map((n: any) => n.getAttribute?.('title'))), /at least one value above 0/);
  });

  it('Add appends a 5 / 2 pair, selects it and opens its Line cell for editing', async () => {
    await render([5, 2]);
    await fire(button('add'), 'click');
    assert.deepEqual(changes, [[5, 2, 5, 2]]);
    assert.deepEqual(selectedRows(), [1]);
    const open = editors();
    assert.equal(open.length, 1, 'one editor open');
    assert.equal(open[0].value, '5');
    assert.ok(findElementsByClass(cell(1, 0), 'table-widget-editor').length === 1, 'in the new Line cell');
  });

  it('Move Up and Move Down move the selected pair and keep it selected', async () => {
    await render([1, 1, 2, 2, 3, 3]);
    await fire(cell(2, 0), 'click');
    await fire(button('move-up'), 'click');
    assert.deepEqual(changes.at(-1), [1, 1, 3, 3, 2, 2]);
    assert.deepEqual(selectedRows(), [1]);
    await fire(button('move-up'), 'click');
    assert.deepEqual(changes.at(-1), [3, 3, 1, 1, 2, 2]);
    assert.deepEqual(selectedRows(), [0]);
    assert.equal(button('move-up').getAttribute('disabled'), '', 'Move Up disabled on the first pair');
    await fire(button('move-down'), 'click');
    assert.deepEqual(changes.at(-1), [1, 1, 3, 3, 2, 2]);
    assert.deepEqual(selectedRows(), [1]);
  });

  it('Remove deletes the selected pair and selects the next one, or the new last one', async () => {
    await render([1, 1, 2, 2, 3, 3]);
    await fire(cell(1, 0), 'click');
    await fire(button('remove'), 'click');
    assert.deepEqual(changes.at(-1), [1, 1, 3, 3]);
    assert.deepEqual(selectedRows(), [1]);
    await fire(button('remove'), 'click');
    assert.deepEqual(changes.at(-1), [1, 1]);
    assert.deepEqual(selectedRows(), [0]);
    await fire(button('remove'), 'click');
    assert.deepEqual(changes.at(-1), []);
    assert.deepEqual(cellTexts(), []);
    assert.notEqual(button('remove').getAttribute('disabled'), null, 'Remove disabled with no pairs');
  });

  it('a read-only control shows its pairs in Read-Only Cells and disables every button', async () => {
    await render([10, 5], true);
    assert.deepEqual(cellTexts(), [['10', '5']]);
    assert.ok(cell(0, 0).getAttribute('class')!.includes('table-widget-cell--readonly'));
    await fire(cell(0, 0), 'dblclick');
    assert.equal(editors().length, 0);
    for (const name of ['add', 'remove', 'move-up', 'move-down']) {
      assert.notEqual(button(name).getAttribute('disabled'), null, `${name} disabled`);
    }
  });
});

describe('DashArrayControl review follow-ups (Ticket #332)', () => {
  beforeEach(() => {
    dom = installMockDom();
    changes = [];
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('ignores a commit that leaves the value unchanged, keeping an earlier rejection mark', async () => {
    await render([5, 2, 1, 3]);
    await editCellTo(0, 0, '-1');
    await editCellTo(1, 1, '3');
    assert.deepEqual(changes, [], 'nothing reported for an unchanged value');
    assert.equal(findElementsByClass(dom!.container, 'dash-array-cell--invalid').length, 1, 'mark kept');
  });

  it('disables Remove when the remaining pairs would all be 0', async () => {
    await render([0, 0, 5, 0]);
    await fire(cell(1, 0), 'click');
    assert.notEqual(button('remove').getAttribute('disabled'), null, 'removing 5 / 0 would leave only zeros');
    await fire(cell(0, 0), 'click');
    assert.equal(button('remove').getAttribute('disabled'), null, 'removing 0 / 0 is allowed');
  });

  it('drops the rejection mark when the control becomes read-only', async () => {
    await render([5, 2]);
    await editCellTo(0, 0, 'x');
    assert.equal(findElementsByClass(dom!.container, 'dash-array-cell--invalid').length, 1);
    await act(async () => {
      dom!.root.render(
        React.createElement(DashArrayControl, { dashArray: [5, 2], readOnly: true, t, onChange: () => {} })
      );
    });
    assert.equal(findElementsByClass(dom!.container, 'dash-array-cell--invalid').length, 0);
  });
});

describe('SimpleModeEditor Dash Array wiring (Ticket #332)', () => {
  const { SimpleModeEditor } = jiti('@renderer/workbench/dialogs/SimpleModeEditor.tsx');
  let saved: string[];

  /**
   * @function line
   * @description Builds a one-component Simple Line style.
   * @param {string} id - Component id.
   * @param {Record<string, unknown>} fields - Line fields such as `dashPattern` and `dashArray`.
   * @returns {string} Serialized style.
   */
  const line = (id: string, fields: Record<string, unknown>): string =>
    JSON.stringify({
      format: 'simple',
      version: 1,
      components: [{ id, type: 'simple-line', enabled: true, color: '#000000', width: 1, ...fields }]
    });

  /**
   * @function renderEditor
   * @description Renders SimpleModeEditor for a style, recording every saved style.
   * @param {string} styleContent - Serialized style.
   */
  async function renderEditor(styleContent: string): Promise<void> {
    await act(async () => {
      dom!.root.render(
        React.createElement(SimpleModeEditor, {
          styleContent,
          geometryKind: 'LineString',
          onChange: (content: string) => saved.push(content)
        })
      );
    });
  }

  beforeEach(() => {
    dom = installMockDom();
    saved = [];
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('saves an edited value as a custom dash pattern', async () => {
    await renderEditor(line('a', { dashPattern: 'custom', dashArray: [5, 2] }));
    await editCellTo(0, 1, '3');
    assert.equal(saved.length, 1);
    const [component] = JSON.parse(saved[0]).components;
    assert.equal(component.dashPattern, 'custom');
    assert.deepEqual(component.dashArray, [5, 3]);
  });

  it('focuses the Dash Array table when its label is clicked', async () => {
    await renderEditor(line('a', { dashPattern: 'custom', dashArray: [5, 2] }));
    const table = findById(dom!.container, 'layer-prop-dash-array-table')!;
    await fire(findById(dom!.container, 'layer-prop-dash-array-label')!, 'click');
    assert.equal(dom!.doc.activeElement, table);
  });

  it('starts afresh for another component: first pair selected, no rejection mark', async () => {
    await renderEditor(line('a', { dashPattern: 'custom', dashArray: [1, 1, 2, 2] }));
    await fire(cell(1, 0), 'click');
    await editCellTo(1, 0, '-3');
    assert.deepEqual(selectedRows(), [1]);
    assert.equal(findElementsByClass(dom!.container, 'dash-array-cell--invalid').length, 1);
    await renderEditor(line('b', { dashPattern: 'custom', dashArray: [1, 1, 2, 2] }));
    assert.deepEqual(selectedRows(), [0]);
    assert.equal(findElementsByClass(dom!.container, 'dash-array-cell--invalid').length, 0);
  });
});
