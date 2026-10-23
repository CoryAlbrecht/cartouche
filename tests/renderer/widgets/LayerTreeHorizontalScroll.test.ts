/**
 * @file LayerTreeHorizontalScroll.test.ts
 * @module tests/renderer/widgets/LayerTreeHorizontalScroll.test
 * @description Unit and component tests verifying LayerTreeWidget horizontal and vertical viewport scrolling, intrinsic display name sizing without ellipsis shortening, full-width row selection highlights, sticky visible-width drop markers, and inline rename sizing transitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see {@link LayerTreeWidget}
 * @see docs/adr/0010-layer-tree-horizontal-scroll-and-nodeline-layout.md (ADR 0010)
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
 * @date 2026-10-23
 * @updated 2026-10-23
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

  value = '';
  defaultValue = '';

  /**
   * @constructor
   * @description Constructs a new MockElement with the given tag name.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
   * @since 0.1.0-dev
   * @param {string} k - Attribute key.
   * @returns {string | undefined} Attribute value string or undefined.
   */
  getAttribute(k: string): string | undefined {
    return this.attributes[k];
  }

  /**
   * @description Removes an attribute from attributes dictionary.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-23
   * @updated 2026-10-23
   * @since 0.1.0-dev
   * @param {string} k - Attribute key to remove.
   * @returns {void}
   */
  removeAttribute(k: string): void {
    delete this.attributes[k];
    if (k === 'class') {
      this.className = '';
    }
  }

  /**
   * @description Simulates element focus.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-23
   * @updated 2026-10-23
   * @since 0.1.0-dev
   * @returns {void}
   */
  focus(): void {}

  /**
   * @description Simulates input selection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-23
   * @updated 2026-10-23
   * @since 0.1.0-dev
   * @returns {void}
   */
  select(): void {}

  /**
   * @description Appends a child node to childNodes and updates parentNode.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
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
   * @date 2026-10-23
   * @updated 2026-10-23
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
 * @date 2026-10-23
 * @updated 2026-10-23
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
 * @date 2026-10-23
 * @updated 2026-10-23
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
 * @date 2026-10-23
 * @updated 2026-10-23
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

const {
  hasProjectSignal,
  projectNameSignal,
  projectTreeSignal,
  editingNodeIdSignal,
  activeLayerIdSignal,
  setNodeSelection,
  clearNodeSelection
} = jiti('../../../src/renderer/state/projectSignals.ts');

const { LayerTreeWidget } = jiti('../../../src/renderer/workbench/widgets/LayerTreeWidget.tsx');

describe('LayerTreeWidget Horizontal Scrolling & Tree Node Row Layout (Ticket #64, ADR 0010)', () => {
  const workbenchCssPath = path.resolve(process.cwd(), 'src/renderer/styles/workbench.css');
  let cssContent = '';

  beforeEach(() => {
    setupDom();
    hasProjectSignal.value = true;
    projectNameSignal.value = 'Metropolitan Transit Spatial Analysis 2026 Project Long Title';
    editingNodeIdSignal.value = null;
    clearNodeSelection();
    activeLayerIdSignal.value = null;

    // Populate a test layer tree with long names
    projectTreeSignal.value = [
      {
        id: 'group-transportation',
        name: 'Transportation Infrastructure & Multi-Modal Corridors',
        visible: true,
        expanded: true,
        children: [
          {
            id: 'layer-osm-transport-a',
            name: 'gis_osm_transport_a_free_1_regional_boundary_rail_corridors_buffered',
            type: 'vector',
            source: '/test/gis_osm_transport_a_free_1.geojson',
            visible: true,
            geometryKind: 'Polygon'
          },
          {
            id: 'layer-osm-transport-p',
            name: 'gis_osm_transport_p_free_1_station_points_and_intermodal_stops',
            type: 'vector',
            source: '/test/gis_osm_transport_p_free_1.geojson',
            visible: true,
            geometryKind: 'Point'
          }
        ]
      }
    ];

    cssContent = fs.readFileSync(workbenchCssPath, 'utf-8');
  });

  afterEach(() => {
    tearDownDom();
    hasProjectSignal.value = false;
    projectNameSignal.value = null;
    projectTreeSignal.value = [];
    editingNodeIdSignal.value = null;
    clearNodeSelection();
    activeLayerIdSignal.value = null;
  });

  it('workbench.css defines .layer-tree-viewport with overflow-x: auto, overflow-y: auto, and container-type: inline-size', () => {
    assert.match(
      cssContent,
      /\.layer-tree-viewport\s*\{[^}]*overflow-x:\s*auto/s,
      '.layer-tree-viewport must declare overflow-x: auto'
    );
    assert.match(
      cssContent,
      /\.layer-tree-viewport\s*\{[^}]*overflow-y:\s*auto/s,
      '.layer-tree-viewport must declare overflow-y: auto'
    );
    assert.match(
      cssContent,
      /\.layer-tree-viewport\s*\{[^}]*container-type:\s*inline-size/s,
      '.layer-tree-viewport must declare container-type: inline-size for container queries'
    );
  });

  it('workbench.css defines .tree-node-title and .project-title without text ellipsis shortening and with intrinsic width', () => {
    // Assert .tree-node-title has intrinsic width and no ellipsis shortening
    const titleMatch = cssContent.match(/(?:^|\n)\.tree-node-title[^{]*\{([^}]+)\}/);
    assert.ok(titleMatch, '.tree-node-title must be declared in workbench.css');
    const titleRules = titleMatch[1];

    assert.doesNotMatch(
      titleRules,
      /text-overflow:\s*ellipsis/,
      '.tree-node-title must NOT declare text-overflow: ellipsis'
    );
    assert.match(
      titleRules,
      /text-overflow:\s*clip/,
      '.tree-node-title must declare text-overflow: clip'
    );
    assert.match(
      titleRules,
      /overflow:\s*visible/,
      '.tree-node-title must declare overflow: visible'
    );
    assert.match(
      titleRules,
      /flex:\s*0\s+0\s+auto/,
      '.tree-node-title must declare flex: 0 0 auto for intrinsic sizing'
    );
    assert.match(
      titleRules,
      /width:\s*max-content/,
      '.tree-node-title must declare width: max-content for intrinsic sizing'
    );
  });

  it('workbench.css defines .tree-node-row and .layer-tree-root with min-width: 100% and width: max-content', () => {
    const rowMatch = cssContent.match(/\.tree-node-row\s*\{([^}]+)\}/s);
    assert.ok(rowMatch, '.tree-node-row must be declared in workbench.css');
    const rowRules = rowMatch[1];

    assert.match(
      rowRules,
      /min-width:\s*100%/,
      '.tree-node-row must declare min-width: 100%'
    );
    assert.match(
      rowRules,
      /width:\s*max-content/,
      '.tree-node-row must declare width: max-content'
    );

    assert.match(
      cssContent,
      /\.layer-tree-root\s*\{[^}]*min-width:\s*100%/s,
      '.layer-tree-root must declare min-width: 100%'
    );
    assert.match(
      cssContent,
      /\.layer-tree-root\s*\{[^}]*width:\s*max-content/s,
      '.layer-tree-root must declare width: max-content'
    );
  });

  it('workbench.css defines .tree-drop-marker with position: sticky, left: 0, and 100cqw container-query constraint', () => {
    const markerMatch = cssContent.match(/\.tree-drop-marker\s*\{([^}]+)\}/s);
    assert.ok(markerMatch, '.tree-drop-marker must be declared in workbench.css');
    const markerRules = markerMatch[1];

    assert.match(
      markerRules,
      /position:\s*sticky/,
      '.tree-drop-marker must declare position: sticky'
    );
    assert.match(
      markerRules,
      /left:\s*0/,
      '.tree-drop-marker must declare left: 0'
    );
    assert.match(
      markerRules,
      /100cqw/,
      '.tree-drop-marker must reference 100cqw for container-query clamping'
    );
  });

  it('workbench.css defines .tree-inline-input with min-width: 14rem and flex: 1', () => {
    const inputMatch = cssContent.match(/\.tree-inline-input\s*\{([^}]+)\}/s);
    assert.ok(inputMatch, '.tree-inline-input must be declared in workbench.css');
    const inputRules = inputMatch[1];

    assert.match(
      inputRules,
      /min-width:\s*14rem/,
      '.tree-inline-input must declare min-width: 14rem for comfortable editing'
    );
    assert.match(
      inputRules,
      /flex:\s*1/,
      '.tree-inline-input must declare flex: 1'
    );
  });

  it('renders LayerTreeWidget viewport with overflowX: auto and overflowY: auto beneath pinned BasicWidget header', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    // Pinned BasicWidget header bar must be present above viewport
    const headerBars = findAllNodes(container, el => el.className.includes('basic-widget-header'));
    assert.strictEqual(headerBars.length, 1, 'BasicWidget header bar must be present');

    // Viewport must have overflow-x and overflow-y auto
    const viewport = findAllNodes(container, el => el.className.includes('layer-tree-viewport'))[0];
    assert.ok(viewport, 'layer-tree-viewport element must be rendered');
    assert.strictEqual(viewport.style.overflowX, 'auto', 'Viewport must have overflowX auto');
    assert.strictEqual(viewport.style.overflowY, 'auto', 'Viewport must have overflowY auto');
  });

  it('renders all tree node rows (project root, group, layers) with full content titles', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    // Project root title
    const projectTitle = findAllNodes(container, el => el.className.includes('project-title'))[0];
    assert.ok(projectTitle, 'Project title node must be rendered');
    const projectText = (projectTitle as any).textContent || projectTitle.childNodes[0]?.nodeValue;
    assert.ok(projectText?.includes('Metropolitan Transit Spatial Analysis 2026'));

    // Group title
    const groupRows = findAllNodes(container, el => el.className.includes('tree-node-group'));
    assert.strictEqual(groupRows.length, 1, 'Group row must be rendered');
    const groupTitle = findAllNodes(groupRows[0], el => el.className.includes('tree-node-title'))[0];
    assert.ok(groupTitle, 'Group title must be rendered');
    const groupText = (groupTitle as any).textContent || groupTitle.childNodes[0]?.nodeValue;
    assert.strictEqual(groupText, 'Transportation Infrastructure & Multi-Modal Corridors');

    // Layer rows
    const layerRows = findAllNodes(container, el => el.className.includes('tree-node-layer'));
    assert.strictEqual(layerRows.length, 2, 'Two layer rows must be rendered');

    const layer1Title = findAllNodes(layerRows[0], el => el.className.includes('tree-node-title'))[0];
    const layer1Text = (layer1Title as any).textContent || layer1Title.childNodes[0]?.nodeValue;
    assert.strictEqual(
      layer1Text,
      'gis_osm_transport_a_free_1_regional_boundary_rail_corridors_buffered'
    );

    const layer2Title = findAllNodes(layerRows[1], el => el.className.includes('tree-node-title'))[0];
    const layer2Text = (layer2Title as any).textContent || layer2Title.childNodes[0]?.nodeValue;
    assert.strictEqual(
      layer2Text,
      'gis_osm_transport_p_free_1_station_points_and_intermodal_stops'
    );
  });

  it('selection and active states apply full-width row highlight classes', async () => {
    // Select group and layer
    setNodeSelection(['group-transportation', 'layer-osm-transport-a']);
    activeLayerIdSignal.value = 'layer-osm-transport-a';

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const groupRow = findAllNodes(container, el => el.className.includes('tree-node-group'))[0];
    assert.ok(groupRow.className.includes('selected'), 'Selected group must have .selected class');

    const layerRow = findAllNodes(container, el => el.className.includes('tree-node-layer'))[0];
    assert.ok(layerRow.className.includes('selected'), 'Selected layer must have .selected class');
    assert.ok(layerRow.className.includes('active'), 'Active layer must have .active class');

    // Both .selected and .active in CSS have full row background color #e0f2fe
    assert.match(
      cssContent,
      /\.tree-node-row\.selected[^{]*\{[^}]*background-color:\s*#e0f2fe/s,
      '.tree-node-row.selected must have background-color #e0f2fe'
    );
    assert.match(
      cssContent,
      /\.tree-node-row\.active[^{]*\{[^}]*background-color:\s*#e0f2fe/s,
      '.tree-node-row.active must have background-color #e0f2fe'
    );
  });

  it('renders drop marker clamped with calc(100cqw - indentPx) when dragOverState is active', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(container, el => el.className.includes('tree-node-layer'));
    const layer1Row = layerRows[0];
    const layer2Row = layerRows[1];
    assert.ok(layer1Row && layer2Row, 'Both layer rows must be rendered');

    // 1. Initiate drag from layer2Row to populate draggedNodeIdsRef
    await act(async () => {
      layer2Row.dispatchEvent({
        type: 'dragstart',
        bubbles: true,
        dataTransfer: {
          setData: () => {},
          setDragImage: () => {},
          effectAllowed: ''
        }
      });
    });

    // 2. Trigger dragOver on layer1Row with offsetY = 6 (top half -> position: before)
    await act(async () => {
      layer1Row.dispatchEvent({
        type: 'dragover',
        bubbles: true,
        dataTransfer: {
          types: ['application/x-cartouche-layers']
        },
        clientY: 6,
        clientX: 50
      });
    });

    // Re-render to observe drop marker in DOM
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const dropMarkers = findAllNodes(container, el => el.className.includes('tree-drop-marker'));
    assert.ok(dropMarkers.length > 0, 'Drop marker must be rendered during drag over');
    const marker = dropMarkers[0];

    // Indent level for layer inside group is 2, so indentPx = 2 * 18 + 6 = 42px
    assert.strictEqual(marker.style.marginLeft, '42px', 'Drop marker must indent to 42px');
    assert.strictEqual(
      marker.style.width,
      'calc(100cqw - 42px)',
      'Drop marker must constrain width to calc(100cqw - 42px) to clamp to visible pane edge'
    );
  });

  it('transitions between intrinsic display name width and min-width 14rem inline input during rename', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    // Before rename: span.tree-node-title rendered
    let inlineInputs = findAllNodes(container, el => el.className.includes('tree-inline-input'));
    assert.strictEqual(inlineInputs.length, 0, 'No inline inputs before rename');

    // Double-click layer title to activate rename mode (index 0: project, 1: group, 2: layer 1)
    const layerTitle = findAllNodes(container, el => el.className.includes('tree-node-title'))[2];
    assert.ok(layerTitle, 'Layer title span must be present');

    await act(async () => {
      layerTitle.dispatchEvent({
        type: 'dblclick',
        bubbles: true
      });
    });

    // Re-render to observe state change
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    inlineInputs = findAllNodes(container, el => el.className.includes('tree-inline-input'));
    assert.strictEqual(inlineInputs.length, 1, 'Inline input must be rendered during rename');
    const inputVal = inlineInputs[0].value || inlineInputs[0].defaultValue || inlineInputs[0].attributes.value || inlineInputs[0].attributes.defaultValue;
    assert.strictEqual(
      inputVal,
      'gis_osm_transport_a_free_1_regional_boundary_rail_corridors_buffered',
      'Inline input must populate initial layer name'
    );

    // Cancel rename mode: returns to intrinsic display name
    await act(async () => {
      editingNodeIdSignal.value = null;
      root!.render(React.createElement(LayerTreeWidget));
    });

    inlineInputs = findAllNodes(container, el => el.className.includes('tree-inline-input'));
    assert.strictEqual(inlineInputs.length, 0, 'Inline input unmounted after cancelling rename');

    const restoredLayerTitle = findAllNodes(container, el => el.className.includes('tree-node-title'))[2];
    assert.ok(restoredLayerTitle, 'Layer title span restored after cancelling rename');
  });
});
