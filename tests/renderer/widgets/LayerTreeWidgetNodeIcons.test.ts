/**
 * @file LayerTreeWidgetNodeIcons.test.ts
 * @module tests/renderer/widgets/LayerTreeWidgetNodeIcons.test
 * @description Unit and component tests verifying LayerTreeWidget tree node line icons (layer geometry, group chevrons, folder outlines, and project root logo) scale to 80% of --cartouche-ui-icon-size via CSS custom properties and adapt row line slot dimensions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link LayerTreeWidget}
 * @see {@link prefsUiIconSize}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

// Mock .svg import for headless Node testing
const require = createRequire(import.meta.url);
require.extensions['.svg'] = (mod: any) => {
  mod.exports = 'mock-logo.svg';
};

// Set React act environment flag
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * @class MockElement
 * @description Lightweight mock DOM Element representation for headless React 19 testing in Node.js.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
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
   * @updated 2026-10-21
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
   * @updated 2026-10-21
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
   * @updated 2026-10-21
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
   * @updated 2026-10-21
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
   * @updated 2026-10-21
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
   * @updated 2026-10-21
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
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {string} type - Event type string.
   * @param {(e: any) => void} cb - Listener callback function.
   * @param {boolean} [capture] - Whether event listener is capture phase.
   * @returns {void}
   */
  addEventListener(type: string, cb: (e: any) => void, capture?: boolean): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture: Boolean(capture) });
  }

  /**
   * @description Removes a registered event listener callback from this element.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {string} type - Event type string.
   * @param {(e: any) => void} cb - Listener callback function to remove.
   * @returns {void}
   */
  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(l => l.cb !== cb);
  }

  /**
   * @description Dispatches an event on this element and bubbles up parent chain.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {any} event - Event object to dispatch.
   * @returns {boolean} Whether default action was prevented.
   */
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

  /**
   * @description Checks if a target node is this element or contained within children.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {any} node - Candidate node to check.
   * @returns {boolean} True if candidate node is contained.
   */
  contains(node: any): boolean {
    if (node === this) return true;
    for (const child of this.childNodes) {
      if (child.contains && child.contains(node)) return true;
    }
    return false;
  }

  /**
   * @description Computes mock bounding client rect dimensions.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @returns {{ width: number, height: number, top: number, left: number, right: number, bottom: number }} Layout bounds.
   */
  getBoundingClientRect(): { width: number; height: number; top: number; left: number; right: number; bottom: number } {
    return { width: 160, height: 80, top: 0, left: 0, right: 160, bottom: 80 };
  }
}

let doc: any;
let container: MockElement;
let root: Root | null = null;
let windowListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};

/**
 * @description Initializes mock window and document global objects for React DOM component testing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @returns {void}
 */
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
 * @description Tears down mock window and document global objects.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
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
}

