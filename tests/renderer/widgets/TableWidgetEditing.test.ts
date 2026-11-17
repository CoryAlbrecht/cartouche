/**
 * @file TableWidgetEditing.test.ts
 * @module tests/renderer/widgets/TableWidgetEditing.test
 * @description Headless component tests for TableWidget editing and Read-Only Cells as a host uses them (Spec #322 / Ticket #327): read-only at table, column, row and cell level, read-only tables still selecting and sorting, the Read-Only Cell colours, starting an edit by double-click, F2 or Enter in the focused column, committing by Enter or leaving the cell, cancelling by Escape, Tab/Shift+Tab moving between editable cells, the default text and number editors, custom column editors, onCellEdit reports, and host rejection by returning false or throwing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link TableWidget}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
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
import { cascadedValue } from '../styles/cssRules';

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
  { key: 'population', header: 'Population', align: 'right' }
];

let dom: MockDom | null = null;

/** The host's state, reset per test by `installHost`. */
let rows: CityRow[];
let selectedRowIds: { value: Set<number> };
let activeRowId: { value: number | null };
let edits: Array<{ rowId: number; columnKey: string; oldValue: unknown; newValue: unknown }>;

/**
 * @function installHost
 * @description Installs the mock DOM and a fresh host: the city rows, empty selection signals and no recorded edits.
 */
function installHost(): void {
  dom = installMockDom();
  rows = CITIES.map((city) => ({ ...city }));
  selectedRowIds = signal(new Set<number>());
  activeRowId = signal(null);
  edits = [];
}

/** Props of the most recent `render`, so `rerender` can repeat it with the host's new rows. */
let lastProps: Record<string, unknown> = {};

/**
 * @function acceptingEdit
 * @description The default host `onCellEdit`: records the edit and writes it into the host's rows, as a real host would.
 * @param {Object} edit - The edit TableWidget reported.
 */
function acceptingEdit(edit: { rowId: number; columnKey: string; oldValue: unknown; newValue: unknown }): void {
  edits.push(edit);
  rows = rows.map((row) => (row.fid === edit.rowId ? { ...row, [edit.columnKey]: edit.newValue } : row));
  void rerender();
}

/**
 * @function render
 * @description Renders a TableWidget into the mock DOM with the host's rows and the city columns, overridden by `props`.
 * @param {Record<string, unknown>} [props] - Props overriding the defaults.
 */
async function render(props: Record<string, unknown> = {}): Promise<void> {
  lastProps = props;
  await act(async () => {
    dom!.root.render(
      React.createElement(TableWidget, {
        rows,
        getRowId: (row: CityRow) => row.fid,
        columns: COLUMNS,
        selectedRowIds,
        activeRowId,
        onCellEdit: acceptingEdit,
        ...props
      })
    );
  });
}

/**
 * @function rerender
 * @description Renders again with the props of the last `render` and the host's current rows.
 */
async function rerender(): Promise<void> {
  dom!.root.render(
    React.createElement(TableWidget, {
      rows,
      getRowId: (row: CityRow) => row.fid,
      columns: COLUMNS,
      selectedRowIds,
      activeRowId,
      onCellEdit: acceptingEdit,
      ...lastProps
    })
  );
}

/**
 * @function nativeEvent
 * @description Builds a bubbling native event for the mock DOM, recording `preventDefault` in `defaultPrevented`.
 * @param {string} type - Event type.
 * @param {Record<string, unknown>} [fields] - Event fields, e.g. `key` and modifier keys.
 * @returns {Record<string, unknown>} The event.
 */
function nativeEvent(type: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
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
  return event;
}

/**
 * @function fire
 * @description Dispatches a native event on an element inside `act`.
 * @param {MockElement} el - Target element.
 * @param {string} type - Event type.
 * @param {Record<string, unknown>} [fields] - Event fields.
 * @returns {Promise<boolean>} Whether the default action was left alone.
 */
async function fire(el: MockElement, type: string, fields: Record<string, unknown> = {}): Promise<boolean> {
  let notPrevented = true;
  await act(async () => {
    notPrevented = el.dispatchEvent(nativeEvent(type, fields));
  });
  return notPrevented;
}

