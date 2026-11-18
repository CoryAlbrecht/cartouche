/**
 * @file LayerPropertiesFieldsTables.test.ts
 * @module tests/renderer/dialogs/LayerPropertiesFieldsTables.test
 * @description Headless tests of the LayerPropertiesDialog fields tables as embedded TableWidgets (Spec #322 / Ticket #331): the Information tab's read-only fields table and the Fields tab's table, with their columns and values, header bars hidden, sorting turned off, row selection driving Delete Selected Field, Layer Edit Mode gating the Length, Precision and Comment edits, edits reaching the draft, and the per-field type select and reset button not changing the row selection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see {@link LayerPropertiesDialog}
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
  textOf,
  type MockDom,
  type MockElement,
} from "../mockDom";

const jiti = createRendererJiti(import.meta.url);

const { LayerPropertiesDialog } = jiti(
  "@renderer/workbench/dialogs/LayerPropertiesDialog.tsx"
);
const {
  activeLayerPropertiesTabSignal,
  layerPropertiesDraftSignal,
  openLayerPropertiesDialog,
  closeLayerPropertiesDialog,
} = jiti("@renderer/state/layerPropertiesSignals.ts");
const { projectLayersSignal, projectTreeSignal } = jiti(
  "@renderer/state/projectSignals.ts"
);
const { editableLayerIdsSignal } = jiti("@renderer/state/gisSignals.ts");
const { dictionarySignal } = jiti("@renderer/state/i18nSignals.ts");
const { preferencesMapSignal } = jiti("@renderer/state/preferencesSignals.ts");

const LAYER_ID = "layer-fields-tables-331";

/** The layer's fields: a string, an integer and a real, in index order. */
const FIELDS = [
  {
    index: 0,
    name: "city",
    nativeType: "String",
    inferredType: "string",
    originalInferredType: "string",
    width: 80,
    precision: 0,
    comment: "Town name",
    nullable: true,
    userOverridden: false,
  },
  {
    index: 1,
    name: "pop",
    nativeType: "Integer",
    inferredType: "integer",
    originalInferredType: "integer",
    width: 10,
    precision: 0,
    comment: "",
    nullable: false,
    userOverridden: false,
  },
  {
    index: 2,
    name: "area",
    nativeType: "Real",
    inferredType: "real",
    originalInferredType: "real",
    width: 18,
    precision: 6,
    comment: "km²",
    nullable: true,
    userOverridden: false,
  },
];

let dom: MockDom | null = null;

/**
 * @function nativeEvent
 * @description Builds a bubbling native event for the mock DOM, recording `preventDefault` in `defaultPrevented`.
 * @param {string} type - Event type.
 * @param {Record<string, unknown>} [fields] - Event fields, e.g. `key` and modifier keys.
 * @returns {Record<string, unknown>} The event.
 */
function nativeEvent(
  type: string,
  fields: Record<string, unknown> = {}
): Record<string, unknown> {
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
  return event;
}

/**
 * @function fire
 * @description Dispatches a native event on an element inside `act`.
 * @param {MockElement} el - Target element.
 * @param {string} type - Event type.
 * @param {Record<string, unknown>} [fields] - Event fields.
 */
async function fire(
  el: MockElement,
  type: string,
  fields: Record<string, unknown> = {}
): Promise<void> {
  await act(async () => {
    el.dispatchEvent(nativeEvent(type, fields));
  });
}

/**
 * @function renderTab
 * @description Opens the dialog on the test layer at a tab and renders it into the mock DOM.
 * @param {string} tab - Tab ID.
 */
async function renderTab(tab: string): Promise<void> {
  await openLayerPropertiesDialog(LAYER_ID);
  activeLayerPropertiesTabSignal.value = tab;
  await act(async () => {
    dom!.root.render(React.createElement(LayerPropertiesDialog));
  });
}

/**
 * @function tables
 * @description Returns every embedded TableWidget.
 * @returns {MockElement[]} TableWidget roots.
 */
function tables(): MockElement[] {
  return findElementsByClass(dom!.doc.body, "table-widget");
}

/**
 * @function headers
 * @description Returns the header texts of the one embedded TableWidget.
 * @returns {string[]} Header texts.
 */
function headers(): string[] {
  return findElementsByClass(tables()[0], "table-widget-header-cell").map(
    (th) => textOf(th)
  );
}

/**
 * @function rowCells
 * @description Returns the data cell texts of each displayed row, top to bottom.
 * @returns {string[][]} Cell texts by row.
 */
function rowCells(): string[][] {
  return findElementsByClass(tables()[0], "table-widget-row").map((tr) =>
    findElementsByClass(tr, "table-widget-cell").map((td) => textOf(td))
  );
}

