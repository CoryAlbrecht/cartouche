/**
 * @file TableWidget.test.ts
 * @module tests/renderer/widgets/TableWidget.test
 * @description Headless component tests for TableWidget as a host uses it (Spec #322 / Ticket #323): the BasicWidget header bar shown or hidden, rows with stable row IDs and column definitions (header text, alignment, display function), the --cartouche-table-* theme tokens on the outer border, column and row lines, header row, plain and alternating rows, 1rem font sizing, the Row Number Column, sticky header row and Row Number Column, and the empty table; (Ticket #326) row selection by primary, Ctrl/Cmd and Shift clicks and by ↑/↓, Shift+↑/↓ and Ctrl/Cmd+A, written to the host's selectedRowIds and activeRowId signals and reported through onSelectionChange with its kind, and the Selected Row and Active Row colours; and column resize handles, dragging and its minimum width, double-click auto-size (sort chevron included), resize handles never sorting, and host-owned and internal column widths (Ticket #324); and (Ticket #328) host cellStyle borders over the shared lines and on selected rows, and cell backgrounds ordered above plain and alternating rows and below the Selected Row and Active Row colours.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link TableWidget}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { createRendererJiti } from '../rendererJiti';
import {
  installMockDom,
  teardownMockDom,
  findElementsByClass,
  textOf,
  type MockDom,
  type MockElement
} from '../mockDom';

const jiti = createRendererJiti(import.meta.url);

const { TableWidget } = jiti('@renderer/workbench/widgets/TableWidget.tsx');
const { signal } = jiti('@preact/signals-react');

/** A host's row: a stable `fid` plus data fields. */
interface CityRow {
  fid: number;
  name: string;
  population: number;
}

const CITIES: CityRow[] = [
  { fid: 10, name: 'Ottawa', population: 1017449 },
  { fid: 20, name: 'Montréal', population: 1762949 },
  { fid: 30, name: 'Halifax', population: 439819 }
];

const COLUMNS = [
  { key: 'name', header: 'Name' },
  {
    key: 'population',
    header: 'Population',
    align: 'right',
    display: (value: unknown) => `${Number(value).toLocaleString('en-CA')} people`
  }
];

const TABLE_WIDGET_SOURCE = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/renderer/workbench/widgets/TableWidget.tsx'),
  'utf8'
);

let dom: MockDom | null = null;

/** The host's selection signals and the selection changes it was told about; reset per test by `installHost`. */
let selectedRowIds: { value: Set<number> };
let activeRowId: { value: number | null };
let selectionChanges: unknown[];

/**
 * @function installHost
 * @description Installs the mock DOM and a fresh host: empty selection signals and no recorded selection changes.
 */
function installHost(): void {
  dom = installMockDom();
  selectedRowIds = signal(new Set<number>());
  activeRowId = signal(null);
  selectionChanges = [];
}

/**
 * @function render
 * @description Renders a TableWidget into the mock DOM with the city rows and columns, overridden by `props`.
 * @param {Record<string, unknown>} [props] - Props overriding the defaults.
 */
async function render(props: Record<string, unknown> = {}): Promise<void> {
  await act(async () => {
    dom!.root.render(
      React.createElement(TableWidget, {
        rows: CITIES,
        getRowId: (row: CityRow) => row.fid,
        columns: COLUMNS,
        selectedRowIds,
        activeRowId,
        onSelectionChange: (change: unknown) => selectionChanges.push(change),
        ...props
      })
    );
  });
}

/**
 * @function headerCells
 * @description Returns the rendered column header cells, in display order.
 * @returns {MockElement[]} Header cells.
 */
function headerCells(): MockElement[] {
  return findElementsByClass(dom!.container, 'table-widget-header-cell');
}

/**
 * @function bodyRows
 * @description Returns the rendered body rows, in display order.
 * @returns {MockElement[]} Body rows.
 */
function bodyRows(): MockElement[] {
  return findElementsByClass(dom!.container, 'table-widget-row');
}

/**
 * @function cellsOf
 * @description Returns the data cells (excluding the Row Number Column) of a body row.
 * @param {MockElement} row - Body row.
 * @returns {MockElement[]} Data cells in column order.
 */
function cellsOf(row: MockElement): MockElement[] {
  return findElementsByClass(row, 'table-widget-cell');
}

describe('TableWidget rows and columns (Ticket #323)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('shows a header cell per column with its header text, and one row per host row in the order given', async () => {
    await render();
    assert.deepEqual(headerCells().map(textOf).filter((t) => t !== '#'), ['Name', 'Population']);
    assert.deepEqual(bodyRows().map((row) => textOf(cellsOf(row)[0])), ['Ottawa', 'Montréal', 'Halifax']);
  });

  it("uses a column's display function for its cells, and shows the raw value where there is none", async () => {
    await render();
    const [ottawa] = bodyRows();
    assert.equal(textOf(cellsOf(ottawa)[0]), 'Ottawa');
    assert.equal(textOf(cellsOf(ottawa)[1]), '1,017,449 people');
  });

  it("aligns a column's header and cells as the column asks, defaulting to left", async () => {
    await render();
    const [nameHeader, populationHeader] = headerCells().filter((c) => textOf(c) !== '#');
    assert.equal(nameHeader.style.textAlign, 'left');
    assert.equal(populationHeader.style.textAlign, 'right');
    const [ottawa] = bodyRows();
    assert.equal(cellsOf(ottawa)[0].style.textAlign, 'left');
    assert.equal(cellsOf(ottawa)[1].style.textAlign, 'right');
  });

  it("identifies each row by the host's stable row ID", async () => {
    await render();
    assert.deepEqual(bodyRows().map((row) => row.getAttribute('data-row-id')), ['10', '20', '30']);
  });

  it('shows the BasicWidget header bar with its display name by default, and hides it when the host passes showHeader false', async () => {
    await render({ displayName: 'Cities' });
    const [header] = findElementsByClass(dom!.container, 'basic-widget-header');
    assert.ok(header, 'header bar shown by default');
    assert.equal(textOf(findElementsByClass(header, 'basic-widget-title')[0]), 'Cities');

    await render({ displayName: 'Cities', showHeader: false });
    assert.equal(findElementsByClass(dom!.container, 'basic-widget-header').length, 0, 'header bar hidden');
    assert.equal(bodyRows().length, 3, 'table still shown');
  });
});

