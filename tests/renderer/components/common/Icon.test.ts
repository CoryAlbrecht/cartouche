/**
 * @file Icon.test.ts
 * @module tests/renderer/components/common/Icon.test
 * @description Unit tests verifying Icon component support for CSS custom properties, calc expressions, and default --cartouche-ui-icon-size inheritance.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link Icon}
 */

import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

// Set React act environment flag
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * @class MockElement
 * @description Lightweight mock DOM Element representation for headless React 19 testing in Node.js.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
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

  /**
   * @constructor
   * @description Constructs a new MockElement with the given tag name.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {string} [tag='div'] - HTML element tag name.
   */
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

  /**
   * @description Sets an attribute value and updates className when key is 'class'.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {string} k - Attribute key.
   * @param {string} v - Attribute value.
   * @returns {void}
   */
  setAttribute(k: string, v: string): void {
    this.attributes[k] = String(v);
    if (k === 'class') {
      this.className = String(v);
    }
  }

  /**
   * @description Retrieves an attribute value by key.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {string} k - Attribute key.
   * @returns {string | undefined} Attribute value string or undefined.
   */
  getAttribute(k: string): string | undefined {
    return this.attributes[k];
  }

  /**
   * @description Appends a child node to childNodes and updates parentNode.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {any} child - Child node to append.
   * @returns {any} The appended child node.
   */
  appendChild(child: any): any {
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  /**
   * @description Removes a child node from childNodes and clears its parentNode.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {any} child - Child node to remove.
   * @returns {any} The removed child node.
   */
  removeChild(child: any): any {
    this.childNodes = this.childNodes.filter(c => c !== child);
    child.parentNode = null;
    return child;
  }

  /**
   * @description Inserts a child node before reference child node.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {any} newChild - New node to insert.
   * @param {any} refChild - Reference child node.
   * @returns {any} The inserted child node.
   */
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

  /**
   * @description Registers an event listener callback on this element.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {string} type - Event type string.
   * @param {(e: any) => void} cb - Listener callback.
   * @param {boolean} [capture=false] - Whether listener captures.
   * @returns {void}
   */
  addEventListener(type: string, cb: (e: any) => void, capture = false): void {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push({ cb, capture });
  }

  /**
   * @description Removes an event listener callback from this element.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {string} type - Event type string.
   * @param {(e: any) => void} cb - Listener callback.
   * @returns {void}
   */
  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(l => l.cb !== cb);
  }
}

/**
 * @function findAllNodes
 * @description Recursively searches DOM node tree for nodes matching predicate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {MockElement} rootNode - Root node to traverse.
 * @param {(el: MockElement) => boolean} predicate - Search predicate.
 * @returns {MockElement[]} Array of matching elements.
 */
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

let doc: any;
let container: MockElement;
let root: Root | null = null;

/**
 * @function setupDom
 * @description Initializes headless mock DOM environment for React 19 testing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @returns {void}
 */
function setupDom(): void {
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

  const win = {
    document: doc,
    addEventListener: () => {},
    removeEventListener: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
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

  container = doc.createElement('div');
  body.appendChild(container);
  root = createRoot(container as any);
}

/**
 * @function tearDownDom
 * @description Tears down and unmounts headless mock DOM environment.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @returns {void}
 */
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
  delete (globalThis as any).document;
  delete (globalThis as any).window;
  delete (globalThis as any).Node;
  delete (globalThis as any).ResizeObserver;
}

// Instantiate jiti with JSX and aliases
const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
    '@main': path.resolve(process.cwd(), 'src/main')
  }
});
const { default: Icon } = jiti('../../../../src/renderer/components/common/Icon.tsx');

describe('Icon Component CSS Custom Property & Sizing Support', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    tearDownDom();
  });

  it('defaults to var(--cartouche-ui-icon-size, 24px) when size prop is omitted, setting style.width and style.height', async () => {
    await act(async () => {
      root!.render(React.createElement(Icon, { path: 'M0,0 L10,10' }));
    });

    const svgs = findAllNodes(container, el => el.tagName === 'SVG');
    assert.strictEqual(svgs.length, 1, 'Should render 1 SVG element');
    const svg = svgs[0];
    assert.strictEqual(
      svg.style.width,
      'var(--cartouche-ui-icon-size, 24px)',
      'style.width should default to var(--cartouche-ui-icon-size, 24px)'
    );
    assert.strictEqual(
      svg.style.height,
      'var(--cartouche-ui-icon-size, 24px)',
      'style.height should default to var(--cartouche-ui-icon-size, 24px)'
    );
  });

  it('supports size="var(--cartouche-ui-icon-size)" and sets both style.width and style.height', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Icon, {
          path: 'M0,0 L10,10',
          size: 'var(--cartouche-ui-icon-size)'
        })
      );
    });

    const svgs = findAllNodes(container, el => el.tagName === 'SVG');
    assert.strictEqual(svgs.length, 1);
    const svg = svgs[0];
    assert.strictEqual(svg.style.width, 'var(--cartouche-ui-icon-size)');
    assert.strictEqual(svg.style.height, 'var(--cartouche-ui-icon-size)');
  });

  it('supports calc expressions such as size="calc(var(--cartouche-ui-icon-size) * 0.8)" on both style dimensions', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Icon, {
          path: 'M0,0 L10,10',
          size: 'calc(var(--cartouche-ui-icon-size) * 0.8)'
        })
      );
    });

    const svgs = findAllNodes(container, el => el.tagName === 'SVG');
    assert.strictEqual(svgs.length, 1);
    const svg = svgs[0];
    assert.strictEqual(svg.style.width, 'calc(var(--cartouche-ui-icon-size) * 0.8)');
    assert.strictEqual(svg.style.height, 'calc(var(--cartouche-ui-icon-size) * 0.8)');
  });

  it('preserves numeric multiplier scaling and literal numbers', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Icon, {
          path: 'M0,0 L10,10',
          size: 18
        })
      );
    });

    const svgs = findAllNodes(container, el => el.tagName === 'SVG');
    assert.strictEqual(svgs.length, 1);
    const svg = svgs[0];
    assert.strictEqual(svg.style.width, '18px');
    assert.strictEqual(svg.style.height, '18px');
  });

  it('applies custom CSS property dimensions to custom file SVG icons (file: prefix)', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Icon, {
          name: 'file:layers-plus-outline.svg',
          size: 'calc(var(--cartouche-ui-icon-size) * 0.75)'
        })
      );
    });

    const svgs = findAllNodes(container, el => el.tagName === 'SVG');
    assert.strictEqual(svgs.length, 1);
    const svg = svgs[0];
    assert.strictEqual(svg.style.width, 'calc(var(--cartouche-ui-icon-size) * 0.75)');
    assert.strictEqual(svg.style.height, 'calc(var(--cartouche-ui-icon-size) * 0.75)');
  });

  it('preserves caller style overrides without dropping dimension styles', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Icon, {
          path: 'M0,0 L10,10',
          style: { opacity: '0.8', margin: '2px' }
        })
      );
    });

    const svgs = findAllNodes(container, el => el.tagName === 'SVG');
    assert.strictEqual(svgs.length, 1);
    const svg = svgs[0];
    assert.strictEqual(svg.style.opacity, '0.8');
    assert.strictEqual(svg.style.margin, '2px');
    assert.strictEqual(svg.style.width, 'var(--cartouche-ui-icon-size, 24px)');
    assert.strictEqual(svg.style.height, 'var(--cartouche-ui-icon-size, 24px)');
  });
});
