/**
 * @file AttributeTableWidget.test.ts
 * @module tests/renderer/widgets/AttributeTableWidget.test
 * @description Unit and component tests verifying AttributeTableWidget header toolbars, scaling, grabber suppression, and reactive synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see {@link AttributeTableWidget}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRendererJiti } from "../rendererJiti";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AttributeTableWidgetProps } from "../../../src/renderer/workbench/widgets/AttributeTableWidget";
import type { GisLayer } from "../../../src/renderer/state/gisSignals";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Lightweight mock DOM Element representation for headless React 19 testing in Node.js.
 */
class MockElement {
  nodeType = 1;
  tagName: string;
  nodeName: string;
  ownerDocument: any = null;
  parentNode: any = null;
  childNodes: any[] = [];
  style: Record<string, string> & {
    setProperty: (name: string, val: string) => void;
    removeProperty: (name: string) => void;
    getPropertyValue: (name: string) => string;
  };
  className = "";
  private _textContent?: string;
  attributes: Record<string, string> = {};
  eventListeners: Record<
    string,
    Array<{ cb: (e: any) => void; capture: boolean }>
  > = {};

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
    const styleProps: Record<string, string> = {};
    this.style = Object.assign(styleProps, {
      setProperty: (name: string, val: string) => {
        styleProps[name] = String(val);
      },
      removeProperty: (name: string) => {
        delete styleProps[name];
      },
      getPropertyValue: (name: string) => styleProps[name] || "",
    });
  }

  focus(): void {}
  blur(): void {}

  getContext(contextId: string): any {
    if (contextId === "2d") {
      return {
        font: "",
        measureText: (text: string) => ({ width: String(text).length * 8 }),
      };
    }
    return null;
  }

  get textContent(): string {
    if (this._textContent !== undefined) return this._textContent;
    let text = "";
    for (const child of this.childNodes) {
      if (child.nodeType === 3) {
        text += child.textContent || child.nodeValue || "";
      } else if (child.textContent) {
        text += child.textContent;
      }
    }
    return text;
  }

  set textContent(v: string) {
    this._textContent = String(v);
  }

  get value(): string {
    if (this.tagName === "SELECT") {
      const selected = this.options.find((o: any) => o.selected);
      if (selected) return selected.value;
      if (this.options.length > 0) return this.options[0].value;
    }
    return (this as any).__value ?? this.attributes["value"] ?? "";
  }

  set value(v: any) {
    (this as any).__value = String(v);
  }

  get options(): any[] {
    const opts: any[] = [];
    const traverse = (el: MockElement) => {
      for (const child of el.childNodes) {
        if (child && child.tagName === "OPTION") {
          opts.push(child);
        } else if (child && child.childNodes) {
          traverse(child);
        }
      }
    };
    traverse(this);
    return opts;
  }

  get type(): string {
    return (this as any).__type ?? this.attributes["type"] ?? "";
  }

  set type(v: any) {
    (this as any).__type = String(v);
    this.attributes["type"] = String(v);
  }

  get title(): string {
    return (this as any).__title ?? this.attributes["title"] ?? "";
  }

  set title(v: any) {
    (this as any).__title = String(v);
    this.attributes["title"] = String(v);
  }

  setAttribute(name: string, val: any): void {
    this.attributes[name] = String(val);
    if (name === "class") this.className = String(val);
    if (name === "id") (this as any).id = String(val);
    if (name === "value") (this as any).__value = String(val);
    if (name === "type") (this as any).__type = String(val);
    if (name === "title") (this as any).__title = String(val);
  }

  getAttribute(name: string): string | null {
    if (name === "class") return this.className || null;
    if (name === "id") return (this as any).id || null;
    if (name === "type")
      return (this as any).__type ?? this.attributes["type"] ?? null;
    if (name === "title")
      return (this as any).__title ?? this.attributes["title"] ?? null;
    return this.attributes[name] ?? null;
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
    if (name === "class") this.className = "";
    if (name === "id") delete (this as any).id;
    if (name === "title") delete (this as any).__title;
  }

  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }

  appendChild(child: any): any {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: any): any {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  insertBefore(newChild: any, refChild: any): any {
    if (!refChild) return this.appendChild(newChild);
    const idx = this.childNodes.indexOf(refChild);
    if (idx !== -1) {
      if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
      newChild.parentNode = this;
      this.childNodes.splice(idx, 0, newChild);
    }
    return newChild;
  }

  addEventListener(type: string, cb: (e: any) => void, capture = false): void {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push({ cb, capture });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(
      (l) => l.cb !== cb
    );
  }

  dispatchEvent(event: any): boolean {
    event.target = event.target || this;
    event.currentTarget = this;
    const origStop = event.stopPropagation;
    event.stopPropagation = () => {
      event.cancelBubble = true;
      if (origStop) origStop.call(event);
    };
    const listeners = (this.eventListeners[event.type] || []).slice();
    for (const { cb } of listeners) {
      cb(event);
    }
    if (event.bubbles !== false && this.parentNode && !event.cancelBubble) {
      this.parentNode.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  contains(node: any): boolean {
    if (node === this) return true;
    for (const child of this.childNodes) {
      if (child.contains && child.contains(node)) return true;
    }
    return false;
  }

  getBoundingClientRect(): {
    width: number;
    height: number;
    top: number;
    left: number;
    right: number;
    bottom: number;
  } {
    return {
      width: 300,
      height: 200,
      top: 0,
      left: 0,
      right: 300,
      bottom: 200,
    };
  }
}

let doc: any;
let container: MockElement;
let root: Root | null = null;
let windowListeners: Record<
  string,
  Array<{ cb: (e: any) => void; capture: boolean }>
> = {};

function setupDom(): void {
  windowListeners = {};
  const documentElement = new MockElement("html");
  const body = new MockElement("body");
  documentElement.appendChild(body);

  doc = {
    nodeType: 9,
    oninput: null,
    onchange: null,
    documentElement,
    body,
    createElement: (tag: string) => {
      const el = new MockElement(tag);
      el.ownerDocument = doc;
      return el;
    },
    createElementNS: (_ns: string, tag: string) => {
      const el = new MockElement(tag);
      el.ownerDocument = doc;
      return el;
    },
    createTextNode: (text: string) => {
      const node = {
        nodeType: 3,
        nodeValue: String(text),
        textContent: String(text),
        ownerDocument: doc,
        parentNode: null as any,
      };
      return node;
    },
    createComment: (data: string) => ({
      nodeType: 8,
      data,
      ownerDocument: doc,
      parentNode: null,
    }),
    addEventListener: (
      type: string,
      cb: (e: any) => void,
      capture?: boolean
    ) => {
      if (!windowListeners[type]) windowListeners[type] = [];
      windowListeners[type].push({ cb, capture: Boolean(capture) });
    },
    removeEventListener: (type: string, cb: (e: any) => void) => {
      if (!windowListeners[type]) return;
      windowListeners[type] = windowListeners[type].filter((l) => l.cb !== cb);
    },
    defaultView: null as any,
  };
  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;

  const win: any = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: (
      type: string,
      cb: (e: any) => void,
      capture?: boolean
    ) => {
      if (!windowListeners[type]) windowListeners[type] = [];
      windowListeners[type].push({ cb, capture: Boolean(capture) });
    },
    removeEventListener: (type: string, cb: (e: any) => void) => {
      if (!windowListeners[type]) return;
      windowListeners[type] = windowListeners[type].filter((l) => l.cb !== cb);
    },
    document: doc,
    HTMLElement: MockElement,
    Element: MockElement,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
  };

  doc.defaultView = win;
  (globalThis as any).window = win;
  (globalThis as any).document = doc;
  (globalThis as any).HTMLIFrameElement = win.HTMLIFrameElement = class {};
  (globalThis as any).HTMLElement = MockElement;
  (globalThis as any).Element = MockElement;
  (globalThis as any).Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
  };
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  container = doc.createElement("div");
  body.appendChild(container);
  root = createRoot(container as any);
}

function tearDownDom(): void {
  if (root) {
    try {
      act(() => {
        root!.unmount();
      });
    } catch {
      // Ignored
    }
    root = null;
  }
}

function findAllNodes(
  rootNode: MockElement,
  predicate: (el: MockElement) => boolean
): MockElement[] {
  const result: MockElement[] = [];
  if (predicate(rootNode)) result.push(rootNode);
  for (const child of rootNode.childNodes) {
    if (child && child.nodeType === 1) {
      result.push(...findAllNodes(child, predicate));
    }
  }
  return result;
}

const jiti = createRendererJiti(import.meta.url);

const {
  AttributeTableWidget,
  AttributeTablePanel,
  isFeatureInExtent,
  getFeatureBoundingBox,
  computeAttributeTableMinHeight,
} = jiti(
  "../../../src/renderer/workbench/widgets/AttributeTableWidget.tsx"
) as {
  AttributeTableWidget: React.FC<AttributeTableWidgetProps>;
  AttributeTablePanel: React.FC<AttributeTableWidgetProps>;
  isFeatureInExtent: (
    feature: any,
    extent: [number, number, number, number]
  ) => boolean;
  getFeatureBoundingBox: (
    coords: unknown
  ) => [number, number, number, number] | null;
  computeAttributeTableMinHeight: () => string;
};

const {
  activeLayerIdSignal,
  layersSignal,
  projectLayersSignal,
  projectTreeSignal,
  featuresSignal,
  activeToolSignal,
  activeSelectionModeSignal,
  editableLayerIdsSignal,
  selectedFeatureIdsSignal,
  editedFeatureIdsSignal,
  isProjectDirtySignal,
  viewportExtentSignal,
  openDockPanelsSignal,
  saveActiveLayerAction,
  toggleLayerEditingAction,
} = jiti("../../../src/renderer/state/gisSignals.ts") as {
  activeLayerIdSignal: { value: string | null };
  layersSignal: { value: GisLayer[] };
  projectLayersSignal: { value: GisLayer[] };
  projectTreeSignal: { value: any[] };
  featuresSignal: { value: any[] };
  activeToolSignal: { value: string };
  activeSelectionModeSignal: { value: string };
  editableLayerIdsSignal: { value: Set<string> };
  selectedFeatureIdsSignal: { value: Set<string | number> };
  editedFeatureIdsSignal: { value: Set<string | number> };
  isProjectDirtySignal: { value: boolean };
  viewportExtentSignal: { value: [number, number, number, number] };
  openDockPanelsSignal: { value: { attributes: boolean; layers: boolean } };
  saveActiveLayerAction: () => void;
  toggleLayerEditingAction: (layerId?: string | null, options?: any) => void;
};

const { dictionarySignal, activeLocaleSignal } = jiti(
  "../../../src/renderer/state/i18nSignals.ts"
) as {
  dictionarySignal: { value: Record<string, string> };
  activeLocaleSignal: { value: string };
};