describe('TableWidget theme tokens and typography (Ticket #323)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('draws a dark outer border around the table from --cartouche-table-border', async () => {
    await render();
    const [frame] = findElementsByClass(dom!.container, 'table-widget-frame');
    assert.equal(frame.style.border, '1px solid var(--cartouche-table-border)');
  });

  it('draws column lines from --cartouche-table-column-line and row lines from --cartouche-table-row-line', async () => {
    await render();
    for (const cell of [...headerCells(), ...bodyRows().flatMap(cellsOf)]) {
      assert.equal(cell.style.borderRight, '1px solid var(--cartouche-table-column-line)');
      assert.equal(cell.style.borderBottom, '1px solid var(--cartouche-table-row-line)');
    }
  });

  it('paints the header row with --cartouche-table-header-bg and bold --cartouche-table-header-fg text', async () => {
    await render();
    for (const cell of headerCells()) {
      assert.equal(cell.style.backgroundColor, 'var(--cartouche-table-header-bg)');
      assert.equal(cell.style.color, 'var(--cartouche-table-header-fg)');
      assert.equal(cell.style.fontWeight, 'bold');
    }
  });

  it('paints rows with --cartouche-table-bg and --cartouche-table-fg text when alternatingRows is off', async () => {
    await render();
    for (const cell of bodyRows().flatMap(cellsOf)) {
      assert.equal(cell.style.backgroundColor, 'var(--cartouche-table-bg)');
      assert.equal(cell.style.color, 'var(--cartouche-table-fg)');
      assert.notEqual(cell.style.fontWeight, 'bold');
    }
  });

  it('paints odd rows (1st, 3rd, …) with --cartouche-table-row-alt-bg when the host turns alternatingRows on', async () => {
    await render({ alternatingRows: true });
    const backgrounds = bodyRows().map((row) => cellsOf(row)[0].style.backgroundColor);
    assert.deepEqual(backgrounds, [
      'var(--cartouche-table-row-alt-bg)',
      'var(--cartouche-table-bg)',
      'var(--cartouche-table-row-alt-bg)'
    ]);
  });

  it('sets the table text to 1rem so it follows the ui.baseFont.size preference', async () => {
    await render();
    const [table] = findElementsByClass(dom!.container, 'table-widget-table');
    assert.equal(table.style.fontSize, '1rem');
  });

  it('uses only --cartouche-table-* tokens: no colour literals and no direct --cartouche-theme-* references', () => {
    const code = TABLE_WIDGET_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'no colour literals');
    assert.doesNotMatch(code, /--cartouche-theme-/, 'no direct base theme tokens');
    const tokens = [...code.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
    assert.ok(tokens.length > 0);
    for (const token of tokens) {
      assert.match(token, /^--cartouche-table-/, `${token} is a table token`);
    }
  });
});

/**
 * @function rowNumberCells
 * @description Returns the Row Number Column's body cells, in display order.
 * @returns {MockElement[]} Row number cells.
 */
function rowNumberCells(): MockElement[] {
  return findElementsByClass(dom!.container, 'table-widget-row-number');
}

describe('TableWidget Row Number Column, sticky headers, widths and empty table (Ticket #323)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('shows a Row Number Column headed # by default, numbering rows 1, 2, 3 by displayed position', async () => {
    await render({ rows: [CITIES[2], CITIES[0], CITIES[1]] });
    assert.equal(textOf(headerCells()[0]), '#');
    assert.deepEqual(rowNumberCells().map(textOf), ['1', '2', '3']);
    assert.deepEqual(bodyRows().map((row) => textOf(cellsOf(row)[0])), ['Halifax', 'Ottawa', 'Montréal']);
  });

  it('hides the Row Number Column when the host passes showRowNumberColumn false', async () => {
    await render({ showRowNumberColumn: false });
    assert.deepEqual(headerCells().map(textOf), ['Name', 'Population']);
    assert.equal(rowNumberCells().length, 0);
  });

  it('colours the Row Number Column like the header row, including on alternating rows', async () => {
    await render({ alternatingRows: true });
    for (const cell of rowNumberCells()) {
      assert.equal(cell.style.backgroundColor, 'var(--cartouche-table-header-bg)');
      assert.equal(cell.style.color, 'var(--cartouche-table-header-fg)');
      assert.equal(cell.style.borderRight, '1px solid var(--cartouche-table-column-line)');
      assert.equal(cell.style.borderBottom, '1px solid var(--cartouche-table-row-line)');
    }
  });

  it('keeps the header row at the top during vertical scrolling', async () => {
    await render();
    for (const cell of headerCells()) {
      assert.equal(cell.style.position, 'sticky');
      assert.match(cell.style.top, /^0(px)?$/);
    }
  });

  it('keeps the Row Number Column at the left during horizontal scrolling, its header above the other headers', async () => {
    await render();
    const [corner, ...otherHeaders] = headerCells();
    for (const cell of [corner, ...rowNumberCells()]) {
      assert.equal(cell.style.position, 'sticky');
      assert.match(cell.style.left, /^0(px)?$/);
    }
    for (const header of otherHeaders) {
      assert.ok(Number(corner.style.zIndex) > Number(header.style.zIndex), '# header stays over scrolled headers');
    }
    for (const cell of rowNumberCells()) {
      assert.ok(Number(cell.style.zIndex) < Number(otherHeaders[0].style.zIndex), 'scrolled-up row numbers pass under the header row');
    }
  });

  it("gives a column its initial width, and the table the columns' total width", async () => {
    await render({
      showRowNumberColumn: false,
      columns: [
        { key: 'name', header: 'Name', width: 120 },
        { key: 'population', header: 'Population', width: 80 }
      ]
    });
    assert.deepEqual(headerCells().map((c) => c.style.width), ['120px', '80px']);
    const [table] = findElementsByClass(dom!.container, 'table-widget-table');
    assert.equal(table.style.width, '200px');
  });

  it('shows only the header row, with no message, when there are no rows', async () => {
    await render({ rows: [] });
    assert.deepEqual(headerCells().map(textOf), ['#', 'Name', 'Population']);
    assert.equal(bodyRows().length, 0);
    const [table] = findElementsByClass(dom!.container, 'table-widget-table');
    const tbody = table.childNodes.find((c: MockElement) => c.tagName === 'TBODY');
    assert.equal(textOf(tbody), '');
  });
});

