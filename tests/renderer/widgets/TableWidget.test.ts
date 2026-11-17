/**
 * @file TableWidget.test.ts
 * @module tests/renderer/widgets/TableWidget.test
 * @description Headless component tests for TableWidget as a host uses it (Spec #322 / Ticket #323): the BasicWidget header bar shown or hidden, rows with stable row IDs and column definitions (header text, alignment, display function), the --cartouche-table-* theme tokens on the outer border, column and row lines, header row, plain and alternating rows, 1rem font sizing, the Row Number Column, sticky header row and Row Number Column, and the empty table.
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
    dom = installMockDom();
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
    dom = installMockDom();
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
    dom = installMockDom();
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

