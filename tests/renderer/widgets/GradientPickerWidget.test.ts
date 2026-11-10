/**
 * @file GradientPickerWidget.test.ts
 * @module tests/renderer/widgets/GradientPickerWidget.test
 * @description Component and unit tests verifying GradientPickerWidget 2 lh preview bar, inline boundary stop buttons, intermediate stop toggle pins, drag physics with pointer capture, stop deletion, double-click creation with color interpolation, and embedded ColourPickerWidget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @see {@link GradientPickerWidget}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import path from "node:path";
import createJiti from "jiti";

// Set React act environment flag
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Lightweight MockElement representation for headless React 19 testing in Node.js.
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
  attributes: Record<string, string> = {};
  eventListeners: Record<
    string,
    Array<{ cb: (e: any) => void; capture: boolean }>
  > = {};
  private _value = "";

  get value(): string {
    if (this.tagName === "SELECT") {
      const selected = this.options.find((opt) => opt.selected);
      if (selected) {
        return selected.value || selected.attributes?.value || "";
      }
    }
    return this._value;
  }

  set value(v: string) {
    this._value = String(v);
    if (this.tagName === "SELECT") {
      for (const opt of this.options) {
        opt.selected = opt.value === v || opt.attributes?.value === v;
      }
    }
  }

  disabled = false;
  title = "";
  multiple = false;
  private _selected = false;

  get selected(): boolean {
    return this._selected;
  }

  set selected(val: boolean) {
    this._selected = Boolean(val);
    if (this._selected && this.parentNode && this.parentNode.tagName === "SELECT" && !this.parentNode.multiple) {
      for (const opt of this.parentNode.options) {
        if (opt !== this) {
          opt._selected = false;
        }
      }
    }
  }

  selectedIndex = 0;

  get options(): any[] {
    return this.childNodes.filter((c) => c.tagName === "OPTION");
  }

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
      getPropertyValue: (name: string) => {
        return styleProps[name] || "";
      },
    });
  }

  setAttribute(k: string, v: string): void {
    this.attributes[k] = String(v);
    if (k === "class") {
      this.className = String(v);
    }
    if (k === "value") {
      this.value = String(v);
    }
    if (k === "title") {
      this.title = String(v);
    }
    if (k === "disabled") {
      this.disabled = true;
    }
  }

  getAttribute(k: string): string | undefined {
    return this.attributes[k];
  }

  removeAttribute(k: string): void {
    delete this.attributes[k];
    if (k === "class") {
      this.className = "";
    }
    if (k === "disabled") {
      this.disabled = false;
    }
  }

  appendChild(child: any): any {
    this.childNodes.push(child);
    child.parentNode = this;
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

  insertBefore(newNode: any, refNode: any): any {
    const idx = this.childNodes.indexOf(refNode);
    if (idx === -1) {
      return this.appendChild(newNode);
    }
    this.childNodes.splice(idx, 0, newNode);
    newNode.parentNode = this;
    return newNode;
  }

  addEventListener(
    type: string,
    cb: (e: any) => void,
    capture?: boolean
  ): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture: Boolean(capture) });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(
      (l) => l.cb !== cb
    );
  }

  dispatchEvent(event: any): boolean {
    if (!event.target || !(event.target instanceof MockElement)) {
      if (event.target && event.target.value !== undefined) {
        this.value = event.target.value;
      }
      event.target = this;
    }
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

  setPointerCapture(_id: number): void {}
  releasePointerCapture(_id: number): void {}

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
    return { width: 200, height: 40, top: 0, left: 0, right: 200, bottom: 40 };
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
    dispatchEvent: (event: any) => {
      const listeners = (windowListeners[event.type] || []).slice();
      for (const { cb } of listeners) {
        cb(event);
      }
      return !event.defaultPrevented;
    },
    document: doc,
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement,
  };
  doc.defaultView = win;

  (globalThis as any).document = doc;
  (globalThis as any).window = win;
  (globalThis as any).HTMLIFrameElement = class {};
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
    act(() => {
      root?.unmount();
    });
    root = null;
  }
}

/**
 * Traverses element tree to collect elements matching a CSS class name.
 */
function findElementsByClass(
  el: MockElement,
  className: string
): MockElement[] {
  const matches: MockElement[] = [];
  if (el.className && el.className.split(/\s+/).includes(className)) {
    matches.push(el);
  }
  for (const child of el.childNodes) {
    if (child instanceof MockElement) {
      matches.push(...findElementsByClass(child, className));
    }
  }
  return matches;
}

/**
 * @function getStopButtonsSorted
 * @description Collects all gradient stop toggle buttons and returns them sorted by offset ascending.
 * @param {MockElement} el - Container element.
 * @returns {MockElement[]} Array of stop button elements sorted by offset.
 */