/** Modifier keys held during a click or key press. */
interface Modifiers {
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

/**
 * @function nativeEvent
 * @description Builds a bubbling native event for the mock DOM, recording `preventDefault` in `defaultPrevented`.
 * @param {string} type - Event type.
 * @param {Record<string, unknown>} fields - Event fields, e.g. `key` and modifier keys.
 * @returns {Record<string, unknown>} The event.
 */
function nativeEvent(type: string, fields: Record<string, unknown>): Record<string, unknown> {
  const event: Record<string, unknown> = {
    type,
    bubbles: true,
    defaultPrevented: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    altKey: false,
    ...fields
  };
  event.preventDefault = () => {
    event.defaultPrevented = true;
  };
  return event;
}

/**
 * @function click
 * @description Primary-clicks an element, with optional modifier keys, as a user would.
 * @param {MockElement} el - Element to click.
 * @param {Modifiers} [modifiers] - Modifier keys held.
 */
async function click(el: MockElement, modifiers: Modifiers = {}): Promise<void> {
  await act(async () => {
    el.dispatchEvent(nativeEvent('click', { button: 0, ...modifiers }));
  });
}

/**
 * @function press
 * @description Presses a key on the table, with optional modifier keys, as a user would.
 * @param {string} key - Key name, e.g. `ArrowDown`.
 * @param {Modifiers} [modifiers] - Modifier keys held.
 * @returns {Promise<boolean>} Whether the default action was left alone (false when the table prevented it).
 */
async function press(key: string, modifiers: Modifiers = {}): Promise<boolean> {
  const [table] = findElementsByClass(dom!.container, 'table-widget-table');
  let notPrevented = true;
  await act(async () => {
    notPrevented = table.dispatchEvent(nativeEvent('keydown', { key, ...modifiers }));
  });
  return notPrevented;
}

/**
 * @function row
 * @description Returns the rendered body row of a host row ID.
 * @param {number} rowId - Host row ID.
 * @returns {MockElement} Body row.
 */
function row(rowId: number): MockElement {
  const found = bodyRows().find((r) => r.getAttribute('data-row-id') === String(rowId));
  assert.ok(found, `row ${rowId} rendered`);
  return found;
}

/**
 * @function selection
 * @description Returns the host's selected row IDs, sorted, for comparison.
 * @returns {number[]} Selected row IDs.
 */
function selection(): number[] {
  return [...selectedRowIds.value].sort((a, b) => a - b);
}

describe('TableWidget row selection by click (Ticket #326)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('a primary-click in a data cell selects only that row and makes it the Active Row', async () => {
    await render();
    selectedRowIds.value = new Set([10, 30]);
    activeRowId.value = 30;
    await click(cellsOf(row(20))[1]);
    assert.deepEqual(selection(), [20]);
    assert.equal(activeRowId.value, 20);
    assert.deepEqual(selectionChanges, [{ kind: 'replace', rowIds: [20], activeRowId: 20 }]);
  });

  it('a primary-click in the # cell selects its row like any other cell', async () => {
    await render();
    await click(findElementsByClass(row(30), 'table-widget-row-number')[0]);
    assert.deepEqual(selection(), [30]);
    assert.equal(activeRowId.value, 30);
    assert.deepEqual(selectionChanges, [{ kind: 'replace', rowIds: [30], activeRowId: 30 }]);
  });

  it('a primary-click on the only selected row still reports a replace, so hosts can clear rows not displayed', async () => {
    await render();
    await click(cellsOf(row(10))[0]);
    await click(cellsOf(row(10))[0]);
    assert.deepEqual(selection(), [10]);
    assert.equal(selectionChanges.length, 2);
    assert.deepEqual(selectionChanges[1], { kind: 'replace', rowIds: [10], activeRowId: 10 });
  });

  it('ignores clicks with a button other than the primary one', async () => {
    await render();
    await act(async () => {
      cellsOf(row(10))[0].dispatchEvent(nativeEvent('click', { button: 1 }));
    });
    assert.deepEqual(selection(), []);
    assert.deepEqual(selectionChanges, []);
  });

  it('Ctrl+primary-click toggles a row into the selection and makes it the Active Row', async () => {
    await render();
    await click(cellsOf(row(10))[0]);
    await click(cellsOf(row(30))[0], { ctrlKey: true });
    assert.deepEqual(selection(), [10, 30]);
    assert.equal(activeRowId.value, 30);
    assert.deepEqual(selectionChanges[1], { kind: 'toggle', rowIds: [30], activeRowId: 30 });
  });

  it('Cmd+primary-click toggles like Ctrl+primary-click', async () => {
    await render();
    await click(cellsOf(row(10))[0]);
    await click(cellsOf(row(20))[0], { metaKey: true });
    assert.deepEqual(selection(), [10, 20]);
    assert.deepEqual(selectionChanges[1], { kind: 'toggle', rowIds: [20], activeRowId: 20 });
  });

  it('Ctrl+primary-click toggles the Active Row out of the selection, leaving no Active Row', async () => {
    await render();
    await click(cellsOf(row(10))[0]);
    await click(cellsOf(row(30))[0], { ctrlKey: true });
    await click(cellsOf(row(30))[0], { ctrlKey: true });
    assert.deepEqual(selection(), [10]);
    assert.equal(activeRowId.value, null);
    assert.deepEqual(selectionChanges[2], { kind: 'toggle', rowIds: [30], activeRowId: null });
  });

  it('Ctrl+primary-click toggles another selected row out, keeping the Active Row', async () => {
    await render();
    await click(cellsOf(row(10))[0]);
    await click(cellsOf(row(30))[0], { ctrlKey: true });
    await click(cellsOf(row(10))[0], { ctrlKey: true });
    assert.deepEqual(selection(), [30]);
    assert.equal(activeRowId.value, 30);
    assert.deepEqual(selectionChanges[2], { kind: 'toggle', rowIds: [10], activeRowId: 30 });
  });

  it('Shift+primary-click selects the displayed rows from the last-clicked row to this one, in either direction', async () => {
    const rows = [...CITIES, { fid: 40, name: 'Regina', population: 249217 }];
    await render({ rows });
    await click(cellsOf(row(20))[0]);
    await click(cellsOf(row(40))[0], { shiftKey: true });
    assert.deepEqual(selection(), [20, 30, 40]);
    assert.equal(activeRowId.value, 40);
    assert.deepEqual(selectionChanges[1], { kind: 'range', rowIds: [20, 30, 40], activeRowId: 40 });

    await click(cellsOf(row(10))[0], { shiftKey: true });
    assert.deepEqual(selection(), [10, 20], 'range still starts at the last-clicked row, not the Shift-clicked one');
    assert.equal(activeRowId.value, 10);
    assert.deepEqual(selectionChanges[2], { kind: 'range', rowIds: [10, 20], activeRowId: 10 });
  });

  it('Shift+primary-click ranges over the rows as displayed, not as the host first supplied them', async () => {
    await render();
    await click(cellsOf(row(10))[0]);
    await render({ rows: [CITIES[2], CITIES[0], CITIES[1]] });
    await click(cellsOf(row(20))[0], { shiftKey: true });
    assert.deepEqual(selection(), [10, 20]);
    assert.deepEqual(selectionChanges[1], { kind: 'range', rowIds: [10, 20], activeRowId: 20 });
  });

  it('Shift+primary-click with no last-clicked row displayed selects only that row', async () => {
    await render();
    await click(cellsOf(row(10))[0]);
    await render({ rows: [CITIES[1], CITIES[2]] });
    await click(cellsOf(row(30))[0], { shiftKey: true });
    assert.deepEqual(selection(), [30]);
    assert.equal(activeRowId.value, 30);
    assert.deepEqual(selectionChanges[1], { kind: 'replace', rowIds: [30], activeRowId: 30 });
  });
});

