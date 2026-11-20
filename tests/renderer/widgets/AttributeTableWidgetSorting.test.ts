/**
 * @file AttributeTableWidgetSorting.test.ts
 * @module tests/renderer/widgets/AttributeTableWidgetSorting.test
 * @description Headless component tests for sorting the AttributeTableWidget through the Geospatial Worker (Spec #322 / Ticket #330): header clicks reaching the chunk query as an `orderBy` Sort Key list and reloading from the first chunk, returning to unsorted in source order, the sort resetting when the Active Layer changes, Virtual Field columns staying unsortable, the `#` column sorting by the layer's stored ID column only, selection surviving a sort, a rejected Sort Key clearing the sort, and in-memory sorting before slicing when no `queryExtent` is available.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link AttributeTableWidget}
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

const { AttributeTableWidget } = jiti(
  "@renderer/workbench/widgets/AttributeTableWidget.tsx"
);
const {
  activeLayerIdSignal,
  layersSignal,
  featuresSignal,
  selectedFeatureIdsSignal,
  editedFeatureIdsSignal,
  editableLayerIdsSignal,
} = jiti("@renderer/state/gisSignals.ts");
const { setLogSink, resetLogSink } = jiti("@shared/logging/index.ts");
const { prefsAttributeTableMaxRows } = jiti(
  "@renderer/state/preferencesSignals.ts"
);

/** A worker feature record as `queryExtent` returns it. */
interface WorkerFeature {
  id: number;
  properties: Record<string, unknown>;
  geometryType: string;
  coordinates: number[];
}

/** Five features whose source order differs from their order by name and by population. */
const DATASET: WorkerFeature[] = [
  {
    id: 101,
    properties: { name: "Ottawa", pop: 1017 },
    geometryType: "Point",
    coordinates: [1, 1],
  },
  {
    id: 102,
    properties: { name: "Montréal", pop: 1762 },
    geometryType: "Point",
    coordinates: [2, 2],
  },
  {
    id: 103,
    properties: { name: "Halifax", pop: 439 },
    geometryType: "Point",
    coordinates: [3, 3],
  },
  {
    id: 104,
    properties: { name: "Toronto", pop: 2794 },
    geometryType: "Point",
    coordinates: [4, 4],
  },
  {
    id: 105,
    properties: { name: "Calgary", pop: 1306 },
    geometryType: "Point",
    coordinates: [5, 5],
  },
];

/** Physical schema of the test layers plus one Virtual Field. */
const FIELDS = [
  { name: "name", nativeType: "String", inferredType: "string" },
  { name: "pop", nativeType: "Integer", inferredType: "integer" },
  {
    name: "density",
    nativeType: "Real",
    inferredType: "real",
    isVirtual: true,
  },
];

let dom: MockDom | null = null;
let queryCalls: Array<{ layerId: string; options: any }> = [];

/**
 * @function makeLayer
 * @description Builds a vector test layer with the test schema.
 * @param {string} id - Layer ID.
 * @param {string} [fidColumn=''] - Stored ID column name, empty when the format has none.
 * @returns {any} The layer.
 */
function makeLayer(id: string, fidColumn = ""): any {
  return {
    id,
    name: id,
    kind: "vector",
    geometryKind: "Point",
    visible: true,
    opacity: 1,
    color: "#2563eb",
    featureCount: DATASET.length,
    fidColumn,
    fields: FIELDS,
  };
}

/**
 * @function fakeQueryExtent
 * @description A stand-in for the Geospatial Worker's `queryExtent`: validates Sort Keys like the worker (physical fields or the stored ID column only), orders by them with an ascending ID tiebreaker, then pages with `start` / `max`.
 * @param {string} fidColumn - The layer's stored ID column name, empty when it has none.
 * @returns {(layerId: string, options: any) => Promise<any>} The fake.
 */