function getStopButtonsSorted(el: MockElement): MockElement[] {
  const btns = findElementsByClass(el, "gradient-stop-toggle-btn");
  return btns.slice().sort((a, b) => {
    const parseOffset = (btn: MockElement) => {
      const match = (btn.getAttribute("aria-label") || "").match(/([\d.]+)%/);
      return match ? parseFloat(match[1]) : 0;
    };
    return parseOffset(a) - parseOffset(b);
  });
}

// Load GradientPickerWidget using jiti
const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    "@renderer": path.resolve(process.cwd(), "src/renderer"),
    "@shared": path.resolve(process.cwd(), "src/shared"),
    "@main": path.resolve(process.cwd(), "src/main"),
  },
});

const { GradientPickerWidget, parseInitialStops, serializeGradientStops } =
  jiti("../../../src/renderer/workbench/widgets/GradientPickerWidget.tsx");

const { prefsUiIconSize } = jiti(
  "../../../src/renderer/state/preferencesSignals.ts"
);

describe("GradientPickerWidget Component & Interactions (Ticket #207)", () => {
  beforeEach(() => {
    setupDom();
    prefsUiIconSize.value = 20; // 20% of 20 = 4px swatch
  });

  afterEach(() => {
    tearDownDom();
  });

  it("renders BasicWidget container, header, 2 lh preview bar, and default 0% and 100% boundary stops", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          displayName: "Custom Gradient",
        })
      );
    });

    // Check widget container
    const widgetEls = findElementsByClass(container, "gradient-picker-widget");
    assert.equal(
      widgetEls.length,
      1,
      "Must render outer GradientPickerWidget container"
    );

    // Check 2 lh preview bar
    const previewBars = findElementsByClass(
      container,
      "gradient-picker-preview-bar"
    );
    assert.equal(previewBars.length, 1, "Must render preview bar");
    assert.equal(
      previewBars[0].style.height,
      "2lh",
      "Preview bar height must be 2lh"
    );

    // Check stop toggle buttons
    const stopBtns = getStopButtonsSorted(container);
    assert.equal(
      stopBtns.length,
      2,
      "Must render 2 initial stop toggle buttons"
    );

    // Check flanking boundary stop buttons
    const boundaryBtns = findElementsByClass(
      container,
      "gradient-stop-boundary-btn"
    );
    assert.equal(
      boundaryBtns.length,
      2,
      "Must render 2 flanking boundary stop buttons"
    );

    // Check vertical guide lines (omitted for boundary stops)
    const guideLines = findElementsByClass(
      container,
      "gradient-stop-guide-line"
    );
    assert.equal(
      guideLines.length,
      0,
      "Must omit guide lines for 0% and 100% boundary stops"
    );

    // Check swatches inside buttons
    const swatches = findElementsByClass(container, "gradient-stop-swatch");
    assert.equal(
      swatches.length,
      2,
      "Must render inner swatch in each stop button"
    );
    // Swatch size = 20% of 20 = 4px
    assert.equal(
      swatches[0].style.width,
      "4px",
      "Swatch width must be 20% of icon size"
    );

    // Check embedded ColourPickerWidget is present
    const colourPickers = findElementsByClass(
      container,
      "colour-picker-widget"
    );
    assert.equal(
      colourPickers.length,
      1,
      "Must render embedded ColourPickerWidget"
    );
  });

  it("supports single-selection toggle button set where active stop cannot be untoggled", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#ff0000ff 0%", "#0000ffff 100%"],
        })
      );
    });

    const stopBtns = findElementsByClass(container, "gradient-stop-toggle-btn");
    assert.equal(stopBtns.length, 2);

    // Initial stop 0 is active
    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "true");
    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "false");

    // Click stop 1 to activate it
    await act(async () => {
      stopBtns[1].dispatchEvent({ type: "click", bubbles: true });
    });

    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "false");
    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "true");

    // Click stop 1 again: cannot be untoggled
    await act(async () => {
      stopBtns[1].dispatchEvent({ type: "click", bubbles: true });
    });

    assert.equal(
      stopBtns[1].getAttribute("aria-pressed"),
      "true",
      "Active stop cannot be untoggled"
    );
  });

  it("prevents dragging or deleting boundary stops at 0% and 100%", async () => {
    let changedStops: string[] | null = null;

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ffffff 100%"],
          onChange: (stops: string[]) => {
            changedStops = stops;
          },
        })
      );
    });

    const deleteBtn = findElementsByClass(
      container,
      "gradient-picker-delete-btn"
    )[0];
    assert.ok(deleteBtn, "Delete button must be rendered");
    assert.equal(
      deleteBtn.disabled,
      true,
      "Delete button must be disabled when 0% boundary stop is active"
    );

    const stopBtns = findElementsByClass(container, "gradient-stop-toggle-btn");

    // Try to drag 0% stop
    await act(async () => {
      stopBtns[0].dispatchEvent({
        type: "pointerdown",
        button: 0,
        clientX: 0,
        pointerId: 1,
        bubbles: true,
      });
    });

    // Dispatch window pointermove to 50px
    await act(async () => {
      const listeners = windowListeners["pointermove"] || [];
      for (const { cb } of listeners) {
        cb({ clientX: 50 });
      }
    });

    assert.equal(
      changedStops,
      null,
      "Dragging 0% boundary stop must be prevented"
    );
  });

  it("double-clicking the gradient preview bar creates a new stop with linearly interpolated color", async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#00ff00ff 100%"],
          onChange: (stops: string[]) => {
            latestStops = stops;
          },
        })
      );
    });

    const previewBar = findElementsByClass(
      container,
      "gradient-picker-preview-bar"
    )[0];
    assert.ok(previewBar);

    // Double click at 50% (clientX = 100 on 200px wide bar)
    await act(async () => {
      previewBar.dispatchEvent({
        type: "dblclick",
        clientX: 100,
        bubbles: true,
      });
    });

    const stopBtns = getStopButtonsSorted(container);
    assert.equal(stopBtns.length, 3, "Must create a 3rd stop on double click");

    // Stop at 50% is active
    assert.equal(
      stopBtns[1].getAttribute("aria-pressed"),
      "true",
      "Newly created stop must become active"
    );

    // Verify interpolated color: between #000000ff and #00ff00ff at 50% is #008000ff
    assert.equal(latestStops.length, 3);
    assert.equal(latestStops[0], "#000000ff 0%");
    assert.equal(latestStops[1], "#008000ff 50%");
    assert.equal(latestStops[2], "#00ff00ff 100%");
  });

  it("dragging an intermediate stop moves it horizontally and updates gradient and onChange", async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#008000ff 50%", "#00ff00ff 100%"],
          onChange: (stops: string[]) => {
            latestStops = stops;
          },
        })
      );
    });

    const stopBtns = getStopButtonsSorted(container);
    assert.equal(stopBtns.length, 3);

    // Pointer down on intermediate stop (50%)
    await act(async () => {
      stopBtns[1].dispatchEvent({
        type: "pointerdown",
        button: 0,
        clientX: 100,
        pointerId: 1,
        bubbles: true,
      });
    });

    // Move pointer to 150px (75% on 200px bar)
    await act(async () => {
      const listeners = windowListeners["pointermove"] || [];
      for (const { cb } of listeners) {
        cb({ clientX: 150 });
      }
    });

    assert.equal(latestStops.length, 3);
    assert.equal(
      latestStops[1],
      "#008000ff 75%",
      "Offset must update to 75% on drag"
    );
  });

  it("delete button deletes the active intermediate stop and re-selects an adjacent stop", async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#008000ff 50%", "#00ff00ff 100%"],
          onChange: (stops: string[]) => {
            latestStops = stops;
          },
        })
      );
    });

    const stopBtns = getStopButtonsSorted(container);
    const deleteBtn = findElementsByClass(
      container,
      "gradient-picker-delete-btn"
    )[0];

    // Select intermediate stop (50%)
    await act(async () => {
      stopBtns[1].dispatchEvent({ type: "click", bubbles: true });
    });

    assert.equal(
      deleteBtn.disabled,
      false,
      "Delete button must be enabled on intermediate stop"
    );

    // Click delete button
    await act(async () => {
      deleteBtn.dispatchEvent({ type: "click", bubbles: true });
    });

    const remainingBtns = findElementsByClass(
      container,
      "gradient-stop-toggle-btn"
    );
    assert.equal(remainingBtns.length, 2, "Stop must be removed");
    assert.equal(latestStops.length, 2);
    assert.equal(
      deleteBtn.disabled,
      true,
      "Delete button must be disabled after returning to 2 boundary stops"
    );
  });

  it("embedded ColourPickerWidget updates and controls the active stop color bidirectionally", async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#00ff00ff 100%"],
          onChange: (stops: string[]) => {
            latestStops = stops;
          },
        })
      );
    });

    // Interact with embedded ColourPickerWidget surface to change color of active stop
    const surface = findElementsByClass(container, "colour-picker-surface")[0];
    assert.ok(surface, "Embedded ColourPickerWidget surface must exist");

    await act(async () => {
      surface.dispatchEvent({
        type: "pointerdown",
        button: 0,
        clientX: 50,
        clientY: 10,
        pointerId: 1,
        currentTarget: surface,
      });
    });

    assert.equal(latestStops.length, 2);
    assert.equal(latestStops[0].endsWith(" 0%"), true);
    assert.notEqual(
      latestStops[0],
      "#000000ff 0%",
      "Active stop color must update from ColourPickerWidget"
    );
  });

  it("serializes stops uniformly across various color formats", () => {
    const stops = [
      { id: "s1", color: "#ff0000ff", offset: 0 },
      { id: "s2", color: "#00ff00ff", offset: 100 },
    ];

    const hexSerialized = serializeGradientStops(stops, "HEX");
    assert.deepEqual(hexSerialized, ["#ff0000ff 0%", "#00ff00ff 100%"]);

    const rgbSerialized = serializeGradientStops(stops, "RGB");
    assert.deepEqual(rgbSerialized, ["rgb(255 0 0) 0%", "rgb(0 255 0) 100%"]);

    const parsed = parseInitialStops(["#112233 10%", "#445566 90%"]);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].offset, 10);
    assert.equal(parsed[1].offset, 90);
  });
});