describe('TableWidget row selection by keyboard (Ticket #326)', () => {
  /** Four displayed rows: 10, 20, 30, 40. */
  const FOUR_ROWS = [...CITIES, { fid: 40, name: 'Regina', population: 249217 }];

  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('↓ and ↑ move the Active Row, selecting only it, and stop at the first and last rows', async () => {
    await render({ rows: FOUR_ROWS });
    await click(cellsOf(row(20))[0]);
    await click(cellsOf(row(40))[0], { ctrlKey: true });
    activeRowId.value = 20;
    selectionChanges = [];

    assert.equal(await press('ArrowDown'), false, 'default scrolling prevented');
    assert.deepEqual(selection(), [30]);
    assert.equal(activeRowId.value, 30);
    await press('ArrowUp');
    await press('ArrowUp');
    await press('ArrowUp');
    assert.deepEqual(selection(), [10]);
    assert.equal(activeRowId.value, 10);
    assert.deepEqual(selectionChanges, [
      { kind: 'replace', rowIds: [30], activeRowId: 30 },
      { kind: 'replace', rowIds: [20], activeRowId: 20 },
      { kind: 'replace', rowIds: [10], activeRowId: 10 },
      { kind: 'replace', rowIds: [10], activeRowId: 10 }
    ]);
  });

  it('↓ with no Active Row selects the first row, and ↑ the last', async () => {
    await render({ rows: FOUR_ROWS });
    await press('ArrowDown');
    assert.equal(activeRowId.value, 10);
    activeRowId.value = null;
    await press('ArrowUp');
    assert.equal(activeRowId.value, 40);
    assert.deepEqual(selection(), [40]);
  });

  it('Shift+↓ and Shift+↑ extend the selection from the last-clicked row to the moved Active Row', async () => {
    await render({ rows: FOUR_ROWS });
    await click(cellsOf(row(20))[0]);
    selectionChanges = [];

    assert.equal(await press('ArrowDown', { shiftKey: true }), false, 'default scrolling prevented');
    await press('ArrowDown', { shiftKey: true });
    assert.deepEqual(selection(), [20, 30, 40]);
    assert.equal(activeRowId.value, 40);
    await press('ArrowUp', { shiftKey: true });
    await press('ArrowUp', { shiftKey: true });
    await press('ArrowUp', { shiftKey: true });
    assert.deepEqual(selection(), [10, 20]);
    assert.equal(activeRowId.value, 10);
    assert.deepEqual(selectionChanges, [
      { kind: 'range', rowIds: [20, 30], activeRowId: 30 },
      { kind: 'range', rowIds: [20, 30, 40], activeRowId: 40 },
      { kind: 'range', rowIds: [20, 30], activeRowId: 30 },
      { kind: 'range', rowIds: [20], activeRowId: 20 },
      { kind: 'range', rowIds: [10, 20], activeRowId: 10 }
    ]);
  });

  it('Shift+↓ after a plain ↓ extends from the row ↓ moved to', async () => {
    await render({ rows: FOUR_ROWS });
    await click(cellsOf(row(10))[0]);
    await press('ArrowDown');
    await press('ArrowDown', { shiftKey: true });
    assert.deepEqual(selection(), [20, 30]);
    assert.equal(activeRowId.value, 30);
  });

  it('Ctrl+A selects every displayed row as a range, keeping the Active Row', async () => {
    await render({ rows: FOUR_ROWS });
    await click(cellsOf(row(30))[0]);
    selectionChanges = [];
    assert.equal(await press('a', { ctrlKey: true }), false, 'default select-all prevented');
    assert.deepEqual(selection(), [10, 20, 30, 40]);
    assert.equal(activeRowId.value, 30);
    assert.deepEqual(selectionChanges, [{ kind: 'range', rowIds: [10, 20, 30, 40], activeRowId: 30 }]);
  });

  it('Ctrl+A with no Active Row makes the first displayed row active; Cmd+A works the same', async () => {
    await render({ rows: [CITIES[2], CITIES[0], CITIES[1]] });
    await press('A', { metaKey: true });
    assert.deepEqual(selection(), [10, 20, 30]);
    assert.equal(activeRowId.value, 30);
    assert.deepEqual(selectionChanges, [{ kind: 'range', rowIds: [30, 10, 20], activeRowId: 30 }]);
  });

  it('ranges and moves over the rows in their sorted display order', async () => {
    const sort = signal({ columnKey: 'population', direction: 'ascending' });
    await render({ sort });
    assert.deepEqual(bodyRows().map((r) => r.getAttribute('data-row-id')), ['30', '10', '20']);
    await click(cellsOf(row(30))[0]);
    await click(cellsOf(row(10))[0], { shiftKey: true });
    assert.deepEqual(selection(), [10, 30]);
    assert.deepEqual(selectionChanges[1], { kind: 'range', rowIds: [30, 10], activeRowId: 10 });
    await press('ArrowDown');
    assert.equal(activeRowId.value, 20);
    assert.deepEqual(selection(), [20]);
  });

  it('leaves other keys, and every key on an empty table, alone', async () => {
    await render();
    assert.equal(await press('x'), true);
    assert.equal(await press('ArrowLeft'), true);
    await render({ rows: [] });
    assert.equal(await press('ArrowDown'), true);
    assert.equal(await press('a', { ctrlKey: true }), true);
    assert.deepEqual(selectionChanges, []);
    assert.deepEqual(selection(), []);
  });
});

