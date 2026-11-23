/**
 * @file WorkbenchStatusBar.test.ts
 * @module tests/renderer/workbench/WorkbenchStatusBar.test
 * @description Unit and component tests for WorkbenchStatusBar verifying reactive signal updates for cursor coordinates, cartographic scale, selected features count, the Project CRS item (ADR 0033 display rules and tooltips), and the memory meter item and its per-process tooltip (approximate resident totals, and exact PSS and private-bytes totals) rendered with the real en.xml strings, each status bar item's text in a truncating `.statusbar-item-label` with the CRS icon marked as a non-shrinking item icon (#393), every memory meter string key present in en.xml and fr.xml, while ensuring zero re-renders of the root Workbench shell and outer ToolbarPanel components during coordinate signal mutations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link WorkbenchStatusBar}
 * @see {@link Workbench}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { decodeXmlEntities } from "../../../src/main/i18n/xmlEntityDecoder";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRendererJiti } from "../rendererJiti";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const require = createRequire(import.meta.url);
require.extensions[".svg"] = (mod: any) => {
  mod.exports = "mock-logo.svg";
};
require.extensions[".css"] = (mod: any) => {
  mod.exports = {};
};

const jiti = createRendererJiti(import.meta.url);

const {
  cursorCoordsSignal,
  scaleDenominatorSignal,
  selectedFeatureIdsSignal,
  selectedFeaturesCountSignal,
} = jiti("@renderer/state/gisSignals");
const { dictionarySignal } = jiti("@renderer/state/i18nSignals");

/**
 * @function loadDictionary
 * @description Reads a locale's `assets/xml/i18n/<locale>.xml` into a key → string dictionary, parsing it as `I18nStore` does (I18nStore itself imports electron).
 * @param {string} locale - Locale file name without extension.
 * @returns {Record<string, string>} The dictionary.
 */
function loadDictionary(locale: string): Record<string, string> {
  const xml = fs.readFileSync(
    path.resolve(process.cwd(), `assets/xml/i18n/${locale}.xml`),
    "utf-8"
  );
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    processEntities: false,
    stopNodes: ["*.string", "ci18n:localization.string"],
  }).parse(xml);
  const root = parsed["ci18n:localization"] ?? parsed.localization;
  const dictionary: Record<string, string> = {};
  for (const entry of [root.string].flat()) {
    if (entry?.["@_name"]) {
      dictionary[entry["@_name"]] = decodeXmlEntities(entry["#text"] ?? "");
    }
  }
  return dictionary;
}

const EN_DICTIONARY = loadDictionary("en");
const { setProjectCrs } = jiti("@renderer/state/projectSignals");