describe("GradientPickerWidget Stop ID Stability & Selection Retention (Ticket #222)", () => {
  beforeEach(() => {
    setupDom();
    prefsUiIconSize.value = 20;
  });

  afterEach(() => {
    tearDownDom();
  });

  it("generates deterministic stop IDs matching default stops and across array re-indexing", () => {
    // Default initial stops
    const defaultStops = parseInitialStops();
    assert.deepEqual(
      defaultStops.map((s: any) => s.id),
      ["stop-0", "stop-100"],
      "Default initial stops must produce stable IDs stop-0 and stop-100"
    );

    // Explicit 2-stop array
    const parsedTwoStops = parseInitialStops([
      "#000000ff 0%",
      "#00ff00ff 100%",
    ]);
    assert.deepEqual(
      parsedTwoStops.map((s: any) => s.id),
      ["stop-0", "stop-100"],
      "Parsed initial stops must match default initial stop IDs without index prefix divergence"
    );

    // 3-stop array: inserting intermediate stop must not alter 100% stop ID
    const parsedThreeStops = parseInitialStops([
      "#000000ff 0%",
      "#008000ff 50%",
      "#00ff00ff 100%",
    ]);
    assert.deepEqual(
      parsedThreeStops.map((s: any) => s.id),
      ["stop-0", "stop-50", "stop-100"],
      "100% boundary stop must retain stop-100 ID regardless of intermediate stops count"
    );
  });

  it("preserves selection of newly created stop across parent prop resynchronization", async () => {
    // Stateful parent simulation mirroring SimpleModeEditor
    let parentStopsState: string[] = ["#000000ff 0%", "#00ff00ff 100%"];

    function ParentWrapper() {
      const [currentStops, setCurrentStops] = React.useState(parentStopsState);

      return React.createElement(GradientPickerWidget, {
        initialStops: currentStops,
        onChange: (newStops: string[]) => {
          parentStopsState = newStops;
          setCurrentStops(newStops);
        },
      });
    }

    await act(async () => {
      root?.render(React.createElement(ParentWrapper));
    });

    const previewBar = findElementsByClass(
      container,
      "gradient-picker-preview-bar"
    )[0];
    assert.ok(previewBar);

    // Double-click at 50%
    await act(async () => {
      previewBar.dispatchEvent({
        type: "dblclick",
        clientX: 100, // 50% on 200px wide bar
        bubbles: true,
      });
    });

    // Parent state should now have 3 stops
    assert.equal(parentStopsState.length, 3);
    assert.equal(parentStopsState[1], "#008000ff 50%");

    // GradientPickerWidget should render 3 stop buttons
    const stopBtns = getStopButtonsSorted(container);
    assert.equal(stopBtns.length, 3);

    // The newly created 50% stop (middle button) must remain active (aria-pressed=true)
    assert.equal(
      stopBtns[1].getAttribute("aria-pressed"),
      "true",
      "Newly created 50% stop must remain active across parent initialStops resync"
    );
    assert.equal(
      stopBtns[0].getAttribute("aria-pressed"),
      "false",
      "0% stop must NOT be active when a new stop was just created"
    );
  });

  it("selecting 100% boundary stop and updating color via embedded ColourPickerWidget preserves 100% stop selection", async () => {
    let parentStopsState: string[] = ["#000000ff 0%", "#00ff00ff 100%"];

    function ParentWrapper() {
      const [currentStops, setCurrentStops] = React.useState(parentStopsState);

      return React.createElement(GradientPickerWidget, {
        initialStops: currentStops,
        onChange: (newStops: string[]) => {
          parentStopsState = newStops;
          setCurrentStops(newStops);
        },
      });
    }

    await act(async () => {
      root?.render(React.createElement(ParentWrapper));
    });

    const stopBtns = getStopButtonsSorted(container);
    assert.equal(stopBtns.length, 2);

    // Click 100% boundary stop button to select it
    await act(async () => {
      stopBtns[1].dispatchEvent({ type: "click", bubbles: true });
    });

    assert.equal(
      stopBtns[1].getAttribute("aria-pressed"),
      "true",
      "100% stop must be selected after click"
    );
    assert.equal(
      stopBtns[0].getAttribute("aria-pressed"),
      "false",
      "0% stop must be unselected"
    );

    // Change color of 100% stop via embedded ColourPickerWidget surface
    const surface = findElementsByClass(container, "colour-picker-surface")[0];
    assert.ok(surface, "ColourPickerWidget surface must be rendered");

    await act(async () => {
      surface.dispatchEvent({
        type: "pointerdown",
        button: 0,
        clientX: 100,
        clientY: 20,
        pointerId: 1,
        currentTarget: surface,
      });
    });

    // Re-query stop buttons
    const updatedStopBtns = getStopButtonsSorted(container);
    assert.equal(
      updatedStopBtns[1].getAttribute("aria-pressed"),
      "true",
      "100% stop must remain selected after color modification"
    );
    assert.equal(
      updatedStopBtns[0].getAttribute("aria-pressed"),
      "false",
      "0% stop must not steal active selection on 100% color change"
    );

    // Verify parent state received updated color for 100% stop
    assert.equal(parentStopsState.length, 2);
    assert.equal(parentStopsState[1].endsWith(" 100%"), true);
    assert.notEqual(
      parentStopsState[1],
      "#00ff00ff 100%",
      "100% stop color must be updated"
    );
  });
});