describe('TableWidget Selected Row and Active Row colours (Ticket #326)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  /**
   * @function coloursOf
   * @description Returns the background and text colour of each data cell of a row.
   * @param {number} rowId - Host row ID.
   * @returns {string[][]} `[background, color]` per data cell.
   */
  function coloursOf(rowId: number): string[][] {
    return cellsOf(row(rowId)).map((cell) => [cell.style.backgroundColor, cell.style.color]);
  }

  const SELECTED = ['var(--cartouche-table-row-selected-bg)', 'var(--cartouche-table-fg)'];
  const ACTIVE = ['var(--cartouche-table-row-active-bg)', 'var(--cartouche-table-row-active-fg)'];

  it('paints Selected Rows with the selected colour and the Active Row with the active colour, from the host signals', async () => {
    await render();
    await act(async () => {
      selectedRowIds.value = new Set([10, 20]);
      activeRowId.value = 20;
    });
    assert.deepEqual(coloursOf(10), [SELECTED, SELECTED]);
    assert.deepEqual(coloursOf(20), [ACTIVE, ACTIVE]);
    assert.deepEqual(coloursOf(30)[0], ['var(--cartouche-table-bg)', 'var(--cartouche-table-fg)']);
  });

  it('repaints as the user changes the selection', async () => {
    await render();
    await click(cellsOf(row(10))[0]);
    await click(cellsOf(row(30))[0], { ctrlKey: true });
    assert.deepEqual(coloursOf(10), [SELECTED, SELECTED]);
    assert.deepEqual(coloursOf(30), [ACTIVE, ACTIVE]);
    await click(cellsOf(row(20))[0]);
    assert.deepEqual(coloursOf(10)[0], ['var(--cartouche-table-bg)', 'var(--cartouche-table-fg)']);
    assert.deepEqual(coloursOf(20), [ACTIVE, ACTIVE]);
  });

  it('paints selection over the alternating row colour', async () => {
    await render({ alternatingRows: true });
    await act(async () => {
      selectedRowIds.value = new Set([10, 30]);
      activeRowId.value = 30;
    });
    assert.deepEqual(coloursOf(10)[0], SELECTED);
    assert.deepEqual(coloursOf(30)[0], ACTIVE);
  });

  it('keeps the header colour in the # cell of Selected Rows and the Active Row', async () => {
    await render();
    await act(async () => {
      selectedRowIds.value = new Set([10, 20]);
      activeRowId.value = 20;
    });
    for (const rowId of [10, 20]) {
      const [numberCell] = findElementsByClass(row(rowId), 'table-widget-row-number');
      assert.equal(numberCell.style.backgroundColor, 'var(--cartouche-table-header-bg)');
      assert.equal(numberCell.style.color, 'var(--cartouche-table-header-fg)');
    }
  });
});