/**
 * @function press
 * @description Presses a key in an editor as a user would: the editor has focus (a `focusin` first, which React's input event tracking in the mock DOM needs), then the keydown.
 * @param {MockElement} input - Editor input.
 * @param {string} key - Key name, e.g. `Enter`.
 * @param {Record<string, unknown>} [modifiers] - Modifier keys held.
 * @returns {Promise<boolean>} Whether the default action was left alone.
 */
async function press(input: MockElement, key: string, modifiers: Record<string, unknown> = {}): Promise<boolean> {
  await fire(input, 'focusin');
  return fire(input, 'keydown', { key, ...modifiers });
}

/**
 * @function row
 * @description Returns the rendered body row of a host row ID.
 * @param {number} rowId - Host row ID.
 * @returns {MockElement} Body row.
 */
function row(rowId: number): MockElement {
  const found = findElementsByClass(dom!.container, 'table-widget-row').find(
    (r) => r.getAttribute('data-row-id') === String(rowId)
  );
  assert.ok(found, `row ${rowId} rendered`);
  return found;
}

/**
 * @function cell
 * @description Returns a data cell by host row ID and column index.
 * @param {number} rowId - Host row ID.
 * @param {number} columnIndex - Index among the data columns.
 * @returns {MockElement} Data cell.
 */
function cell(rowId: number, columnIndex: number): MockElement {
  return findElementsByClass(row(rowId), 'table-widget-cell')[columnIndex];
}

/**
 * @function table
 * @description Returns the table element, which takes keyboard focus.
 * @returns {MockElement} Table element.
 */
function table(): MockElement {
  return findElementsByClass(dom!.container, 'table-widget-table')[0];
}

/**
 * @function editors
 * @description Returns every rendered default cell editor.
 * @returns {MockElement[]} Editor inputs.
 */
function editors(): MockElement[] {
  return findElementsByClass(dom!.container, 'table-widget-editor');
}

/**
 * @function editor
 * @description Returns the one open default cell editor.
 * @returns {MockElement} Editor input.
 */
function editor(): MockElement {
  const open = editors();
  assert.equal(open.length, 1, 'one editor open');
  return open[0];
}

/**
 * @function doubleClick
 * @description Clicks and then double-clicks a cell, as a user's double-click does.
 * @param {MockElement} el - Cell to double-click.
 */
async function doubleClick(el: MockElement): Promise<void> {
  await fire(el, 'click');
  await fire(el, 'dblclick');
}

/**
 * @function type
 * @description Types new text into an editor input through its React change handler.
 * @param {MockElement} input - Editor input.
 * @param {string} text - The input's new text.
 */
async function type(input: MockElement, text: string): Promise<void> {
  const propsKey = Object.keys(input).find((k) => k.startsWith('__reactProps'))!;
  await act(async () => {
    input.value = text;
    (input as any)[propsKey].onChange({ target: input, currentTarget: input });
  });
}

describe('TableWidget starting an edit (Ticket #327)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('double-clicking an editable cell opens an editor holding its value, and selects the row', async () => {
    await render();
    await doubleClick(cell(20, 0));
    assert.equal(editor().value, 'Montréal');
    assert.deepEqual([...selectedRowIds.value], [20]);
  });
});

/** Read-only at each level, each making the Halifax population cell (row 30, column 1) a Read-Only Cell. */
const READ_ONLY_LEVELS: Array<[string, () => Record<string, unknown>]> = [
  ['the table', () => ({ readOnly: true })],
  ['its column', () => ({ columns: [COLUMNS[0], { ...COLUMNS[1], readOnly: true }] })],
  ['its row', () => ({ isRowReadOnly: (r: CityRow) => r.fid === 30 })],
  [
    'the cell itself',
    () => ({ isCellReadOnly: (r: CityRow, column: { key: string }) => r.fid === 30 && column.key === 'population' })
  ]
];