describe("GradientPickerWidget Click-to-Select & Boundary Hit Targets (Ticket #223)", () => {
  beforeEach(() => {
    setupDom();
    prefsUiIconSize.value = 20;
  });

  afterEach(() => {
    tearDownDom();
  });

  it("single-clicking preview bar calculates relative position and activates nearest stop", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#008000ff 50%", "#00ff00ff 100%"],
        })
      );
    });

    const previewBar = findElementsByClass(
      container,
      "gradient-picker-preview-bar"
    )[0];
    assert.ok(previewBar);

    const stopBtns = getStopButtonsSorted(container);
    assert.equal(stopBtns.length, 3);
    assert.equal(
      stopBtns[0].getAttribute("aria-pressed"),
      "true",
      "Initial stop 0% is active"
    );

    // Click at clientX = 90 (45% on 200px bar -> closest to 50% stop)
    await act(async () => {
      previewBar.dispatchEvent({
        type: "click",
        button: 0,
        clientX: 90,
        bubbles: true,
      });
    });

    assert.equal(
      stopBtns[1].getAttribute("aria-pressed"),
      "true",
      "50% stop must be activated by click at 45%"
    );
    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "false");
    assert.equal(stopBtns[2].getAttribute("aria-pressed"), "false");

    // Click at clientX = 180 (90% on 200px bar -> closest to 100% stop)
    await act(async () => {
      previewBar.dispatchEvent({
        type: "click",
        button: 0,
        clientX: 180,
        bubbles: true,
      });
    });

    assert.equal(
      stopBtns[2].getAttribute("aria-pressed"),
      "true",
      "100% stop must be activated by click at 90%"
    );
    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "false");
    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "false");
  });

  it("single-clicking near left and right extremities activates 0% and 100% boundary stops respectively", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#00ff00ff 100%"],
        })
      );
    });

    const previewBar = findElementsByClass(
      container,
      "gradient-picker-preview-bar"
    )[0];
    const stopBtns = getStopButtonsSorted(container);

    // Initially 0% is active
    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "true");
    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "false");

    // Click at far right extremity (clientX = 200, 100%)
    await act(async () => {
      previewBar.dispatchEvent({
        type: "click",
        button: 0,
        clientX: 200,
        bubbles: true,
      });
    });

    assert.equal(
      stopBtns[1].getAttribute("aria-pressed"),
      "true",
      "100% stop must be activated at right extremity"
    );
    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "false");

    // Click at far left extremity (clientX = 0, 0%)
    await act(async () => {
      previewBar.dispatchEvent({
        type: "click",
        button: 0,
        clientX: 0,
        bubbles: true,
      });
    });

    assert.equal(
      stopBtns[0].getAttribute("aria-pressed"),
      "true",
      "0% stop must be activated at left extremity"
    );
    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "false");
  });

  it("guide lines feature expanded 11px interactive hit area and select stop on click", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ff0000ff 50%", "#00ff00ff 100%"],
        })
      );
    });

    const guideLines = findElementsByClass(
      container,
      "gradient-stop-guide-line"
    );
    assert.equal(
      guideLines.length,
      1,
      "Only intermediate stops have vertical guide lines"
    );

    // Verify expanded 11px width
    assert.equal(
      guideLines[0].style.width,
      "11px",
      "Guide line container must have 11px expanded hit target"
    );

    const stopBtns = getStopButtonsSorted(container);
    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "true");
    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "false");

    // Click directly on 50% intermediate guide line
    await act(async () => {
      guideLines[0].dispatchEvent({ type: "click", button: 0, bubbles: true });
    });

    assert.equal(
      stopBtns[1].getAttribute("aria-pressed"),
      "true",
      "50% intermediate stop must activate on clicking its guide line"
    );
    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "false");
  });

  it("double-clicking near boundary extremities activates boundary stops without spawning intermediate stops", async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#00ff00ff 100%"],
          onChange: (stops: string[]) => {
            latestStops = stops;
          },
        })
      );
    });

    const previewBar = findElementsByClass(
      container,
      "gradient-picker-preview-bar"
    )[0];
    const initialBtns = getStopButtonsSorted(container);
    assert.equal(initialBtns.length, 2);

    // Double click at clientX = 199 (99.5% on 200px bar -> near 100% boundary)
    await act(async () => {
      previewBar.dispatchEvent({
        type: "dblclick",
        clientX: 199,
        bubbles: true,
      });
    });

    // Should NOT create a 3rd stop at 99.9%
    const currentBtns = getStopButtonsSorted(container);
    assert.equal(
      currentBtns.length,
      2,
      "Must not spawn unwanted intermediate stop near 100% boundary"
    );
    assert.equal(
      currentBtns[1].getAttribute("aria-pressed"),
      "true",
      "100% boundary stop must become active"
    );
    assert.equal(
      latestStops.length,
      0,
      "No onChange fired when double-clicking boundary"
    );

    // Double click at clientX = 1 (0.5% on 200px bar -> near 0% boundary)
    await act(async () => {
      previewBar.dispatchEvent({ type: "dblclick", clientX: 1, bubbles: true });
    });

    const finalBtns = getStopButtonsSorted(container);
    assert.equal(
      finalBtns.length,
      2,
      "Must not spawn unwanted intermediate stop near 0% boundary"
    );
    assert.equal(
      finalBtns[0].getAttribute("aria-pressed"),
      "true",
      "0% boundary stop must become active"
    );
    assert.equal(latestStops.length, 0);
  });
});