/**
 * @function resizeHandleOf
 * @description Returns the resize handle inside a column header cell.
 * @param {MockElement} header - Column header cell.
 * @returns {MockElement} The header's resize handle.
 */
function resizeHandleOf(header: MockElement): MockElement {
  const [handle] = findElementsByClass(header, 'table-widget-resize-handle');
  assert.ok(handle, `header ${textOf(header)} has a resize handle`);
  return handle;
}

/**
 * @function dataHeaders
 * @description Returns the column header cells, excluding the Row Number Column's `#` header.
 * @returns {MockElement[]} Data column header cells.
 */
function dataHeaders(): MockElement[] {
  return headerCells().filter((cell) => !cell.className.includes('table-widget-row-number-header'));
}

/**
 * @function drag
 * @description Drags a resize handle from `fromX` to `toX`: mousedown on the handle, then mousemove and mouseup on the window.
 * @param {MockElement} handle - Resize handle.
 * @param {number} fromX - Pointer x at mousedown.
 * @param {number} toX - Pointer x at mousemove and mouseup.
 */
async function drag(handle: MockElement, fromX: number, toX: number): Promise<void> {
  await act(async () => {
    handle.dispatchEvent({ type: 'mousedown', button: 0, clientX: fromX, bubbles: true });
  });
  await act(async () => {
    dom!.win.dispatchEvent({ type: 'mousemove', clientX: toX });
  });
  await act(async () => {
    dom!.win.dispatchEvent({ type: 'mouseup', clientX: toX });
  });
}

/** City columns with explicit widths, used by the resize tests. */
const SIZED_COLUMNS = [
  { key: 'name', header: 'Name', width: 120 },
  { key: 'population', header: 'Population', width: 100, align: 'right' }
];