function fakeQueryExtent(
  fidColumn = ""
): (layerId: string, options: any) => Promise<any> {
  return async (layerId: string, options: any) => {
    queryCalls.push({ layerId, options });
    const orderBy: Array<[string, "ASC" | "DESC"]> = options?.orderBy ?? [];
    const physical = new Set([
      "name",
      "pop",
      ...(fidColumn ? [fidColumn] : []),
    ]);
    for (const [field] of orderBy) {
      if (!physical.has(field))
        throw new Error(`Unknown Sort Key field: ${field}`);
    }
    const valueOf = (f: WorkerFeature, field: string): any =>
      field === fidColumn ? f.id : f.properties[field];
    const ordered = [...DATASET].sort((a, b) => {
      for (const [field, dir] of orderBy) {
        const x = valueOf(a, field);
        const y = valueOf(b, field);
        const c =
          typeof x === "number" ? x - y : String(x).localeCompare(String(y));
        if (c !== 0) return dir === "ASC" ? c : -c;
      }
      return a.id - b.id;
    });
    const start = options?.start ?? 0;
    const max = options?.max ?? 5000;
    return {
      layerId,
      features: ordered.slice(start, start + max),
      totalMatched: ordered.length,
    };
  };
}

/**
 * @function render
 * @description Renders the AttributeTableWidget into the mock DOM.
 */
async function render(): Promise<void> {
  await act(async () => {
    dom!.root.render(React.createElement(AttributeTableWidget));
  });
}

/**
 * @function headerCells
 * @description Returns the embedded table's header cells, in display order (the `#` column first).
 * @returns {MockElement[]} Header cells.
 */