describe('TableWidget Read-Only Cells (Ticket #327)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  for (const [level, props] of READ_ONLY_LEVELS) {
    it(`a cell is read-only when ${level} is: double-click only selects its row, and F2/Enter do nothing`, async () => {
      await render(props());
      await doubleClick(cell(30, 1));
      assert.equal(editors().length, 0, 'no editor on a Read-Only Cell');
      assert.deepEqual([...selectedRowIds.value], [30]);
      assert.equal(activeRowId.value, 30);
      await fire(table(), 'keydown', { key: 'F2' });
      await fire(table(), 'keydown', { key: 'Enter' });
      assert.equal(editors().length, 0, 'F2 and Enter do not edit the focused Read-Only Cell');
      assert.deepEqual(edits, []);
    });
  }

  it('only the marked cells are read-only: the others still edit', async () => {
    await render({ isRowReadOnly: (r: CityRow) => r.fid === 30 });
    await doubleClick(cell(20, 1));
    assert.equal(editor().value, '1762949');
  });

  it('a read-only table still selects and sorts', async () => {
    await render({ readOnly: true });
    await fire(cell(10, 0), 'click');
    await fire(cell(30, 0), 'click', { shiftKey: true });
    assert.deepEqual([...selectedRowIds.value].sort(), [10, 20, 30]);
    await fire(table(), 'keydown', { key: 'ArrowUp' });
    assert.equal(activeRowId.value, 20);
    const [nameHeader] = findElementsByClass(dom!.container, 'table-widget-header-cell').filter(
      (c) => textOf(c) === 'Name'
    );
    await fire(nameHeader, 'click');
    const order = findElementsByClass(dom!.container, 'table-widget-row').map((r) => r.getAttribute('data-row-id'));
    assert.deepEqual(order, ['30', '20', '10'], 'sorted by name ascending: Halifax, Montréal, Ottawa');
  });
});

describe('TableWidget Read-Only Cell colours (Ticket #327)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  /**
   * @function colours
   * @description Returns a data cell's `[background, color]`.
   * @param {number} rowId - Host row ID.
   * @param {number} columnIndex - Index among the data columns.
   * @returns {string[]} Background and text colour.
   */
  function colours(rowId: number, columnIndex: number): string[] {
    const target = cell(rowId, columnIndex);
    return [cascadedValue(target, 'background-color') ?? '', cascadedValue(target, 'color') ?? ''];
  }

  const READ_ONLY_COLUMN = { columns: [COLUMNS[0], { ...COLUMNS[1], readOnly: true }] };

  it('shows Read-Only Cell text in --cartouche-table-readonly-fg on rows that are not selected, on the row colour', async () => {
    await render({ ...READ_ONLY_COLUMN, alternatingRows: true });
    assert.deepEqual(colours(10, 1), ['var(--cartouche-table-row-alt-bg)', 'var(--cartouche-table-readonly-fg)']);
    assert.deepEqual(colours(20, 1), ['var(--cartouche-table-bg)', 'var(--cartouche-table-readonly-fg)']);
    assert.deepEqual(colours(20, 0), ['var(--cartouche-table-bg)', 'var(--cartouche-table-fg)'], 'editable cell');
  });

  it('paints read-only cells of Selected Rows with the read-only selected colours', async () => {
    await render(READ_ONLY_COLUMN);
    await act(async () => {
      selectedRowIds.value = new Set([10, 20]);
      activeRowId.value = 20;
    });
    assert.deepEqual(colours(10, 1), [
      'var(--cartouche-table-readonly-selected-bg)',
      'var(--cartouche-table-readonly-selected-fg)'
    ]);
    assert.deepEqual(
      colours(10, 0),
      ['var(--cartouche-table-row-selected-bg)', 'var(--cartouche-table-fg)'],
      'editable cell'
    );
  });

  it("keeps a host cell background under read-only text, and the read-only selected colours over it", async () => {
    await render({ ...READ_ONLY_COLUMN, cellStyle: () => ({ background: 'pink' }) });
    assert.deepEqual(colours(10, 1), ['pink', 'var(--cartouche-table-readonly-fg)']);
    await act(async () => {
      selectedRowIds.value = new Set([10, 20]);
      activeRowId.value = 20;
    });
    assert.deepEqual(colours(10, 1), [
      'var(--cartouche-table-readonly-selected-bg)',
      'var(--cartouche-table-readonly-selected-fg)'
    ]);
    assert.deepEqual(colours(20, 1), ['var(--cartouche-table-row-active-bg)', 'var(--cartouche-table-fg)']);
  });

  it('paints read-only cells of the Active Row with the active colour and --cartouche-table-fg text', async () => {
    await render(READ_ONLY_COLUMN);
    await act(async () => {
      selectedRowIds.value = new Set([20]);
      activeRowId.value = 20;
    });
    assert.deepEqual(colours(20, 1), ['var(--cartouche-table-row-active-bg)', 'var(--cartouche-table-fg)']);
    assert.deepEqual(colours(20, 0), ['var(--cartouche-table-row-active-bg)', 'var(--cartouche-table-row-active-fg)']);
  });
});

