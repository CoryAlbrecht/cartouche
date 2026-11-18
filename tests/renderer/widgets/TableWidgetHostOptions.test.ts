/**
 * @file TableWidgetHostOptions.test.ts
 * @module tests/renderer/widgets/TableWidgetHostOptions.test
 * @description Headless component tests for the TableWidget options that embedded form-style tables need (Spec #322 / Ticket #335): `selectionMode='single'`, columns with `resizable: false`, the `tableId` / `ariaLabel` / `ariaLabelledBy` props on the focusable table element, host-started edits through the `editCell` signal, and host cell classes through `cellClassName`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see {@link TableWidget}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRendererJiti } from "../rendererJiti";
import {
  installMockDom,
  teardownMockDom,
  findElementsByClass,
  type MockDom,
  type MockElement,
} from "../mockDom";

const jiti = createRendererJiti(import.meta.url);

const { TableWidget } = jiti("@renderer/workbench/widgets/TableWidget.tsx");
const { signal } = jiti("@preact/signals-react");

/** A host's row: a stable `fid` plus data fields. */
interface CityRow {
  fid: number;
  name: string;
  population: number;
}

const CITIES: CityRow[] = [
  { fid: 10, name: "Ottawa", population: 1017449 },
  { fid: 20, name: "Montréal", population: 1762949 },
  { fid: 30, name: "Halifax", population: 439819 },
];

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "population", header: "Population", align: "right" },
];

let dom: MockDom | null = null;

/** The host's state, reset per test by `installHost`. */
let rows: CityRow[];
let selectedRowIds: { value: Set<number> };
let activeRowId: { value: number | null };
let selectionKinds: string[];

/**
 * @function installHost
 * @description Installs the mock DOM and a fresh host: the city rows, empty selection signals and no recorded selection changes.
 */
function installHost(): void {
  dom = installMockDom();
  rows = CITIES.map((city) => ({ ...city }));
  selectedRowIds = signal(new Set<number>());
  activeRowId = signal(null);
  selectionKinds = [];
}

/**
 * @function render
 * @description Renders a TableWidget into the mock DOM with the host's rows and the city columns, overridden by `props`.
 * @param {Record<string, unknown>} [props] - Props overriding the defaults.
 */
async function render(props: Record<string, unknown> = {}): Promise<void> {
  await act(async () => {
    dom!.root.render(
      React.createElement(TableWidget, {
        rows,
        getRowId: (row: CityRow) => row.fid,
        columns: COLUMNS,
        selectedRowIds,
        activeRowId,
        onSelectionChange: (change: { kind: string }) =>
          selectionKinds.push(change.kind),
        ...props,
      })
    );
  });
}

/**
 * @function fire
 * @description Dispatches a bubbling native event on an element inside `act`, recording `preventDefault`.
 * @param {MockElement} el - Target element.
 * @param {string} type - Event type.
 * @param {Record<string, unknown>} [fields] - Event fields, e.g. `key` and modifier keys.
 * @returns {Promise<boolean>} Whether the default action was left alone.
 */
async function fire(
  el: MockElement,
  type: string,
  fields: Record<string, unknown> = {}
): Promise<boolean> {
  const event: Record<string, unknown> = {
    type,
    bubbles: true,
    defaultPrevented: false,
    button: 0,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    altKey: false,
    ...fields,
  };
  event.preventDefault = () => {
    event.defaultPrevented = true;
  };
  let notPrevented = true;
  await act(async () => {
    notPrevented = el.dispatchEvent(event);
  });
  return notPrevented;
}

/**
 * @function cell
 * @description Returns a data cell by its row's `fid` and its column index.
 * @param {number} rowId - The row's `fid`.
 * @param {number} columnIndex - Index among the data columns.
 * @returns {MockElement} Data cell.
 */
function cell(rowId: number, columnIndex: number): MockElement {
  const row = findElementsByClass(dom!.container, "table-widget-row").find(
    (r) => r.getAttribute("data-row-id") === String(rowId)
  );
  assert.ok(row, `row ${rowId} rendered`);
  return findElementsByClass(row, "table-widget-cell")[columnIndex];
}

/**
 * @function table
 * @description Returns the table element, which takes keyboard focus.
 * @returns {MockElement} Table element.
 */
function table(): MockElement {
  return findElementsByClass(dom!.container, "table-widget-table")[0];
}