describe('TableWidget column resizing and auto-size (Ticket #324)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('puts a resize handle with a col-resize cursor at the right edge of each column header', async () => {
    await render();
    const headers = dataHeaders();
    assert.equal(headers.length, 2);
    for (const header of headers) {
      const handle = resizeHandleOf(header);
      assert.equal(handle.style.cursor, 'col-resize');
      assert.equal(handle.style.position, 'absolute');
      assert.match(handle.style.right, /^0(px)?$/);
    }
  });

  it('widens and narrows only the dragged column, and the table with it', async () => {
    await render({ columns: SIZED_COLUMNS, showRowNumberColumn: false });
    await drag(resizeHandleOf(dataHeaders()[0]), 200, 280);
    assert.deepEqual(dataHeaders().map((c) => c.style.width), ['200px', '100px']);
    const [table] = findElementsByClass(dom!.container, 'table-widget-table');
    assert.equal(table.style.width, '300px');

    await drag(resizeHandleOf(dataHeaders()[0]), 300, 240);
    assert.deepEqual(dataHeaders().map((c) => c.style.width), ['140px', '100px']);
    assert.equal(table.style.width, '240px');
  });

  it('stops following the pointer after mouseup', async () => {
    await render({ columns: SIZED_COLUMNS });
    await drag(resizeHandleOf(dataHeaders()[0]), 200, 230);
    await act(async () => {
      dom!.win.dispatchEvent({ type: 'mousemove', clientX: 400 });
    });
    assert.equal(dataHeaders()[0].style.width, '150px');
  });

  it("never drags a column narrower than the column definition's minWidth", async () => {
    await render({
      columns: [{ key: 'name', header: 'Name', width: 120, minWidth: 90 }, SIZED_COLUMNS[1]]
    });
    await drag(resizeHandleOf(dataHeaders()[0]), 200, 100);
    assert.equal(dataHeaders()[0].style.width, '90px');
    await drag(resizeHandleOf(dataHeaders()[0]), 200, 210);
    assert.equal(dataHeaders()[0].style.width, '100px', 'resizes freely above the minimum');
  });

  it('without a minWidth, never drags a column narrower than its header text needs', async () => {
    await render({ columns: SIZED_COLUMNS });
    await drag(resizeHandleOf(dataHeaders()[0]), 200, -1000);
    await drag(resizeHandleOf(dataHeaders()[1]), 400, -1000);
    const [nameFloor, populationFloor] = dataHeaders().map((c) => parseFloat(c.style.width));
    assert.ok(nameFloor > 0, 'Name keeps a positive width');
    assert.ok(populationFloor > nameFloor, 'the longer header Population keeps a wider minimum than Name');
  });

  // Headless, text measures 8px per character, a cell adds 17px (0.5rem padding each side plus the 1px column line),
  // and a sortable header adds 20px for its sort chevron (1rem icon plus 0.25rem margin).
  it('double-clicking a resize handle sizes the column to the widest of its header text and its displayed values', async () => {
    await render({
      columns: [
        ...COLUMNS.map((column) => ({ ...column, width: 60 })),
        { key: 'fid', header: 'Feature identifier', width: 60 }
      ]
    });
    for (const header of dataHeaders()) {
      await act(async () => {
        resizeHandleOf(header).dispatchEvent({ type: 'dblclick', button: 0, bubbles: true });
      });
    }
    assert.deepEqual(
      dataHeaders().map((c) => c.style.width),
      [
        `${8 * 'Montréal'.length + 17}px`,
        `${8 * '1,762,949 people'.length + 17}px`,
        `${8 * 'Feature identifier'.length + 20 + 17}px`
      ]
    );
  });

  it('auto-sizes a column that cannot be sorted to its header text alone, with no room for a sort chevron', async () => {
    await render({ columns: [{ key: 'fid', header: 'Feature identifier', width: 60, sortable: false }] });
    await act(async () => {
      resizeHandleOf(dataHeaders()[0]).dispatchEvent({ type: 'dblclick', button: 0, bubbles: true });
    });
    assert.equal(dataHeaders()[0].style.width, `${8 * 'Feature identifier'.length + 17}px`);
  });

  it('auto-sizes no narrower than the column minWidth', async () => {
    await render({ columns: [{ key: 'name', header: 'Name', width: 60, minWidth: 150 }] });
    await act(async () => {
      resizeHandleOf(dataHeaders()[0]).dispatchEvent({ type: 'dblclick', button: 0, bubbles: true });
    });
    assert.equal(dataHeaders()[0].style.width, '150px');
  });

  it("never sorts when a sortable column's resize handle is dragged, clicked or double-clicked", async () => {
    await render({ columns: SIZED_COLUMNS });
    const handle = resizeHandleOf(dataHeaders()[0]);
    await drag(handle, 200, 230);
    await act(async () => {
      handle.dispatchEvent({ type: 'click', button: 0, bubbles: true });
      handle.dispatchEvent({ type: 'click', button: 0, bubbles: true, detail: 2 });
      handle.dispatchEvent({ type: 'dblclick', button: 0, bubbles: true });
    });
    assert.equal(dataHeaders()[0].getAttribute('aria-sort'), 'none');
    assert.deepEqual(bodyRows().map((row) => row.getAttribute('data-row-id')), ['10', '20', '30']);
  });

  it('without a host widths signal, keeps resized widths itself across re-renders', async () => {
    await render({ columns: SIZED_COLUMNS });
    await drag(resizeHandleOf(dataHeaders()[0]), 200, 250);
    await render({ columns: SIZED_COLUMNS, rows: [CITIES[1]] });
    assert.deepEqual(dataHeaders().map((c) => c.style.width), ['170px', '100px']);
  });

  it("reads widths from a host's columnWidths signal over the column definitions, following later changes", async () => {
    const { signal } = jiti('@preact/signals-react');
    const columnWidths = signal({ population: 140 });
    await render({ columns: SIZED_COLUMNS, columnWidths });
    assert.deepEqual(dataHeaders().map((c) => c.style.width), ['120px', '140px']);

    await act(async () => {
      columnWidths.value = { name: 90, population: 140 };
    });
    assert.deepEqual(dataHeaders().map((c) => c.style.width), ['90px', '140px']);
  });

  it("writes dragged and auto-sized widths to a host's columnWidths signal", async () => {
    const { signal } = jiti('@preact/signals-react');
    const columnWidths = signal({ population: 140 });
    await render({ columns: SIZED_COLUMNS, columnWidths });
    await drag(resizeHandleOf(dataHeaders()[0]), 200, 230);
    assert.deepEqual(columnWidths.value, { population: 140, name: 150 });

    await act(async () => {
      resizeHandleOf(dataHeaders()[1]).dispatchEvent({ type: 'dblclick', button: 0, bubbles: true });
    });
    // The header Population and its sort chevron are wider than the raw values (e.g. 1762949).
    assert.deepEqual(columnWidths.value, { population: 8 * 'Population'.length + 20 + 17, name: 150 });
    assert.deepEqual(dataHeaders().map((c) => c.style.width), ['150px', '117px']);
  });
});

/**
 * @function cellOf
 * @description Returns a row's data cell in a column.
 * @param {number} rowId - Host row ID.
 * @param {number} columnIndex - Column index (0 = Name, 1 = Population).
 * @returns {MockElement} The data cell.
 */
function cellOf(rowId: number, columnIndex: number): MockElement {
  return cellsOf(row(rowId))[columnIndex];
}

/**
 * @function cellBorderOf
 * @description Returns the cell border drawn inside a data cell, if any.
 * @param {MockElement} cell - Data cell.
 * @returns {MockElement | undefined} The cell border element, or undefined when the cell has none.
 */
function cellBorderOf(cell: MockElement): MockElement | undefined {
  return findElementsByClass(cell, 'table-widget-cell-border')[0];
}

/**
 * @function markMontrealPopulation
 * @description A host `cellStyle` that marks Montréal's population cell with a red border and a pink background, and leaves every other cell alone.
 * @param {CityRow} cityRow - Host row.
 * @param {{ key: string }} column - Column definition.
 * @returns {{ borderColour: string, background: string } | undefined} The cell style, or nothing.
 */
function markMontrealPopulation(cityRow: CityRow, column: { key: string }) {
  return cityRow.fid === 20 && column.key === 'population' ? { borderColour: 'red', background: 'pink' } : undefined;
}

