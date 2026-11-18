/**
 * @file TableWidgetSorting.test.ts
 * @module tests/renderer/widgets/TableWidgetSorting.test
 * @description Headless component tests for TableWidget single-column sorting as a host uses it (Spec #322 / Ticket #325): header clicks cycling none → ascending → descending → none, one sorted column at a time, the dual, up and down chevrons, columns with `sortable: false`, a host-owned sort signal, in-memory sorting with the column's compare function or the default, a host `sortHandler`, and Row Number Column values following the displayed order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see {@link TableWidget}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { mdiChevronDown, mdiChevronUp, mdiUnfoldMoreHorizontal } from '@mdi/js';
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
// The same signals module instance TableWidget subscribes through.
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
        selectedRowIds: signal(new Set()),
        activeRowId: signal(null),
        ...props
      })
    );
  });
}

/**
 * @function headerCells
 * @description Returns the rendered header cells, in display order.
 * @returns {MockElement[]} Header cells.
 */
function headerCells(): MockElement[] {
  return findElementsByClass(dom!.container, 'table-widget-header-cell');
}

/**
 * @function dataHeader
 * @description Returns the header cell of the column with the given header text.
 * @param {string} text - Header text.
 * @returns {MockElement} Header cell.
 */
function dataHeader(text: string): MockElement {
  const header = headerCells().find((cell) => textOf(cell) === text);
  assert.ok(header, `header ${text} rendered`);
  return header;
}

/**
 * @function clickHeader
 * @description Primary-clicks the header cell of the column with the given header text.
 * @param {string} text - Header text.
 */
async function clickHeader(text: string): Promise<void> {
  await act(async () => {
    dataHeader(text).dispatchEvent({ type: 'click', bubbles: true, button: 0 });
  });
}

/**
 * @function displayedNames
 * @description Returns the first data cell's text of each displayed row, in display order.
 * @returns {string[]} Displayed names.
 */
function displayedNames(): string[] {
  return findElementsByClass(dom!.container, 'table-widget-row').map((row) =>
    textOf(findElementsByClass(row, 'table-widget-cell')[0])
  );
}

/**
 * @function chevronOf
 * @description Returns the MDI path of the sort chevron in a column's header, or null when it shows none.
 * @param {string} text - Header text.
 * @returns {string | null} The chevron icon's MDI path data.
 */
function chevronOf(text: string): string | null {
  const [icon] = findElementsByClass(dataHeader(text), 'table-widget-sort-icon');
  if (!icon) return null;
  const path = icon.childNodes.find((child: MockElement) => child.tagName === 'PATH');
  return path?.getAttribute('d') ?? null;
}

