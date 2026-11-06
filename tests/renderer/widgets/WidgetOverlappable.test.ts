/**
 * @file WidgetOverlappable.test.ts
 * @module tests/renderer/widgets/WidgetOverlappable.test
 * @description Unit tests verifying the read-only overlappable property defaults to false on BasicWidget and is enabled on built-in tool widgets (LayerTreeWidget, AttributeTablePanel, ConsolePanel).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link LayerTreeWidget}
 * @see {@link AttributeTablePanel}
 * @see {@link ConsolePanel}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

// Mock .svg import for headless Node testing
const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions['.svg'] = (mod: any) => {
  mod.exports = 'mock-logo.svg';
};

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * @class MockElement
 * @description Lightweight mock DOM Element representation for headless React 19 testing in Node.js.
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
      },
    });
  }

  setAttribute(k: string, v: string): void {
    this.attributes[k] = String(v);
    if (k === 'class') {
      this.className = String(v);
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
  }

  appendChild(child: any): any {
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child: any): any {
    this.childNodes = this.childNodes.filter(c => c !== child);
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

  addEventListener(type: string, cb: (e: any) => void, capture?: boolean): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture: Boolean(capture) });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(l => l.cb !== cb);
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

  getBoundingClientRect(): { width: number; height: number; top: number; left: number; right: number; bottom: number } {
    return { width: 160, height: 80, top: 0, left: 0, right: 160, bottom: 80 };
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

  const win = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: (type: string, cb: (e: any) => void, capture?: boolean) => {
      if (!windowListeners[type]) windowListeners[type] = [];
      windowListeners[type].push({ cb, capture: Boolean(capture) });
    },
    removeEventListener: (type: string, cb: (e: any) => void) => {
      if (!windowListeners[type]) return;
      windowListeners[type] = windowListeners[type].filter(l => l.cb !== cb);
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
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };

  doc.defaultView = win;
  (globalThis as any).window = win;
  (globalThis as any).document = doc;
  (globalThis as any).HTMLIFrameElement = win.HTMLIFrameElement;
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

function findAllNodes(rootNode: MockElement, predicate: (el: MockElement) => boolean): MockElement[] {
  const result: MockElement[] = [];
  if (predicate(rootNode)) result.push(rootNode);
  for (const child of rootNode.childNodes) {
    if (child && child.nodeType === 1) {
      result.push(...findAllNodes(child, predicate));
    }
  }
  return result;
}

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
    '@main': path.resolve(process.cwd(), 'src/main'),
  },
});

const { BasicWidget } = jiti('../../../src/renderer/workbench/widgets/BasicWidget.tsx');
const { LayerTreeWidget } = jiti('../../../src/renderer/workbench/widgets/LayerTreeWidget.tsx');
const { AttributeTableWidget: AttributeTablePanel } = jiti('../../../src/renderer/workbench/widgets/AttributeTableWidget.tsx');
const { ConsolePanel } = jiti('../../../src/renderer/workbench/panels/ConsolePanel.tsx');

describe('Widget overlappable Property & Built-in Tool Defaults (Ticket #167)', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    tearDownDom();
  });

  it('defaults overlappable to false on BasicWidget', async () => {
    await act(async () => {
      root!.render(
        React.createElement(BasicWidget, {
          name: 'test-basic-widget',
          displayName: 'Test Widget',
        })
      );
    });

    const widgetEl = findAllNodes(container, el => el.className.includes('basic-widget'))[0];
    assert.ok(widgetEl, 'Widget container element must exist');
    assert.strictEqual(
      widgetEl.className.includes('is-overlappable'),
      false,
      'BasicWidget without overlappable prop must not have is-overlappable class'
    );

    const headerEl = findAllNodes(container, el => el.className.includes('basic-widget-header'))[0];
    assert.ok(headerEl, 'Header element must exist');
    assert.strictEqual(
      headerEl.getAttribute('data-overlappable'),
      'false',
      'BasicWidget header must receive data-overlappable="false"'
    );
  });

  it('respects overlappable={true} on BasicWidget when explicitly set', async () => {
    await act(async () => {
      root!.render(
        React.createElement(BasicWidget, {
          name: 'test-basic-widget',
          displayName: 'Test Widget',
          overlappable: true,
        })
      );
    });

    const widgetEl = findAllNodes(container, el => el.className.includes('basic-widget'))[0];
    assert.ok(widgetEl);
    assert.ok(
      widgetEl.className.includes('is-overlappable'),
      'BasicWidget with overlappable={true} must have is-overlappable class'
    );

    const headerEl = findAllNodes(container, el => el.className.includes('basic-widget-header'))[0];
    assert.strictEqual(
      headerEl.getAttribute('data-overlappable'),
      'true',
      'BasicWidget header must receive data-overlappable="true"'
    );
  });

  it('LayerTreeWidget defaults overlappable to true on its BasicWidget container', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget, {}));
    });

    const headerEl = findAllNodes(container, el => el.className.includes('basic-widget-header'))[0];
    assert.ok(headerEl, 'LayerTreeWidget header must exist');
    assert.strictEqual(
      headerEl.getAttribute('data-overlappable'),
      'true',
      'LayerTreeWidget must configure overlappable={true}'
    );
  });

  it('AttributeTablePanel defaults overlappable to true on its BasicWidget container', async () => {
    await act(async () => {
      root!.render(React.createElement(AttributeTablePanel, {}));
    });

    const headerEl = findAllNodes(container, el => el.className.includes('basic-widget-header'))[0];
    assert.ok(headerEl, 'AttributeTablePanel header must exist');
    assert.strictEqual(
      headerEl.getAttribute('data-overlappable'),
      'true',
      'AttributeTablePanel must configure overlappable={true}'
    );
  });

  it('ConsolePanel defaults overlappable to true on its BasicWidget container', async () => {
    await act(async () => {
      root!.render(React.createElement(ConsolePanel, {}));
    });

    const headerEl = findAllNodes(container, el => el.className.includes('basic-widget-header'))[0];
    assert.ok(headerEl, 'ConsolePanel header must exist');
    assert.strictEqual(
      headerEl.getAttribute('data-overlappable'),
      'true',
      'ConsolePanel must configure overlappable={true}'
    );
  });
});