/**
 * @function row
 * @description Returns the displayed row of a field.
 * @param {string} name - Field name (the row ID).
 * @returns {MockElement} Row element.
 */
function row(name: string): MockElement {
  const found = findElementsByClass(tables()[0], "table-widget-row").find(
    (tr) => tr.getAttribute("data-row-id") === name
  );
  assert.ok(found, `row ${name} rendered`);
  return found;
}

/**
 * @function cell
 * @description Returns a field's data cell by column index.
 * @param {string} name - Field name.
 * @param {number} columnIndex - Index among the data columns.
 * @returns {MockElement} Cell element.
 */
function cell(name: string, columnIndex: number): MockElement {
  return findElementsByClass(row(name), "table-widget-cell")[columnIndex];
}

/**
 * @function toolbarButton
 * @description Returns a Fields tab toolbar button by its class.
 * @param {string} className - Button class, e.g. `delete-field`.
 * @returns {MockElement} Button element.
 */
function toolbarButton(className: string): MockElement {
  const button = findElementsByClass(dom!.doc.body, className)[0];
  assert.ok(button, `${className} button rendered`);
  return button;
}

/**
 * @function isDisabled
 * @description Whether a mock button is disabled, however React wrote the attribute.
 * @param {MockElement} el - Button element.
 * @returns {boolean} True when disabled.
 */
function isDisabled(el: MockElement): boolean {
  return Boolean((el as any).disabled);
}

/**
 * @function reactProps
 * @description Reads the React props of a rendered element, for control state the mock DOM does not model (a select's value).
 * @param {MockElement} el - Rendered element.
 * @returns {any} The element's React props.
 */
function reactProps(el: MockElement): any {
  const propsKey = Object.keys(el).find((k) => k.startsWith("__reactProps"))!;
  return (el as any)[propsKey];
}

/**
 * @function type
 * @description Types new text into an editor input through its React change handler.
 * @param {MockElement} input - Editor input.
 * @param {string} text - The input's new text.
 */
async function type(input: MockElement, text: string): Promise<void> {
  await act(async () => {
    input.value = text;
    reactProps(input).onChange({ target: input, currentTarget: input });
  });
}

/**
 * @function editField
 * @description Double-clicks a cell, types a value into its editor and presses Enter.
 * @param {string} name - Field name.
 * @param {number} columnIndex - Index among the data columns.
 * @param {string} text - Text to enter.
 */
async function editField(
  name: string,
  columnIndex: number,
  text: string
): Promise<void> {
  const target = cell(name, columnIndex);
  await fire(target, "click");
  await fire(target, "dblclick");
  const input = findElementsByClass(dom!.doc.body, "table-widget-editor")[0];
  assert.ok(input, "cell editor open");
  await type(input, text);
  await fire(input, "focusin");
  await fire(input, "keydown", { key: "Enter" });
}

/**
 * @function draftField
 * @description Reads a field from the dialog's draft.
 * @param {string} name - Field name.
 * @returns {any} The draft field.
 */
function draftField(name: string): any {
  return layerPropertiesDraftSignal.value.fields.find(
    (f: any) => f.name === name
  );
}

beforeEach(() => {
  dom = installMockDom();
  dom.win.electronAPI = {
    getLayerInfo: async () => ({
      layerId: LAYER_ID,
      name: "Towns",
      geometryKind: "Point",
      fields: FIELDS,
    }),
    setPreferenceValue: async () => ({}),
  };
  dictionarySignal.value = {
    layer_properties_field_col_index: "Index",
    layer_properties_field_col_name: "Field Name",
    layer_properties_field_col_native_type: "Native Type",
    layer_properties_field_col_inferred_type: "Inferred Type",
    layer_properties_fields_col_data_type: "Data Type",
    layer_properties_field_col_length: "Length",
    layer_properties_field_col_precision: "Precision",
    layer_properties_field_col_nullable: "Nullable",
    layer_properties_fields_col_comment: "Comment",
    layer_properties_yes: "Yes",
    layer_properties_no: "No",
  };
  preferencesMapSignal.value = {};
  editableLayerIdsSignal.value = new Set();
  const layer = {
    id: LAYER_ID,
    name: "Towns",
    type: "vector",
    source: "/data/towns.shp",
    fields: FIELDS,
  };
  projectLayersSignal.value = [layer];
  projectTreeSignal.value = [layer];
});

afterEach(() => {
  closeLayerPropertiesDialog();
  editableLayerIdsSignal.value = new Set();
  teardownMockDom(dom);
  dom = null;
});