/**
 * @function editors
 * @description Returns every rendered default cell editor.
 * @returns {MockElement[]} Editor inputs.
 */
function editors(): MockElement[] {
  return findElementsByClass(dom!.container, "table-widget-editor");
}

/**
 * @function selection
 * @description Returns the host's Selected Rows, sorted.
 * @returns {number[]} The Selected Rows' `fid`s.
 */
function selection(): number[] {
  return [...selectedRowIds.value].sort((a, b) => a - b);
}

describe("TableWidget selectionMode (Ticket #335)", () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("in 'single' mode Ctrl+click selects only the clicked row, as a replace", async () => {
    await render({ selectionMode: "single" });
    await fire(cell(10, 0), "click");
    await fire(cell(30, 0), "click", { ctrlKey: true });
    assert.deepEqual(selection(), [30]);
    assert.equal(activeRowId.value, 30);
    assert.deepEqual(selectionKinds, ["replace", "replace"]);
  });

  it("in 'single' mode Ctrl+click on the selected row keeps it selected", async () => {
    await render({ selectionMode: "single" });
    await fire(cell(20, 0), "click");
    await fire(cell(20, 0), "click", { ctrlKey: true });
    assert.deepEqual(selection(), [20]);
    assert.equal(activeRowId.value, 20);
  });

  it("in 'single' mode Shift+click selects only the clicked row", async () => {
    await render({ selectionMode: "single" });
    await fire(cell(10, 0), "click");
    await fire(cell(30, 0), "click", { shiftKey: true });
    assert.deepEqual(selection(), [30]);
    assert.equal(activeRowId.value, 30);
  });

  it("in 'single' mode Shift+↓ moves the Active Row like ↓", async () => {
    await render({ selectionMode: "single" });
    await fire(cell(10, 0), "click");
    await fire(table(), "keydown", { key: "ArrowDown", shiftKey: true });
    assert.deepEqual(selection(), [20]);
    assert.equal(activeRowId.value, 20);
    assert.deepEqual(selectionKinds, ["replace", "replace"]);
  });

  it("in 'single' mode Ctrl+A changes nothing", async () => {
    await render({ selectionMode: "single" });
    await fire(cell(20, 0), "click");
    await fire(table(), "keydown", { key: "a", ctrlKey: true });
    assert.deepEqual(selection(), [20]);
    assert.deepEqual(selectionKinds, ["replace"]);
  });

  it("'multiple' mode, the default, still extends the selection", async () => {
    await render();
    await fire(cell(10, 0), "click");
    await fire(cell(30, 0), "click", { ctrlKey: true });
    assert.deepEqual(selection(), [10, 30]);
    await fire(table(), "keydown", { key: "a", ctrlKey: true });
    assert.deepEqual(selection(), [10, 20, 30]);
  });
});

describe("TableWidget non-resizable columns (Ticket #335)", () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("a column with resizable: false has no resizer; the others keep theirs", async () => {
    await render({
      columns: [{ ...COLUMNS[0], resizable: false }, COLUMNS[1]],
    });
    const headers = findElementsByClass(
      dom!.container,
      "table-widget-header-cell"
    );
    const [nameHeader, populationHeader] = headers.slice(1);
    assert.equal(
      findElementsByClass(nameHeader, "table-widget-resize-handle").length,
      0
    );
    assert.equal(
      findElementsByClass(populationHeader, "table-widget-resize-handle")
        .length,
      1
    );
  });

  it("columns are resizable by default", async () => {
    await render();
    assert.equal(
      findElementsByClass(dom!.container, "table-widget-resize-handle").length,
      2
    );
  });
});

describe("TableWidget table id and accessible name (Ticket #335)", () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("puts tableId, ariaLabel and ariaLabelledBy on the focusable table element", async () => {
    await render({
      tableId: "dash-table",
      ariaLabel: "Dash Array",
      ariaLabelledBy: "dash-label",
    });
    const el = table();
    assert.equal(el.getAttribute("id"), "dash-table");
    assert.equal(el.getAttribute("aria-label"), "Dash Array");
    assert.equal(el.getAttribute("aria-labelledby"), "dash-label");
    assert.equal(el.getAttribute("tabindex"), "0");
  });

  it("leaves the attributes off when not given", async () => {
    await render();
    const el = table();
    assert.equal(el.getAttribute("id"), null);
    assert.equal(el.getAttribute("aria-label"), null);
    assert.equal(el.getAttribute("aria-labelledby"), null);
  });
});