describe('TableWidget starting an edit from the keyboard (Ticket #327)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("F2 edits the Active Row's cell in the focused column: the column of the last clicked cell", async () => {
    await render();
    await fire(cell(10, 1), 'click');
    await fire(table(), 'keydown', { key: 'ArrowDown' });
    assert.equal(activeRowId.value, 20);
    const notPrevented = await fire(table(), 'keydown', { key: 'F2' });
    assert.equal(notPrevented, false);
    assert.equal(editor().value, '1762949', 'Montréal population');
  });

  it("Enter edits the Active Row's first editable cell when no column has been focused yet", async () => {
    await render({ columns: [{ ...COLUMNS[0], readOnly: true }, COLUMNS[1]] });
    await act(async () => {
      selectedRowIds.value = new Set([30]);
      activeRowId.value = 30;
    });
    await fire(table(), 'keydown', { key: 'Enter' });
    assert.equal(editor().value, '439819', 'Halifax population');
  });

  it('F2 and Enter do nothing without an Active Row', async () => {
    await render();
    await fire(table(), 'keydown', { key: 'F2' });
    await fire(table(), 'keydown', { key: 'Enter' });
    assert.equal(editors().length, 0);
  });
});

describe('TableWidget committing and cancelling an edit (Ticket #327)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('Enter commits: onCellEdit gets the row ID, column key, old and new value, and the edit ends', async () => {
    await render();
    await doubleClick(cell(20, 0));
    await type(editor(), 'Montreal');
    await press(editor(), 'Enter');
    assert.deepEqual(edits, [{ rowId: 20, columnKey: 'name', oldValue: 'Montréal', newValue: 'Montreal' }]);
    assert.equal(editors().length, 0);
    assert.equal(textOf(cell(20, 0)), 'Montreal');
  });

  it('leaving the cell commits', async () => {
    await render();
    await doubleClick(cell(10, 0));
    await type(editor(), 'Bytown');
    await fire(editor(), 'focusout');
    assert.deepEqual(edits, [{ rowId: 10, columnKey: 'name', oldValue: 'Ottawa', newValue: 'Bytown' }]);
    assert.equal(editors().length, 0);
  });

  it('commits once only, even when leaving the cell follows Enter', async () => {
    await render();
    await doubleClick(cell(10, 0));
    const input = editor();
    await type(input, 'Bytown');
    await press(input, 'Enter');
    await fire(input, 'focusout');
    assert.equal(edits.length, 1);
  });

  it('Escape cancels: no onCellEdit, the old value stays, and the edit ends', async () => {
    await render();
    await doubleClick(cell(10, 0));
    await type(editor(), 'Bytown');
    await press(editor(), 'Escape');
    assert.deepEqual(edits, []);
    assert.equal(editors().length, 0);
    assert.equal(textOf(cell(10, 0)), 'Ottawa');
  });

  it('does not report a commit that leaves the value unchanged', async () => {
    await render();
    await doubleClick(cell(10, 0));
    await press(editor(), 'Enter');
    assert.deepEqual(edits, []);
    assert.equal(editors().length, 0);
  });

  it('keys and clicks inside the editor never reach row selection or the table', async () => {
    await render();
    await doubleClick(cell(20, 0));
    await press(editor(), 'ArrowDown');
    await press(editor(), 'a', { ctrlKey: true });
    await fire(editor(), 'click', { ctrlKey: true });
    assert.deepEqual([...selectedRowIds.value], [20]);
    assert.equal(activeRowId.value, 20);
    assert.equal(editor().value, 'Montréal');
  });
});