describe("LayerPropertiesDialog Information tab fields table (Ticket #331)", () => {
  it("shows the fields in one embedded TableWidget with its header bar hidden", async () => {
    await renderTab("information");

    assert.equal(tables().length, 1, "one TableWidget");
    assert.equal(
      findElementsByClass(tables()[0], "basic-widget-header").length,
      0,
      "header bar hidden"
    );
    assert.deepEqual(headers(), [
      "Field Name",
      "Native Type",
      "Inferred Type",
      "Length",
      "Precision",
      "Nullable",
    ]);
    assert.deepEqual(rowCells(), [
      ["city", "String", "string", "80", "", "Yes"],
      ["pop", "Integer", "integer", "10", "", "No"],
      ["area", "Real", "real", "18", "6", "Yes"],
    ]);
  });
});

describe("LayerPropertiesDialog Fields tab table (Ticket #331)", () => {
  it("shows the fields in one embedded TableWidget with its header bar hidden and no Row Number Column", async () => {
    await renderTab("fields");

    assert.equal(tables().length, 1, "one TableWidget");
    assert.equal(
      findElementsByClass(tables()[0], "basic-widget-header").length,
      0,
      "header bar hidden"
    );
    assert.equal(
      findElementsByClass(tables()[0], "table-widget-row-number").length,
      0,
      "no Row Number Column"
    );
    assert.deepEqual(headers(), [
      "Index",
      "Field Name",
      "Data Type",
      "Length",
      "Precision",
      "Comment",
    ]);
    const withoutType = rowCells().map((cells) =>
      cells.filter((_, i) => i !== 2)
    );
    assert.deepEqual(withoutType, [
      ["0", "city", "80", "", "Town name"],
      ["1", "pop", "10", "", ""],
      ["2", "area", "18", "6", "km²"],
    ]);
    const selects = findElementsByClass(tables()[0], "layer-field-type-select");
    assert.deepEqual(
      selects.map((s) => reactProps(s).value),
      ["string", "integer", "real"],
      "Data Type select per field"
    );
  });

  it("adds the Native Type column after Data Type when Show Native Type is on", async () => {
    preferencesMapSignal.value = {
      "ui.layerProperties.fields.showNativeType": {
        value: true,
        defaultValue: false,
        category: "ui",
        hidden: true,
      },
    };
    await renderTab("fields");

    assert.deepEqual(headers(), [
      "Index",
      "Field Name",
      "Data Type",
      "Native Type",
      "Length",
      "Precision",
      "Comment",
    ]);
    assert.deepEqual(
      rowCells().map((cells) => cells[3]),
      ["String", "Integer", "Real"]
    );
  });
});

describe("LayerPropertiesDialog fields tables do not sort (Ticket #331)", () => {
  for (const tab of ["information", "fields"]) {
    it(`the ${tab} tab table shows no sort chevrons and header clicks leave the row order unchanged`, async () => {
      await renderTab(tab);
      const headerCells = findElementsByClass(
        tables()[0],
        "table-widget-header-cell"
      );
      const nameColumn = tab === "fields" ? 1 : 0;

      assert.equal(
        findElementsByClass(tables()[0], "table-widget-sort-icon").length,
        0,
        "no sort chevrons"
      );
      for (const th of headerCells) {
        assert.equal(th.getAttribute("aria-sort"), null, "no sort state");
      }
      for (const th of headerCells) {
        await fire(th, "click");
        await fire(th, "click");
      }
      assert.deepEqual(
        rowCells().map((cells) => cells[nameColumn]),
        ["city", "pop", "area"],
        "rows stay in field order"
      );
      assert.equal(
        findElementsByClass(tables()[0], "table-widget-sort-icon").length,
        0,
        "still no sort chevrons"
      );
    });
  }
});