describe("AttributeTableWidget Header Embedded Toolbars (Ticket #176)", () => {
  beforeEach(() => {
    setupDom();
    activeLayerIdSignal.value = null;
    layersSignal.value = [];
    projectLayersSignal.value = [];
    projectTreeSignal.value = [];
    featuresSignal.value = [];
    activeToolSignal.value = "pan";
    activeSelectionModeSignal.value = "select_feature";
    editableLayerIdsSignal.value = new Set();
    selectedFeatureIdsSignal.value = new Set();
    editedFeatureIdsSignal.value = new Set();
    isProjectDirtySignal.value = false;
    activeLocaleSignal.value = "en";
  });

  afterEach(() => {
    tearDownDom();
  });

  it("exports AttributeTableWidget and retains AttributeTablePanel alias", () => {
    assert.strictEqual(typeof AttributeTableWidget, "function");
    assert.strictEqual(AttributeTablePanel, AttributeTableWidget);
  });

  it("renders empty message when no active layer is selected", async () => {
    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const emptyMsg = findAllNodes(container, (el) =>
      el.className.includes("empty-panel-message")
    )[0];
    assert.ok(
      emptyMsg,
      "Empty panel message must be rendered when active layer is null"
    );
  });

  it("renders embedded Selection and Digitizing toolbars in header when layer is active", async () => {
    const mockLayer: GisLayer = {
      id: "layer-parcels",
      name: "Parcels",
      kind: "vector",
      geometryKind: "Polygon",
      visible: true,
      opacity: 1.0,
      color: "#3b82f6",
      featureCount: 1,
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = "layer-parcels";
    featuresSignal.value = [
      {
        id: 1,
        layerId: "layer-parcels",
        geometryType: "Polygon",
        properties: { name: "Parcel A", area: 1200 },
      },
    ];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const header = findAllNodes(container, (el) =>
      el.className.includes("attribute-table-header")
    )[0];
    assert.ok(header, "Attribute table header container must exist");

    // Verify redundant title text is absent
    const redundantTitle = findAllNodes(container, (el) =>
      el.className.includes("table-title")
    )[0];
    assert.strictEqual(
      redundantTitle,
      undefined,
      "Redundant table title text must not be rendered in header"
    );

    // Verify SelectionToolbarWidget is embedded
    const selectionToolbar = findAllNodes(
      container,
      (el) => el.getAttribute("id") === "toolbar-widget-selection"
    )[0];
    assert.ok(
      selectionToolbar,
      "SelectionToolbarWidget must be embedded inside attribute table header"
    );

    // Verify DigitizingToolbarWidget is embedded
    const digitizingToolbar = findAllNodes(
      container,
      (el) => el.getAttribute("id") === "toolbar-widget-digitizing"
    )[0];
    assert.ok(
      digitizingToolbar,
      "DigitizingToolbarWidget must be embedded inside attribute table header"
    );

    // Verify grabber handles are suppressed in both toolbars
    const grabbers = findAllNodes(header, (el) =>
      el.className.includes("toolbar-grabber")
    );
    assert.strictEqual(
      grabbers.length,
      0,
      "Embedded toolbars must suppress grabber handles (showGrabber={false})"
    );

    // Verify scaling is set to 0.667 on toolbar wrappers
    const toolbarsWithScaling = findAllNodes(header, (el) => {
      const scalingVal =
        (el.style as any)["--cartouche-ui-icon-scaling"]
        || el.style.getPropertyValue("--cartouche-ui-icon-scaling");
      return scalingVal === "0.667" || scalingVal === 0.667;
    });
    assert.strictEqual(
      toolbarsWithScaling.length >= 2,
      true,
      "Both embedded toolbars must apply --cartouche-ui-icon-scaling: 0.667"
    );

    // Verify toolbars are left-aligned (flex-start) rather than separated across opposite edges (space-between) (Ticket #210)
    assert.strictEqual(
      header.style.justifyContent,
      "flex-start",
      "Attribute table header toolbars must be left-aligned (justify-content: flex-start) (Ticket #210)"
    );

    // Verify workbench.css defines justify-content: flex-start for .attribute-table-header (Ticket #210)
    const workbenchCssPath = path.resolve(__dirname, "../../../src/renderer/styles/workbench.css");
    const workbenchCss = fs.readFileSync(workbenchCssPath, "utf-8");
    const headerCssMatch = workbenchCss.match(/\.attribute-table-header\s*\{[^}]*\}/);
    assert.ok(headerCssMatch, ".attribute-table-header rule must exist in workbench.css");
    assert.match(
      headerCssMatch[0],
      /justify-content:\s*flex-start;/,
      ".attribute-table-header must specify justify-content: flex-start (Ticket #210)"
    );
    assert.doesNotMatch(
      headerCssMatch[0],
      /justify-content:\s*space-between;/,
      ".attribute-table-header must not specify justify-content: space-between (Ticket #210)"
    );
  });

  it("reflects reactive state changes across active tools and layer edit mode", async () => {
    const mockLayer: GisLayer = {
      id: "layer-rivers",
      name: "Rivers",
      kind: "vector",
      geometryKind: "LineString",
      visible: true,
      opacity: 1.0,
      color: "#06b6d4",
      featureCount: 0,
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = "layer-rivers";
    featuresSignal.value = [];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const toggleBtn = findAllNodes(
      container,
      (el) => el.getAttribute("id") === "toolbar-tool-toggle-layer-editing"
    )[0];
    assert.ok(toggleBtn, "Toggle layer editing button must exist");
    assert.strictEqual(
      toggleBtn.className.includes("active"),
      false,
      "Toggle editing button must not be active when edit mode is off"
    );

    // Toggle edit mode in signals
    await act(async () => {
      editableLayerIdsSignal.value = new Set(["layer-rivers"]);
    });

    assert.strictEqual(
      toggleBtn.className.includes("active"),
      true,
      "Toggle editing button must become active immediately when editableLayerIdsSignal changes"
    );
  });

  it("supports single click, Ctrl-click toggle, and Shift-click range selection on the counter column", async () => {
    const mockLayer: GisLayer = {
      id: "layer-parcels",
      name: "Parcels",
      kind: "vector",
      geometryKind: "Polygon",
      visible: true,
      opacity: 1.0,
      color: "#3b82f6",
      featureCount: 4,
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = "layer-parcels";
    featuresSignal.value = [
      {
        id: "f-1",
        layerId: "layer-parcels",
        geometryType: "Polygon",
        properties: { name: "Parcel 1" },
      },
      {
        id: "f-2",
        layerId: "layer-parcels",
        geometryType: "Polygon",
        properties: { name: "Parcel 2" },
      },
      {
        id: "f-3",
        layerId: "layer-parcels",
        geometryType: "Polygon",
        properties: { name: "Parcel 3" },
      },
      {
        id: "f-4",
        layerId: "layer-parcels",
        geometryType: "Polygon",
        properties: { name: "Parcel 4" },
      },
    ];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const counterCells = findAllNodes(container, (el) =>
      el.className.includes("cell-counter")
    );
    assert.strictEqual(counterCells.length, 4, "Must render 4 counter cells");
    assert.strictEqual(
      counterCells[0].textContent,
      "1",
      "First row counter must be 1"
    );
    assert.strictEqual(
      counterCells[3].textContent,
      "4",
      "Fourth row counter must be 4"
    );

    // 1. Single click on row 2 (index 1, id 'f-2')
    await act(async () => {
      counterCells[1].dispatchEvent({
        type: "click",
        stopPropagation: () => {},
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      });
    });

    assert.deepStrictEqual(Array.from(selectedFeatureIdsSignal.value), ["f-2"]);

    // 2. Ctrl-click on row 4 (index 3, id 'f-4') to toggle it in
    await act(async () => {
      counterCells[3].dispatchEvent({
        type: "click",
        stopPropagation: () => {},
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
      });
    });

    assert.deepStrictEqual(Array.from(selectedFeatureIdsSignal.value).sort(), [
      "f-2",
      "f-4",
    ]);

    // 3. Shift-click from anchor (now 'f-4' at index 3) backwards to row 2 (index 1)
    await act(async () => {
      counterCells[1].dispatchEvent({
        type: "click",
        stopPropagation: () => {},
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
      });
    });

    assert.deepStrictEqual(Array.from(selectedFeatureIdsSignal.value).sort(), [
      "f-2",
      "f-3",
      "f-4",
    ]);

    // 4. Verify existing selections render with .selected-row
    await act(async () => {
      selectedFeatureIdsSignal.value = new Set(["f-1", "f-3"]);
    });

    const selectedRows = findAllNodes(container, (el) =>
      el.className.includes("selected-row")
    );
    assert.strictEqual(
      selectedRows.length,
      2,
      "Two rows must have selected-row class"
    );
  });

  it("gates data cell editing by layer edit mode and tracks modified features in editedFeatureIdsSignal", async () => {
    const mockLayer: GisLayer = {
      id: "layer-parcels",
      name: "Parcels",
      kind: "vector",
      geometryKind: "Polygon",
      visible: true,
      opacity: 1.0,
      color: "#3b82f6",
      featureCount: 2,
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = "layer-parcels";
    featuresSignal.value = [
      {
        id: "f-101",
        layerId: "layer-parcels",
        geometryType: "Polygon",
        properties: { name: "Parcel 101", zoning: "Commercial" },
      },
      {
        id: "f-102",
        layerId: "layer-parcels",
        geometryType: "Polygon",
        properties: { name: "Parcel 102", zoning: "Residential" },
      },
    ];

    // Case 1: Edit mode is OFF
    editableLayerIdsSignal.value = new Set();

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const dataCells = findAllNodes(container, (el) =>
      el.className.includes("cell-attribute-data")
    );
    assert.ok(dataCells.length >= 2, "Data cells must exist");

    // Click data cell when not in edit mode
    await act(async () => {
      dataCells[0].dispatchEvent({ type: "click", stopPropagation: () => {} });
    });

    let inputEls = findAllNodes(container, (el) =>
      el.className.includes("cell-editor-input")
    );
    assert.strictEqual(
      inputEls.length,
      0,
      "No inline cell editor input should appear when edit mode is OFF"
    );

    // Case 2: Enable edit mode
    await act(async () => {
      editableLayerIdsSignal.value = new Set(["layer-parcels"]);
    });

    // Click data cell when edit mode is ON
    await act(async () => {
      dataCells[0].dispatchEvent({ type: "click", stopPropagation: () => {} });
    });

    inputEls = findAllNodes(container, (el) =>
      el.className.includes("cell-editor-input")
    );
    assert.strictEqual(
      inputEls.length,
      1,
      "Inline cell editor input should appear when edit mode is ON"
    );
    assert.strictEqual((inputEls[0] as any).value, "Parcel 101");

    // Type a new value into the input and commit via Enter key
    await act(async () => {
      const propKey = Object.keys(inputEls[0]).find((k) =>
        k.startsWith("__reactProps")
      )!;
      (inputEls[0] as any)[propKey].onChange({
        target: { value: "Parcel 101 Revised" },
      });
    });

    // Re-acquire input with updated state and simulate Enter keydown
    inputEls = findAllNodes(container, (el) =>
      el.className.includes("cell-editor-input")
    );
    await act(async () => {
      const propKey = Object.keys(inputEls[0]).find((k) =>
        k.startsWith("__reactProps")
      )!;
      (inputEls[0] as any)[propKey].onKeyDown({
        key: "Enter",
        preventDefault: () => {},
      });
    });

    // Verify feature property was updated in featuresSignal
    const updatedFeature = featuresSignal.value.find((f) => f.id === "f-101");
    assert.strictEqual(updatedFeature?.properties.name, "Parcel 101 Revised");

    // Verify editedFeatureIdsSignal contains 'f-101'
    assert.ok(
      editedFeatureIdsSignal.value.has("f-101"),
      "editedFeatureIdsSignal must track modified feature ID"
    );
    assert.strictEqual(
      isProjectDirtySignal.value,
      true,
      "isProjectDirtySignal must be set to true on cell edit"
    );

    // Verify saving active layer resets editedFeatureIdsSignal
    await act(async () => {
      saveActiveLayerAction();
    });
    assert.strictEqual(
      editedFeatureIdsSignal.value.size,
      0,
      "saveActiveLayerAction must reset editedFeatureIdsSignal"
    );

    // Re-add to editedFeatureIdsSignal and verify toggling editing off preserves it (#182)
    await act(async () => {
      editedFeatureIdsSignal.value = new Set(["f-101"]);
      toggleLayerEditingAction("layer-parcels", { force: true });
    });
    assert.strictEqual(
      editedFeatureIdsSignal.value.size,
      1,
      "toggleLayerEditingAction disabling edit mode must preserve editedFeatureIdsSignal"
    );
  });
});

describe("AttributeTableWidget Filtering, minHeight, and Localization (Ticket #179)", () => {
  beforeEach(() => {
    setupDom();
    activeLayerIdSignal.value = null;
    layersSignal.value = [];
    projectLayersSignal.value = [];
    projectTreeSignal.value = [];
    featuresSignal.value = [];
    activeToolSignal.value = "pan";
    activeSelectionModeSignal.value = "select_feature";
    editableLayerIdsSignal.value = new Set();
    selectedFeatureIdsSignal.value = new Set();
    editedFeatureIdsSignal.value = new Set();
    isProjectDirtySignal.value = false;
    viewportExtentSignal.value = [-180, -90, 180, 90];
    openDockPanelsSignal.value = { attributes: true, layers: true };
    dictionarySignal.value = {};
  });

  afterEach(() => {
    tearDownDom();
  });

  it("computes dynamic minHeight CSS string accommodating header, toolbars, table header, 2 feature rows, and filter bar", async () => {
    const minHeightExpr = computeAttributeTableMinHeight();
    assert.ok(
      minHeightExpr.includes("var(--cartouche-ui-icon-size, 24px) * 0.8 + 8px"),
      "Should account for widget header"
    );
    assert.ok(
      minHeightExpr.includes(
        "var(--cartouche-ui-icon-size, 24px) * 0.667 + 12px"
      ),
      "Should account for embedded toolbars"
    );
    assert.ok(
      minHeightExpr.includes(
        "var(--cartouche-ui-basefont-size, 12pt) * 1.5 + 8px"
      ),
      "Should account for table header"
    );
    assert.ok(
      minHeightExpr.includes(
        "2 * (var(--cartouche-ui-basefont-size, 12pt) * 1.5 + 8px)"
      ),
      "Should account for at least 2 feature rows"
    );
    assert.ok(
      minHeightExpr.includes(
        "var(--cartouche-ui-basefont-size, 12pt) * 1.5 + 16px"
      ),
      "Should account for footer filter bar"
    );

    // Mount AttributeTableWidget and verify BasicWidget receives computed minHeight
    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget));
    });

    const basicWidgetNode = findAllNodes(container, (el) =>
      el.className.includes("cartouche-widget")
    )[0];
    assert.ok(
      basicWidgetNode,
      "BasicWidget cartouche-widget container should be present"
    );
    assert.strictEqual(
      basicWidgetNode.style.minHeight,
      minHeightExpr,
      "BasicWidget should have dynamic minHeight applied"
    );
  });

  it("evaluates spatial intersection between feature geometry and viewport extent correctly", () => {
    assert.deepStrictEqual(getFeatureBoundingBox([50, 50]), [50, 50, 50, 50]);
    assert.deepStrictEqual(
      getFeatureBoundingBox([
        [-10, 20],
        [30, 40],
      ]),
      [-10, 20, 30, 40]
    );

    const extent: [number, number, number, number] = [0, 0, 100, 100];

    // Point inside
    const ptInside = {
      id: "p1",
      layerId: "l1",
      geometryType: "point" as const,
      properties: {},
      coordinates: [50, 50],
    };
    assert.strictEqual(
      isFeatureInExtent(ptInside, extent),
      true,
      "Point inside extent should return true"
    );

    // Point outside
    const ptOutside = {
      id: "p2",
      layerId: "l1",
      geometryType: "point" as const,
      properties: {},
      coordinates: [150, 50],
    };
    assert.strictEqual(
      isFeatureInExtent(ptOutside, extent),
      false,
      "Point outside extent should return false"
    );

    // LineString intersecting
    const lineIntersecting = {
      id: "l1",
      layerId: "l1",
      geometryType: "linestring" as const,
      properties: {},
      coordinates: [
        [-10, 50],
        [50, 50],
      ],
    };
    assert.strictEqual(
      isFeatureInExtent(lineIntersecting, extent),
      true,
      "LineString intersecting extent should return true"
    );

    // Polygon outside
    const polyOutside = {
      id: "poly1",
      layerId: "l1",
      geometryType: "polygon" as const,
      properties: {},
      coordinates: [
        [
          [200, 200],
          [300, 200],
          [300, 300],
          [200, 300],
          [200, 200],
        ],
      ],
    };
    assert.strictEqual(
      isFeatureInExtent(polyOutside, extent),
      false,
      "Polygon outside extent should return false"
    );

    // Null or invalid coordinates
    const invalidFeature = {
      id: "inv",
      layerId: "l1",
      geometryType: "point" as const,
      properties: {},
      coordinates: null,
    };
    assert.strictEqual(
      isFeatureInExtent(invalidFeature, extent),
      false,
      "Null coordinates should return false"
    );
  });

  it("renders an unlabelled filter dropdown at the bottom-left with all 4 filter options and correct localization", async () => {
    dictionarySignal.value = {
      filter_dropdown_label: "Filter features",
      filter_show_all: "Show all features",
      filter_show_selected: "Show selected features",
      filter_show_visible: "Show features visible on map",
      filter_show_edited_new: "Show edited and new features",
    };

    const layer: GisLayer = {
      id: "layer-test",
      name: "Test Layer",
      kind: "vector",
      geometryKind: "Point",
      visible: true,
      opacity: 1,
      color: "#3b82f6",
      featureCount: 1,
    };
    layersSignal.value = [layer];
    activeLayerIdSignal.value = "layer-test";
    featuresSignal.value = [
      {
        id: "f1",
        layerId: "layer-test",
        geometryType: "point",
        properties: { name: "Alpha" },
        coordinates: [10, 10],
      },
    ];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget));
    });

    const footerNode = findAllNodes(container, (el) =>
      el.className.includes("attribute-table-footer")
    )[0];
    assert.ok(footerNode, "Footer bar should be rendered");

    const selectEls = findAllNodes(footerNode, (el) =>
      el.className.includes("attribute-table-filter-select")
    );
    assert.strictEqual(
      selectEls.length,
      1,
      "Filter select dropdown should be rendered"
    );

    const selectEl = selectEls[0];
    assert.strictEqual(
      selectEl.getAttribute("aria-label"),
      "Filter features",
      "Filter dropdown should have localized aria-label"
    );

    const options = (selectEl as any).options;
    assert.strictEqual(
      options.length,
      4,
      "Filter dropdown should contain 4 options"
    );
    assert.strictEqual(options[0].getAttribute("value"), "all");
    assert.strictEqual(options[0].textContent, "Show all features");
    assert.strictEqual(options[1].getAttribute("value"), "selected");
    assert.strictEqual(options[1].textContent, "Show selected features");
    assert.strictEqual(options[2].getAttribute("value"), "visible");
    assert.strictEqual(options[2].textContent, "Show features visible on map");
    assert.strictEqual(options[3].getAttribute("value"), "edited_new");
    assert.strictEqual(options[3].textContent, "Show edited and new features");
  });

  it("filters rows correctly for all four filter modes", async () => {
    const layer: GisLayer = {
      id: "layer-filter",
      name: "Filter Layer",
      kind: "vector",
      geometryKind: "Point",
      visible: true,
      opacity: 1,
      color: "#3b82f6",
      featureCount: 3,
    };
    layersSignal.value = [layer];
    activeLayerIdSignal.value = "layer-filter";

    // 3 features:
    // f1: [10, 10] - inside extent [0, 0, 100, 100], not selected, not edited
    // f2: [50, 50] - inside extent [0, 0, 100, 100], selected, edited
    // f3: [200, 200] - outside extent [0, 0, 100, 100], not selected, not edited
    featuresSignal.value = [
      {
        id: "f1",
        layerId: "layer-filter",
        geometryType: "point",
        properties: { name: "Item 1" },
        coordinates: [10, 10],
      },
      {
        id: "f2",
        layerId: "layer-filter",
        geometryType: "point",
        properties: { name: "Item 2" },
        coordinates: [50, 50],
      },
      {
        id: "f3",
        layerId: "layer-filter",
        geometryType: "point",
        properties: { name: "Item 3" },
        coordinates: [200, 200],
      },
    ];
    selectedFeatureIdsSignal.value = new Set(["f2"]);
    editedFeatureIdsSignal.value = new Set(["f2"]);
    viewportExtentSignal.value = [0, 0, 100, 100];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget));
    });

    const selectEl = findAllNodes(container, (el) =>
      el.className.includes("attribute-table-filter-select")
    )[0];
    const getRenderedRows = () =>
      findAllNodes(container, (el) => el.tagName === "TR").filter(
        (r) =>
          findAllNodes(r, (c) => c.className.includes("cell-counter")).length
          > 0
      );

    // Mode 1: 'all' (default)
    let rows = getRenderedRows();
    assert.strictEqual(
      rows.length,
      3,
      "Show all features should render 3 rows"
    );

    // Mode 2: 'selected'
    await act(async () => {
      const propKey = Object.keys(selectEl).find((k) =>
        k.startsWith("__reactProps")
      )!;
      (selectEl as any)[propKey].onChange({ target: { value: "selected" } });
    });
    rows = getRenderedRows();
    assert.strictEqual(
      rows.length,
      1,
      "Show selected features should render 1 row"
    );
    assert.ok(
      rows[0].textContent.includes("Item 2"),
      "Rendered row should be Item 2"
    );

    // Mode 3: 'visible' (f1 and f2 are inside [0, 0, 100, 100])
    await act(async () => {
      const propKey = Object.keys(selectEl).find((k) =>
        k.startsWith("__reactProps")
      )!;
      (selectEl as any)[propKey].onChange({ target: { value: "visible" } });
    });
    rows = getRenderedRows();
    assert.strictEqual(
      rows.length,
      2,
      "Show features visible on map should render 2 rows"
    );

    // Mode 4: 'edited_new'
    await act(async () => {
      const propKey = Object.keys(selectEl).find((k) =>
        k.startsWith("__reactProps")
      )!;
      (selectEl as any)[propKey].onChange({ target: { value: "edited_new" } });
    });
    rows = getRenderedRows();
    assert.strictEqual(
      rows.length,
      1,
      "Show edited and new features should render 1 row"
    );
    assert.ok(rows[0].textContent.includes("Item 2"));

    // When no features match filter, render empty-filter-message
    await act(async () => {
      editedFeatureIdsSignal.value = new Set();
    });
    rows = getRenderedRows();
    assert.strictEqual(
      rows.length,
      0,
      "No rows should match when editedFeatureIdsSignal is empty"
    );
    const emptyMsgEl = findAllNodes(container, (el) =>
      el.className.includes("empty-filter-message")
    )[0];
    assert.ok(emptyMsgEl, "Empty filter message element should be displayed");
  });

  it('defaults dropdown selection to "Show all features" when AttributeTableWidget is unhidden via View -> Panels', async () => {
    const layer: GisLayer = {
      id: "layer-unhide",
      name: "Unhide Layer",
      kind: "vector",
      geometryKind: "Point",
      visible: true,
      opacity: 1,
      color: "#3b82f6",
      featureCount: 2,
    };
    layersSignal.value = [layer];
    activeLayerIdSignal.value = "layer-unhide";
    featuresSignal.value = [
      {
        id: "f1",
        layerId: "layer-unhide",
        geometryType: "point",
        properties: { name: "Item 1" },
        coordinates: [10, 10],
      },
      {
        id: "f2",
        layerId: "layer-unhide",
        geometryType: "point",
        properties: { name: "Item 2" },
        coordinates: [20, 20],
      },
    ];
    selectedFeatureIdsSignal.value = new Set(["f1"]);
    openDockPanelsSignal.value = { attributes: true, layers: true };

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget));
    });

    const selectEl = findAllNodes(container, (el) =>
      el.className.includes("attribute-table-filter-select")
    )[0];

    // Change filter mode to 'selected'
    await act(async () => {
      const propKey = Object.keys(selectEl).find((k) =>
        k.startsWith("__reactProps")
      )!;
      (selectEl as any)[propKey].onChange({ target: { value: "selected" } });
    });

    let renderedCounters = findAllNodes(container, (el) =>
      el.className.includes("cell-counter")
    );
    assert.strictEqual(
      renderedCounters.length,
      1,
      "Should filter to 1 selected row"
    );

    // Simulate panel hidden then unhidden via View -> Panels
    await act(async () => {
      openDockPanelsSignal.value = { attributes: false, layers: true };
    });
    await act(async () => {
      openDockPanelsSignal.value = { attributes: true, layers: true };
    });

    // Verify filter dropdown reset to 'all' and both rows are displayed
    renderedCounters = findAllNodes(container, (el) =>
      el.className.includes("cell-counter")
    );
    assert.strictEqual(
      renderedCounters.length,
      2,
      "Should reset to Show all features (2 rows)"
    );
    const updatedSelect = findAllNodes(container, (el) =>
      el.className.includes("attribute-table-filter-select")
    )[0];
    assert.strictEqual(
      (updatedSelect as any).value,
      "all",
      'Dropdown value should be "all"'
    );
  });

  it("localizes all UI strings in AttributeTableWidget when dictionary changes", async () => {
    dictionarySignal.value = {
      attribute_table_select_layer_prompt:
        "Sélectionnez une couche dans le panneau Couches pour inspecter les attributs.",
      attribute_table_empty_filtered:
        "Aucune entité ne correspond au filtre actuel.",
      attribute_table_title: "Table d'attributs",
      attribute_table_title_format: "Attributs — {name} ({count} entités)",
      attribute_table_col_counter: "#",
      attribute_table_col_id: "Identifiant",
      attribute_table_col_type: "Genre",
      filter_dropdown_label: "Filtrer les entités",
      filter_show_all: "Afficher toutes les entités",
      filter_show_selected: "Afficher les entités sélectionnées",
      filter_show_visible: "Afficher les entités visibles sur la carte",
      filter_show_edited_new: "Afficher les entités modifiées et nouvelles",
    };

    // Case 1: No active layer -> renders French empty prompt and title
    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget));
    });

    const emptyPanelMsg = findAllNodes(container, (el) =>
      el.className.includes("empty-panel-message")
    )[0];
    assert.strictEqual(
      emptyPanelMsg.textContent,
      "Sélectionnez une couche dans le panneau Couches pour inspecter les attributs."
    );

    // Case 2: Active layer -> renders French title format, table column headers, and filter options
    const layer: GisLayer = {
      id: "layer-fr",
      name: "Régions",
      kind: "vector",
      geometryKind: "Polygon",
      visible: true,
      opacity: 1,
      color: "#3b82f6",
      featureCount: 1,
    };
    await act(async () => {
      layersSignal.value = [layer];
      activeLayerIdSignal.value = "layer-fr";
      featuresSignal.value = [
        {
          id: "fr-1",
          layerId: "layer-fr",
          geometryType: "polygon",
          properties: { nom: "Bretagne" },
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      ];
    });

    const thEls = findAllNodes(container, (el) => el.tagName === "TH");
    assert.strictEqual(thEls[0].textContent, "#");
    assert.strictEqual(thEls[1].textContent, "nom");

    const options = (
      findAllNodes(container, (el) =>
        el.className.includes("attribute-table-filter-select")
      )[0] as any
    ).options;
    assert.strictEqual(options[0].textContent, "Afficher toutes les entités");
    assert.strictEqual(
      options[1].textContent,
      "Afficher les entités sélectionnées"
    );
    assert.strictEqual(
      options[2].textContent,
      "Afficher les entités visibles sur la carte"
    );
    assert.strictEqual(
      options[3].textContent,
      "Afficher les entités modifiées et nouvelles"
    );
  });
});