describe("TableWidget host-started edits through editCell (Ticket #335)", () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("opens the requested cell for editing, selects its row and resets the signal", async () => {
    const editCell = signal(null);
    await render({ editCell });
    await act(async () => {
      editCell.value = { rowId: 20, columnKey: "population" };
    });
    const open = editors();
    assert.equal(open.length, 1, "one editor open");
    assert.equal(open[0].value, "1762949");
    assert.equal(editCell.value, null);
    assert.deepEqual(selection(), [20]);
    assert.equal(activeRowId.value, 20);
  });

  it("opens an edit requested before the first render", async () => {
    const editCell = signal({ rowId: 30, columnKey: "name" });
    await render({ editCell });
    assert.equal(editors()[0]?.value, "Halifax");
    assert.equal(editCell.value, null);
  });

  it("ignores a request for a Read-Only Cell, still resetting the signal", async () => {
    const editCell = signal(null);
    await render({ editCell, readOnly: true });
    await act(async () => {
      editCell.value = { rowId: 20, columnKey: "name" };
    });
    assert.equal(editors().length, 0);
    assert.equal(editCell.value, null);
  });

  it("ignores a request for a row or column that is not displayed, still resetting the signal", async () => {
    const editCell = signal(null);
    await render({ editCell });
    await act(async () => {
      editCell.value = { rowId: 99, columnKey: "name" };
    });
    assert.equal(editors().length, 0);
    assert.equal(editCell.value, null);
    await act(async () => {
      editCell.value = { rowId: 10, columnKey: "nope" };
    });
    assert.equal(editors().length, 0);
    assert.equal(editCell.value, null);
  });

  it("opens a request for a row added in the same update", async () => {
    const editCell = signal(null);
    await render({ editCell });
    rows = [...rows, { fid: 40, name: "Regina", population: 226404 }];
    await act(async () => {
      editCell.value = { rowId: 40, columnKey: "name" };
      dom!.root.render(
        React.createElement(TableWidget, {
          rows,
          getRowId: (row: CityRow) => row.fid,
          columns: COLUMNS,
          selectedRowIds,
          activeRowId,
          editCell,
        })
      );
    });
    assert.equal(editors()[0]?.value, "Regina");
    assert.equal(editCell.value, null);
  });
});

describe("TableWidget host cell classes (Ticket #335)", () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("adds the host's classes to the matching cells alongside TableWidget's own", async () => {
    await render({
      readOnly: true,
      cellClassName: (row: CityRow, column: { key: string }) =>
        row.fid === 20 && column.key === "population" ?
          "host-invalid"
        : undefined,
    });
    const marked = cell(20, 1).getAttribute("class")!.split(" ");
    assert.ok(marked.includes("host-invalid"));
    assert.ok(marked.includes("table-widget-cell"));
    assert.ok(marked.includes("table-widget-cell--readonly"));
    assert.deepEqual(cell(20, 0).getAttribute("class")!.split(" ").sort(), [
      "table-widget-cell",
      "table-widget-cell--readonly",
    ]);
  });
});

describe("TableWidget editCell selection and open edits (Ticket #335)", () => {
  beforeEach(() => {
    installHost();
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
  });

  it("makes the requested row the only Selected Row, even when it is already the Active Row", async () => {
    const editCell = signal(null);
    await render({ editCell });
    await fire(cell(10, 0), "click");
    await fire(cell(20, 0), "click", { ctrlKey: true });
    assert.deepEqual(selection(), [10, 20]);
    assert.equal(activeRowId.value, 20);
    await act(async () => {
      editCell.value = { rowId: 20, columnKey: "name" };
    });
    assert.deepEqual(selection(), [20]);
    assert.equal(activeRowId.value, 20);
    assert.equal(editors()[0]?.value, "Montréal");
  });

  it("a request made while another cell is being edited replaces that edit", async () => {
    const editCell = signal(null);
    await render({ editCell });
    await fire(cell(10, 0), "click");
    await fire(cell(10, 0), "dblclick");
    assert.equal(editors()[0]?.value, "Ottawa");
    await act(async () => {
      editCell.value = { rowId: 30, columnKey: "population" };
    });
    const open = editors();
    assert.equal(open.length, 1, "one editor open");
    assert.equal(open[0].value, "439819");
    assert.equal(activeRowId.value, 30);
  });
});