describe("GradientPickerWidget Inline Boundary Stops & Intermediate Pin Track (Ticket #225)", () => {
  beforeEach(() => {
    setupDom();
    prefsUiIconSize.value = 20;
  });

  afterEach(() => {
    tearDownDom();
  });

  it("renders 0% and 100% buttons flanking the preview bar with 6px gap in a preview row", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ff0000ff 50%", "#ffffff 100%"],
        })
      );
    });

    const previewRow = findElementsByClass(
      container,
      "gradient-picker-preview-row"
    )[0];
    assert.ok(previewRow, "Preview row container must be rendered");
    assert.equal(
      previewRow.style.gap,
      "6px",
      "Preview row must separate buttons and bar with 6px gap"
    );

    const previewBar = findElementsByClass(
      container,
      "gradient-picker-preview-bar"
    )[0];
    assert.ok(previewBar, "Preview bar must be rendered");
    assert.equal(
      previewBar.style.flex,
      "1",
      "Preview bar must stretch to fill remaining row width"
    );

    const boundaryBtns = findElementsByClass(
      container,
      "gradient-stop-boundary-btn"
    );
    assert.equal(
      boundaryBtns.length,
      2,
      "Must render exactly 2 boundary buttons"
    );
    assert.equal(
      boundaryBtns[0].getAttribute("aria-label"),
      "Gradient stop at 0%"
    );
    assert.equal(
      boundaryBtns[1].getAttribute("aria-label"),
      "Gradient stop at 100%"
    );

    // Top track margin matches preview bar inset (22px)
    const track = findElementsByClass(container, "gradient-picker-track")[0];
    assert.ok(track, "Track must be rendered");
    assert.equal(
      track.style.margin,
      "0 22px",
      "Track margins must align horizontally with preview bar"
    );

    // Track only contains intermediate stops
    const trackBtns = track.childNodes.filter((c: any) =>
      c.className?.includes("gradient-stop-toggle-btn")
    );
    assert.equal(
      trackBtns.length,
      1,
      "Track must only contain the 50% intermediate stop"
    );
    assert.equal(
      trackBtns[0].getAttribute("aria-label"),
      "Gradient stop at 50%"
    );

    // Through-bar guide lines only render for intermediate stops
    const guideLines = findElementsByClass(
      container,
      "gradient-stop-guide-line"
    );
    assert.equal(
      guideLines.length,
      1,
      "Only intermediate stops must have through-bar vertical guide lines"
    );
    assert.equal(guideLines[0].getAttribute("title"), "Stop at 50%");
  });

  it("boundary buttons retain 16x16px size, swatches, and active indicator ring on click", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ffffff 100%"],
        })
      );
    });

    const boundaryBtns = findElementsByClass(
      container,
      "gradient-stop-boundary-btn"
    );
    assert.equal(boundaryBtns[0].style.width, "16px");
    assert.equal(boundaryBtns[0].style.height, "16px");
    assert.equal(boundaryBtns[0].getAttribute("aria-pressed"), "true");
    assert.ok(
      boundaryBtns[0].style.boxShadow.includes("rgba(27, 68, 108"),
      "Active boundary stop must have ring shadow"
    );

    // Click 100% boundary button
    await act(async () => {
      boundaryBtns[1].dispatchEvent({ type: "click", bubbles: true });
    });

    assert.equal(boundaryBtns[0].getAttribute("aria-pressed"), "false");
    assert.equal(boundaryBtns[1].getAttribute("aria-pressed"), "true");
    assert.ok(
      boundaryBtns[1].style.boxShadow.includes("rgba(27, 68, 108"),
      "100% stop must receive ring shadow when active"
    );
  });

  it("primary clicking flanking boundary buttons updates embedded ColourPickerWidget", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#ff0000ff 0%", "#0000ffff 100%"],
        })
      );
    });

    const boundaryBtns = findElementsByClass(
      container,
      "gradient-stop-boundary-btn"
    );
    const hexInput = findElementsByClass(
      container,
      "colour-picker-hex-input"
    )[0];
    assert.ok(hexInput, "Colour picker hex input must exist");
    assert.equal(
      hexInput.value,
      "#ff0000ff",
      "Colour picker must reflect 0% stop color initially"
    );

    // Click 100% boundary stop
    await act(async () => {
      boundaryBtns[1].dispatchEvent({ type: "click", bubbles: true });
    });

    const updatedHexInput = findElementsByClass(
      container,
      "colour-picker-hex-input"
    )[0];
    assert.equal(
      updatedHexInput.value,
      "#0000ffff",
      "Colour picker must reflect 100% stop color after selection"
    );
  });
});