describe("AttributeTableWidget Chunk Hydration, Schema Columns, and Pagination (Ticket #184)", () => {
  beforeEach(() => {
    setupDom();
    activeLayerIdSignal.value = null;
    layersSignal.value = [];
    projectLayersSignal.value = [];
    projectTreeSignal.value = [];
    featuresSignal.value = [];
    activeToolSignal.value = "pan";
    activeSelectionModeSignal.value = "select_feature";
    editableLayerIdsSignal.value = new Set();
    selectedFeatureIdsSignal.value = new Set();
    editedFeatureIdsSignal.value = new Set();
    isProjectDirtySignal.value = false;
    viewportExtentSignal.value = [-180, -90, 180, 90];
    openDockPanelsSignal.value = { attributes: true, layers: true };
    dictionarySignal.value = {};
  });

  afterEach(() => {
    tearDownDom();
  });

  it("derives column headers from activeLayer.fields even when the layer has 0 features", async () => {
    const emptyLayerWithSchema: GisLayer = {
      id: "layer-empty-schema",
      name: "Empty Schema Layer",
      kind: "vector",
      geometryKind: "Polygon",
      visible: true,
      opacity: 1,
      color: "#2563eb",
      featureCount: 0,
      fields: [
        {
          name: "parcel_code",
          nativeType: "String",
          inferredType: "string",
          nullable: false,
        },
        {
          name: "assessed_val",
          nativeType: "Real",
          inferredType: "real",
          nullable: true,
        },
        {
          name: "zoning_class",
          nativeType: "String",
          inferredType: "string",
          nullable: true,
        },
      ],
    };

    layersSignal.value = [emptyLayerWithSchema];
    activeLayerIdSignal.value = "layer-empty-schema";
    featuresSignal.value = [];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget));
    });

    const thEls = findAllNodes(container, (el) => el.tagName === "TH");
    const headerTexts = thEls.map((th) => th.textContent);
    assert.deepStrictEqual(headerTexts.slice(1), [
      "parcel_code",
      "assessed_val",
      "zoning_class",
    ]);
  });

  it("deserializes binary CART WKB packet buffer returned by queryExtent", async () => {
    const {
      WKB_PACKET_MAGIC,
      WKB_PACKET_VERSION,
      WKB_FLAG_HAS_GEOMETRY,
      WKB_FLAG_HAS_PROPERTIES,
    } = await import("../../../src/shared/types/project");

    const pointWkb = new Uint8Array(21);
    const wkbView = new DataView(pointWkb.buffer);
    pointWkb[0] = 1; // little endian
    wkbView.setUint32(1, 1, true); // Point (1)
    wkbView.setFloat64(5, -75.69, true);
    wkbView.setFloat64(13, 45.42, true);

    const propsBytes = new TextEncoder().encode(
      JSON.stringify({ city_name: "Ottawa" })
    );
    const totalSize =
      12 + 8 + 4 + pointWkb.byteLength + 4 + propsBytes.byteLength;
    const binaryPacket = new ArrayBuffer(totalSize);
    const view = new DataView(binaryPacket);
    const uint8View = new Uint8Array(binaryPacket);
    view.setUint32(0, WKB_PACKET_MAGIC, true);
    view.setUint16(4, WKB_PACKET_VERSION, true);
    view.setUint16(6, WKB_FLAG_HAS_GEOMETRY | WKB_FLAG_HAS_PROPERTIES, true);
    view.setUint32(8, 1, true);
    let offset = 12;
    view.setBigInt64(offset, 77n, true);
    offset += 8;
    view.setUint32(offset, pointWkb.byteLength, true);
    offset += 4;
    uint8View.set(pointWkb, offset);
    offset += pointWkb.byteLength;
    view.setUint32(offset, propsBytes.byteLength, true);
    offset += 4;
    uint8View.set(propsBytes, offset);

    (globalThis as any).window.electronAPI = {
      ...(globalThis as any).window.electronAPI,
      queryExtent: async (layerId: string) => ({
        layerId,
        buffer: binaryPacket,
        totalMatched: 1,
      }),
    };

    try {
      const layer: GisLayer = {
        id: "layer-wkb-buf",
        name: "WKB Buffer Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1,
        color: "#2563eb",
        featureCount: 1,
        fields: [
          {
            name: "city_name",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };
      layersSignal.value = [layer];
      activeLayerIdSignal.value = "layer-wkb-buf";

      await act(async () => {
        root!.render(React.createElement(AttributeTableWidget));
      });

      const tdEls = findAllNodes(container, (el) => el.tagName === "TD");
      assert.deepStrictEqual(
        tdEls.map((td) => td.textContent),
        ["1", "Ottawa"]
      );
    } finally {
      delete (globalThis as any).window.electronAPI.queryExtent;
    }
  });

  it("hydrates feature chunks via window.electronAPI.queryExtent, paginates with 4 MDI buttons, numbers counter as start + rowIndex + 1, and does not re-fetch on selection change", async () => {
    const { prefsAttributeTableMaxRows } =
      await import("../../../src/renderer/state/preferencesSignals");
    prefsAttributeTableMaxRows.value = 2;

    const queryCalls: Array<{ layerId: string; options: any }> = [];
    const dataset = [
      {
        id: 101,
        properties: { title: "Row 1" },
        geometryType: "Point",
        coordinates: [1, 1],
      },
      {
        id: 102,
        properties: { title: "Row 2" },
        geometryType: "Point",
        coordinates: [2, 2],
      },
      {
        id: 103,
        properties: { title: "Row 3" },
        geometryType: "Point",
        coordinates: [3, 3],
      },
      {
        id: 104,
        properties: { title: "Row 4" },
        geometryType: "Point",
        coordinates: [4, 4],
      },
      {
        id: 105,
        properties: { title: "Row 5" },
        geometryType: "Point",
        coordinates: [5, 5],
      },
    ];

    (globalThis as any).window.electronAPI = {
      ...(globalThis as any).window.electronAPI,
      queryExtent: async (layerId: string, options: any) => {
        queryCalls.push({ layerId, options });
        const start = options?.start ?? 0;
        const max = options?.max ?? 5000;
        return {
          layerId,
          features: dataset.slice(start, start + max),
          totalMatched: dataset.length,
        };
      },
    };

    try {
      const layer: GisLayer = {
        id: "layer-paged",
        name: "Paged Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1,
        color: "#2563eb",
        featureCount: 5,
        fields: [
          {
            name: "title",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };
      layersSignal.value = [layer];
      activeLayerIdSignal.value = "layer-paged";

      await act(async () => {
        root!.render(React.createElement(AttributeTableWidget));
      });

      assert.strictEqual(queryCalls.length, 1);
      assert.strictEqual(queryCalls[0].options.start, 0);
      assert.strictEqual(queryCalls[0].options.max, 2);
      assert.strictEqual(queryCalls[0].options.includeGeometry, true);

      let counterCells = findAllNodes(container, (el) =>
        el.className.includes("cell-counter")
      );
      assert.deepStrictEqual(
        counterCells.map((c) => c.textContent),
        ["1", "2"]
      );

      const firstBtn = findAllNodes(container, (el) =>
        el.className.includes("attribute-table-page-first")
      )[0];
      const prevBtn = findAllNodes(container, (el) =>
        el.className.includes("attribute-table-page-prev")
      )[0];
      const nextBtn = findAllNodes(container, (el) =>
        el.className.includes("attribute-table-page-next")
      )[0];
      const lastBtn = findAllNodes(container, (el) =>
        el.className.includes("attribute-table-page-last")
      )[0];
      assert.ok(
        firstBtn && prevBtn && nextBtn && lastBtn,
        "All 4 MDI pagination buttons must be rendered in footer"
      );
      assert.strictEqual(
        firstBtn.textContent,
        "",
        "First page button must be icon-only without text"
      );
      assert.strictEqual(
        prevBtn.textContent,
        "",
        "Prev page button must be icon-only without text"
      );
      assert.strictEqual(
        nextBtn.textContent,
        "",
        "Next page button must be icon-only without text"
      );
      assert.strictEqual(
        lastBtn.textContent,
        "",
        "Last page button must be icon-only without text"
      );
      assert.strictEqual(
        firstBtn.getAttribute("disabled") !== null
          || (firstBtn as any).disabled === true,
        true
      );
      assert.strictEqual(
        prevBtn.getAttribute("disabled") !== null
          || (prevBtn as any).disabled === true,
        true
      );

      // Click Next page -> start = 2
      await act(async () => {
        nextBtn.dispatchEvent({ type: "click", stopPropagation: () => {} });
      });

      assert.strictEqual(queryCalls.length, 2);
      assert.strictEqual(queryCalls[1].options.start, 2);
      assert.strictEqual(queryCalls[1].options.max, 2);
      counterCells = findAllNodes(container, (el) =>
        el.className.includes("cell-counter")
      );
      assert.deepStrictEqual(
        counterCells.map((c) => c.textContent),
        ["3", "4"]
      );

      // Selecting a feature on page 2 must NOT trigger a new queryExtent call
      await act(async () => {
        counterCells[0].dispatchEvent({
          type: "click",
          stopPropagation: () => {},
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        });
      });
      assert.strictEqual(
        queryCalls.length,
        2,
        "Selecting a feature must not re-fetch features"
      );
      assert.deepStrictEqual(Array.from(selectedFeatureIdsSignal.value), [103]);

      // Click Last page -> start = 4 (only 1 feature: 105)
      await act(async () => {
        lastBtn.dispatchEvent({ type: "click", stopPropagation: () => {} });
      });
      assert.strictEqual(queryCalls.length, 3);
      assert.strictEqual(queryCalls[2].options.start, 4);
      counterCells = findAllNodes(container, (el) =>
        el.className.includes("cell-counter")
      );
      assert.deepStrictEqual(
        counterCells.map((c) => c.textContent),
        ["5"]
      );
      assert.strictEqual(
        nextBtn.getAttribute("disabled") !== null
          || (nextBtn as any).disabled === true,
        true
      );
      assert.strictEqual(
        lastBtn.getAttribute("disabled") !== null
          || (lastBtn as any).disabled === true,
        true
      );

      // Click First page -> start = 0
      await act(async () => {
        firstBtn.dispatchEvent({ type: "click", stopPropagation: () => {} });
      });
      assert.strictEqual(queryCalls.length, 4);
      assert.strictEqual(queryCalls[3].options.start, 0);
      counterCells = findAllNodes(container, (el) =>
        el.className.includes("cell-counter")
      );
      assert.deepStrictEqual(
        counterCells.map((c) => c.textContent),
        ["1", "2"]
      );

      // Switch filter mode to 'selected' -> passes featureIds: [103] to queryExtent
      const filterSelect = findAllNodes(container, (el) =>
        el.className.includes("attribute-table-filter-select")
      )[0];
      await act(async () => {
        const propKey = Object.keys(filterSelect).find((k) =>
          k.startsWith("__reactProps")
        )!;
        (filterSelect as any)[propKey].onChange({
          target: { value: "selected" },
        });
      });
      assert.strictEqual(queryCalls.length, 5);
      assert.deepStrictEqual(queryCalls[4].options.featureIds, [103]);
    } finally {
      await act(async () => {
        prefsAttributeTableMaxRows.value = 5000;
      });
      delete (globalThis as any).window.electronAPI.queryExtent;
    }
  });

  it("stages inline cell edits to Main process via window.electronAPI.stageFeatureEdit", async () => {
    const stagedCalls: Array<{ layerId: string; edit: any }> = [];
    (globalThis as any).window.electronAPI = {
      ...(globalThis as any).window.electronAPI,
      stageFeatureEdit: async (layerId: string, edit: any) => {
        stagedCalls.push({ layerId, edit });
      },
    };

    try {
      const layer: GisLayer = {
        id: "layer-edit-stage",
        name: "Editable Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1,
        color: "#2563eb",
        featureCount: 1,
        fields: [
          {
            name: "label",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };
      layersSignal.value = [layer];
      activeLayerIdSignal.value = "layer-edit-stage";
      editableLayerIdsSignal.value = new Set(["layer-edit-stage"]);
      featuresSignal.value = [
        {
          id: 42,
          layerId: "layer-edit-stage",
          geometryType: "Point",
          properties: { label: "Before" },
          coordinates: [0, 0],
        },
      ];

      await act(async () => {
        root!.render(React.createElement(AttributeTableWidget));
      });

      const dataCell = findAllNodes(container, (el) =>
        el.className.includes("cell-attribute-data")
      )[0];
      await act(async () => {
        dataCell.dispatchEvent({ type: "click", stopPropagation: () => {} });
      });

      const inputEl = findAllNodes(container, (el) =>
        el.className.includes("cell-editor-input")
      )[0];
      assert.ok(inputEl, "Inline cell editor input must appear");

      await act(async () => {
        const propKey = Object.keys(inputEl).find((k) =>
          k.startsWith("__reactProps")
        )!;
        (inputEl as any)[propKey].onChange({ target: { value: "After Edit" } });
      });

      await act(async () => {
        const propKey = Object.keys(inputEl).find((k) =>
          k.startsWith("__reactProps")
        )!;
        (inputEl as any)[propKey].onKeyDown({
          key: "Enter",
          preventDefault: () => {},
        });
      });

      assert.strictEqual(stagedCalls.length, 1);
      assert.strictEqual(stagedCalls[0].layerId, "layer-edit-stage");
      assert.deepStrictEqual(stagedCalls[0].edit, {
        id: 42,
        properties: { label: "After Edit" },
      });
    } finally {
      delete (globalThis as any).window.electronAPI.stageFeatureEdit;
    }
  });

  it("renders UnsavedChangesModal with Cancel, Don't Save Changes, and Save Changes buttons and resolves choices (Ticket #185)", async () => {
    const { UnsavedChangesModal } = jiti(
      "../../../src/renderer/workbench/dialogs/ModalDialog.tsx"
    ) as { UnsavedChangesModal: React.FC };
    const { promptUnsavedChanges, unsavedChangesModalSignal } =
      await import("../../../src/renderer/state/gisSignals");

    dictionarySignal.value = {
      unsaved_changes_title: "Unsaved Changes",
      unsaved_layer_changes_prompt:
        'Layer "{name}" has unsaved changes. Do you want to save them before continuing?',
      unsaved_project_changes_prompt:
        'Project "{name}" has unsaved changes. Do you want to save them before continuing?',
      unsaved_changes_cancel: "Cancel",
      unsaved_changes_dont_save: "Don't Save Changes",
      unsaved_changes_save: "Save Changes",
    };

    try {
      await act(async () => {
        root!.render(React.createElement(UnsavedChangesModal));
      });

      let choicePromise!: Promise<string>;
      await act(async () => {
        choicePromise = promptUnsavedChanges(
          "layer",
          "Parcels Layer",
          "layer-parcels"
        );
      });

      const msgEl = findAllNodes(
        document.body as unknown as MockElement,
        (el) => el.className.includes("unsaved-changes-modal-message")
      )[0];
      assert.ok(
        msgEl,
        "UnsavedChangesModal message must be rendered in document.body portal"
      );
      assert.strictEqual(
        msgEl.textContent,
        'Layer "Parcels Layer" has unsaved changes. Do you want to save them before continuing?'
      );

      const buttons = findAllNodes(
        document.body as unknown as MockElement,
        (el) => el.tagName === "BUTTON"
      );
      assert.deepStrictEqual(
        buttons.map((b) => b.textContent),
        ["Cancel", "Don't Save Changes", "Save Changes"]
      );

      // Click "Don't Save Changes"
      await act(async () => {
        buttons[1].dispatchEvent({ type: "click", stopPropagation: () => {} });
      });
      assert.strictEqual(await choicePromise, "discard");
      assert.strictEqual(unsavedChangesModalSignal.value, null);
    } finally {
      unsavedChangesModalSignal.value = null;
    }
  });

  it("sizes widget to full dock dimensions and constrains table flex items with minHeight 0 to prevent dock overflowing (Ticket #186)", async () => {
    const mockLayer: GisLayer = {
      id: "layer-overflow-check",
      name: "Overflow Layer",
      kind: "vector",
      geometryKind: "Polygon",
      visible: true,
      opacity: 1.0,
      color: "#3b82f6",
      featureCount: 251,
      fields: [
        {
          name: "name",
          nativeType: "String",
          inferredType: "string",
          nullable: false,
        },
      ],
    };

    const features251 = Array.from({ length: 251 }, (_, i) => ({
      id: `feat-${i + 1}`,
      properties: { name: `Feature ${i + 1}` },
      geometryType: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    }));

    (globalThis as any).window.electronAPI = {
      ...(globalThis as any).window.electronAPI,
      queryExtent: async (layerId: string, options: any) => ({
        layerId,
        features: features251.slice(
          options?.start ?? 0,
          (options?.start ?? 0) + (options?.max ?? 5000)
        ),
        totalMatched: 251,
      }),
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = "layer-overflow-check";

    try {
      await act(async () => {
        root!.render(React.createElement(AttributeTableWidget));
      });

      // 1. Root cartouche-widget container sizing
      const widgetEl = findAllNodes(container, (el) =>
        el.className.includes("cartouche-widget")
      )[0];
      assert.ok(widgetEl, "cartouche-widget container must be rendered");
      assert.strictEqual(widgetEl.style.width, "100%");
      assert.strictEqual(widgetEl.style.height, "100%");

      // 2. BasicWidget body flex containment
      const bodyEl = findAllNodes(container, (el) =>
        el.className.includes("basic-widget-body")
      )[0];
      assert.ok(bodyEl, "basic-widget-body must be rendered");
      assert.strictEqual(bodyEl.style.display, "flex");
      assert.strictEqual(bodyEl.style.flexDirection, "column");
      assert.ok(
        bodyEl.style.minHeight === "0px" || bodyEl.style.minHeight === "0"
      );
      assert.strictEqual(bodyEl.style.overflow, "hidden");

      // 3. Attribute table container flex containment
      const tableContainerEl = findAllNodes(container, (el) =>
        el.className.includes("attribute-table-container")
      )[0];
      assert.ok(tableContainerEl, "attribute-table-container must be rendered");
      assert.strictEqual(tableContainerEl.style.height, "100%");
      assert.strictEqual(tableContainerEl.style.display, "flex");
      assert.strictEqual(tableContainerEl.style.flexDirection, "column");
      assert.ok(
        tableContainerEl.style.minHeight === "0px"
          || tableContainerEl.style.minHeight === "0"
      );
      assert.strictEqual(tableContainerEl.style.overflow, "hidden");

      // 4. Header toolbar flex-shrink
      const headerEl = findAllNodes(container, (el) =>
        el.className.includes("attribute-table-header")
      )[0];
      assert.ok(headerEl, "attribute-table-header must be rendered");
      assert.ok(
        headerEl.style.flexShrink === "0"
          || headerEl.style.flexShrink === (0 as any)
      );

      // 5. Scroll wrapper flex and minHeight containment
      const scrollWrapperEl = findAllNodes(container, (el) =>
        el.className.includes("table-scroll-wrapper")
      )[0];
      assert.ok(scrollWrapperEl, "table-scroll-wrapper must be rendered");
      assert.strictEqual(scrollWrapperEl.style.overflow, "auto");
      assert.ok(
        scrollWrapperEl.style.minHeight === "0px"
          || scrollWrapperEl.style.minHeight === "0"
      );

      // 6. Footer flex-shrink and controls presence
      const footerEl = findAllNodes(container, (el) =>
        el.className.includes("attribute-table-footer")
      )[0];
      assert.ok(footerEl, "attribute-table-footer must be rendered");
      assert.ok(
        footerEl.style.flexShrink === "0"
          || footerEl.style.flexShrink === (0 as any)
      );

      const filterSelect = findAllNodes(footerEl, (el) =>
        el.className.includes("attribute-table-filter-select")
      )[0];
      assert.ok(filterSelect, "filter dropdown must remain rendered in footer");

      const paginationEl = findAllNodes(footerEl, (el) =>
        el.className.includes("attribute-table-pagination")
      )[0];
      assert.ok(
        paginationEl,
        "pagination buttons must remain rendered in footer"
      );
    } finally {
      delete (globalThis as any).window.electronAPI.queryExtent;
    }
  });

  it("automatically grows dock panel and enforces Dockview constraints to meet largest minHeight (192.208px at 12pt/24px) when dock is smaller than minHeight (Ticket #186)", async () => {
    const { prefsUiBaseFontSize, prefsUiIconSize } =
      await import("../../../src/renderer/state/preferencesSignals");
    prefsUiBaseFontSize.value = 12;
    prefsUiIconSize.value = 24;

    const constraintsPassed: any[] = [];
    const groupConstraintsPassed: any[] = [];
    const sizesPassed: any[] = [];
    const groupSizesPassed: any[] = [];

    const mockPanelApi = {
      id: "attribute-table",
      height: 100, // Starts smaller than minHeight of 192.208px
      width: 500,
      setConstraints: (c: any) => {
        constraintsPassed.push(c);
      },
      setSize: (s: any) => {
        sizesPassed.push(s);
      },
      group: {
        api: {
          height: 100,
          width: 500,
          setConstraints: (c: any) => {
            groupConstraintsPassed.push(c);
          },
          setSize: (s: any) => {
            groupSizesPassed.push(s);
          },
        },
        panels: [],
      },
    };

    const mockLayer: GisLayer = {
      id: "layer-dock-grow",
      name: "Dock Grow Layer",
      kind: "vector",
      geometryKind: "Polygon",
      visible: true,
      opacity: 1.0,
      color: "#3b82f6",
      featureCount: 1,
      fields: [
        {
          name: "name",
          nativeType: "String",
          inferredType: "string",
          nullable: false,
        },
      ],
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = "layer-dock-grow";

    await act(async () => {
      root!.render(
        React.createElement(AttributeTableWidget, {
          api: mockPanelApi as any,
          panelApi: mockPanelApi as any,
          location: "bottom",
        })
      );
    });

    // 1. Verify panel.api.setConstraints receives minimumHeight 192.208
    assert.ok(
      constraintsPassed.length > 0,
      "panel.api.setConstraints must be called"
    );
    const lastConstraint = constraintsPassed[constraintsPassed.length - 1];
    assert.strictEqual(
      lastConstraint.minimumHeight,
      192.208,
      "panel.api minimumHeight must be 192.208px"
    );

    // 2. Verify groupApi.setConstraints receives minimumHeight 192.208
    assert.ok(
      groupConstraintsPassed.length > 0,
      "groupApi.setConstraints must be called"
    );
    const lastGroupConstraint =
      groupConstraintsPassed[groupConstraintsPassed.length - 1];
    assert.strictEqual(
      lastGroupConstraint.minimumHeight,
      192.208,
      "groupApi minimumHeight must be 192.208px"
    );

    // 3. Verify dock panel automatically grows to 192.208px because current height (100px) was smaller
    assert.ok(
      groupSizesPassed.length > 0,
      "groupApi.setSize must be called to grow dock panel"
    );
    assert.strictEqual(
      groupSizesPassed[groupSizesPassed.length - 1].height,
      192.208,
      "groupApi must grow height to 192.208px"
    );

    assert.ok(
      sizesPassed.length > 0,
      "panelApi.setSize must be called to grow panel"
    );
    assert.strictEqual(
      sizesPassed[sizesPassed.length - 1].height,
      192.208,
      "panelApi must grow height to 192.208px"
    );
  });

  describe("AttributeTableWidget Vertical Column Dividers and Fixed Layout (Ticket #188)", () => {
    it("renders table with table-layout fixed, explicit initial column widths, and vertical border dividers on all header and body cells", async () => {
      const mockLayer: GisLayer = {
        id: "layer-grid-test",
        name: "Grid Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1.0,
        color: "#3b82f6",
        featureCount: 2,
        fields: [
          {
            name: "name",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
          {
            name: "category",
            nativeType: "String",
            inferredType: "string",
            nullable: true,
          },
        ],
      };

      const mockFeatures = [
        {
          id: "f-1",
          properties: { name: "Alpha", category: "CatA" },
          geometryType: "Point",
          coordinates: [0, 0],
        },
        {
          id: "f-2",
          properties: { name: "Beta", category: "CatB" },
          geometryType: "Point",
          coordinates: [1, 1],
        },
      ];

      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string, _options: any) => ({
          layerId,
          features: mockFeatures,
          totalMatched: 2,
        }),
      };

      layersSignal.value = [mockLayer];
      activeLayerIdSignal.value = "layer-grid-test";

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        const tableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        assert.ok(tableEl, "table element must be rendered");
        assert.strictEqual(
          tableEl.style.tableLayout,
          "fixed",
          "table must use table-layout: fixed"
        );
        assert.strictEqual(
          tableEl.style.borderCollapse,
          "collapse",
          "table must have border-collapse: collapse"
        );

        const scrollWrapperEl = findAllNodes(container, (el) =>
          el.className.includes("table-scroll-wrapper")
        )[0];
        assert.ok(scrollWrapperEl, "table scroll wrapper must be present");
        assert.strictEqual(
          scrollWrapperEl.style.overflow,
          "auto",
          "scroll wrapper must enable overflow auto for horizontal scrolling"
        );

        // Check header cells
        const thNodes = findAllNodes(tableEl, (el) => el.tagName === "TH");
        assert.strictEqual(
          thNodes.length,
          3,
          "must render 1 system column (#) + 2 attribute columns"
        );

        for (const th of thNodes) {
          assert.strictEqual(
            th.style.borderRight,
            "1px solid var(--cartouche-menubar-bg, #1b446c)",
            "all th cells must have 1px solid var(--cartouche-menubar-bg, #1b446c) border-right"
          );
          assert.ok(
            th.style.width,
            "all th cells must have explicit initial width"
          );
        }

        // Check body rows and cells
        const trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        // header row + 2 data rows
        assert.strictEqual(
          trNodes.length,
          3,
          "must render 1 header row and 2 feature data rows"
        );

        const dataRow1 = trNodes[1];
        const tdNodesRow1 = findAllNodes(dataRow1, (el) => el.tagName === "TD");
        assert.strictEqual(
          tdNodesRow1.length,
          3,
          "data row must render 3 td cells"
        );

        for (const td of tdNodesRow1) {
          assert.strictEqual(
            td.style.borderRight,
            "1px solid var(--cartouche-menubar-bg, #1b446c)",
            "all td cells must have 1px solid var(--cartouche-menubar-bg, #1b446c) border-right"
          );
        }

        // Verify column dividers persist when row is selected (Ticket #192)
        await act(async () => {
          selectedFeatureIdsSignal.value = new Set(["f-1"]);
        });
        const selectedRow = findAllNodes(
          tableEl,
          (el) => el.tagName === "TR" && el.className?.includes("selected-row")
        )[0];
        assert.ok(selectedRow, "selected row must have selected-row class");
        const selectedTds = findAllNodes(
          selectedRow,
          (el) => el.tagName === "TD"
        );
        for (const td of selectedTds) {
          assert.strictEqual(
            td.style.borderRight,
            "1px solid var(--cartouche-menubar-bg, #1b446c)",
            "selected row cells must retain 1px solid var(--cartouche-menubar-bg, #1b446c) border-right"
          );
        }
      } finally {
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });
  });

  describe("AttributeTableWidget Interactive Column Resizing and Auto-Fit (Ticket #189)", () => {
    it("renders interactive column resize drag handles on each column header with col-resize cursor", async () => {
      const mockLayer: GisLayer = {
        id: "layer-resize-test",
        name: "Resize Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1.0,
        color: "#3b82f6",
        featureCount: 1,
        fields: [
          {
            name: "title",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };

      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string, _options: any) => ({
          layerId,
          features: [
            {
              id: "1",
              properties: { title: "Test" },
              geometryType: "Point",
              coordinates: [0, 0],
            },
          ],
          totalMatched: 1,
        }),
      };

      layersSignal.value = [mockLayer];
      activeLayerIdSignal.value = "layer-resize-test";

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        const handles = findAllNodes(container, (el) =>
          el.className.includes("column-resize-handle")
        );
        // 1 system column (#) + 1 attribute column = 2 handles
        assert.strictEqual(
          handles.length,
          2,
          "each column header must have a column resize separator"
        );
        for (const h of handles) {
          assert.strictEqual(
            h.style.cursor,
            "col-resize",
            "handle must have col-resize cursor"
          );
        }
      } finally {
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });

    it("drags column resize separator to adjust column width independently and hard-clamps at minimum text width", async () => {
      const mockLayer: GisLayer = {
        id: "layer-drag-test",
        name: "Drag Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1.0,
        color: "#3b82f6",
        featureCount: 1,
        fields: [
          {
            name: "col_a",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
          {
            name: "very_long_column_name_header",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };

      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string, _options: any) => ({
          layerId,
          features: [
            {
              id: "1",
              properties: {
                col_a: "Val",
                very_long_column_name_header: "LongVal",
              },
              geometryType: "Point",
              coordinates: [0, 0],
            },
          ],
          totalMatched: 1,
        }),
      };

      layersSignal.value = [mockLayer];
      activeLayerIdSignal.value = "layer-drag-test";

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        const tableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        const thNodes = findAllNodes(tableEl, (el) => el.tagName === "TH");
        const colATh = thNodes[1]; // col_a header
        const longColTh = thNodes[2]; // very_long_column_name_header
        const handleColA = findAllNodes(colATh, (el) =>
          el.className.includes("column-resize-handle")
        )[0];
        const handleLongCol = findAllNodes(longColTh, (el) =>
          el.className.includes("column-resize-handle")
        )[0];
        assert.ok(handleColA, "col_a header must have column resize separator");
        assert.ok(
          handleLongCol,
          "longCol header must have column resize separator"
        );

        const initialWidth = parseInt(colATh.style.width, 10);

        // 1. Drag expand col_a by +80px
        await act(async () => {
          handleColA.dispatchEvent({
            type: "mousedown",
            clientX: 100,
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        const moveListeners = windowListeners["mousemove"] || [];
        assert.ok(
          moveListeners.length > 0,
          "mousemove listener must be registered on drag start"
        );

        await act(async () => {
          for (const l of moveListeners) {
            l.cb({ clientX: 180 });
          }
        });

        const upListeners = windowListeners["mouseup"] || [];
        await act(async () => {
          for (const l of upListeners) {
            l.cb({ clientX: 180 });
          }
        });

        const expandedWidth = parseInt(colATh.style.width, 10);
        assert.strictEqual(
          expandedWidth,
          initialWidth + 80,
          "column width should expand by 80px"
        );

        // 2. Drag shrink col_a: minimum width is 5 chars * 8 = 40 + 24 = 64px
        await act(async () => {
          handleColA.dispatchEvent({
            type: "mousedown",
            clientX: 180,
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        const moveListeners2 = windowListeners["mousemove"] || [];
        await act(async () => {
          for (const l of moveListeners2) {
            l.cb({ clientX: -200 });
          }
        });

        const upListeners2 = windowListeners["mouseup"] || [];
        await act(async () => {
          for (const l of upListeners2) {
            l.cb({ clientX: -200 });
          }
        });

        const clampedWidthColA = parseInt(colATh.style.width, 10);
        assert.strictEqual(
          clampedWidthColA,
          64,
          "col_a must clamp to its calculated minimum width (64px)"
        );

        // 3. Test long column header clamping: 28 chars * 8 = 224 + 24 = 248px
        await act(async () => {
          handleLongCol.dispatchEvent({
            type: "mousedown",
            clientX: 200,
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        const moveListeners3 = windowListeners["mousemove"] || [];
        await act(async () => {
          for (const l of moveListeners3) {
            l.cb({ clientX: 0 }); // Attempt to shrink by 200px
          }
        });

        const upListeners3 = windowListeners["mouseup"] || [];
        await act(async () => {
          for (const l of upListeners3) {
            l.cb({ clientX: 0 });
          }
        });

        const clampedWidthLongCol = parseInt(longColTh.style.width, 10);
        assert.ok(
          clampedWidthLongCol >= 240,
          `long column must clamp to its header width >= 240px (got ${clampedWidthLongCol})`
        );
      } finally {
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });

    it("double clicks column resize separator to auto-fit column to widest visible content", async () => {
      const mockLayer: GisLayer = {
        id: "layer-autofit-test",
        name: "AutoFit Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1.0,
        color: "#3b82f6",
        featureCount: 2,
        fields: [
          {
            name: "desc",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };

      const longText =
        "This is a substantially long description text that requires wide column auto-fit";

      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string, _options: any) => ({
          layerId,
          features: [
            {
              id: "1",
              properties: { desc: "Short" },
              geometryType: "Point",
              coordinates: [0, 0],
            },
            {
              id: "2",
              properties: { desc: longText },
              geometryType: "Point",
              coordinates: [1, 1],
            },
          ],
          totalMatched: 2,
        }),
      };

      layersSignal.value = [mockLayer];
      activeLayerIdSignal.value = "layer-autofit-test";

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        const tableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        const thNodes = findAllNodes(tableEl, (el) => el.tagName === "TH");
        const attrTh = thNodes[1];
        const handle = findAllNodes(attrTh, (el) =>
          el.className.includes("column-resize-handle")
        )[0];

        await act(async () => {
          handle.dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        const autoFittedWidth = parseInt(attrTh.style.width, 10);
        // longText is 79 characters * 8 = 632 + padding >= 650
        assert.ok(
          autoFittedWidth >= 600,
          `auto-fit width should accommodate widest cell text (got ${autoFittedWidth})`
        );
      } finally {
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });

    it("persists customized column widths in session cache per layer across layer switches", async () => {
      const layer1: GisLayer = {
        id: "layer-cache-1",
        name: "Layer One",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1.0,
        color: "#3b82f6",
        featureCount: 1,
        fields: [
          {
            name: "field_a",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };

      const layer2: GisLayer = {
        id: "layer-cache-2",
        name: "Layer Two",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1.0,
        color: "#ef4444",
        featureCount: 1,
        fields: [
          {
            name: "field_b",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };

      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string, _options: any) => ({
          layerId,
          features: [
            {
              id: "1",
              properties: { field_a: "ValA", field_b: "ValB" },
              geometryType: "Point",
              coordinates: [0, 0],
            },
          ],
          totalMatched: 1,
        }),
      };

      layersSignal.value = [layer1, layer2];
      activeLayerIdSignal.value = "layer-cache-1";

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        // Resize field_a on layer-cache-1
        let tableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        let thNodes = findAllNodes(tableEl, (el) => el.tagName === "TH");
        let handle = findAllNodes(thNodes[1], (el) =>
          el.className.includes("column-resize-handle")
        )[0];

        await act(async () => {
          handle.dispatchEvent({
            type: "mousedown",
            clientX: 100,
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });
        const moveListeners = windowListeners["mousemove"] || [];
        await act(async () => {
          for (const l of moveListeners) l.cb({ clientX: 350 }); // +250px
        });
        const upListeners = windowListeners["mouseup"] || [];
        await act(async () => {
          for (const l of upListeners) l.cb({ clientX: 350 });
        });

        const customizedWidth = parseInt(thNodes[1].style.width, 10);
        assert.ok(
          customizedWidth > 300,
          `customized width should be >300 (got ${customizedWidth})`
        );

        // Switch to layer-cache-2
        await act(async () => {
          activeLayerIdSignal.value = "layer-cache-2";
        });

        // Switch back to layer-cache-1
        await act(async () => {
          activeLayerIdSignal.value = "layer-cache-1";
        });

        tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        thNodes = findAllNodes(tableEl, (el) => el.tagName === "TH");
        const restoredWidth = parseInt(thNodes[1].style.width, 10);
        assert.strictEqual(
          restoredWidth,
          customizedWidth,
          "customized column width must be restored from per-layer session cache"
        );
      } finally {
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });
  });

  describe("AttributeTableWidget Inferred Type Formatting and Locale Reactivity (Ticket #190)", () => {
    it("formats date, time, datetime, integer, real, boolean, and null values according to active locale and inferred schema", async () => {
      const mockLayer: GisLayer = {
        id: "layer-formatting-test",
        name: "Formatting Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1.0,
        color: "#3b82f6",
        featureCount: 2,
        fields: [
          {
            name: "date_col",
            nativeType: "Date",
            inferredType: "date",
            nullable: false,
          },
          {
            name: "time_col",
            nativeType: "Time",
            inferredType: "time",
            nullable: false,
          },
          {
            name: "datetime_col",
            nativeType: "DateTime",
            inferredType: "datetime",
            nullable: false,
          },
          {
            name: "int_col",
            nativeType: "Integer",
            inferredType: "integer",
            nullable: false,
          },
          {
            name: "real_col",
            nativeType: "Real",
            inferredType: "real",
            nullable: false,
          },
          {
            name: "bool_col",
            nativeType: "Boolean",
            inferredType: "boolean",
            nullable: false,
          },
          {
            name: "null_col",
            nativeType: "String",
            inferredType: "string",
            nullable: true,
          },
        ],
      };

      const mockFeatures = [
        {
          id: "feat-1",
          properties: {
            date_col: "2026-11-06",
            time_col: "14:30:00",
            datetime_col: "2026-11-06T14:30:00Z",
            int_col: 1250000,
            real_col: 9876.54,
            bool_col: true,
            null_col: null,
          },
          geometryType: "Point",
          coordinates: [0, 0],
        },
        {
          id: "feat-2",
          properties: {
            date_col: "2026-05-15",
            time_col: "08:15:00",
            datetime_col: "2026-05-15T08:15:00Z",
            int_col: -42,
            real_col: 0.125,
            bool_col: false,
            null_col: undefined,
          },
          geometryType: "Point",
          coordinates: [1, 1],
        },
      ];

      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string, _options: any) => ({
          layerId,
          features: mockFeatures,
          totalMatched: 2,
        }),
      };

      activeLocaleSignal.value = "en";
      layersSignal.value = [mockLayer];
      activeLayerIdSignal.value = "layer-formatting-test";

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        const tableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        const trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        const row1 = trNodes[1];
        const tdRow1 = findAllNodes(row1, (el) => el.tagName === "TD");

        // Indices: 0: counter, 1: date_col, 2: time_col, 3: datetime_col, 4: int_col, 5: real_col, 6: bool_col, 7: null_col
        const expectedDate = new Intl.DateTimeFormat("en", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        }).format(new Date(2026, 10, 6));
        assert.strictEqual(
          tdRow1[1].textContent,
          expectedDate,
          "date_col must format via Intl.DateTimeFormat"
        );

        // int_col: 1,250,000 with right alignment
        const expectedInt = new Intl.NumberFormat("en", {
          maximumFractionDigits: 0,
        }).format(1250000);
        assert.strictEqual(
          tdRow1[4].textContent,
          expectedInt,
          "integer must format via Intl.NumberFormat"
        );
        assert.strictEqual(
          tdRow1[4].style.textAlign,
          "right",
          "integer cell must be right-aligned"
        );

        // real_col: 9,876.54 with right alignment
        const expectedReal = new Intl.NumberFormat("en").format(9876.54);
        assert.strictEqual(
          tdRow1[5].textContent,
          expectedReal,
          "real must format via Intl.NumberFormat"
        );
        assert.strictEqual(
          tdRow1[5].style.textAlign,
          "right",
          "real cell must be right-aligned"
        );

        // bool_col: "True"
        assert.strictEqual(
          tdRow1[6].textContent,
          "True",
          "bool_col true must display as True"
        );

        // null_col: cell-null-value span with text NULL
        const nullSpan = findAllNodes(tdRow1[7], (el) =>
          el.className.includes("cell-null-value")
        )[0];
        assert.ok(nullSpan, "null_col must render .cell-null-value element");
        assert.strictEqual(nullSpan.textContent, "NULL");
        assert.strictEqual(nullSpan.style.fontStyle, "italic");

        // Row 2 checks
        const row2 = trNodes[2];
        const tdRow2 = findAllNodes(row2, (el) => el.tagName === "TD");
        assert.strictEqual(
          tdRow2[6].textContent,
          "False",
          "bool_col false must display as False"
        );
        const undefinedSpan = findAllNodes(tdRow2[7], (el) =>
          el.className.includes("cell-null-value")
        )[0];
        assert.ok(
          undefinedSpan,
          "undefined value must render .cell-null-value element"
        );
        assert.strictEqual(undefinedSpan.textContent, "NULL");

        // Reactive locale update
        await act(async () => {
          activeLocaleSignal.value = "fr";
          dictionarySignal.value = {
            boolean_true: "Vrai",
            boolean_false: "Faux",
          };
        });

        // In French locale:
        // bool_col: "Vrai"
        assert.strictEqual(
          tdRow1[6].textContent,
          "Vrai",
          "boolean field must reactively update to localized string on activeLocaleSignal change"
        );
        assert.strictEqual(
          tdRow2[6].textContent,
          "Faux",
          "boolean field must reactively update to localized string on activeLocaleSignal change"
        );

        // Number grouping in French uses non-breaking space
        const expectedIntFr = new Intl.NumberFormat("fr", {
          maximumFractionDigits: 0,
        }).format(1250000);
        assert.strictEqual(
          tdRow1[4].textContent,
          expectedIntFr,
          "integer field must reactively update to French locale formatting"
        );
      } finally {
        activeLocaleSignal.value = "en";
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });
  });

  describe("AttributeTableWidget Type-Specialized Cell Editors and Input Validation (Ticket #191)", () => {
    it("activates specialized HTML5 inputs for dates, times, select for boolean, and validates numbers", async () => {
      const mockLayer: GisLayer = {
        id: "layer-editors-test",
        name: "Editors Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1.0,
        color: "#3b82f6",
        featureCount: 1,
        fields: [
          {
            name: "date_field",
            nativeType: "Date",
            inferredType: "date",
            nullable: false,
          },
          {
            name: "time_field",
            nativeType: "Time",
            inferredType: "time",
            nullable: false,
          },
          {
            name: "datetime_field",
            nativeType: "DateTime",
            inferredType: "datetime",
            nullable: false,
          },
          {
            name: "int_field",
            nativeType: "Integer",
            inferredType: "integer",
            nullable: false,
          },
          {
            name: "real_field",
            nativeType: "Real",
            inferredType: "real",
            nullable: false,
          },
          {
            name: "bool_field",
            nativeType: "Boolean",
            inferredType: "boolean",
            nullable: false,
          },
        ],
      };

      const stagedEdits: Array<{ layerId: string; feature: any }> = [];
      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string, _options: any) => ({
          layerId,
          features: [
            {
              id: "feat-100",
              layerId,
              geometryType: "Point",
              properties: {
                date_field: "2026-11-06",
                time_field: "14:30:00",
                datetime_field: "2026-11-06T14:30",
                int_field: 100,
                real_field: 25.5,
                bool_field: true,
              },
              coordinates: [0, 0],
            },
          ],
          totalMatched: 1,
        }),
        stageFeatureEdit: async (layerId: string, feature: any) => {
          stagedEdits.push({ layerId, feature });
        },
      };

      layersSignal.value = [mockLayer];
      activeLayerIdSignal.value = "layer-editors-test";
      editableLayerIdsSignal.value = new Set(["layer-editors-test"]);

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        // 1. Double-click date field: activates <input type="date"> initialized with YYYY-MM-DD
        let tableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        let trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        let dataRow = trNodes[1];
        let tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");
        // Indices: 0: counter, 1: date, 2: time, 3: datetime, 4: int, 5: real, 6: bool

        await act(async () => {
          tdCells[1].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        let dateInput = findAllNodes(
          container,
          (el) => el.tagName === "INPUT"
        )[0];
        assert.ok(dateInput, "date input should be active");
        assert.strictEqual(
          dateInput.getAttribute("type"),
          "date",
          'input must be type="date"'
        );
        assert.strictEqual(
          dateInput.value,
          "2026-11-06",
          "date input must be initialized with YYYY-MM-DD"
        );

        const triggerChange = (el: any, val: string) => {
          const propKey = Object.keys(el).find((k) =>
            k.startsWith("__reactProps")
          )!;
          (el as any)[propKey].onChange({ target: { value: val } });
        };
        const triggerKeyDown = (el: any, key: string) => {
          const propKey = Object.keys(el).find((k) =>
            k.startsWith("__reactProps")
          )!;
          (el as any)[propKey].onKeyDown({ key, preventDefault: () => {} });
        };
        const triggerBlur = (el: any) => {
          const propKey = Object.keys(el).find((k) =>
            k.startsWith("__reactProps")
          )!;
          (el as any)[propKey].onBlur();
        };

        // Change date value and commit
        await act(async () => {
          dateInput.value = "2026-12-25";
          triggerChange(dateInput, "2026-12-25");
        });
        await act(async () => {
          triggerKeyDown(dateInput, "Enter");
        });

        assert.strictEqual(stagedEdits.length, 1);
        assert.strictEqual(
          stagedEdits[0].feature.properties.date_field,
          "2026-12-25"
        );
        assert.ok(editedFeatureIdsSignal.value.has("feat-100"));

        // 2. Double-click time field: activates <input type="time"> initialized with HH:MM
        tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        dataRow = trNodes[1];
        tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");

        await act(async () => {
          tdCells[2].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        let timeInput = findAllNodes(
          container,
          (el) => el.tagName === "INPUT"
        )[0];
        assert.ok(timeInput, "time input should be active");
        assert.strictEqual(
          timeInput.getAttribute("type"),
          "time",
          'input must be type="time"'
        );
        assert.strictEqual(
          timeInput.value,
          "14:30",
          "time input must be initialized with HH:MM"
        );

        await act(async () => {
          timeInput.value = "18:45";
          triggerChange(timeInput, "18:45");
        });
        await act(async () => {
          triggerKeyDown(timeInput, "Enter");
        });

        assert.strictEqual(stagedEdits.length, 2);
        assert.strictEqual(
          stagedEdits[1].feature.properties.time_field,
          "18:45"
        );

        // 3. Double-click datetime field: activates <input type="datetime-local"> initialized with YYYY-MM-DDTHH:MM
        tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        dataRow = trNodes[1];
        tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");

        await act(async () => {
          tdCells[3].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        let dtInput = findAllNodes(
          container,
          (el) => el.tagName === "INPUT"
        )[0];
        assert.ok(dtInput, "datetime input should be active");
        assert.strictEqual(
          dtInput.getAttribute("type"),
          "datetime-local",
          'input must be type="datetime-local"'
        );
        assert.strictEqual(
          dtInput.value,
          "2026-11-06T14:30",
          "datetime input initialized with YYYY-MM-DDTHH:MM"
        );

        await act(async () => {
          dtInput.value = "2026-12-25T18:45";
          triggerChange(dtInput, "2026-12-25T18:45");
        });
        await act(async () => {
          triggerKeyDown(dtInput, "Enter");
        });

        assert.strictEqual(stagedEdits.length, 3);
        assert.strictEqual(
          stagedEdits[2].feature.properties.datetime_field,
          "2026-12-25T18:45"
        );

        // 4. Double-click integer field: parses localized number, truncates decimal, commits integer
        tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        dataRow = trNodes[1];
        tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");

        await act(async () => {
          tdCells[4].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        let intInput = findAllNodes(
          container,
          (el) => el.tagName === "INPUT"
        )[0];
        assert.ok(intInput, "int input should be active");

        await act(async () => {
          intInput.value = "1,250.75";
          triggerChange(intInput, "1,250.75");
        });
        await act(async () => {
          triggerKeyDown(intInput, "Enter");
        });

        assert.strictEqual(stagedEdits.length, 4);
        assert.strictEqual(
          stagedEdits[3].feature.properties.int_field,
          1250,
          "integer must truncate decimals"
        );

        // Integer non-numeric validation: reverts cleanly without staging
        tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        dataRow = trNodes[1];
        tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");

        await act(async () => {
          tdCells[4].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        intInput = findAllNodes(container, (el) => el.tagName === "INPUT")[0];
        await act(async () => {
          intInput.value = "invalid_abc";
          triggerChange(intInput, "invalid_abc");
        });
        await act(async () => {
          triggerKeyDown(intInput, "Enter");
        });

        // Staged edits should still be 4 (no new edit staged for invalid text!)
        assert.strictEqual(
          stagedEdits.length,
          4,
          "invalid non-numeric input must not stage an edit"
        );

        // 5. Double-click real field: parses localized numeric input
        tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        dataRow = trNodes[1];
        tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");

        await act(async () => {
          tdCells[5].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        let realInput = findAllNodes(
          container,
          (el) => el.tagName === "INPUT"
        )[0];
        await act(async () => {
          realInput.value = "1 250,5";
          triggerChange(realInput, "1 250,5");
        });
        await act(async () => {
          triggerKeyDown(realInput, "Enter");
        });

        assert.strictEqual(stagedEdits.length, 5);
        assert.strictEqual(
          stagedEdits[4].feature.properties.real_field,
          1250.5
        );

        // Real non-numeric validation: reverts cleanly
        tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        dataRow = trNodes[1];
        tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");

        await act(async () => {
          tdCells[5].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        realInput = findAllNodes(container, (el) => el.tagName === "INPUT")[0];
        await act(async () => {
          realInput.value = "not_a_real";
          triggerChange(realInput, "not_a_real");
        });
        await act(async () => {
          triggerKeyDown(realInput, "Enter");
        });

        assert.strictEqual(
          stagedEdits.length,
          5,
          "invalid real text must not stage an edit"
        );

        // 6. Double-click boolean field: renders <select> with True/False options and commits boolean primitive
        tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        dataRow = trNodes[1];
        tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");

        await act(async () => {
          tdCells[6].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        const boolSelect = findAllNodes(
          container,
          (el) =>
            el.tagName === "SELECT"
            && el.className.includes("cell-editor-boolean")
        )[0];
        assert.ok(
          boolSelect,
          "<select> dropdown must be active for boolean field"
        );
        const options = boolSelect.options;
        assert.strictEqual(
          options.length,
          2,
          "boolean dropdown must have 2 options"
        );

        await act(async () => {
          boolSelect.value = "false";
          triggerChange(boolSelect, "false");
        });
        await act(async () => {
          triggerBlur(boolSelect);
        });

        assert.strictEqual(stagedEdits.length, 6);
        assert.strictEqual(
          stagedEdits[5].feature.properties.bool_field,
          false,
          "boolean editor must commit boolean primitive false"
        );
      } finally {
        editableLayerIdsSignal.value = new Set();
        delete (globalThis as any).window.electronAPI.queryExtent;
        delete (globalThis as any).window.electronAPI.stageFeatureEdit;
      }
    });
  });

  describe("AttributeTableWidget Cell Truncation and Tooltip Titles (Ticket #193)", () => {
    it("enforces overflow ellipsis truncation styles and native title tooltips on all table data cells while keeping inline editors fully usable", async () => {
      const truncLayer: GisLayer = {
        id: "layer-trunc-193",
        name: "Truncation Test Layer",
        kind: "vector",
        geometryKind: "Polygon",
        visible: true,
        opacity: 1.0,
        color: "#3b82f6",
        featureCount: 1,
        fields: [
          { name: "long_desc", nativeType: "String", inferredType: "string" },
          {
            name: "population",
            nativeType: "Integer",
            inferredType: "integer",
          },
          {
            name: "active_flag",
            nativeType: "Boolean",
            inferredType: "boolean",
          },
          { name: "notes", nativeType: "String", inferredType: "string" },
        ],
      };

      const testFeature = {
        id: "feat-trunc-1",
        layerId: "layer-trunc-193",
        geometryType: "Polygon",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
        },
        properties: {
          long_desc:
            "123 Very Long Street Avenue, Building 4A, Suite 500, Metro City, ST 99999",
          population: 1250,
          active_flag: true,
          notes: null,
        },
      };

      const stagedEdits: Array<{ layerId: string; feature: any }> = [];
      if (!(globalThis as any).window.electronAPI) {
        (globalThis as any).window.electronAPI = {};
      }
      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string) => ({
          layerId,
          features: [testFeature],
          totalMatched: 1,
        }),
        stageFeatureEdit: async (layerId: string, feature: any) => {
          stagedEdits.push({ layerId, feature });
          return { success: true };
        },
      };

      try {
        activeLocaleSignal.value = "en";
        layersSignal.value = [truncLayer];
        activeLayerIdSignal.value = truncLayer.id;
        editableLayerIdsSignal.value = new Set([truncLayer.id]);
        featuresSignal.value = [testFeature];

        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        const tableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        assert.ok(tableEl, "table element must be rendered");

        const trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        // 1 header row + 1 data row
        assert.strictEqual(
          trNodes.length,
          2,
          "table must render 1 header row and 1 data row"
        );

        const dataRow = trNodes[1];
        const tdCells = findAllNodes(dataRow, (el) => el.tagName === "TD");
        // System cols: counter (1) + 4 attribute cols = 5
        assert.strictEqual(
          tdCells.length,
          5,
          "must render 5 td cells for feature row"
        );

        // 1. Verify overflow, text-overflow, and white-space styles on all td cells
        for (let i = 0; i < tdCells.length; i++) {
          const td = tdCells[i];
          assert.strictEqual(
            td.style.overflow,
            "hidden",
            `cell index ${i} must enforce overflow: hidden`
          );
          assert.strictEqual(
            td.style.textOverflow,
            "ellipsis",
            `cell index ${i} must enforce text-overflow: ellipsis`
          );
          assert.strictEqual(
            td.style.whiteSpace,
            "nowrap",
            `cell index ${i} must enforce white-space: nowrap`
          );
        }

        // 2. Verify native title tooltips on rendered cells
        // System counter cell
        assert.strictEqual(
          tdCells[0].getAttribute("title"),
          "1",
          "counter cell must have native title matching row number"
        );
        // Long string attribute cell: full unclipped text
        assert.strictEqual(
          tdCells[1].getAttribute("title"),
          "123 Very Long Street Avenue, Building 4A, Suite 500, Metro City, ST 99999",
          "long string cell must have native title with full unclipped text"
        );
        // Formatted integer cell
        assert.strictEqual(
          tdCells[2].getAttribute("title"),
          "1,250",
          "integer cell must have native title with formatted number"
        );
        // Localized boolean cell
        assert.strictEqual(
          tdCells[3].getAttribute("title"),
          "True",
          "boolean cell must have native title True"
        );
        // Null attribute cell
        assert.strictEqual(
          tdCells[4].getAttribute("title"),
          "NULL",
          "null cell must have native title NULL"
        );

        // 3. Verify active inline editor controls remain fully visible and usable
        // Double click long_desc to edit text
        await act(async () => {
          tdCells[1].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        let textInput = findAllNodes(
          container,
          (el) => el.tagName === "INPUT"
        )[0];
        assert.ok(textInput, "text input must be active in cell editor");
        assert.strictEqual(
          textInput.style.width,
          "100%",
          "editor input must have width 100%"
        );
        assert.strictEqual(
          textInput.style.boxSizing,
          "border-box",
          "editor input must have boxSizing border-box"
        );

        const triggerChange = (el: any, val: string) => {
          const propKey = Object.keys(el).find((k) =>
            k.startsWith("__reactProps")
          )!;
          (el as any)[propKey].onChange({ target: { value: val } });
        };
        const triggerKeyDown = (el: any, key: string) => {
          const propKey = Object.keys(el).find((k) =>
            k.startsWith("__reactProps")
          )!;
          (el as any)[propKey].onKeyDown({ key, preventDefault: () => {} });
        };
        const triggerBlur = (el: any) => {
          const propKey = Object.keys(el).find((k) =>
            k.startsWith("__reactProps")
          )!;
          (el as any)[propKey].onBlur();
        };

        await act(async () => {
          textInput.value = "Updated Street Address";
          triggerChange(textInput, "Updated Street Address");
        });
        await act(async () => {
          triggerKeyDown(textInput, "Enter");
        });

        assert.strictEqual(stagedEdits.length, 1);
        assert.strictEqual(
          stagedEdits[0].feature.properties.long_desc,
          "Updated Street Address"
        );

        // Double click bool cell to edit boolean select
        const updatedTableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        const updatedRow = findAllNodes(
          updatedTableEl,
          (el) => el.tagName === "TR"
        )[1];
        const updatedTds = findAllNodes(
          updatedRow,
          (el) => el.tagName === "TD"
        );

        await act(async () => {
          updatedTds[3].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });

        const boolSelect = findAllNodes(
          container,
          (el) =>
            el.tagName === "SELECT"
            && el.className.includes("cell-editor-boolean")
        )[0];
        assert.ok(boolSelect, "boolean select must be active in cell editor");
        assert.strictEqual(
          boolSelect.style.width,
          "100%",
          "editor select must have width 100%"
        );
        assert.strictEqual(
          boolSelect.style.boxSizing,
          "border-box",
          "editor select must have boxSizing border-box"
        );

        await act(async () => {
          boolSelect.value = "false";
          triggerChange(boolSelect, "false");
        });
        await act(async () => {
          triggerBlur(boolSelect);
        });

        assert.strictEqual(stagedEdits.length, 2);
        assert.strictEqual(
          stagedEdits[1].feature.properties.active_flag,
          false
        );
      } finally {
        editableLayerIdsSignal.value = new Set();
        delete (globalThis as any).window.electronAPI.queryExtent;
        delete (globalThis as any).window.electronAPI.stageFeatureEdit;
      }
    });
  });

  describe("AttributeTableWidget Synthetic Type Column Suppression and Dataset Field Preservation (Ticket #201)", () => {
    it("suppresses synthetic Type column while preserving physical dataset fields named geom_type", async () => {
      const layer: GisLayer = {
        id: "layer-type-test",
        name: "Type Test Layer",
        kind: "vector",
        geometryKind: "Polygon",
        visible: true,
        opacity: 1,
        color: "#10b981",
        featureCount: 2,
        fields: [
          { name: "geom_type", nativeType: "String", inferredType: "string" },
          {
            name: "feature_label",
            nativeType: "String",
            inferredType: "string",
          },
        ],
      };

      (globalThis as any).window.electronAPI = {
        queryExtent: async () => ({
          layerId: "layer-type-test",
          totalMatched: 2,
          features: [
            {
              id: "f-1",
              properties: {
                geom_type: "custom_polygon_code",
                feature_label: "Feature One",
              },
              geometryType: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
            {
              id: "f-2",
              properties: {
                geom_type: "custom_multipolygon_code",
                feature_label: "Feature Two",
              },
              geometryType: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [2, 0],
                  [2, 2],
                  [0, 0],
                ],
              ],
            },
          ],
        }),
      };

      try {
        await act(async () => {
          dictionarySignal.value = {
            attribute_table_col_counter: "#",
            attribute_table_col_id: "ID",
          };
          layersSignal.value = [layer];
          activeLayerIdSignal.value = "layer-type-test";
          root!.render(React.createElement(AttributeTableWidget));
        });

        const tableEl = findAllNodes(
          container,
          (el) => el.tagName === "TABLE"
        )[0];
        assert.ok(tableEl, "table element must render");

        const thEls = findAllNodes(tableEl, (el) => el.tagName === "TH");
        const headerTexts = thEls.map((th) => th.textContent);

        // Expected headers: '#' and physical fields 'geom_type', 'feature_label' (single identity column '#')
        // There must be NO synthetic 'Type' column header and NO 'ID' column when fidColumn is absent
        assert.deepStrictEqual(headerTexts, [
          "#",
          "geom_type",
          "feature_label",
        ]);

        const trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        assert.strictEqual(
          trNodes.length,
          3,
          "table must render 1 header row and 2 data rows"
        );

        const firstDataRow = trNodes[1];
        const tdCells = findAllNodes(firstDataRow, (el) => el.tagName === "TD");
        assert.strictEqual(
          tdCells.length,
          3,
          "feature row must render exactly 3 cells"
        );

        // Cells: 0: counter, 1: geom_type (physical attribute), 2: feature_label
        assert.strictEqual(tdCells[0].textContent, "1", "row counter");
        assert.strictEqual(
          tdCells[1].textContent,
          "custom_polygon_code",
          "physical geom_type attribute value"
        );
        assert.strictEqual(
          tdCells[2].textContent,
          "Feature One",
          "feature_label attribute value"
        );

        // Ensure no cell has class 'cell-geometry-type'
        const geomTypeCells = findAllNodes(tableEl, (el) =>
          Boolean(el.className && el.className.includes("cell-geometry-type"))
        );
        assert.strictEqual(
          geomTypeCells.length,
          0,
          "cell-geometry-type must not be present in DOM"
        );
      } finally {
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });
  });

  describe("AttributeTableWidget Dual-Tier Identity Column and Capabilities (Ticket #202)", () => {
    it("renders single persistent FID column when fidColumn is present and suppresses row counter '#'", async () => {
      const mockLayerWithFid: GisLayer = {
        id: "layer-fid-test",
        name: "FID Layer",
        kind: "vector",
        geometryKind: "Polygon",
        visible: true,
        opacity: 1,
        color: "#2563eb",
        featureCount: 2,
        fidColumn: "ogc_fid",
        capabilities: {
          randomWrite: true,
          deleteFeature: true,
          fastRandomRead: true,
        },
        fields: [
          {
            name: "ogc_fid",
            nativeType: "Integer",
            inferredType: "integer",
            nullable: false,
          },
          {
            name: "county_name",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };

      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string) => ({
          layerId,
          features: [
            {
              id: "501",
              properties: { ogc_fid: 501, county_name: "Arapahoe" },
              geometryType: "Polygon",
              coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
            },
            {
              id: "502",
              properties: { ogc_fid: 502, county_name: "Boulder" },
              geometryType: "Polygon",
              coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]],
            },
          ],
          totalMatched: 2,
        }),
      };

      layersSignal.value = [mockLayerWithFid];
      activeLayerIdSignal.value = "layer-fid-test";

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        const tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        assert.ok(tableEl, "table element must render");

        const thEls = findAllNodes(tableEl, (el) => el.tagName === "TH");
        const headerTexts = thEls.map((th) => th.textContent);

        // Header MUST render 'ogc_fid' (from fidColumn) and 'county_name', deduplicating ogc_fid from attributes.
        // Counter '#' MUST be suppressed.
        assert.deepStrictEqual(headerTexts, ["ogc_fid", "county_name"]);

        const trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        const row1 = trNodes[1];
        const tdCells = findAllNodes(row1, (el) => el.tagName === "TD");

        // Exactly 2 cells: FID cell and county_name cell
        assert.strictEqual(tdCells.length, 2);
        assert.strictEqual(tdCells[0].textContent, "501", "FID cell renders feature ID");
        assert.strictEqual(tdCells[1].textContent, "Arapahoe", "county_name attribute value");

        // Double-clicking FID cell must NOT activate an editor (identity columns are strictly read-only)
        await act(async () => {
          tdCells[0].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });
        const inputs = findAllNodes(container, (el) => el.tagName === "INPUT");
        assert.strictEqual(inputs.length, 0, "identity cell must not activate an editor on double click");

        // Single-clicking FID cell selects the row
        await act(async () => {
          tdCells[0].dispatchEvent({
            type: "click",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });
        assert.ok(selectedFeatureIdsSignal.value.has("501"), "clicking FID cell must select row");
      } finally {
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });

    it("renders single sequential counter '#' column when fidColumn is empty or undefined and suppresses 'ID'", async () => {
      const mockLayerNoFid: GisLayer = {
        id: "layer-no-fid-test",
        name: "No FID Layer",
        kind: "vector",
        geometryKind: "Point",
        visible: true,
        opacity: 1,
        color: "#10b981",
        featureCount: 1,
        fidColumn: "",
        fields: [
          {
            name: "site_code",
            nativeType: "String",
            inferredType: "string",
            nullable: false,
          },
        ],
      };

      (globalThis as any).window.electronAPI = {
        ...(globalThis as any).window.electronAPI,
        queryExtent: async (layerId: string) => ({
          layerId,
          features: [
            {
              id: "v-99",
              properties: { site_code: "SITE-ALPHA" },
              geometryType: "Point",
              coordinates: [10, 20],
            },
          ],
          totalMatched: 1,
        }),
      };

      dictionarySignal.value = {
        attribute_table_col_counter: "#",
        attribute_table_col_id: "ID",
      };
      layersSignal.value = [mockLayerNoFid];
      activeLayerIdSignal.value = "layer-no-fid-test";

      try {
        await act(async () => {
          root!.render(React.createElement(AttributeTableWidget));
        });

        const tableEl = findAllNodes(container, (el) => el.tagName === "TABLE")[0];
        const thEls = findAllNodes(tableEl, (el) => el.tagName === "TH");
        const headerTexts = thEls.map((th) => th.textContent);

        // Header MUST render '#' and 'site_code'. 'ID' MUST be suppressed.
        assert.deepStrictEqual(headerTexts, ["#", "site_code"]);

        const trNodes = findAllNodes(tableEl, (el) => el.tagName === "TR");
        const row1 = trNodes[1];
        const tdCells = findAllNodes(row1, (el) => el.tagName === "TD");

        assert.strictEqual(tdCells.length, 2);
        assert.strictEqual(tdCells[0].textContent, "1", "1-based sequential counter");
        assert.strictEqual(tdCells[1].textContent, "SITE-ALPHA", "site_code attribute value");

        // Double-clicking counter cell must NOT activate an editor
        await act(async () => {
          tdCells[0].dispatchEvent({
            type: "dblclick",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });
        const inputs = findAllNodes(container, (el) => el.tagName === "INPUT");
        assert.strictEqual(inputs.length, 0, "counter cell must not activate an editor on double click");

        // Single-clicking counter cell selects the row
        await act(async () => {
          tdCells[0].dispatchEvent({
            type: "click",
            preventDefault: () => {},
            stopPropagation: () => {},
          });
        });
        assert.ok(selectedFeatureIdsSignal.value.has("v-99"), "clicking counter cell must select row");
      } finally {
        dictionarySignal.value = {};
        delete (globalThis as any).window.electronAPI.queryExtent;
      }
    });
  });
});