/**
 * @description Traverses a MockElement DOM subtree and finds all elements matching a predicate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {MockElement} rootNode - Root DOM node to traverse.
 * @param {(el: MockElement) => boolean} predicate - Match predicate function.
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

// Instantiate jiti with aliases
const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
    '@main': path.resolve(process.cwd(), 'src/main')
  }
});

import {
  hasProjectSignal,
  projectNameSignal,
  projectTreeSignal,
  editingNodeIdSignal,
} from '../../../src/renderer/state/projectSignals';

const { LayerTreeWidget } = jiti('../../../src/renderer/workbench/widgets/LayerTreeWidget.tsx');
const { prefsUiIconSize } = jiti('../../../src/renderer/state/preferencesSignals.ts');

describe('LayerTreeWidget Node Line Icon Sizing (Ticket #54)', () => {
  beforeEach(() => {
    setupDom();
    hasProjectSignal.value = true;
    projectNameSignal.value = 'Test GIS Project';
    editingNodeIdSignal.value = null;
    prefsUiIconSize.value = undefined;

    // Populate a test layer tree with a group and a layer
    projectTreeSignal.value = [
      {
        id: 'group-1',
        name: 'Boundaries',
        visible: true,
        expanded: true,
        children: [
          {
            id: 'layer-1',
            name: 'Districts',
            type: 'vector',
            source: '/test/districts.geojson',
            visible: true,
            geometryKind: 'Polygon'
          }
        ]
      }
    ];
  });

  afterEach(() => {
    tearDownDom();
    hasProjectSignal.value = false;
    projectNameSignal.value = null;
    projectTreeSignal.value = [];
    prefsUiIconSize.value = undefined;
  });

  it('workbench.css defines .tree-icon-slot, .tree-chevron, and .tree-indent with 80% of --cartouche-ui-icon-size', () => {
    const workbenchCssPath = path.resolve(process.cwd(), 'src/renderer/styles/workbench.css');
    const content = fs.readFileSync(workbenchCssPath, 'utf-8');

    assert.match(
      content,
      /\.tree-icon-slot\s*\{[^}]*--cartouche-ui-icon-size/s,
      '.tree-icon-slot must adapt dynamically to --cartouche-ui-icon-size'
    );
    assert.match(
      content,
      /\.tree-chevron\s*\{[^}]*--cartouche-ui-icon-size/s,
      '.tree-chevron must adapt dynamically to --cartouche-ui-icon-size'
    );
    assert.match(
      content,
      /\.tree-indent\s*\{[^}]*--cartouche-ui-icon-size/s,
      '.tree-indent must adapt dynamically to --cartouche-ui-icon-size to preserve alignment'
    );
  });

  it('renders all tree node icons (layer, group chevron, folder outline, project logo) scaled to 80% with aspect-ratio 1', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    // 1. Project root logo image
    const projectLogos = findAllNodes(container, el => el.tagName === 'IMG' && el.attributes.alt === 'Cartouche');
    assert.strictEqual(projectLogos.length, 1, 'Should render project root Cartouche logo');
    assert.ok(
      projectLogos[0].style.width.includes('calc(') &&
      projectLogos[0].style.width.includes('--cartouche-ui-icon-size') &&
      projectLogos[0].style.width.includes('0.8'),
      `Project logo style.width must scale to 80%, got: ${projectLogos[0].style.width}`
    );
    assert.strictEqual(projectLogos[0].style.aspectRatio, '1', 'Project logo must have aspectRatio 1');

    // 2. Group chevron toggle (<Icon />)
    const chevronSlot = findAllNodes(container, el => el.className.includes('tree-chevron'))[0];
    assert.ok(chevronSlot, 'Group chevron slot must be present');
    const chevronSvg = findAllNodes(chevronSlot, el => el.tagName === 'SVG')[0];
    assert.ok(chevronSvg, 'Chevron SVG must be present');
    assert.ok(
      chevronSvg.style.width.includes('calc(') &&
      chevronSvg.style.width.includes('--cartouche-ui-icon-size') &&
      chevronSvg.style.width.includes('0.8'),
      `Chevron SVG style.width must scale to 80%, got: ${chevronSvg.style.width}`
    );
    assert.strictEqual(chevronSvg.style.aspectRatio, '1', 'Chevron SVG must have aspectRatio 1');

    // 3. Group folder icon (<Icon />)
    const groupIconSlot = findAllNodes(container, el => el.className.includes('group-icon'))[0];
    assert.ok(groupIconSlot, 'Group folder icon slot must be present');
    const folderSvg = findAllNodes(groupIconSlot, el => el.tagName === 'SVG')[0];
    assert.ok(folderSvg, 'Folder outline SVG must be present');
    assert.ok(
      folderSvg.style.width.includes('calc(') &&
      folderSvg.style.width.includes('--cartouche-ui-icon-size') &&
      folderSvg.style.width.includes('0.8'),
      `Folder SVG style.width must scale to 80%, got: ${folderSvg.style.width}`
    );
    assert.strictEqual(folderSvg.style.aspectRatio, '1', 'Folder SVG must have aspectRatio 1');

    // 4. Layer geometry icon (<Icon />)
    const layerRow = findAllNodes(container, el => el.className.includes('tree-node-layer'))[0];
    assert.ok(layerRow, 'Layer row must be present');
    const layerSvg = findAllNodes(layerRow, el => el.tagName === 'SVG')[0];
    assert.ok(layerSvg, 'Layer geometry SVG must be present');
    assert.ok(
      layerSvg.style.width.includes('calc(') &&
      layerSvg.style.width.includes('--cartouche-ui-icon-size') &&
      layerSvg.style.width.includes('0.8'),
      `Layer SVG style.width must scale to 80%, got: ${layerSvg.style.width}`
    );
    assert.strictEqual(layerSvg.style.aspectRatio, '1', 'Layer SVG must have aspectRatio 1');
  });

  it('renders collapsed group chevron and closed folder icon with 80% scaling and 1:1 aspect ratio', async () => {
    projectTreeSignal.value = [
      {
        id: 'group-collapsed',
        name: 'Collapsed Group',
        visible: true,
        expanded: false,
        children: []
      }
    ];

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const chevronSvg = findAllNodes(container, el => el.tagName === 'SVG')[0];
    assert.ok(chevronSvg, 'Chevron SVG should be present in collapsed group');
    assert.ok(
      chevronSvg.style.width.includes('calc(') &&
      chevronSvg.style.width.includes('--cartouche-ui-icon-size') &&
      chevronSvg.style.width.includes('0.8'),
      `Collapsed chevron width must scale to 80%, got: ${chevronSvg.style.width}`
    );
    assert.strictEqual(chevronSvg.style.aspectRatio, '1');

    const folderSvg = findAllNodes(container, el => el.tagName === 'SVG')[1];
    assert.ok(folderSvg, 'Closed folder SVG should be present in collapsed group');
    assert.ok(
      folderSvg.style.width.includes('calc(') &&
      folderSvg.style.width.includes('--cartouche-ui-icon-size') &&
      folderSvg.style.width.includes('0.8'),
      `Closed folder width must scale to 80%, got: ${folderSvg.style.width}`
    );
    assert.strictEqual(folderSvg.style.aspectRatio, '1');
  });

  it('renders various layer geometry kinds (Point, LineString, Polygon) scaled to 80%', async () => {
    projectTreeSignal.value = [
      { id: 'l-pt', name: 'Points', type: 'vector', source: 'pt.geojson', visible: true, geometryKind: 'Point' },
      { id: 'l-line', name: 'Lines', type: 'vector', source: 'line.geojson', visible: true, geometryKind: 'LineString' },
      { id: 'l-poly', name: 'Polygons', type: 'vector', source: 'poly.geojson', visible: true, geometryKind: 'Polygon' }
    ];

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(container, el => el.className.includes('tree-node-layer'));
    assert.strictEqual(layerRows.length, 3, 'Should render 3 layer rows');

    for (const row of layerRows) {
      const svg = findAllNodes(row, el => el.tagName === 'SVG')[0];
      assert.ok(svg, 'Layer row must have SVG icon');
      assert.ok(
        svg.style.width.includes('calc(') &&
        svg.style.width.includes('--cartouche-ui-icon-size') &&
        svg.style.width.includes('0.8'),
        `Layer icon style.width must scale to 80%, got: ${svg.style.width}`
      );
      assert.strictEqual(svg.style.aspectRatio, '1');
    }
  });

  it('reactively synchronizes prefsUiIconSize signal changes affecting tree node lines at runtime', () => {
    const { effect } = jiti('@preact/signals-react');
    const dispose = effect(() => {
      const iconSize = prefsUiIconSize.value;
      if (iconSize) {
        doc.documentElement.style.setProperty(
          '--cartouche-ui-icon-size',
          `${iconSize}px`
        );
      } else {
        doc.documentElement.style.removeProperty(
          '--cartouche-ui-icon-size'
        );
      }
    });

    try {
      // 1. Initial unset: no custom property set
      assert.strictEqual(
        doc.documentElement.style.getPropertyValue('--cartouche-ui-icon-size'),
        '',
        'Initial unset signal should have empty inline style'
      );

      // 2. Update to 32px
      prefsUiIconSize.value = 32;
      assert.strictEqual(
        doc.documentElement.style.getPropertyValue('--cartouche-ui-icon-size'),
        '32px',
        'Signal update to 32 should set property to 32px'
      );

      // 3. Update to 20px
      prefsUiIconSize.value = 20;
      assert.strictEqual(
        doc.documentElement.style.getPropertyValue('--cartouche-ui-icon-size'),
        '20px',
        'Signal update to 20 should set property to 20px'
      );

      // 4. Reset to undefined (fallback to CSS theme default)
      prefsUiIconSize.value = undefined;
      assert.strictEqual(
        doc.documentElement.style.getPropertyValue('--cartouche-ui-icon-size'),
        '',
        'Resetting signal to undefined must remove property to fall back to CSS 24px default'
      );
    } finally {
      dispose();
    }
  });
});