function headerCells(): MockElement[] {
  return findElementsByClass(dom!.container, "table-widget-header-cell");
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
 * @function click
 * @description Primary-clicks an element inside act.
 * @param {MockElement} el - Element to click.
 * @param {Record<string, unknown>} [init] - Extra event fields (modifier keys).
 */
async function click(
  el: MockElement,
  init: Record<string, unknown> = {}
): Promise<void> {
  await act(async () => {
    el.dispatchEvent({
      type: "click",
      bubbles: true,
      button: 0,
      stopPropagation: () => {},
      ...init,
    });
  });
}

/**
 * @function clickHeader
 * @description Primary-clicks the header cell of the column with the given header text.
 * @param {string} text - Header text.
 */
async function clickHeader(text: string): Promise<void> {
  await click(dataHeader(text));
}

/**
 * @function displayedIds
 * @description Returns the feature ID of each displayed row, in display order.
 * @returns {number[]} Displayed feature IDs.
 */
function displayedIds(): number[] {
  return findElementsByClass(dom!.container, "table-widget-row").map((row) =>
    Number(row.getAttribute("data-row-id"))
  );
}

/**
 * @function isSortable
 * @description Whether a header cell is sortable: it carries a sort chevron.
 * @param {MockElement} header - Header cell.
 * @returns {boolean} True when it shows a sort chevron.
 */
function isSortable(header: MockElement): boolean {
  return findElementsByClass(header, "table-widget-sort-icon").length > 0;
}

/**
 * @function lastQuery
 * @description Returns the options of the most recent `queryExtent` call.
 * @returns {any} Query options.
 */
function lastQuery(): any {
  assert.ok(queryCalls.length > 0, "queryExtent was called");
  return queryCalls[queryCalls.length - 1].options;
}

describe("AttributeTableWidget sorting through the Geospatial Worker (Ticket #330)", () => {
  beforeEach(() => {
    dom = installMockDom();
    queryCalls = [];
    prefsAttributeTableMaxRows.value = 2;
    featuresSignal.value = [];
    selectedFeatureIdsSignal.value = new Set();
    editedFeatureIdsSignal.value = new Set();
    editableLayerIdsSignal.value = new Set();
    layersSignal.value = [
      makeLayer("layer-a"),
      makeLayer("layer-b"),
      makeLayer("layer-gpkg", "fid"),
    ];
    activeLayerIdSignal.value = "layer-a";
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
    activeLayerIdSignal.value = null;
    layersSignal.value = [];
    featuresSignal.value = [];
    selectedFeatureIdsSignal.value = new Set();
    prefsAttributeTableMaxRows.value = 5000;
  });

  it("makes physical attribute columns sortable and keeps Virtual Field columns unsortable", async () => {
    dom!.win.electronAPI.queryExtent = fakeQueryExtent();
    await render();
    assert.equal(isSortable(dataHeader("name")), true);
    assert.equal(isSortable(dataHeader("pop")), true);
    assert.equal(isSortable(dataHeader("density")), false);

    const calls = queryCalls.length;
    await clickHeader("density");
    assert.equal(
      queryCalls.length,
      calls,
      "clicking a Virtual Field header does not query"
    );
    assert.equal(lastQuery().orderBy, undefined);
  });

  it("sends the sort to the chunk query as orderBy and reloads from the first chunk", async () => {
    dom!.win.electronAPI.queryExtent = fakeQueryExtent();
    await render();
    assert.equal(
      lastQuery().orderBy,
      undefined,
      "unsorted queries omit orderBy"
    );
    assert.deepEqual(displayedIds(), [101, 102]);

    // Go to the second chunk, then sort: the table reloads from the first chunk.
    await click(
      findElementsByClass(dom!.container, "attribute-table-page-next")[0]
    );
    assert.equal(lastQuery().start, 2);
    assert.deepEqual(displayedIds(), [103, 104]);

    await clickHeader("pop");
    assert.deepEqual(lastQuery().orderBy, [["pop", "ASC"]]);
    assert.equal(lastQuery().start, 0);
    assert.deepEqual(displayedIds(), [103, 101]);

    await clickHeader("pop");
    assert.deepEqual(lastQuery().orderBy, [["pop", "DESC"]]);
    assert.equal(lastQuery().start, 0);
    assert.deepEqual(displayedIds(), [104, 102]);
  });

  it("replaces the Sort Key when another column is clicked", async () => {
    dom!.win.electronAPI.queryExtent = fakeQueryExtent();
    await render();
    await clickHeader("pop");
    await clickHeader("name");
    assert.deepEqual(lastQuery().orderBy, [["name", "ASC"]]);
    assert.deepEqual(displayedIds(), [105, 103]);
    assert.equal(dataHeader("pop").getAttribute("aria-sort"), "none");
    assert.equal(dataHeader("name").getAttribute("aria-sort"), "ascending");
  });

  it("reloads in source order from the first chunk when returning to unsorted", async () => {
    dom!.win.electronAPI.queryExtent = fakeQueryExtent();
    await render();
    await clickHeader("name");
    await click(
      findElementsByClass(dom!.container, "attribute-table-page-next")[0]
    );
    assert.equal(lastQuery().start, 2);

    await clickHeader("name");
    await clickHeader("name");
    assert.equal(lastQuery().orderBy, undefined);
    assert.equal(lastQuery().start, 0);
    assert.deepEqual(displayedIds(), [101, 102]);
  });

  it("resets the sort when the Active Layer changes", async () => {
    dom!.win.electronAPI.queryExtent = fakeQueryExtent();
    await render();
    await clickHeader("pop");
    assert.deepEqual(lastQuery().orderBy, [["pop", "ASC"]]);

    const calls = queryCalls.length;
    await act(async () => {
      activeLayerIdSignal.value = "layer-b";
    });
    const layerBCalls = queryCalls.slice(calls);
    assert.ok(layerBCalls.length > 0, "the new layer is queried");
    for (const call of layerBCalls) {
      assert.equal(call.layerId, "layer-b");
      assert.equal(
        call.options.orderBy,
        undefined,
        "the new layer is never queried with the old sort"
      );
    }
    assert.equal(dataHeader("pop").getAttribute("aria-sort"), "none");
    assert.deepEqual(displayedIds(), [101, 102]);
  });

  it("keeps the # column unsortable when the layer has no stored ID column", async () => {
    dom!.win.electronAPI.queryExtent = fakeQueryExtent();
    await render();
    const counter = headerCells()[0];
    assert.equal(isSortable(counter), false);
    const calls = queryCalls.length;
    await click(counter);
    assert.equal(queryCalls.length, calls);
  });

  it("sorts the # column by the layer's reported stored ID column name", async () => {
    dom!.win.electronAPI.queryExtent = fakeQueryExtent("fid");
    activeLayerIdSignal.value = "layer-gpkg";
    await render();
    const idHeader = headerCells()[0];
    assert.equal(textOf(idHeader), "fid");
    assert.equal(isSortable(idHeader), true);

    await click(idHeader);
    assert.deepEqual(lastQuery().orderBy, [["fid", "ASC"]]);
    await click(headerCells()[0]);
    assert.deepEqual(lastQuery().orderBy, [["fid", "DESC"]]);
    assert.deepEqual(displayedIds(), [105, 104]);
  });

  it("keeps the selection across chunks after sorting", async () => {
    dom!.win.electronAPI.queryExtent = fakeQueryExtent();
    await render();
    // Toronto (104) is on the second chunk in source order.
    await act(async () => {
      selectedFeatureIdsSignal.value = new Set([104]);
    });
    const selectedRows = (): number[] =>
      findElementsByClass(dom!.container, "table-widget-row")
        .filter((row) => row.getAttribute("aria-selected") === "true")
        .map((row) => Number(row.getAttribute("data-row-id")));
    assert.deepEqual(selectedRows(), []);

    // Sorting by population descending brings it to the first chunk, still selected.
    await clickHeader("pop");
    await clickHeader("pop");
    assert.deepEqual(displayedIds(), [104, 102]);
    assert.deepEqual(selectedRows(), [104]);

    // Ctrl+clicking another row adds it to the selection that spans chunks.
    const [, montreal] = findElementsByClass(
      dom!.container,
      "table-widget-row"
    );
    await click(montreal, { ctrlKey: true });
    assert.deepEqual([...selectedFeatureIdsSignal.value].sort(), [102, 104]);

    // On the next chunk neither is shown, and both stay selected.
    await click(
      findElementsByClass(dom!.container, "attribute-table-page-next")[0]
    );
    assert.deepEqual(displayedIds(), [105, 101]);
    assert.deepEqual(selectedRows(), []);
    assert.deepEqual([...selectedFeatureIdsSignal.value].sort(), [102, 104]);
  });

  it("clears the sort and logs an error when the worker rejects the Sort Key", async () => {
    const worker = fakeQueryExtent();
    dom!.win.electronAPI.queryExtent = async (
      layerId: string,
      options: any
    ) => {
      if (options?.orderBy?.some(([field]: [string]) => field === "name")) {
        queryCalls.push({ layerId, options });
        throw new Error('Sort Key field "name" is not a field of the layer');
      }
      return worker(layerId, options);
    };
    await render();
    const payloads: any[] = [];
    setLogSink((payload: any) => payloads.push(payload));
    try {
      await clickHeader("name");
      await act(async () => {});
    } finally {
      resetLogSink();
    }

    assert.equal(
      dataHeader("name").getAttribute("aria-sort"),
      "none",
      "the sort is cleared"
    );
    assert.equal(lastQuery().orderBy, undefined, "the table reloads unsorted");
    assert.deepEqual(displayedIds(), [101, 102]);
    assert.ok(
      payloads.some(
        (payload) =>
          payload.level === "error"
          && payload.meta?.some(
            (item: any) =>
              Array.isArray(item?.fields) && item.fields.includes("name")
          )
      ),
      "an error naming the field is logged"
    );
  });

  it("sorts all features before slicing the page when queryExtent is unavailable", async () => {
    featuresSignal.value = DATASET.map((f) => ({ ...f, layerId: "layer-a" }));
    await render();
    assert.deepEqual(displayedIds(), [101, 102]);

    await clickHeader("pop");
    assert.deepEqual(displayedIds(), [103, 101]);
    await clickHeader("pop");
    assert.deepEqual(displayedIds(), [104, 102]);
    await click(
      findElementsByClass(dom!.container, "attribute-table-page-next")[0]
    );
    assert.deepEqual(displayedIds(), [105, 101]);
    await clickHeader("pop");
    assert.deepEqual(
      displayedIds(),
      [101, 102],
      "unsorted shows the source order from the first page"
    );
  });
});