describe("LayerPropertiesDialog Fields tab selection and Delete Selected Field (Ticket #331)", () => {
  it("enables Delete Selected Field in Layer Edit Mode once a row is selected, and deletes it from the draft", async () => {
    editableLayerIdsSignal.value = new Set([LAYER_ID]);
    await renderTab("fields");
    assert.ok(
      isDisabled(toolbarButton("delete-field")),
      "disabled with no selection"
    );

    await fire(cell("pop", 1), "click");
    assert.equal(
      row("pop").getAttribute("aria-selected"),
      "true",
      "clicked row selected"
    );
    assert.ok(
      !isDisabled(toolbarButton("delete-field")),
      "enabled with a selection"
    );

    await fire(toolbarButton("delete-field"), "click");
    assert.deepEqual(
      layerPropertiesDraftSignal.value.fields.map((f: any) => f.name),
      ["city", "area"],
      "selected field removed from the draft"
    );
    assert.deepEqual(
      rowCells().map((cells) => cells[1]),
      ["city", "area"]
    );
    assert.ok(
      isDisabled(toolbarButton("delete-field")),
      "selection cleared after deleting"
    );
  });

  it("deletes every Selected Row", async () => {
    editableLayerIdsSignal.value = new Set([LAYER_ID]);
    await renderTab("fields");

    await fire(cell("city", 1), "click");
    await fire(cell("area", 1), "click", { ctrlKey: true });
    await fire(toolbarButton("delete-field"), "click");

    assert.deepEqual(
      layerPropertiesDraftSignal.value.fields.map((f: any) => f.name),
      ["pop"]
    );
  });

  it("keeps Delete Selected Field disabled outside Layer Edit Mode even with a selection", async () => {
    await renderTab("fields");

    await fire(cell("pop", 1), "click");
    assert.equal(
      row("pop").getAttribute("aria-selected"),
      "true",
      "read-only table still selects"
    );
    assert.ok(isDisabled(toolbarButton("delete-field")));
  });

  it("clicking the Data Type select or Reset Type button leaves the row selection alone", async () => {
    editableLayerIdsSignal.value = new Set([LAYER_ID]);
    await renderTab("fields");
    await fire(cell("city", 1), "click");

    const select = findElementsByClass(
      row("pop"),
      "layer-field-type-select"
    )[0];
    await fire(select, "click");
    await act(async () => {
      reactProps(select).onChange({ target: { value: "real" } });
    });
    const reset = findElementsByClass(
      row("pop"),
      "layer-field-reset-type-btn"
    )[0];
    assert.ok(!isDisabled(reset), "Reset Type enabled on the overridden field");
    await fire(reset, "click");

    assert.equal(draftField("pop").inferredType, "integer", "type reset");
    assert.equal(row("city").getAttribute("aria-selected"), "true");
    assert.equal(row("pop").getAttribute("aria-selected"), "false");
  });
});

describe("LayerPropertiesDialog Fields tab editing (Ticket #331)", () => {
  it("stages an edited Length, Precision and Comment in the draft as a user override", async () => {
    editableLayerIdsSignal.value = new Set([LAYER_ID]);
    await renderTab("fields");

    await editField("area", 3, "24");
    await editField("area", 4, "8");
    await editField("area", 5, "Square kilometres");

    const area = draftField("area");
    assert.equal(area.width, 24);
    assert.equal(area.precision, 8);
    assert.equal(area.comment, "Square kilometres");
    assert.equal(area.userOverridden, true);
    assert.deepEqual(
      rowCells()[2].filter((_, i) => i !== 2),
      ["2", "area", "24", "8", "Square kilometres"]
    );
  });

  it("clears a Length to empty", async () => {
    editableLayerIdsSignal.value = new Set([LAYER_ID]);
    await renderTab("fields");

    await editField("city", 3, "");

    assert.equal(draftField("city").width, undefined);
    assert.equal(rowCells()[0][3], "");
  });

  it("rejects a Length that is not a whole number, keeping the old value", async () => {
    editableLayerIdsSignal.value = new Set([LAYER_ID]);
    await renderTab("fields");

    await editField("city", 3, "wide");

    assert.equal(draftField("city").width, 80);
    assert.equal(
      draftField("city").userOverridden,
      false,
      "no override recorded"
    );
    assert.equal(rowCells()[0][3], "80");
  });

  it("opens no editor outside Layer Edit Mode", async () => {
    await renderTab("fields");

    await fire(cell("city", 5), "click");
    await fire(cell("city", 5), "dblclick");

    assert.equal(
      findElementsByClass(dom!.doc.body, "table-widget-editor").length,
      0
    );
  });

  it("opens no editor on a column the field type does not allow (Precision of a string)", async () => {
    editableLayerIdsSignal.value = new Set([LAYER_ID]);
    await renderTab("fields");

    await fire(cell("city", 4), "click");
    await fire(cell("city", 4), "dblclick");
    assert.equal(
      findElementsByClass(dom!.doc.body, "table-widget-editor").length,
      0,
      "string Precision read-only"
    );

    await fire(cell("city", 1), "dblclick");
    assert.equal(
      findElementsByClass(dom!.doc.body, "table-widget-editor").length,
      0,
      "Field Name read-only"
    );
  });

  it("changes a field type through its Data Type select", async () => {
    editableLayerIdsSignal.value = new Set([LAYER_ID]);
    await renderTab("fields");

    const select = findElementsByClass(
      row("pop"),
      "layer-field-type-select"
    )[0];
    await act(async () => {
      reactProps(select).onChange({ target: { value: "real" } });
    });

    assert.equal(draftField("pop").inferredType, "real");
    assert.equal(draftField("pop").userOverridden, true);
    assert.equal(
      findElementsByClass(row("pop"), "layer-field-override-badge").length,
      1,
      "User badge shown"
    );
  });
});