describe('TableWidget single-column sorting (Ticket #325)', () => {
  beforeEach(() => {
    dom = installMockDom();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("cycles a sortable column's header clicks none → ascending → descending → none, sorting rows in memory", async () => {
    await render();
    assert.deepEqual(displayedNames(), ['Ottawa', 'Montréal', 'Halifax']);
    await clickHeader('Population');
    assert.deepEqual(displayedNames(), ['Halifax', 'Ottawa', 'Montréal']);
    await clickHeader('Population');
    assert.deepEqual(displayedNames(), ['Montréal', 'Ottawa', 'Halifax']);
    await clickHeader('Population');
    assert.deepEqual(displayedNames(), ['Ottawa', 'Montréal', 'Halifax']);
  });

  it('sorts by one column at a time: sorting a different column resets the previous one', async () => {
    await render();
    await clickHeader('Population');
    await clickHeader('Population');
    await clickHeader('Name');
    assert.deepEqual(displayedNames(), ['Halifax', 'Montréal', 'Ottawa']);
    assert.equal(chevronOf('Name'), mdiChevronUp);
    assert.equal(chevronOf('Population'), mdiUnfoldMoreHorizontal);
  });

  it('shows a dual chevron on unsorted sortable headers and an up or down chevron on the sorted one', async () => {
    await render();
    assert.equal(chevronOf('Name'), mdiUnfoldMoreHorizontal);
    assert.equal(chevronOf('Population'), mdiUnfoldMoreHorizontal);
    assert.equal(dataHeader('Population').getAttribute('aria-sort'), 'none');
    await clickHeader('Population');
    assert.equal(chevronOf('Population'), mdiChevronUp);
    assert.equal(dataHeader('Population').getAttribute('aria-sort'), 'ascending');
    await clickHeader('Population');
    assert.equal(chevronOf('Population'), mdiChevronDown);
    assert.equal(dataHeader('Population').getAttribute('aria-sort'), 'descending');
    await clickHeader('Population');
    assert.equal(chevronOf('Population'), mdiUnfoldMoreHorizontal);
  });

  it('shows no chevrons on a column with sortable false and ignores clicks on its header', async () => {
    await render({ columns: [{ key: 'name', header: 'Name', sortable: false }, COLUMNS[1]] });
    assert.equal(chevronOf('Name'), null);
    assert.equal(dataHeader('Name').getAttribute('aria-sort'), null);
    await clickHeader('Name');
    assert.deepEqual(displayedNames(), ['Ottawa', 'Montréal', 'Halifax']);
    assert.equal(chevronOf('Name'), null);
  });

  it('shows no chevron on the Row Number Column header', async () => {
    await render();
    assert.equal(findElementsByClass(headerCells()[0], 'table-widget-sort-icon').length, 0);
  });

  it('reads and writes a host-owned sort signal instead of keeping the sort itself', async () => {
    const sort = signal({ columnKey: 'population', direction: 'descending' });
    await render({ sort });
    assert.deepEqual(displayedNames(), ['Montréal', 'Ottawa', 'Halifax']);
    assert.equal(chevronOf('Population'), mdiChevronDown);

    await clickHeader('Name');
    assert.deepEqual(sort.value, { columnKey: 'name', direction: 'ascending' });
    assert.deepEqual(displayedNames(), ['Halifax', 'Montréal', 'Ottawa']);

    await act(async () => {
      sort.value = null;
    });
    assert.deepEqual(displayedNames(), ['Ottawa', 'Montréal', 'Halifax']);
    assert.equal(chevronOf('Name'), mdiUnfoldMoreHorizontal);
  });

  it("sorts in memory with the column's compare function when it has one", async () => {
    const byLength = (a: unknown, b: unknown) => String(a).length - String(b).length;
    await render({ columns: [{ key: 'name', header: 'Name', compare: byLength }, COLUMNS[1]] });
    await clickHeader('Name');
    assert.deepEqual(displayedNames(), ['Ottawa', 'Halifax', 'Montréal']);
    await clickHeader('Name');
    assert.deepEqual(displayedNames(), ['Montréal', 'Halifax', 'Ottawa']);
  });

  it('sorts numbers numerically, text in natural order, and missing values last in either direction by default', async () => {
    const rows = [
      { fid: 1, name: 'Site 10', population: 9 },
      { fid: 2, name: 'Site 2', population: null },
      { fid: 3, name: 'Site 1', population: 100 }
    ];
    await render({ rows });
    await clickHeader('Name');
    assert.deepEqual(displayedNames(), ['Site 1', 'Site 2', 'Site 10']);
    await clickHeader('Population');
    assert.deepEqual(displayedNames(), ['Site 10', 'Site 1', 'Site 2']);
    await clickHeader('Population');
    assert.deepEqual(displayedNames(), ['Site 1', 'Site 10', 'Site 2']);
  });

  it('with a sortHandler, updates the sort and chevrons, calls the handler, and shows the rows in the order the host supplies', async () => {
    const calls: Array<[string, string | null]> = [];
    const sortHandler = (columnKey: string, direction: string | null) => calls.push([columnKey, direction]);
    await render({ sortHandler });

    await clickHeader('Population');
    assert.deepEqual(calls, [['population', 'ascending']]);
    assert.equal(chevronOf('Population'), mdiChevronUp);
    assert.deepEqual(displayedNames(), ['Ottawa', 'Montréal', 'Halifax'], 'rows left in the host order');

    await render({ sortHandler, rows: [CITIES[2], CITIES[0], CITIES[1]] });
    assert.deepEqual(displayedNames(), ['Halifax', 'Ottawa', 'Montréal']);
    assert.equal(chevronOf('Population'), mdiChevronUp, 'sort kept across new rows');

    await clickHeader('Population');
    await clickHeader('Population');
    assert.deepEqual(calls, [
      ['population', 'ascending'],
      ['population', 'descending'],
      ['population', null]
    ]);
    assert.equal(chevronOf('Population'), mdiUnfoldMoreHorizontal);
  });

  it('numbers the Row Number Column by displayed position, so 1 is always the top row', async () => {
    await render();
    await clickHeader('Population');
    const rowNumbers = findElementsByClass(dom!.container, 'table-widget-row-number').map(textOf);
    assert.deepEqual(rowNumbers, ['1', '2', '3']);
    assert.deepEqual(
      findElementsByClass(dom!.container, 'table-widget-row').map((row) => row.getAttribute('data-row-id')),
      ['30', '10', '20']
    );
  });
});
