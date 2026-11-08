/**
 * @file WidgetTheme.test.ts
 * @module tests/renderer/workbench/widgets/WidgetTheme.test
 * @description Unit tests verifying that Widget and BasicWidget omit hardcoded inline background and border styles by default, bind to theme CSS tokens, correctly accept custom prop overrides, and synchronize detached window body styles (ADR 0027 / Ticket #197).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-07
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @see {@link Widget}
 * @see {@link BasicWidget}
 * @see {@link DetachedWindowPortal}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
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
  style: Record<string, string> = {};
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};

  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
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
    const listeners = (this.eventListeners[event.type] || []).slice();
    for (const { cb } of listeners) {
      cb(event);
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
    return { width: 200, height: 150, top: 0, left: 0, right: 200, bottom: 150 };
  }
}

let doc: any;
let container: MockElement;
let root: Root | null = null;

function setupDom(): void {
  const documentElement = new MockElement('html');
  const body = new MockElement('body');
  const head = new MockElement('head');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  doc = {
    nodeType: 9,
    documentElement,
    body,
    head,
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
    querySelectorAll: (selector: string) => {
      if (selector.includes('link') || selector.includes('style')) {
        return [];
      }
      return [];
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null as any
  };
  doc.body.ownerDocument = doc;
  doc.head.ownerDocument = doc;
  doc.documentElement.ownerDocument = doc;

  const win = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    document: doc,
    open: () => {
      const childDoc = {
        nodeType: 9,
        title: '',
        body: new MockElement('body'),
        head: new MockElement('head'),
        documentElement: new MockElement('html'),
      };
      childDoc.body.ownerDocument = childDoc;
      childDoc.head.ownerDocument = childDoc;
      childDoc.documentElement.ownerDocument = childDoc;
      return {
        document: childDoc,
        closed: false,
        addEventListener: () => {},
        removeEventListener: () => {},
        close: () => {},
      };
    },
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement
  };

  doc.defaultView = win;
  (globalThis as any).window = win;
  (globalThis as any).document = doc;
  (globalThis as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8, DOCUMENT_NODE: 9 };
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (globalThis as any).MutationObserver = class {
    observe() {}
    disconnect() {}
  };

  container = doc.createElement('div');
  doc.body.appendChild(container);
  root = createRoot(container as any);
}

function tearDownDom(): void {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
}

function findNode(rootNode: MockElement, predicate: (el: MockElement) => boolean): MockElement | null {
  if (predicate(rootNode)) return rootNode;
  for (const child of rootNode.childNodes) {
    if (child && child.nodeType === 1) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
    '@main': path.resolve(process.cwd(), 'src/main')
  }
});

const { Widget } = jiti('../../../../src/renderer/workbench/widgets/Widget.tsx');
const { BasicWidget } = jiti('../../../../src/renderer/workbench/widgets/BasicWidget.tsx');

describe('Widget Theme Binding & Inline Style Decoupling (Ticket #197)', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    tearDownDom();
  });

  it('renders default Widget with .cartouche-widget class and NO inline background or border styles', async () => {
    await act(async () => {
      root!.render(
        React.createElement(
          Widget,
          { id: 'test-widget' },
          React.createElement('span', null, 'Content')
        )
      );
    });

    const widgetEl = findNode(container, el => el.className.includes('cartouche-widget'));
    assert.ok(widgetEl, 'Widget container element must exist with cartouche-widget class');

    // Must NOT have inline backgroundColor, borderWidth, or borderColor
    assert.strictEqual(
      widgetEl.style.backgroundColor,
      undefined,
      'Default Widget must omit inline backgroundColor to allow theme CSS rule to govern'
    );
    assert.strictEqual(
      widgetEl.style.borderWidth,
      undefined,
      'Default Widget must omit inline borderWidth'
    );
    assert.strictEqual(
      widgetEl.style.borderColor,
      undefined,
      'Default Widget must omit inline borderColor'
    );
  });

  it('renders Widget with custom background and border as inline style overrides when explicit props are passed', async () => {
    await act(async () => {
      root!.render(
        React.createElement(
          Widget,
          {
            id: 'custom-widget',
            background: '#123456',
            border: 2,
            borderColor: '#654321',
          },
          React.createElement('span', null, 'Content')
        )
      );
    });

    const widgetEl = findNode(container, el => el.className.includes('cartouche-widget'));
    assert.ok(widgetEl, 'Custom widget container must exist');
    assert.strictEqual(
      widgetEl.style.backgroundColor,
      '#123456',
      'Explicit background prop must be applied as inline style override'
    );
    assert.strictEqual(
      widgetEl.style.borderWidth,
      '2px',
      'Explicit border prop must be applied as inline borderWidth'
    );
    assert.strictEqual(
      widgetEl.style.borderColor,
      '#654321',
      'Explicit borderColor prop must be applied as inline borderColor'
    );
  });

  it('renders default BasicWidget with .basic-widget class and NO inline background or border styles on outer container', async () => {
    await act(async () => {
      root!.render(
        React.createElement(
          BasicWidget,
          { name: 'test-basic', displayName: 'Test Panel' },
          React.createElement('span', null, 'Body')
        )
      );
    });

    const basicEl = findNode(container, el => el.className.includes('basic-widget'));
    assert.ok(basicEl, 'BasicWidget element must exist with basic-widget class');

    assert.strictEqual(
      basicEl.style.backgroundColor,
      undefined,
      'Default BasicWidget must omit inline backgroundColor on outer container'
    );
    assert.strictEqual(
      basicEl.style.borderColor,
      undefined,
      'Default BasicWidget must omit inline borderColor on outer container'
    );
  });

  it('forwards custom background and border props to BasicWidget as inline style overrides', async () => {
    await act(async () => {
      root!.render(
        React.createElement(
          BasicWidget,
          {
            name: 'custom-basic',
            displayName: 'Custom Panel',
            background: '#aabbcc',
            border: 3,
            borderColor: '#ddeeff',
          },
          React.createElement('span', null, 'Body')
        )
      );
    });

    const basicEl = findNode(container, el => el.className.includes('basic-widget'));
    assert.ok(basicEl, 'Custom BasicWidget must exist');
    assert.strictEqual(
      basicEl.style.backgroundColor,
      '#aabbcc',
      'Custom BasicWidget background prop must render as inline style override'
    );
    assert.strictEqual(
      basicEl.style.borderWidth,
      '3px',
      'Custom BasicWidget border prop must render as inline style override'
    );
    assert.strictEqual(
      basicEl.style.borderColor,
      '#ddeeff',
      'Custom BasicWidget borderColor prop must render as inline style override'
    );
  });

  it('verifies that workbench.css binds .cartouche-widget and .basic-widget to theme tokens', () => {
    const workbenchCssPath = path.resolve(process.cwd(), 'src/renderer/styles/workbench.css');
    const content = fs.readFileSync(workbenchCssPath, 'utf-8');

    assert.ok(
      content.includes('.cartouche-widget {\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  box-sizing: border-box;\n  background-color: var(--cartouche-widget-bg);\n  border: 1px solid var(--cartouche-widget-border);'),
      'workbench.css must define .cartouche-widget using var(--cartouche-widget-bg) and var(--cartouche-widget-border)'
    );

    assert.ok(
      content.includes('.basic-widget {\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  box-sizing: border-box;\n  background-color: var(--cartouche-widget-bg);\n  border-color: var(--cartouche-widget-border);'),
      'workbench.css must define .basic-widget using var(--cartouche-widget-bg) and var(--cartouche-widget-border)'
    );

    assert.ok(
      content.includes('.basic-widget-header {\n  flex-shrink: 0;\n  background-color: var(--cartouche-widget-header-bg);\n  color: var(--cartouche-widget-header-fg);\n  border-bottom: 1px solid var(--cartouche-widget-header-border);'),
      'workbench.css must define .basic-widget-header using var(--cartouche-widget-header-bg) and var(--cartouche-widget-header-border)'
    );
  });

  it('verifies that DetachedWindowPortal initializes child window body style with theme background token', () => {
    const portalPath = path.resolve(
      process.cwd(),
      'src/renderer/components/common/DetachedWindowPortal.tsx'
    );
    const content = fs.readFileSync(portalPath, 'utf-8');

    assert.ok(
      content.includes('childWindow.document.body.style.background = "var(--cartouche-theme-bg, #ffffff)";'),
      'DetachedWindowPortal must set childWindow body background to var(--cartouche-theme-bg, #ffffff)'
    );

    assert.ok(
      content.includes('childWindow.document.body.style.color = "var(--cartouche-theme-fg, #000000)";'),
      'DetachedWindowPortal must set childWindow body color to var(--cartouche-theme-fg, #000000)'
    );
  });
});
