/**
 * @file LayerTreeTitleAndActiveState.test.ts
 * @module tests/renderer/widgets/LayerTreeTitleAndActiveState.test
 * @description Unit and component tests verifying Tree Node Row Title composite structure, feature count formatting, async loading placeholder, inline rename isolation, and active/selected visual orthogonality (Ticket #92, ADR 0016).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link LayerTreeWidget}
 * @see docs/adr/0016-active-layer-vs-selected-layer-and-tree-node-title.md (ADR 0016)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { createJiti } from 'jiti';

// Mock .svg import for headless Node testing
// @ts-ignore
require.extensions['.svg'] = (mod: any) => {
  mod.exports = 'mock-logo.svg';
};

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

  value = '';
  defaultValue = '';

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

  get textContent(): string {
    if (this.childNodes.length > 0) {
      return this.childNodes.map(c => c.textContent || '').join('');
    }
    return (this as any)._textContent || '';
  }

  set textContent(val: string) {
    (this as any)._textContent = String(val);
    this.childNodes = [];
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

  focus(): void {}
  select(): void {}

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

  replaceChild(newChild: any, oldChild: any): any {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx !== -1) {
      this.childNodes[idx] = newChild;
      newChild.parentNode = this;
      oldChild.parentNode = null;
    }
    return oldChild;
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
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
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
      textContent: text,
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
    '@main': path.resolve(process.cwd(), 'src/main')
  }
});

const {
  hasProjectSignal,
  projectNameSignal,
  projectTreeSignal,
  projectLayersSignal,
  editingNodeIdSignal,
  activeLayerIdSignal,
  setNodeSelection,
  clearNodeSelection,
  updateLayerFeatureCount
} = jiti('../../../src/renderer/state/projectSignals.ts');

const { editableLayerIdsSignal } = jiti('../../../src/renderer/state/gisSignals.ts');
const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');
const { mdiPencilOutline, mdiClockTimeFourOutline } = jiti('@mdi/js');

const { LayerTreeWidget } = jiti('../../../src/renderer/workbench/widgets/LayerTreeWidget.tsx');

describe('LayerTreeWidget Title Structure & Active Layer Typography (Ticket #92, ADR 0016)', () => {
  const workbenchCssPath = path.resolve(process.cwd(), 'src/renderer/styles/workbench.css');
  let cssContent = '';

  beforeEach(() => {
    setupDom();
    hasProjectSignal.value = true;
    projectNameSignal.value = 'National Topographic Project';
    editingNodeIdSignal.value = null;
    clearNodeSelection();
    activeLayerIdSignal.value = null;
    editableLayerIdsSignal.value = new Set();
    dictionarySignal.value = {
      tree_node_layer_in_edit_mode: 'Layer is in edit mode',
      tree_node_layer_temporal_enabled: 'Dynamic temporal control enabled'
    };

    projectTreeSignal.value = [
      {
        id: 'group-water',
        name: 'Hydrography',
        visible: true,
        expanded: true,
        children: [
          {
            id: 'layer-lakes',
            name: 'Major Lakes',
            type: 'vector',
            source: '/data/lakes.shp',
            visible: true,
            geometryKind: 'Polygon',
            featureCount: 1353
          },
          {
            id: 'layer-rivers-loading',
            name: 'Rivers and Streams',
            type: 'vector',
            source: '/data/rivers.shp',
            visible: true,
            geometryKind: 'LineString'
            // featureCount undefined (resolving asynchronously)
          },
          {
            id: 'layer-dem-raster',
            name: 'Digital Elevation Model',
            type: 'raster',
            source: '/data/dem.tif',
            visible: true,
            geometryKind: 'Raster'
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
    editableLayerIdsSignal.value = new Set();
    dictionarySignal.value = {
      tree_node_layer_in_edit_mode: 'Layer is in edit mode',
      tree_node_layer_temporal_enabled: 'Dynamic temporal control enabled'
    };
  });

  it('workbench.css reserves var(--cartouche-theme-info-subtle) background strictly for .selected and defines 4-state typography matrix', () => {
    // 1. .selected must declare background-color: var(--cartouche-theme-info-subtle)
    assert.match(
      cssContent,
      /\.tree-node-row\.selected[^{]*\{[^}]*background-color:\s*var\(--cartouche-theme-info-subtle\)/s,
      '.tree-node-row.selected must declare background-color: var(--cartouche-theme-info-subtle)'
    );

    // 2. .active must NOT declare background-color: var(--cartouche-theme-info-subtle)
    const activeRowMatch = cssContent.match(/\.tree-node-row\.active\s*\{([^}]+)\}/);
    if (activeRowMatch) {
      assert.doesNotMatch(
        activeRowMatch[1],
        /background-color:\s*var\(--cartouche-theme-info-subtle\)/,
        '.tree-node-row.active must NOT declare background-color: var(--cartouche-theme-info-subtle)'
      );
    }

    // 3. 4-state typography matrix on .tree-node-title
    // Active only: font-weight: bold, font-style: normal
    assert.match(
      cssContent,
      /\.tree-node-row\.active\s+\.tree-node-title[^{]*\{[^}]*font-weight:\s*bold/s,
      '.tree-node-row.active .tree-node-title must declare font-weight: bold'
    );
    assert.match(
      cssContent,
      /\.tree-node-row\.active\s+\.tree-node-title[^{]*\{[^}]*font-style:\s*normal/s,
      '.tree-node-row.active .tree-node-title must declare font-style: normal'
    );

    // In edit mode only: font-weight: normal, font-style: italic
    assert.match(
      cssContent,
      /\.tree-node-row\.in-edit-mode\s+\.tree-node-title[^{]*\{[^}]*font-weight:\s*normal/s,
      '.tree-node-row.in-edit-mode .tree-node-title must declare font-weight: normal'
    );
    assert.match(
      cssContent,
      /\.tree-node-row\.in-edit-mode\s+\.tree-node-title[^{]*\{[^}]*font-style:\s*italic/s,
      '.tree-node-row.in-edit-mode .tree-node-title must declare font-style: italic'
    );

    // Active AND in edit mode: font-weight: bold, font-style: italic
    assert.match(
      cssContent,
      /\.tree-node-row\.active\.in-edit-mode\s+\.tree-node-title[^{]*\{[^}]*font-weight:\s*bold/s,
      '.tree-node-row.active.in-edit-mode .tree-node-title must declare font-weight: bold'
    );
    assert.match(
      cssContent,
      /\.tree-node-row\.active\.in-edit-mode\s+\.tree-node-title[^{]*\{[^}]*font-style:\s*italic/s,
      '.tree-node-row.active.in-edit-mode .tree-node-title must declare font-style: italic'
    );
  });

  it('renders .tree-node-title wrapping .tree-node-name and .tree-node-count for vector layers with features', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    assert.strictEqual(layerRows.length, 3);

    // First layer: Lakes (Polygon, featureCount = 1353)
    const lakesRow = layerRows[0];
    const titleContainer = findAllNodes(lakesRow, el => el.className.includes('tree-node-title'))[0];
    assert.ok(titleContainer, 'Lakes row must render .tree-node-title container');

    const nameSpan = findAllNodes(titleContainer, el => el.className.includes('tree-node-name'))[0];
    assert.ok(nameSpan, 'Must render .tree-node-name span inside title');
    assert.strictEqual(nameSpan.textContent, 'Major Lakes');

    const countSpan = findAllNodes(titleContainer, el => el.className.includes('tree-node-count'))[0];
    assert.ok(countSpan, 'Must render .tree-node-count span inside title');
    assert.strictEqual(countSpan.textContent, ' (1,353)', 'Feature count must be parenthesized and locale-formatted');
  });

  it('renders (...) placeholder in .tree-node-count when vector featureCount is undefined', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    // Second layer: Rivers and Streams (LineString, featureCount undefined)
    const riversRow = layerRows[1];
    const titleContainer = findAllNodes(riversRow, el => el.className.includes('tree-node-title'))[0];
    assert.ok(titleContainer, 'Rivers row must render .tree-node-title');

    const countSpan = findAllNodes(titleContainer, el => el.className.includes('tree-node-count'))[0];
    assert.ok(countSpan, 'Must render .tree-node-count placeholder');
    assert.strictEqual(countSpan.textContent, ' (...)', 'Undefined vector count must render (...) placeholder');
  });

  it('omits .tree-node-count for raster layers, layer groups, and project root', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    // 1. Raster layer
    const layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    const rasterRow = layerRows[2];
    const rasterTitle = findAllNodes(rasterRow, el => el.className.includes('tree-node-title'))[0];
    const rasterCount = findAllNodes(rasterTitle, el => el.className.includes('tree-node-count'));
    assert.strictEqual(rasterCount.length, 0, 'Raster layers must not render .tree-node-count');

    // 2. Group row
    const groupRow = findAllNodes(container!, el => el.className.includes('tree-node-group'))[0];
    const groupTitle = findAllNodes(groupRow, el => el.className.includes('tree-node-title'))[0];
    const groupCount = findAllNodes(groupTitle, el => el.className.includes('tree-node-count'));
    assert.strictEqual(groupCount.length, 0, 'Layer groups must not render .tree-node-count');

    // 3. Project root row
    const projectRow = findAllNodes(container!, el => el.className.includes('tree-node-project'))[0];
    const projectTitle = findAllNodes(projectRow, el => el.className.includes('project-title'))[0];
    const projectCount = findAllNodes(projectTitle, el => el.className.includes('tree-node-count'));
    assert.strictEqual(projectCount.length, 0, 'Project root must not render .tree-node-count');
  });

  it('isolates inline renaming to .tree-node-name while preserving .tree-node-count', async () => {
    // Put 'layer-lakes' into inline edit mode
    editingNodeIdSignal.value = 'layer-lakes';

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    const lakesRow = layerRows[0];
    const titleContainer = findAllNodes(lakesRow, el => el.className.includes('tree-node-title'))[0];
    assert.ok(titleContainer, 'Title container must remain rendered during inline editing');

    // Inside titleContainer: must have <input> and must still have .tree-node-count
    const inlineInput = findAllNodes(titleContainer, el => el.tagName === 'INPUT')[0];
    assert.ok(inlineInput, 'Must render inline input field inside .tree-node-title');

    const countSpan = findAllNodes(titleContainer, el => el.className.includes('tree-node-count'))[0];
    assert.ok(countSpan, 'Must preserve .tree-node-count beside inline input');
    assert.strictEqual(countSpan.textContent, ' (1,353)');
  });

  it('renders active and selected states orthogonally on tree node rows', async () => {
    // Layer 1 (lakes) is active only
    // Layer 2 (rivers) is selected only
    activeLayerIdSignal.value = 'layer-lakes';
    setNodeSelection(['layer-rivers-loading']);

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    const lakesRow = layerRows[0];
    const riversRow = layerRows[1];

    // Lakes: active only
    assert.ok(lakesRow.className.includes('active'), 'Active-only layer must have .active class');
    assert.strictEqual(lakesRow.className.includes('selected'), false, 'Active-only layer must NOT have .selected class');

    // Rivers: selected only
    assert.ok(riversRow.className.includes('selected'), 'Selected-only layer must have .selected class');
    assert.strictEqual(riversRow.className.includes('active'), false, 'Selected-only layer must NOT have .active class');

    // Now select both: lakes becomes active AND selected
    await act(async () => {
      setNodeSelection(['layer-lakes', 'layer-rivers-loading']);
    });

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    assert.ok(lakesRow.className.includes('active'), 'Lakes must have .active class');
    assert.ok(lakesRow.className.includes('selected'), 'Lakes must have .selected class');
  });

  it('updates feature count reactively when resolved asynchronously via updateLayerFeatureCount', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const riverRow = findAllNodes(
      container!,
      el => el.className.includes('tree-node-layer') && el.textContent.includes('Rivers and Streams')
    )[0];
    const riverCount = findAllNodes(riverRow, el => el.className.includes('tree-node-count'))[0];
    assert.ok(riverCount, 'River count span must exist');
    assert.strictEqual(riverCount.textContent.trim(), '(...)', 'Initially displays placeholder');

    // Asynchronous resolution completes
    await act(async () => {
      updateLayerFeatureCount('layer-rivers-loading', 8420);
    });

    const updatedRiverCount = findAllNodes(riverRow, el => el.className.includes('tree-node-count'))[0];
    assert.strictEqual(updatedRiverCount.textContent.trim(), '(8,420)', 'Updates reactively to formatted feature count');
  });

  it('resolves feature count from projectLayersSignal when not present on projectTreeSignal node', async () => {
    projectLayersSignal.value = [
      {
        id: 'layer-rivers-loading',
        name: 'Rivers and Streams',
        type: 'vector',
        source: '/data/rivers.shp',
        featureCount: 2500
      } as any
    ];

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const riverRow = findAllNodes(
      container!,
      el => el.className.includes('tree-node-layer') && el.textContent.includes('Rivers and Streams')
    )[0];
    const riverCount = findAllNodes(riverRow, el => el.className.includes('tree-node-count'))[0];
    assert.ok(riverCount, 'River count span must exist');
    assert.strictEqual(riverCount.textContent.trim(), '(2,500)', 'Resolves count from projectLayersSignal');
  });

  it('renders 4-state typography classes (.active, .in-edit-mode) across all permutations on tree rows', async () => {
    // State 1: Lakes is active only (active: true, edit: false)
    await act(async () => {
      activeLayerIdSignal.value = 'layer-lakes';
      editableLayerIdsSignal.value = new Set();
      root!.render(React.createElement(LayerTreeWidget));
    });

    let layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    let lakesRow = layerRows[0];
    let riversRow = layerRows[1];

    assert.ok(lakesRow.className.includes('active'), 'State 1: active layer has .active');
    assert.strictEqual(lakesRow.className.includes('in-edit-mode'), false, 'State 1: non-editing layer lacks .in-edit-mode');
    assert.strictEqual(riversRow.className.includes('active'), false, 'State 4: regular layer lacks .active');
    assert.strictEqual(riversRow.className.includes('in-edit-mode'), false, 'State 4: regular layer lacks .in-edit-mode');

    // State 2: Lakes is active AND in edit mode
    await act(async () => {
      editableLayerIdsSignal.value = new Set(['layer-lakes']);
      root!.render(React.createElement(LayerTreeWidget));
    });

    layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    lakesRow = layerRows[0];
    assert.ok(lakesRow.className.includes('active'), 'State 2: active layer has .active');
    assert.ok(lakesRow.className.includes('in-edit-mode'), 'State 2: editing layer has .in-edit-mode');

    // State 3: Rivers is in edit mode but NOT active; Lakes is inactive and not editing (State 4)
    await act(async () => {
      activeLayerIdSignal.value = null;
      editableLayerIdsSignal.value = new Set(['layer-rivers-loading']);
      root!.render(React.createElement(LayerTreeWidget));
    });

    layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    lakesRow = layerRows[0];
    riversRow = layerRows[1];

    assert.strictEqual(riversRow.className.includes('active'), false, 'State 3: inactive layer lacks .active');
    assert.ok(riversRow.className.includes('in-edit-mode'), 'State 3: editing layer has .in-edit-mode');
    assert.strictEqual(lakesRow.className.includes('active'), false, 'State 4: neither layer lacks .active');
    assert.strictEqual(lakesRow.className.includes('in-edit-mode'), false, 'State 4: neither layer lacks .in-edit-mode');
  });

  it('renders MDI pencil-outline icon in #2563eb with tooltip when layer is in edit mode and reactively updates on change', async () => {
    // Initially not in edit mode
    await act(async () => {
      editableLayerIdsSignal.value = new Set();
      root!.render(React.createElement(LayerTreeWidget));
    });

    let layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    let lakesRow = layerRows[0];
    let editIcons = findAllNodes(lakesRow, el => el.className.includes('tree-edit-icon-slot'));
    assert.strictEqual(editIcons.length, 0, 'No pencil icon when edit mode is off');

    // Put Lakes into edit mode
    await act(async () => {
      editableLayerIdsSignal.value = new Set(['layer-lakes']);
      root!.render(React.createElement(LayerTreeWidget));
    });

    layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    lakesRow = layerRows[0];
    const riversRow = layerRows[1];

    editIcons = findAllNodes(lakesRow, el => el.className.includes('tree-edit-icon-slot'));
    assert.strictEqual(editIcons.length, 1, 'Pencil icon rendered when in edit mode');

    const editIconSpan = editIcons[0];
    assert.strictEqual(editIconSpan.attributes['title'], 'Layer is in edit mode', 'Pencil icon must have tooltip');

    // Check SVG child path
    const svgPath = findAllNodes(editIconSpan, el => el.tagName === 'PATH')[0];
    assert.ok(svgPath, 'SVG path must be present in edit icon slot');
    assert.strictEqual(svgPath.attributes['d'], mdiPencilOutline, 'Must render mdiPencilOutline path');

    // Rivers is not in edit mode
    const riverEditIcons = findAllNodes(riversRow, el => el.className.includes('tree-edit-icon-slot'));
    assert.strictEqual(riverEditIcons.length, 0, 'Non-editing layer must not render pencil icon');

    // Toggle edit mode off reactively
    await act(async () => {
      editableLayerIdsSignal.value = new Set();
      root!.render(React.createElement(LayerTreeWidget));
    });

    layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    lakesRow = layerRows[0];
    editIcons = findAllNodes(lakesRow, el => el.className.includes('tree-edit-icon-slot'));
    assert.strictEqual(editIcons.length, 0, 'Pencil icon reactively removed when edit mode is toggled off');
  });

  it('renders MDI clock-outline icon immediately following title when dynamic temporal control is enabled and updates reactively (Ticket #163)', async () => {
    // 1. Initial render without temporal control
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    let layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    let lakesRow = layerRows[0];
    let clockIcons = findAllNodes(lakesRow, el => el.className.includes('tree-temporal-icon-slot'));
    assert.strictEqual(clockIcons.length, 0, 'No clock icon when temporal control is disabled');

    // Group and project root rows must not have clock icon
    const groupRows = findAllNodes(container!, el => el.className.includes('tree-node-group'));
    assert.ok(groupRows.length > 0, 'Group row exists');
    const groupClockIcons = findAllNodes(groupRows[0], el => el.className.includes('tree-temporal-icon-slot'));
    assert.strictEqual(groupClockIcons.length, 0, 'Group row must never render clock icon');

    const projectRow = findAllNodes(container!, el => el.className.includes('tree-node-project'))[0];
    assert.ok(projectRow, 'Project root row must exist');
    const rootClockIcons = findAllNodes(projectRow, el => el.className.includes('tree-temporal-icon-slot'));
    assert.strictEqual(rootClockIcons.length, 0, 'Project root must never render clock icon');

    // 2. Enable dynamic temporal control on Lakes layer in projectTreeSignal
    await act(async () => {
      projectTreeSignal.value = [
        {
          id: 'group-water',
          name: 'Hydrography',
          visible: true,
          expanded: true,
          children: [
            {
              id: 'layer-lakes',
              name: 'Major Lakes',
              type: 'vector',
              source: '/data/lakes.shp',
              visible: true,
              geometryKind: 'Polygon',
              featureCount: 1353,
              temporalEnabled: true
            },
            {
              id: 'layer-rivers-loading',
              name: 'Rivers and Streams',
              type: 'vector',
              source: '/data/rivers.shp',
              visible: true,
              geometryKind: 'LineString',
              temporalEnabled: false
            }
          ]
        }
      ];
      root!.render(React.createElement(LayerTreeWidget));
    });

    layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    lakesRow = layerRows[0];
    const riversRow = layerRows[1];

    clockIcons = findAllNodes(lakesRow, el => el.className.includes('tree-temporal-icon-slot'));
    assert.strictEqual(clockIcons.length, 1, 'Clock icon rendered when temporalEnabled is true');

    const clockSpan = clockIcons[0];
    assert.strictEqual(
      clockSpan.attributes['title'],
      'Dynamic temporal control enabled',
      'Clock icon must have accessible tooltip'
    );
    assert.strictEqual(clockSpan.style.color, '#2563eb', 'Clock icon must use #2563eb accent color');

    // Verify SVG icon path
    const svgPath = findAllNodes(clockSpan, el => el.tagName === 'PATH')[0];
    assert.ok(svgPath, 'SVG path must be present in temporal icon slot');
    assert.strictEqual(svgPath.attributes['d'], mdiClockTimeFourOutline, 'Must render mdiClockTimeFourOutline path');

    // Positioning check: clock icon must appear AFTER .tree-node-title in childNodes
    const lakesRowChildClasses = lakesRow.childNodes
      .filter(c => c.nodeType === 1)
      .map(c => c.className || '');
    const titleIndex = lakesRowChildClasses.findIndex(c => c.includes('tree-node-title'));
    const clockIndex = lakesRowChildClasses.findIndex(c => c.includes('tree-temporal-icon-slot'));
    assert.ok(titleIndex !== -1, 'tree-node-title exists');
    assert.ok(clockIndex !== -1, 'tree-temporal-icon-slot exists');
    assert.ok(
      clockIndex > titleIndex,
      `Clock icon must be positioned after tree-node-title (clock=${clockIndex}, title=${titleIndex})`
    );

    // Feature count badge positioning check
    const titleNode = lakesRow.childNodes.find(c => c.className && c.className.includes('tree-node-title'));
    const countBadge = findAllNodes(titleNode, el => el.className.includes('tree-node-count'))[0];
    assert.ok(countBadge, 'Vector feature count badge must be within tree-node-title');

    // Rivers has temporalEnabled: false, so must not render clock icon
    const riverClockIcons = findAllNodes(riversRow, el => el.className.includes('tree-temporal-icon-slot'));
    assert.strictEqual(riverClockIcons.length, 0, 'Disabled temporal layer must not render clock icon');

    // 3. Reactively disable temporal control
    await act(async () => {
      projectTreeSignal.value = [
        {
          id: 'group-water',
          name: 'Hydrography',
          visible: true,
          expanded: true,
          children: [
            {
              id: 'layer-lakes',
              name: 'Major Lakes',
              type: 'vector',
              source: '/data/lakes.shp',
              visible: true,
              geometryKind: 'Polygon',
              featureCount: 1353,
              temporalEnabled: false
            }
          ]
        }
      ];
      root!.render(React.createElement(LayerTreeWidget));
    });

    layerRows = findAllNodes(container!, el => el.className.includes('tree-node-layer'));
    lakesRow = layerRows[0];
    clockIcons = findAllNodes(lakesRow, el => el.className.includes('tree-temporal-icon-slot'));
    assert.strictEqual(clockIcons.length, 0, 'Clock icon reactively removed when temporalEnabled is false');
  });
});
