/**
 * @file GradientPickerWidget.test.ts
 * @module tests/renderer/widgets/GradientPickerWidget.test
 * @description Component and unit tests verifying GradientPickerWidget 2 lh preview bar, stop toggle pins, drag physics with pointer capture, stop deletion, double-click creation with color interpolation, and embedded ColourPickerWidget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @see {@link GradientPickerWidget}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import path from 'node:path';
import createJiti from 'jiti';

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
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};
  value = '';
  disabled = false;
  title = '';
  multiple = false;
  selected = false;
  selectedIndex = 0;

  get options(): any[] {
    return this.childNodes.filter((c) => c.tagName === 'OPTION');
  }

  constructor(tag = 'div') {
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
        return styleProps[name] || '';
      }
    });
  }

  setAttribute(k: string, v: string): void {
    this.attributes[k] = String(v);
    if (k === 'class') {
      this.className = String(v);
    }
    if (k === 'value') {
      this.value = String(v);
    }
    if (k === 'title') {
      this.title = String(v);
    }
    if (k === 'disabled') {
      this.disabled = true;
    }
  }

  getAttribute(k: string): string | undefined {
    return this.attributes[k];
  }

  removeAttribute(k: string): void {
    delete this.attributes[k];
    if (k === 'class') {
      this.className = '';
    }
    if (k === 'disabled') {
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

  addEventListener(type: string, cb: (e: any) => void, capture?: boolean): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture: Boolean(capture) });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter((l) => l.cb !== cb);
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

  getBoundingClientRect(): { width: number; height: number; top: number; left: number; right: number; bottom: number } {
    return { width: 200, height: 40, top: 0, left: 0, right: 200, bottom: 40 };
  }
}

let doc: any;
let container: MockElement;
let root: Root | null = null;
let windowListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};

function setupDom(): void {
  windowListeners = {};
  const documentElement = new MockElement('html');
  const body = new MockElement('body');
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
      parentNode: null
    }),
    createComment: (data: string) => ({
      nodeType: 8,
      data,
      ownerDocument: doc,
      parentNode: null
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null as any
  };
  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;

  const win: any = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: (type: string, cb: (e: any) => void, capture?: boolean) => {
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
    Element: MockElement
  };
  doc.defaultView = win;

  (globalThis as any).document = doc;
  (globalThis as any).window = win;
  (globalThis as any).HTMLIFrameElement = class {};
  (globalThis as any).HTMLElement = MockElement;
  (globalThis as any).Element = MockElement;
  (globalThis as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8, DOCUMENT_NODE: 9 };
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  container = doc.createElement('div');
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
function findElementsByClass(el: MockElement, className: string): MockElement[] {
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

// Load GradientPickerWidget using jiti
const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
    '@main': path.resolve(process.cwd(), 'src/main')
  }
});

const {
  GradientPickerWidget,
  parseInitialStops,
  serializeGradientStops
} = jiti('../../../src/renderer/workbench/widgets/GradientPickerWidget.tsx');

const { prefsUiIconSize } = jiti('../../../src/renderer/state/preferencesSignals.ts');

describe('GradientPickerWidget Component & Interactions (Ticket #207)', () => {
  beforeEach(() => {
    setupDom();
    prefsUiIconSize.value = 20; // 20% of 20 = 4px swatch
  });

  afterEach(() => {
    tearDownDom();
  });

  it('renders BasicWidget container, header, 2 lh preview bar, and default 0% and 100% boundary stops', async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          displayName: 'Custom Gradient'
        })
      );
    });

    // Check widget container
    const widgetEls = findElementsByClass(container, 'gradient-picker-widget');
    assert.equal(widgetEls.length, 1, 'Must render outer GradientPickerWidget container');

    // Check 2 lh preview bar
    const previewBars = findElementsByClass(container, 'gradient-picker-preview-bar');
    assert.equal(previewBars.length, 1, 'Must render preview bar');
    assert.equal(previewBars[0].style.height, '2lh', 'Preview bar height must be 2lh');

    // Check stop toggle buttons
    const stopBtns = findElementsByClass(container, 'gradient-stop-toggle-btn');
    assert.equal(stopBtns.length, 2, 'Must render 2 initial stop toggle buttons');

    // Check vertical guide lines
    const guideLines = findElementsByClass(container, 'gradient-stop-guide-line');
    assert.equal(guideLines.length, 2, 'Must render 2 guide lines extending through preview bar');

    // Check swatches inside buttons
    const swatches = findElementsByClass(container, 'gradient-stop-swatch');
    assert.equal(swatches.length, 2, 'Must render inner swatch in each stop button');
    // Swatch size = 20% of 20 = 4px
    assert.equal(swatches[0].style.width, '4px', 'Swatch width must be 20% of icon size');

    // Check embedded ColourPickerWidget is present
    const colourPickers = findElementsByClass(container, 'colour-picker-widget');
    assert.equal(colourPickers.length, 1, 'Must render embedded ColourPickerWidget');
  });

  it('supports single-selection toggle button set where active stop cannot be untoggled', async () => {
    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ['#ff0000ff 0%', '#0000ffff 100%']
        })
      );
    });

    const stopBtns = findElementsByClass(container, 'gradient-stop-toggle-btn');
    assert.equal(stopBtns.length, 2);

    // Initial stop 0 is active
    assert.equal(stopBtns[0].getAttribute('aria-pressed'), 'true');
    assert.equal(stopBtns[1].getAttribute('aria-pressed'), 'false');

    // Click stop 1 to activate it
    await act(async () => {
      stopBtns[1].dispatchEvent({ type: 'click', bubbles: true });
    });

    assert.equal(stopBtns[0].getAttribute('aria-pressed'), 'false');
    assert.equal(stopBtns[1].getAttribute('aria-pressed'), 'true');

    // Click stop 1 again: cannot be untoggled
    await act(async () => {
      stopBtns[1].dispatchEvent({ type: 'click', bubbles: true });
    });

    assert.equal(stopBtns[1].getAttribute('aria-pressed'), 'true', 'Active stop cannot be untoggled');
  });

  it('prevents dragging or deleting boundary stops at 0% and 100%', async () => {
    let changedStops: string[] | null = null;

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ['#000000ff 0%', '#ffffff 100%'],
          onChange: (stops: string[]) => {
            changedStops = stops;
          }
        })
      );
    });

    const deleteBtn = findElementsByClass(container, 'gradient-picker-delete-btn')[0];
    assert.ok(deleteBtn, 'Delete button must be rendered');
    assert.equal(deleteBtn.disabled, true, 'Delete button must be disabled when 0% boundary stop is active');

    const stopBtns = findElementsByClass(container, 'gradient-stop-toggle-btn');

    // Try to drag 0% stop
    await act(async () => {
      stopBtns[0].dispatchEvent({
        type: 'pointerdown',
        button: 0,
        clientX: 0,
        pointerId: 1,
        bubbles: true
      });
    });

    // Dispatch window pointermove to 50px
    await act(async () => {
      const listeners = windowListeners['pointermove'] || [];
      for (const { cb } of listeners) {
        cb({ clientX: 50 });
      }
    });

    assert.equal(changedStops, null, 'Dragging 0% boundary stop must be prevented');
  });

  it('double-clicking the gradient preview bar creates a new stop with linearly interpolated color', async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ['#000000ff 0%', '#00ff00ff 100%'],
          onChange: (stops: string[]) => {
            latestStops = stops;
          }
        })
      );
    });

    const previewBar = findElementsByClass(container, 'gradient-picker-preview-bar')[0];
    assert.ok(previewBar);

    // Double click at 50% (clientX = 100 on 200px wide bar)
    await act(async () => {
      previewBar.dispatchEvent({
        type: 'dblclick',
        clientX: 100,
        bubbles: true
      });
    });

    const stopBtns = findElementsByClass(container, 'gradient-stop-toggle-btn');
    assert.equal(stopBtns.length, 3, 'Must create a 3rd stop on double click');

    // Stop at 50% is active
    assert.equal(stopBtns[1].getAttribute('aria-pressed'), 'true', 'Newly created stop must become active');

    // Verify interpolated color: between #000000ff and #00ff00ff at 50% is #008000ff
    assert.equal(latestStops.length, 3);
    assert.equal(latestStops[0], '#000000ff 0%');
    assert.equal(latestStops[1], '#008000ff 50%');
    assert.equal(latestStops[2], '#00ff00ff 100%');
  });

  it('dragging an intermediate stop moves it horizontally and updates gradient and onChange', async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ['#000000ff 0%', '#008000ff 50%', '#00ff00ff 100%'],
          onChange: (stops: string[]) => {
            latestStops = stops;
          }
        })
      );
    });

    const stopBtns = findElementsByClass(container, 'gradient-stop-toggle-btn');
    assert.equal(stopBtns.length, 3);

    // Pointer down on intermediate stop (50%)
    await act(async () => {
      stopBtns[1].dispatchEvent({
        type: 'pointerdown',
        button: 0,
        clientX: 100,
        pointerId: 1,
        bubbles: true
      });
    });

    // Move pointer to 150px (75% on 200px bar)
    await act(async () => {
      const listeners = windowListeners['pointermove'] || [];
      for (const { cb } of listeners) {
        cb({ clientX: 150 });
      }
    });

    assert.equal(latestStops.length, 3);
    assert.equal(latestStops[1], '#008000ff 75%', 'Offset must update to 75% on drag');
  });

  it('delete button deletes the active intermediate stop and re-selects an adjacent stop', async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ['#000000ff 0%', '#008000ff 50%', '#00ff00ff 100%'],
          onChange: (stops: string[]) => {
            latestStops = stops;
          }
        })
      );
    });

    const stopBtns = findElementsByClass(container, 'gradient-stop-toggle-btn');
    const deleteBtn = findElementsByClass(container, 'gradient-picker-delete-btn')[0];

    // Select intermediate stop (50%)
    await act(async () => {
      stopBtns[1].dispatchEvent({ type: 'click', bubbles: true });
    });

    assert.equal(deleteBtn.disabled, false, 'Delete button must be enabled on intermediate stop');

    // Click delete button
    await act(async () => {
      deleteBtn.dispatchEvent({ type: 'click', bubbles: true });
    });

    const remainingBtns = findElementsByClass(container, 'gradient-stop-toggle-btn');
    assert.equal(remainingBtns.length, 2, 'Stop must be removed');
    assert.equal(latestStops.length, 2);
    assert.equal(deleteBtn.disabled, true, 'Delete button must be disabled after returning to 2 boundary stops');
  });

  it('embedded ColourPickerWidget updates and controls the active stop color bidirectionally', async () => {
    let latestStops: string[] = [];

    await act(async () => {
      root?.render(
        React.createElement(GradientPickerWidget, {
          initialStops: ['#000000ff 0%', '#00ff00ff 100%'],
          onChange: (stops: string[]) => {
            latestStops = stops;
          }
        })
      );
    });

    // Interact with embedded ColourPickerWidget surface to change color of active stop
    const surface = findElementsByClass(container, 'colour-picker-surface')[0];
    assert.ok(surface, 'Embedded ColourPickerWidget surface must exist');

    await act(async () => {
      surface.dispatchEvent({
        type: 'pointerdown',
        button: 0,
        clientX: 50,
        clientY: 10,
        pointerId: 1,
        currentTarget: surface
      });
    });

    assert.equal(latestStops.length, 2);
    assert.equal(latestStops[0].endsWith(' 0%'), true);
    assert.notEqual(latestStops[0], '#000000ff 0%', 'Active stop color must update from ColourPickerWidget');
  });

  it('serializes stops uniformly across various color formats', () => {
    const stops = [
      { id: 's1', color: '#ff0000ff', offset: 0 },
      { id: 's2', color: '#00ff00ff', offset: 100 }
    ];

    const hexSerialized = serializeGradientStops(stops, 'HEX');
    assert.deepEqual(hexSerialized, ['#ff0000ff 0%', '#00ff00ff 100%']);

    const rgbSerialized = serializeGradientStops(stops, 'RGB');
    assert.deepEqual(rgbSerialized, ['rgb(255 0 0) 0%', 'rgb(0 255 0) 100%']);

    const parsed = parseInitialStops(['#112233 10%', '#445566 90%']);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].offset, 10);
    assert.equal(parsed[1].offset, 90);
  });
});