/**
 * @class MockElement
 * @description Lightweight mock DOM Element for headless React 19 testing in Node.js.
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
    cssText: string;
  };
  className = "";
  classList = {
    add: () => {},
    remove: () => {},
    contains: () => false,
    toggle: () => false,
  };
  attributes: Record<string, string> = {};
  eventListeners: Record<
    string,
    Array<{ cb: (e: any) => void; capture: boolean }>
  > = {};
  disabled = false;

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
    const styleObj: Record<string, string> = { cssText: "" };
    this.style = Object.assign(styleObj, {
      cssText: "",
      setProperty: (name: string, val: string) => {
        styleObj[name] = val;
      },
      removeProperty: (name: string) => {
        delete styleObj[name];
      },
      getPropertyValue: (name: string) => styleObj[name] || "",
    });
  }

  setAttribute(key: string, val: string): void {
    this.attributes[key] = String(val);
    if (key === "class") {
      this.className = String(val);
    }
    if (key === "disabled") {
      this.disabled = true;
    }
  }

  getAttribute(key: string): string | null {
    if (key === "disabled" && this.disabled) return "";
    return this.attributes[key] ?? null;
  }

  hasAttribute(key: string): boolean {
    if (key === "disabled") return this.disabled;
    return key in this.attributes;
  }

  removeAttribute(key: string): void {
    delete this.attributes[key];
    if (key === "disabled") {
      this.disabled = false;
    }
  }

  appendChild(child: any): any {
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  prepend(child: any): any {
    this.childNodes.unshift(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child: any): any {
    this.childNodes = this.childNodes.filter((c) => c !== child);
    child.parentNode = null;
    return child;
  }

  insertBefore(newChild: any, refChild: any): any {
    const idx = this.childNodes.indexOf(refChild);
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, newChild);
    } else {
      this.childNodes.push(newChild);
    }
    newChild.parentNode = this;
    return newChild;
  }

  addEventListener(type: string, cb: (e: any) => void, opts?: any): void {
    const capture = typeof opts === "boolean" ? opts : Boolean(opts?.capture);
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
    const listeners = (this.eventListeners[event.type] || []).slice();
    for (const { cb } of listeners) {
      cb(event);
    }
    if (event.bubbles !== false && this.parentNode && !event.cancelBubble) {
      this.parentNode.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  contains(other: any): boolean {
    if (other === this) return true;
    for (const child of this.childNodes) {
      if (child && child.contains && child.contains(other)) return true;
    }
    return false;
  }

  get textContent(): string {
    if (this.childNodes.length > 0) {
      return this.childNodes
        .map((c) =>
          c.nodeType === 3 ?
            c.nodeValue || c.textContent || ""
          : c.textContent || ""
        )
        .join("");
    }
    return (this as any)._textContent || "";
  }

  set textContent(val: string) {
    (this as any)._textContent = String(val);
  }
}

/**
 * @function findAllNodes
 * @description Recursively searches mock DOM tree for elements matching predicate.
 * @param {MockElement} rootNode - Root node to traverse.
 * @param {(el: MockElement) => boolean} predicate - Match predicate.
 * @returns {MockElement[]} Matching elements.
 */
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

/**
 * @function hasClass
 * @description Tests whether a mock element carries a class.
 * @param {MockElement} el - Element to test.
 * @param {string} name - Class name.
 * @returns {boolean} True when the element has the class.
 */
function hasClass(el: MockElement, name: string): boolean {
  return String(el.className).split(" ").includes(name);
}

let doc: any;
let container: MockElement;
let root: Root | null = null;
let memoryListener: ((snapshot: any) => void) | null = null;

/**
 * @function residentRow
 * @description Builds a memory breakdown row counted by resident memory (approximate).
 * @param {string} kind - Breakdown group.
 * @param {number | undefined} pid - OS pid, or undefined for the Other row.
 * @param {number} currentKb - Current resident memory in kB.
 * @param {number} peakKb - Peak resident memory in kB.
 * @returns {object} The row.
 */
function residentRow(
  kind: string,
  pid: number | undefined,
  currentKb: number,
  peakKb: number
) {
  return {
    kind,
    pid,
    currentKb,
    peakKb,
    residentKb: currentKb,
    approximate: true,
  };
}

/**
 * @function setupDom
 * @description Initializes headless mock DOM environment for React 19 testing.
 * @returns {void}
 */