describe('TableWidget per-cell styling (Ticket #328)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("draws a real 1px border in the host's colour on all four sides of a styled cell, over the shared row and column lines", async () => {
    await render({ cellStyle: markMontrealPopulation });
    const cell = cellOf(20, 1);
    const border = cellBorderOf(cell);
    assert.ok(border, 'the styled cell has a border');
    assert.equal(border.style.border, '1px solid red');
    assert.equal(border.style.position, 'absolute');
    assert.equal(cell.style.position, 'relative');
    assert.deepEqual(
      [border.style.top, border.style.right, border.style.bottom, border.style.left],
      ['-1px', '-1px', '-1px', '-1px'],
      "the border covers the line above, the line to the left and the cell's own right and bottom lines"
    );
    assert.equal(cell.style.overflow, 'clip');
    assert.equal(cell.style.overflowClipMargin, '1px', 'the cell does not clip its border away');
    assert.equal(border.style.pointerEvents, 'none');
    assert.equal(border.style.boxShadow ?? '', '');
    assert.equal(cell.style.boxShadow ?? '', '');
    assert.equal(cellBorderOf(cellOf(20, 0)), undefined);
    assert.equal(cellBorderOf(cellOf(10, 1)), undefined);
  });

  it('keeps the top border of a first-row cell and the left border of a first-column cell inside the cell, clear of the sticky header row and Row Number Column', async () => {
    await render({ cellStyle: () => ({ borderColour: 'red' }) });
    const sides = (cell: MockElement) => {
      const { top, right, bottom, left } = cellBorderOf(cell)!.style;
      return [top, right, bottom, left];
    };
    assert.deepEqual(sides(cellOf(10, 0)), ['0px', '-1px', '-1px', '0px']);
    assert.deepEqual(sides(cellOf(10, 1)), ['0px', '-1px', '-1px', '-1px']);
    assert.deepEqual(sides(cellOf(20, 0)), ['-1px', '-1px', '-1px', '0px']);
    assert.deepEqual(sides(cellOf(30, 1)), ['-1px', '-1px', '-1px', '-1px']);
  });

  it('treats the first displayed row as the first row when the table is sorted', async () => {
    await render({ cellStyle: () => ({ borderColour: 'red' }), sort: signal({ columnKey: 'name', direction: 'ascending' }) });
    assert.equal(textOf(cellsOf(bodyRows()[0])[0]), 'Halifax');
    assert.equal(cellBorderOf(cellOf(30, 1))!.style.top, '0px');
    assert.equal(cellBorderOf(cellOf(10, 1))!.style.top, '-1px');
  });

  it("paints a styled cell's background over the plain row colour, leaving its text colour and other cells alone", async () => {
    await render({ cellStyle: markMontrealPopulation });
    assert.equal(cellOf(20, 1).style.backgroundColor, 'pink');
    assert.equal(cellOf(20, 1).style.color, 'var(--cartouche-table-fg)');
    assert.equal(cellOf(20, 0).style.backgroundColor, 'var(--cartouche-table-bg)');
  });

  it("paints a styled cell's background over the alternating row colour", async () => {
    await render({ alternatingRows: true, cellStyle: () => ({ background: 'pink' }) });
    assert.equal(cellOf(10, 0).style.backgroundColor, 'pink');
    assert.equal(cellOf(20, 0).style.backgroundColor, 'pink');
    assert.equal(cellBorderOf(cellOf(10, 0)), undefined, 'a background alone draws no border');
  });

  it("paints the selected and active colours over a styled cell's background", async () => {
    await render({ cellStyle: () => ({ background: 'pink' }) });
    await act(async () => {
      selectedRowIds.value = new Set([10, 20]);
      activeRowId.value = 20;
    });
    assert.equal(cellOf(10, 0).style.backgroundColor, 'var(--cartouche-table-row-selected-bg)');
    assert.equal(cellOf(20, 0).style.backgroundColor, 'var(--cartouche-table-row-active-bg)');
    assert.equal(cellOf(30, 0).style.backgroundColor, 'pink');
  });

  it('keeps showing the border of a styled cell on Selected Rows and the Active Row', async () => {
    await render({ cellStyle: () => ({ borderColour: 'red', background: 'pink' }) });
    await act(async () => {
      selectedRowIds.value = new Set([10, 20]);
      activeRowId.value = 20;
    });
    for (const rowId of [10, 20]) {
      assert.equal(cellBorderOf(cellOf(rowId, 1))!.style.border, '1px solid red');
    }
  });

  it('leaves cells unstyled when cellStyle returns nothing, or when the host passes none', async () => {
    await render({ cellStyle: () => null });
    assert.equal(cellOf(10, 0).style.backgroundColor, 'var(--cartouche-table-bg)');
    assert.equal(cellOf(10, 0).style.position ?? '', '');
    assert.equal(cellOf(10, 0).style.overflow, 'hidden');
    assert.equal(cellBorderOf(cellOf(10, 0)), undefined);
    await render();
    assert.equal(cellBorderOf(cellOf(10, 0)), undefined);
  });

  it("passes cellStyle each displayed row and the column's definition", async () => {
    const calls: string[] = [];
    await render({
      cellStyle: (cityRow: CityRow, column: { key: string; header: string }) => {
        calls.push(`${cityRow.name}/${column.key}/${column.header}`);
        return undefined;
      }
    });
    assert.deepEqual(calls, [
      'Ottawa/name/Name',
      'Ottawa/population/Population',
      'Montréal/name/Name',
      'Montréal/population/Population',
      'Halifax/name/Name',
      'Halifax/population/Population'
    ]);
  });
});