describe("GradientPickerWidget Stop Dropdown & Delete Controls (Ticket #226)", () => {
  beforeEach(() => {
    setupDom();
    prefsUiIconSize.value = 20;
  });

  afterEach(() => {
    tearDownDom();
  });

  it("renders stop dropdown and delete button between preview row and colour picker, sorted ascending by offset", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#00ff00ff 100%", "#ff0000ff 50%"],
        })
      );
    });

    // 1. Actions row exists and top header is removed
    const actionsRow = findElementsByClass(container, "gradient-picker-actions-row");
    assert.equal(actionsRow.length, 1, "Must render combined stop controls container");
    const topHeader = findElementsByClass(container, "gradient-picker-stops-header");
    assert.equal(topHeader.length, 0, "Top stops header must be removed");

    // 2. Dropdown exists with aria-label
    const stopSelects = findElementsByClass(container, "gradient-picker-stop-select");
    assert.equal(stopSelects.length, 1, "Must render stop selector select");
    const selectEl = stopSelects[0];
    assert.equal(selectEl.getAttribute("aria-label"), "Select gradient stop");

    // 3. Options sorted ascending by offset
    const options = selectEl.options;
    assert.equal(options.length, 3, "Must render 3 options");
    assert.equal(options[0].value, "stop-0");
    assert.equal(options[0].textContent, "0% — #000000ff");
    assert.equal(options[1].value, "stop-50");
    assert.equal(options[1].textContent, "50% — #ff0000ff");
    assert.equal(options[2].value, "stop-100");
    assert.equal(options[2].textContent, "100% — #00ff00ff");
    assert.equal(selectEl.value, "stop-0", "0% stop must be selected initially");
  });

  it("selecting option from dropdown activates that stop and synchronizes ColourPickerWidget", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ff0000ff 50%", "#00ff00ff 100%"],
        })
      );
    });

    const selectEl = findElementsByClass(container, "gradient-picker-stop-select")[0];
    const hexInput = findElementsByClass(container, "colour-picker-hex-input")[0];
    const stopBtns = getStopButtonsSorted(container);

    // Initial state: 0% active
    assert.equal(selectEl.value, "stop-0");
    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "true");
    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "false");
    assert.equal(hexInput.value, "#000000ff");

    // Select 50% stop via dropdown
    await act(async () => {
      selectEl.value = "stop-50";
      selectEl.dispatchEvent({ type: "change", bubbles: true });
    });

    assert.equal(stopBtns[0].getAttribute("aria-pressed"), "false");
    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "true", "50% stop button must be active");
    const updatedHexInput = findElementsByClass(container, "colour-picker-hex-input")[0];
    assert.equal(updatedHexInput.value, "#ff0000ff", "Embedded colour picker must update to 50% stop color");

    // Select 100% stop via dropdown
    await act(async () => {
      selectEl.value = "stop-100";
      selectEl.dispatchEvent({ type: "change", bubbles: true });
    });

    assert.equal(stopBtns[1].getAttribute("aria-pressed"), "false");
    assert.equal(stopBtns[2].getAttribute("aria-pressed"), "true", "100% stop button must be active");
    const finalHexInput = findElementsByClass(container, "colour-picker-hex-input")[0];
    assert.equal(finalHexInput.value, "#00ff00ff", "Embedded colour picker must update to 100% stop color");
  });

  it("clicking stop buttons or preview bar synchronizes the dropdown selection", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ff0000ff 50%", "#00ff00ff 100%"],
        })
      );
    });

    const selectEl = findElementsByClass(container, "gradient-picker-stop-select")[0];
    const stopBtns = getStopButtonsSorted(container);
    const previewBar = findElementsByClass(container, "gradient-picker-preview-bar")[0];

    // Click 50% intermediate stop button
    await act(async () => {
      stopBtns[1].dispatchEvent({ type: "click", button: 0, bubbles: true });
    });


    assert.equal(selectEl.value, "stop-50", "Dropdown must synchronize to stop-50 on button click");

    // Click 100% boundary stop button
    await act(async () => {
      stopBtns[2].dispatchEvent({ type: "click", bubbles: true });
    });

    assert.equal(selectEl.value, "stop-100", "Dropdown must synchronize to stop-100 on button click");

    // Click preview bar at 10px (near 0% stop)
    await act(async () => {
      previewBar.dispatchEvent({ type: "click", button: 0, clientX: 10, bubbles: true });
    });

    assert.equal(selectEl.value, "stop-0", "Dropdown must synchronize to stop-0 on preview bar click");
  });

  it("option label dynamically updates offset during pin drag", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ff0000ff 50%", "#00ff00ff 100%"],
        })
      );
    });

    const selectEl = findElementsByClass(container, "gradient-picker-stop-select")[0];
    const stopBtns = getStopButtonsSorted(container);

    // Pointer down on 50% stop button
    await act(async () => {
      stopBtns[1].dispatchEvent({
        type: "pointerdown",
        button: 0,
        clientX: 100,
        pointerId: 1,
        bubbles: true,
      });
    });

    // Move pointer to 150px (75% on 200px bar)
    await act(async () => {
      const listeners = windowListeners["pointermove"] || [];
      for (const { cb } of listeners) {
        cb({ clientX: 150 });
      }
    });

    assert.equal(
      selectEl.options[1].textContent,
      "75% — #ff0000ff",
      "Dropdown option label must update dynamically during drag"
    );
  });

  it("double-clicking preview bar adds stop and automatically selects it in dropdown", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#00ff00ff 100%"],
        })
      );
    });

    const selectEl = findElementsByClass(container, "gradient-picker-stop-select")[0];
    assert.equal(selectEl.options.length, 2);

    const previewBar = findElementsByClass(container, "gradient-picker-preview-bar")[0];

    // Double click at 50% (clientX = 100 on 200px bar)
    await act(async () => {
      previewBar.dispatchEvent({ type: "dblclick", clientX: 100, bubbles: true });
    });

    assert.equal(selectEl.options.length, 3, "Must now have 3 options in dropdown");
    assert.equal(selectEl.value, "stop-50", "Newly created stop must be selected in dropdown");
  });

  it("relocated delete button enforces boundary stop guards and deletes intermediate stop", async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ff0000ff 50%", "#00ff00ff 100%"],
          onChange: (stops: string[]) => {
            latestStops = stops;
          },
        })
      );
    });

    const actionsRow = findElementsByClass(container, "gradient-picker-actions-row")[0];
    const deleteBtn = findElementsByClass(actionsRow, "gradient-picker-delete-btn")[0];
    assert.ok(deleteBtn, "Delete button must be in actions row");

    // Initially at stop-0: delete button is disabled
    assert.equal(deleteBtn.disabled, true, "Delete button must be disabled for 0% boundary stop");

    // Select 50% intermediate stop
    const selectEl = findElementsByClass(container, "gradient-picker-stop-select")[0];
    await act(async () => {
      selectEl.value = "stop-50";
      selectEl.dispatchEvent({ type: "change", bubbles: true });
    });

    assert.equal(deleteBtn.disabled, false, "Delete button must be enabled for intermediate stop");

    // Click delete button
    await act(async () => {
      deleteBtn.dispatchEvent({ type: "click", bubbles: true });
    });

    assert.equal(latestStops.length, 2);
    assert.equal(selectEl.options.length, 2, "Dropdown must update to 2 options after deletion");
    assert.equal(deleteBtn.disabled, true, "Delete button must be disabled when only 2 boundary stops remain");
    assert.ok(selectEl.value === "stop-0" || selectEl.value === "stop-100", "Selection must roll over to adjacent stop");
  });

  it("cascades disabled prop to stop select dropdown and delete button", async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ["#000000ff 0%", "#ff0000ff 50%", "#00ff00ff 100%"],
          disabled: true,
        })
      );
    });

    const selectEl = findElementsByClass(container, "gradient-picker-stop-select")[0];
    const deleteBtn = findElementsByClass(container, "gradient-picker-delete-btn")[0];

    assert.equal(selectEl.disabled, true, "Stop select must be disabled when widget is disabled");
    assert.equal(deleteBtn.disabled, true, "Delete button must be disabled when widget is disabled");
  });
});