function setupDom(): void {
  const documentElement = new MockElement("html");
  const body = new MockElement("body");
  documentElement.appendChild(body);

  doc = {
    nodeType: 9,
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
    createTextNode: (text: string) => ({
      nodeType: 3,
      nodeValue: text,
      textContent: text,
      ownerDocument: doc,
      parentNode: null,
    }),
    createComment: (data: string) => ({
      nodeType: 8,
      data,
      ownerDocument: doc,
      parentNode: null,
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    defaultView: null as any,
  };
  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;
  documentElement.parentNode = doc;

  const MockResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  const win = {
    document: doc,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {},
    removeEventListener: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    ResizeObserver: MockResizeObserver,
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    electronAPI: {
      getActions: async () => [],
      executeAction: () => {},
      getPreferences: async () => [],
      isWindowMaximized: async () => false,
      onMaximizedState: () => () => {},
      onLayerAdded: () => () => {},
      onMemoryUsage: (callback: (snapshot: any) => void) => {
        memoryListener = callback;
        return () => {
          memoryListener = null;
        };
      },
    },
  };

  doc.defaultView = win;
  (globalThis as any).window = win;
  (globalThis as any).document = doc;
  (globalThis as any).ResizeObserver = MockResizeObserver;
  (globalThis as any).localStorage = win.localStorage;
}

describe("WorkbenchStatusBar Reactivity and Workbench Render Isolation", () => {
  beforeEach(() => {
    setupDom();
    container = doc.createElement("div");
    doc.body.appendChild(container);
    root = createRoot(container as any);

    cursorCoordsSignal.value = null;
    scaleDenominatorSignal.value = 25000000;
    setProjectCrs(null);
    selectedFeatureIdsSignal.value = new Set();
    dictionarySignal.value = EN_DICTIONARY;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    cursorCoordsSignal.value = null;
    scaleDenominatorSignal.value = 25000000;
    setProjectCrs(null);
    selectedFeatureIdsSignal.value = new Set();
  });

  it("renders default status bar items when cursorCoordsSignal is null", async () => {
    const { WorkbenchStatusBar } = jiti(
      "@renderer/workbench/WorkbenchStatusBar"
    ) as { WorkbenchStatusBar: React.FC };

    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });

    const footers = findAllNodes(
      container,
      (el) => el.tagName === "FOOTER" && el.className === "workbench-statusbar"
    );
    assert.equal(
      footers.length,
      1,
      "Expected footer.workbench-statusbar element"
    );

    const text = footers[0].textContent;
    assert.ok(
      text.includes("Coordinate: 0.0000°, 0.0000°"),
      "Expected fallback coordinate text"
    );
    assert.ok(
      text.includes(`Scale: 1 : ${(25000000).toLocaleString()}`),
      "Expected formatted cartographic scale"
    );
    assert.ok(text.includes("Selected: 0"), "Expected selected features count");
    assert.ok(
      text.includes("EPSG:3857"),
      "Expected default drawing CRS when no Project CRS is set"
    );
    assert.ok(text.includes("● Ready"), "Expected application core status");
  });

  it("updates reactively when cursorCoordsSignal, scaleDenominatorSignal, the Project CRS, and selectedFeaturesCountSignal change", async () => {
    const { WorkbenchStatusBar } = jiti(
      "@renderer/workbench/WorkbenchStatusBar"
    ) as { WorkbenchStatusBar: React.FC };

    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });

    await act(async () => {
      cursorCoordsSignal.value = { lon: 12.3456, lat: 45.6789, x: 100, y: 200 };
    });
    assert.ok(
      container.textContent.includes("12.3456°E, 45.6789°N"),
      `Expected positive E/N coordinates in status bar, got: ${container.textContent}`
    );

    await act(async () => {
      cursorCoordsSignal.value = {
        lon: -75.6972,
        lat: -33.4489,
        x: 300,
        y: 400,
      };
    });
    assert.ok(
      container.textContent.includes("75.6972°W, 33.4489°S"),
      `Expected negative W/S coordinates in status bar, got: ${container.textContent}`
    );

    await act(async () => {
      scaleDenominatorSignal.value = 50000;
      setProjectCrs({
        authId: "EPSG:2003",
        description: "Grenada 1953 / British West Indies Grid",
      });
      selectedFeatureIdsSignal.value = new Set(["feat-1", "feat-2", "feat-3"]);
    });

    assert.equal(selectedFeaturesCountSignal.value, 3);
    assert.ok(
      container.textContent.includes(`Scale: 1 : ${(50000).toLocaleString()}`),
      "Expected updated scale denominator"
    );
    assert.ok(
      container.textContent.includes("Selected: 3"),
      "Expected updated selected feature count"
    );
    assert.ok(
      container.textContent.includes("EPSG:2003"),
      "Expected updated Project CRS"
    );
  });

  it("shows the Project CRS display rules with their tooltips", async () => {
    const { WorkbenchStatusBar } = jiti(
      "@renderer/workbench/WorkbenchStatusBar"
    ) as { WorkbenchStatusBar: React.FC };

    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });

    /**
     * @function crsItem
     * @description Finds the status bar CRS item.
     * @returns {any} The CRS item element.
     */
    const crsItem = () =>
      findAllNodes(container, (el) => hasClass(el, "statusbar-crs"))[0];

    assert.equal(crsItem().textContent, "EPSG:3857");
    assert.match(
      crsItem().getAttribute("title") ?? "",
      /default drawing CRS.*no Project CRS is set/i
    );

    await act(async () => {
      setProjectCrs({
        authId: "EPSG:2003",
        description: "Grenada 1953 / British West Indies Grid",
      });
    });
    assert.equal(crsItem().textContent, "EPSG:2003");
    assert.equal(
      crsItem().getAttribute("title"),
      "Grenada 1953 / British West Indies Grid"
    );

    await act(async () => {
      setProjectCrs({ authId: "", none: true });
    });
    assert.equal(crsItem().textContent, "No CRS");
    assert.match(crsItem().getAttribute("title") ?? "", /no reprojection/i);
  });

  it("shows the memory meter total and its per-process tooltip once Main pushes a sample", async () => {
    const { WorkbenchStatusBar } = jiti(
      "@renderer/workbench/WorkbenchStatusBar"
    );

    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });

    /**
     * @function memoryItem
     * @description Finds the status bar memory item.
     * @returns {any} The memory item element, if rendered.
     */
    const memoryItem = () =>
      findAllNodes(container, (el) => hasClass(el, "statusbar-memory"))[0];

    assert.equal(memoryItem(), undefined, "No memory item before a sample");
    assert.ok(memoryListener, "Status bar subscribes to memory samples");

    await act(async () => {
      memoryListener!({
        totalKb: 1.2 * 1024 * 1024,
        measure: "resident",
        approximate: true,
        rows: [
          residentRow("main", 10, 200 * 1024, 250 * 1024),
          residentRow("workbench", 20, 300 * 1024, 310 * 1024),
          residentRow("worker", 50, 400 * 1024, 2 * 1024 * 1024),
          residentRow("gpu", 30, 100 * 1024, 120 * 1024),
          residentRow("other", undefined, 1024, 2048),
        ],
      });
    });

    assert.equal(memoryItem().textContent, "Memory: ≈1.2 GB");
    const lines = (memoryItem().getAttribute("title") ?? "").split("\n");
    assert.match(lines[0], /approximate/i);
    assert.ok(lines.includes("Main: 200 MB (peak 250 MB)"), lines.join(" | "));
    assert.ok(lines.includes("Workbench (PID 20): 300 MB (peak 310 MB)"));
    assert.ok(lines.includes("Geospatial Worker: 400 MB (peak 2 GB)"));
    assert.ok(lines.includes("GPU: 100 MB (peak 120 MB)"));
    assert.ok(lines.includes("Other: 1 MB (peak 2 MB)"));
    assert.match(lines[lines.length - 1], /in each of them/);

    await act(async () => {
      memoryListener!({
        totalKb: 512 * 1024,
        measure: "resident",
        approximate: true,
        rows: [residentRow("main", 10, 512 * 1024, 512 * 1024)],
      });
    });
    assert.equal(memoryItem().textContent, "Memory: ≈512 MB");
    assert.doesNotMatch(
      memoryItem().getAttribute("title") ?? "",
      /Geospatial Worker/,
      "Worker row omitted when the sample has none"
    );
  });

  it("shows an exact PSS total without the approximate mark, with private and shared memory per row, on Linux", async () => {
    const { WorkbenchStatusBar } = jiti(
      "@renderer/workbench/WorkbenchStatusBar"
    );
    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });
    await act(async () => {
      memoryListener!({
        totalKb: 700 * 1024,
        measure: "proportional",
        approximate: false,
        rows: [
          {
            kind: "main",
            pid: 10,
            currentKb: 600 * 1024,
            peakKb: 950 * 1024,
            residentKb: 900 * 1024,
            privateKb: 550 * 1024,
            sharedKb: 350 * 1024,
            approximate: false,
          },
        ],
      });
    });

    const item = findAllNodes(container, (el) =>
      hasClass(el, "statusbar-memory")
    )[0];
    assert.equal(item.textContent, "Memory: 700 MB");
    const lines = (item.getAttribute("title") ?? "").split("\n");
    assert.match(lines[0], /proportional/i);
    assert.doesNotMatch(lines[0], /approximate/i);
    assert.ok(
      lines.includes(
        "Main: 600 MB (private 550 MB, shared 350 MB, peak resident 950 MB)"
      ),
      lines.join(" | ")
    );
    assert.equal(
      lines.some((line) => /in each of them/.test(line)),
      false,
      "No shared-pages note on an exact total"
    );
  });

  it("names the resident fallback for a process whose precise figure could not be read, and marks the total approximate", async () => {
    const { WorkbenchStatusBar } = jiti(
      "@renderer/workbench/WorkbenchStatusBar"
    );
    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });
    await act(async () => {
      memoryListener!({
        totalKb: 900 * 1024,
        measure: "private",
        approximate: true,
        rows: [
          {
            kind: "main",
            pid: 10,
            currentKb: 600 * 1024,
            peakKb: 950 * 1024,
            residentKb: 900 * 1024,
            approximate: false,
          },
          residentRow("gpu", 30, 300 * 1024, 310 * 1024),
        ],
      });
    });

    const item = findAllNodes(container, (el) =>
      hasClass(el, "statusbar-memory")
    )[0];
    assert.equal(item.textContent, "Memory: ≈900 MB");
    const lines = (item.getAttribute("title") ?? "").split("\n");
    assert.match(lines[0], /approximate/i);
    assert.match(lines[0], /private bytes/i);
    assert.ok(
      lines.includes(
        "Main: 600 MB (working set 900 MB, peak working set 950 MB)"
      ),
      lines.join(" | ")
    );
    assert.ok(
      lines.includes(
        "GPU: 300 MB approximate, including resident memory (peak 310 MB)"
      ),
      lines.join(" | ")
    );
    assert.match(lines[lines.length - 1], /in each of them/);
  });

  it("puts each status bar item's text in a truncating label and marks the CRS icon as a non-shrinking item icon (#393)", async () => {
    const { WorkbenchStatusBar } = jiti(
      "@renderer/workbench/WorkbenchStatusBar"
    );

    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });
    await act(async () => {
      memoryListener!({
        totalKb: 512 * 1024,
        measure: "resident",
        approximate: true,
        rows: [residentRow("main", 10, 512 * 1024, 600 * 1024)],
      });
    });

    const items = findAllNodes(container, (el) =>
      hasClass(el, "statusbar-item")
    );
    assert.equal(items.length, 6, "Expected six status bar items");
    for (const item of items) {
      const labels = item.childNodes.filter(
        (c: any) => c?.nodeType === 1 && hasClass(c, "statusbar-item-label")
      );
      assert.equal(labels.length, 1, `One label in "${item.textContent}"`);
      assert.equal(
        labels[0].textContent,
        item.textContent,
        "All of an item's text sits in its label"
      );
      assert.ok(item.getAttribute("title"), "Full text stays in the tooltip");
    }

    const crs = items.find((el) => hasClass(el, "statusbar-crs"))!;
    const icons = findAllNodes(crs, (el) =>
      hasClass(el, "statusbar-item-icon")
    );
    assert.equal(icons.length, 1, "CRS item icon carries the icon class");
    assert.equal(icons[0].tagName, "SVG");
  });

  it("finds every memory meter string key it uses in en.xml and fr.xml", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/renderer/workbench/WorkbenchStatusBar.tsx"
      ),
      "utf-8"
    );
    const keys = new Set(
      [...source.matchAll(/"((?:statusbar_memory|memory_size)_\w+)"/g)].map(
        (match) => match[1]
      )
    );
    assert.ok(keys.size >= 20, `Expected the memory keys, found ${keys.size}`);
    const fr = loadDictionary("fr");
    for (const key of keys) {
      assert.ok(key in EN_DICTIONARY, `en.xml lacks ${key}`);
      assert.ok(key in fr, `fr.xml lacks ${key}`);
    }
  });

  it("isolates coordinate and status bar signal mutations from Workbench and ToolbarPanel re-renders", async () => {
    let workbenchRenderCount = 0;
    let toolbarPanelRenderCount = 0;
    let statusBarRenderCount = 0;

    const { Workbench } = jiti("@renderer/workbench/Workbench") as {
      Workbench: React.FC;
    };
    const { DockviewReact } = jiti("dockview-react");
    const { ToolbarContainerWidget } = jiti(
      "@renderer/workbench/widgets/ToolbarContainerWidget"
    ) as { ToolbarContainerWidget: React.FC<any> };

    const origCreateElement = React.createElement;
    (React as any).createElement = function (
      type: any,
      props: any,
      ...children: any[]
    ) {
      if (type === "div" && props?.className === "workbench-container") {
        workbenchRenderCount++;
      }
      if (type === ToolbarContainerWidget) {
        toolbarPanelRenderCount++;
      }
      if (type === "footer" && props?.className === "workbench-statusbar") {
        statusBarRenderCount++;
      }
      if (type === DockviewReact) {
        return origCreateElement("div", { className: "mock-dockview" });
      }
      return origCreateElement(type, props, ...children);
    };

    try {
      await act(async () => {
        root!.render(origCreateElement(Workbench));
      });

      const initialWorkbenchRenders = workbenchRenderCount;
      const initialToolbarRenders = toolbarPanelRenderCount;
      const initialStatusBarRenders = statusBarRenderCount;
      assert.ok(
        initialWorkbenchRenders >= 1,
        "Workbench must render on initial mount"
      );
      assert.ok(
        initialToolbarRenders >= 4,
        "All 4 outer ToolbarPanel zones must render on initial mount"
      );
      assert.ok(
        initialStatusBarRenders >= 1,
        "WorkbenchStatusBar must render on initial mount"
      );

      // Mutate cursorCoordsSignal, scaleDenominatorSignal, and the Project CRS repeatedly (simulating pointermove and pan/zoom frames)
      await act(async () => {
        cursorCoordsSignal.value = { lon: 10.1234, lat: 20.5678, x: 50, y: 60 };
      });
      await act(async () => {
        cursorCoordsSignal.value = { lon: 11.2345, lat: 21.6789, x: 55, y: 65 };
      });
      await act(async () => {
        cursorCoordsSignal.value = { lon: 12.3456, lat: 22.789, x: 60, y: 70 };
        scaleDenominatorSignal.value = 100000;
        setProjectCrs({ authId: "EPSG:2003" });
      });

      // Verify WorkbenchStatusBar inside Workbench updated its rendered output and re-rendered
      const footers = findAllNodes(
        container,
        (el) =>
          el.tagName === "FOOTER" && el.className === "workbench-statusbar"
      );
      assert.equal(footers.length, 1);
      assert.ok(footers[0].textContent.includes("12.3456°E, 22.7890°N"));
      assert.ok(
        footers[0].textContent.includes(
          `Scale: 1 : ${(100000).toLocaleString()}`
        )
      );
      assert.ok(footers[0].textContent.includes("EPSG:2003"));
      assert.ok(
        statusBarRenderCount > initialStatusBarRenders,
        "WorkbenchStatusBar must re-render when status bar signals mutate"
      );

      // Verify Workbench and ToolbarPanel render counts remained completely constant
      assert.equal(
        workbenchRenderCount,
        initialWorkbenchRenders,
        "Workbench must not re-render when cursor coordinates, scale, or CRS signals mutate"
      );
      assert.equal(
        toolbarPanelRenderCount,
        initialToolbarRenders,
        "Outer ToolbarPanel components must not re-render when cursor coordinates, scale, or CRS signals mutate"
      );
    } finally {
      (React as any).createElement = origCreateElement;
    }
  });
});
