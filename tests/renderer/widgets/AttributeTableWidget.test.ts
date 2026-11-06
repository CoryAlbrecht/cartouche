/**
 * @file AttributeTableWidget.test.ts
 * @module tests/renderer/widgets/AttributeTableWidget.test
 * @description Unit and component tests verifying AttributeTableWidget header toolbars, scaling, grabber suppression, and reactive synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @see {@link AttributeTableWidget}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AttributeTableWidgetProps } from '../../../src/renderer/workbench/widgets/AttributeTableWidget';
import type { GisLayer } from '../../../src/renderer/state/gisSignals';

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
  className = '';
  textContent = '';
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
      getPropertyValue: (name: string) => styleProps[name] || '',
    });
  }

  focus(): void {}
  blur(): void {}

  get value(): string {
    return (this as any).__value ?? '';
  }

  set value(v: any) {
    (this as any).__value = String(v);
  }

  setAttribute(name: string, val: any): void {
    this.attributes[name] = String(val);
    if (name === 'class') this.className = String(val);
    if (name === 'id') (this as any).id = String(val);
    if (name === 'value') (this as any).__value = String(val);
  }

  getAttribute(name: string): string | null {
    if (name === 'class') return this.className || null;
    if (name === 'id') return (this as any).id || null;
    return this.attributes[name] ?? null;
  }

  removeAttribute(name: string): void {
    delete this.attributes[name];
    if (name === 'class') this.className = '';
    if (name === 'id') delete (this as any).id;
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
    return { width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200 };
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
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null as any,
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
      windowListeners[type] = windowListeners[type].filter(l => l.cb !== cb);
    },
    document: doc,
    HTMLElement: MockElement,
    Element: MockElement,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };

  doc.defaultView = win;
  (globalThis as any).window = win;
  (globalThis as any).document = doc;
  (globalThis as any).HTMLIFrameElement = win.HTMLIFrameElement = class {};
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

const {
  AttributeTableWidget,
  AttributeTablePanel,
} = jiti('../../../src/renderer/workbench/widgets/AttributeTableWidget.tsx') as {
  AttributeTableWidget: React.FC<AttributeTableWidgetProps>;
  AttributeTablePanel: React.FC<AttributeTableWidgetProps>;
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
  saveActiveLayerAction,
  toggleLayerEditingAction,
} = jiti('../../../src/renderer/state/gisSignals.ts') as {
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
  saveActiveLayerAction: () => void;
  toggleLayerEditingAction: (layerId?: string | null, options?: any) => void;
};

describe('AttributeTableWidget Header Embedded Toolbars (Ticket #176)', () => {
  beforeEach(() => {
    setupDom();
    activeLayerIdSignal.value = null;
    layersSignal.value = [];
    projectLayersSignal.value = [];
    projectTreeSignal.value = [];
    featuresSignal.value = [];
    activeToolSignal.value = 'pan';
    activeSelectionModeSignal.value = 'select_feature';
    editableLayerIdsSignal.value = new Set();
    selectedFeatureIdsSignal.value = new Set();
    editedFeatureIdsSignal.value = new Set();
    isProjectDirtySignal.value = false;
  });

  afterEach(() => {
    tearDownDom();
  });

  it('exports AttributeTableWidget and retains AttributeTablePanel alias', () => {
    assert.strictEqual(typeof AttributeTableWidget, 'function');
    assert.strictEqual(AttributeTablePanel, AttributeTableWidget);
  });

  it('renders empty message when no active layer is selected', async () => {
    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const emptyMsg = findAllNodes(container, el => el.className.includes('empty-panel-message'))[0];
    assert.ok(emptyMsg, 'Empty panel message must be rendered when active layer is null');
  });

  it('renders embedded Selection and Digitizing toolbars in header when layer is active', async () => {
    const mockLayer: GisLayer = {
      id: 'layer-parcels',
      name: 'Parcels',
      kind: 'vector',
      geometryKind: 'Polygon',
      visible: true,
      opacity: 1.0,
      color: '#3b82f6',
      featureCount: 1,
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = 'layer-parcels';
    featuresSignal.value = [
      { id: 1, layerId: 'layer-parcels', geometryType: 'Polygon', properties: { name: 'Parcel A', area: 1200 } },
    ];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const header = findAllNodes(container, el => el.className.includes('attribute-table-header'))[0];
    assert.ok(header, 'Attribute table header container must exist');

    // Verify redundant title text is absent
    const redundantTitle = findAllNodes(container, el => el.className.includes('table-title'))[0];
    assert.strictEqual(redundantTitle, undefined, 'Redundant table title text must not be rendered in header');

    // Verify SelectionToolbarWidget is embedded
    const selectionToolbar = findAllNodes(container, el => el.getAttribute('id') === 'toolbar-widget-selection')[0];
    assert.ok(selectionToolbar, 'SelectionToolbarWidget must be embedded inside attribute table header');

    // Verify DigitizingToolbarWidget is embedded
    const digitizingToolbar = findAllNodes(container, el => el.getAttribute('id') === 'toolbar-widget-digitizing')[0];
    assert.ok(digitizingToolbar, 'DigitizingToolbarWidget must be embedded inside attribute table header');

    // Verify grabber handles are suppressed in both toolbars
    const grabbers = findAllNodes(header, el => el.className.includes('toolbar-grabber'));
    assert.strictEqual(grabbers.length, 0, 'Embedded toolbars must suppress grabber handles (showGrabber={false})');

    // Verify scaling is set to 0.667 on toolbar wrappers
    const toolbarsWithScaling = findAllNodes(header, el => {
      const scalingVal = (el.style as any)['--cartouche-ui-icon-scaling'] || el.style.getPropertyValue('--cartouche-ui-icon-scaling');
      return scalingVal === '0.667' || scalingVal === 0.667;
    });
    assert.strictEqual(
      toolbarsWithScaling.length >= 2,
      true,
      'Both embedded toolbars must apply --cartouche-ui-icon-scaling: 0.667'
    );
  });

  it('reflects reactive state changes across active tools and layer edit mode', async () => {
    const mockLayer: GisLayer = {
      id: 'layer-rivers',
      name: 'Rivers',
      kind: 'vector',
      geometryKind: 'LineString',
      visible: true,
      opacity: 1.0,
      color: '#06b6d4',
      featureCount: 0,
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = 'layer-rivers';
    featuresSignal.value = [];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const toggleBtn = findAllNodes(container, el => el.getAttribute('id') === 'toolbar-tool-toggle-layer-editing')[0];
    assert.ok(toggleBtn, 'Toggle layer editing button must exist');
    assert.strictEqual(
      toggleBtn.className.includes('active'),
      false,
      'Toggle editing button must not be active when edit mode is off'
    );

    // Toggle edit mode in signals
    await act(async () => {
      editableLayerIdsSignal.value = new Set(['layer-rivers']);
    });

    assert.strictEqual(
      toggleBtn.className.includes('active'),
      true,
      'Toggle editing button must become active immediately when editableLayerIdsSignal changes'
    );
  });

  it('supports single click, Ctrl-click toggle, and Shift-click range selection on the counter column', async () => {
    const mockLayer: GisLayer = {
      id: 'layer-parcels',
      name: 'Parcels',
      kind: 'vector',
      geometryKind: 'Polygon',
      visible: true,
      opacity: 1.0,
      color: '#3b82f6',
      featureCount: 4,
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = 'layer-parcels';
    featuresSignal.value = [
      { id: 'f-1', layerId: 'layer-parcels', geometryType: 'Polygon', properties: { name: 'Parcel 1' } },
      { id: 'f-2', layerId: 'layer-parcels', geometryType: 'Polygon', properties: { name: 'Parcel 2' } },
      { id: 'f-3', layerId: 'layer-parcels', geometryType: 'Polygon', properties: { name: 'Parcel 3' } },
      { id: 'f-4', layerId: 'layer-parcels', geometryType: 'Polygon', properties: { name: 'Parcel 4' } },
    ];

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const counterCells = findAllNodes(container, el => el.className.includes('cell-counter'));
    assert.strictEqual(counterCells.length, 4, 'Must render 4 counter cells');
    assert.strictEqual(counterCells[0].textContent, '1', 'First row counter must be 1');
    assert.strictEqual(counterCells[3].textContent, '4', 'Fourth row counter must be 4');

    // 1. Single click on row 2 (index 1, id 'f-2')
    await act(async () => {
      counterCells[1].dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      });
    });

    assert.deepStrictEqual(Array.from(selectedFeatureIdsSignal.value), ['f-2']);

    // 2. Ctrl-click on row 4 (index 3, id 'f-4') to toggle it in
    await act(async () => {
      counterCells[3].dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
      });
    });

    assert.deepStrictEqual(Array.from(selectedFeatureIdsSignal.value).sort(), ['f-2', 'f-4']);

    // 3. Shift-click from anchor (now 'f-4' at index 3) backwards to row 2 (index 1)
    await act(async () => {
      counterCells[1].dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
      });
    });

    assert.deepStrictEqual(Array.from(selectedFeatureIdsSignal.value).sort(), ['f-2', 'f-3', 'f-4']);

    // 4. Verify existing selections render with .selected-row
    await act(async () => {
      selectedFeatureIdsSignal.value = new Set(['f-1', 'f-3']);
    });

    const selectedRows = findAllNodes(container, el => el.className.includes('selected-row'));
    assert.strictEqual(selectedRows.length, 2, 'Two rows must have selected-row class');
  });

  it('gates data cell editing by layer edit mode and tracks modified features in editedFeatureIdsSignal', async () => {
    const mockLayer: GisLayer = {
      id: 'layer-parcels',
      name: 'Parcels',
      kind: 'vector',
      geometryKind: 'Polygon',
      visible: true,
      opacity: 1.0,
      color: '#3b82f6',
      featureCount: 2,
    };

    layersSignal.value = [mockLayer];
    activeLayerIdSignal.value = 'layer-parcels';
    featuresSignal.value = [
      { id: 'f-101', layerId: 'layer-parcels', geometryType: 'Polygon', properties: { name: 'Parcel 101', zoning: 'Commercial' } },
      { id: 'f-102', layerId: 'layer-parcels', geometryType: 'Polygon', properties: { name: 'Parcel 102', zoning: 'Residential' } },
    ];

    // Case 1: Edit mode is OFF
    editableLayerIdsSignal.value = new Set();

    await act(async () => {
      root!.render(React.createElement(AttributeTableWidget, {}));
    });

    const dataCells = findAllNodes(container, el => el.className.includes('cell-attribute-data'));
    assert.ok(dataCells.length >= 2, 'Data cells must exist');

    // Click data cell when not in edit mode
    await act(async () => {
      dataCells[0].dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
      });
    });

    let inputEls = findAllNodes(container, el => el.className.includes('cell-editor-input'));
    assert.strictEqual(inputEls.length, 0, 'No inline cell editor input should appear when edit mode is OFF');

    // Case 2: Enable edit mode
    await act(async () => {
      editableLayerIdsSignal.value = new Set(['layer-parcels']);
    });

    // Click data cell when edit mode is ON
    await act(async () => {
      dataCells[0].dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
      });
    });

    inputEls = findAllNodes(container, el => el.className.includes('cell-editor-input'));
    assert.strictEqual(inputEls.length, 1, 'Inline cell editor input should appear when edit mode is ON');
    assert.strictEqual((inputEls[0] as any).value, 'Parcel 101');

    // Type a new value into the input and commit via Enter key
    await act(async () => {
      const propKey = Object.keys(inputEls[0]).find(k => k.startsWith('__reactProps'))!;
      (inputEls[0] as any)[propKey].onChange({ target: { value: 'Parcel 101 Revised' } });
    });

    // Re-acquire input with updated state and simulate Enter keydown
    inputEls = findAllNodes(container, el => el.className.includes('cell-editor-input'));
    await act(async () => {
      const propKey = Object.keys(inputEls[0]).find(k => k.startsWith('__reactProps'))!;
      (inputEls[0] as any)[propKey].onKeyDown({
        key: 'Enter',
        preventDefault: () => {},
      });
    });

    // Verify feature property was updated in featuresSignal
    const updatedFeature = featuresSignal.value.find(f => f.id === 'f-101');
    assert.strictEqual(updatedFeature?.properties.name, 'Parcel 101 Revised');

    // Verify editedFeatureIdsSignal contains 'f-101'
    assert.ok(editedFeatureIdsSignal.value.has('f-101'), 'editedFeatureIdsSignal must track modified feature ID');
    assert.strictEqual(isProjectDirtySignal.value, true, 'isProjectDirtySignal must be set to true on cell edit');

    // Verify saving active layer resets editedFeatureIdsSignal
    await act(async () => {
      saveActiveLayerAction();
    });
    assert.strictEqual(editedFeatureIdsSignal.value.size, 0, 'saveActiveLayerAction must reset editedFeatureIdsSignal');

    // Re-add to editedFeatureIdsSignal and verify toggling editing off clears it
    await act(async () => {
      editedFeatureIdsSignal.value = new Set(['f-101']);
      toggleLayerEditingAction('layer-parcels', { force: true });
    });
    assert.strictEqual(editedFeatureIdsSignal.value.size, 0, 'toggleLayerEditingAction disabling edit mode must clear editedFeatureIdsSignal');
  });
});