describe('TableWidget moving between edits with Tab (Ticket #327)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('Tab commits and edits the next editable cell, skipping Read-Only Cells and moving on to the next row', async () => {
    await render({ isCellReadOnly: (r: CityRow, column: { key: string }) => r.fid === 20 && column.key === 'name' });
    await doubleClick(cell(10, 0));
    await type(editor(), 'Bytown');
    const notPrevented = await press(editor(), 'Tab');
    assert.equal(notPrevented, false, 'Tab stays in the table');
    assert.deepEqual(edits, [{ rowId: 10, columnKey: 'name', oldValue: 'Ottawa', newValue: 'Bytown' }]);
    assert.equal(editor().value, '1017449', 'Ottawa population');

    await press(editor(), 'Tab');
    assert.equal(editor().value, '1762949', 'Montréal population: its read-only name was skipped');
    assert.deepEqual([...selectedRowIds.value], [20], 'the row edited is selected');
    assert.equal(activeRowId.value, 20);
  });

  it('Shift+Tab commits and edits the previous editable cell', async () => {
    await render();
    await doubleClick(cell(20, 0));
    await press(editor(), 'Tab', { shiftKey: true });
    assert.equal(editor().value, '1017449', 'Ottawa population');
    assert.equal(activeRowId.value, 10);
  });

  it('Tab on the last editable cell commits and ends editing', async () => {
    await render();
    await doubleClick(cell(30, 1));
    await type(editor(), '440000');
    await press(editor(), 'Tab');
    assert.equal(editors().length, 0);
    assert.deepEqual(edits, [{ rowId: 30, columnKey: 'population', oldValue: 439819, newValue: 440000 }]);
  });
});

describe('TableWidget editors (Ticket #327)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it('edits numbers with the number editor: commits a number, parsing grouped and decimal-comma input', async () => {
    await render();
    await doubleClick(cell(10, 1));
    assert.ok(editor().className.includes('cell-editor-numeric'), 'numeric editor');
    await type(editor(), '1 017 449,5');
    await press(editor(), 'Enter');
    assert.deepEqual(edits, [{ rowId: 10, columnKey: 'population', oldValue: 1017449, newValue: 1017449.5 }]);
  });

  it('the number editor cancels input that is not a number, keeping the old value', async () => {
    await render();
    await doubleClick(cell(10, 1));
    await type(editor(), 'lots');
    await press(editor(), 'Enter');
    assert.deepEqual(edits, []);
    assert.equal(textOf(cell(10, 1)), '1017449');
  });

  it("uses a column's own editor, giving it the row, column and value, and reports what it commits", async () => {
    const seen: unknown[] = [];
    /**
     * @function YesNoEditor
     * @description A host's custom editor: a button that commits the opposite of the cell's boolean value.
     * @param {Object} props - Editor props.
     * @returns {React.ReactElement} The button.
     */
    function YesNoEditor(props: { row: CityRow; column: { key: string }; value: unknown; onCommit: (v: unknown) => void }) {
      seen.push([props.row.fid, props.column.key, props.value]);
      return React.createElement('button', { className: 'yes-no-editor', onClick: () => props.onCommit(!props.value) });
    }
    rows = rows.map((r) => ({ ...r, capital: r.fid === 10 }));
    await render({ columns: [...COLUMNS, { key: 'capital', header: 'Capital', editor: YesNoEditor }] });
    await doubleClick(cell(10, 2));
    assert.deepEqual(seen[0], [10, 'capital', true]);
    const [button] = findElementsByClass(dom!.container, 'yes-no-editor');
    await fire(button, 'click');
    assert.deepEqual(edits, [{ rowId: 10, columnKey: 'capital', oldValue: true, newValue: false }]);
    assert.equal(findElementsByClass(dom!.container, 'yes-no-editor').length, 0, 'edit ended');
  });
});

describe('TableWidget host rejection of an edit (Ticket #327)', () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  for (const [how, onCellEdit] of [
    [
      'returns false',
      (edit: unknown) => {
        edits.push(edit as (typeof edits)[number]);
        return false;
      }
    ],
    [
      'throws',
      (edit: unknown) => {
        edits.push(edit as (typeof edits)[number]);
        throw new Error('invalid name');
      }
    ]
  ] as const) {
    it(`when the host ${how}, the old value shows again, edit mode ends and no error styling is added`, async () => {
      await render({ onCellEdit });
      const before = cascadedValue(cell(10, 0), 'border');
      await doubleClick(cell(10, 0));
      await type(editor(), 'Bytown');
      await press(editor(), 'Enter');
      assert.equal(edits.length, 1, 'host was asked');
      assert.equal(editors().length, 0);
      assert.equal(textOf(cell(10, 0)), 'Ottawa');
      const target = cell(10, 0);
      assert.deepEqual(
        ['background-color', 'color', 'border'].map((property) => cascadedValue(target, property)),
        ['var(--cartouche-table-row-active-bg)', 'var(--cartouche-table-row-active-fg)', before]
      );
    });
  }
});
