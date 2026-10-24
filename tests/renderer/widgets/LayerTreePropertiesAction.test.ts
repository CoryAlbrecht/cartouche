/**
 * @file LayerTreePropertiesAction.test.ts
 * @module tests/renderer/widgets/LayerTreePropertiesAction.test
 * @description Unit and component tests verifying LayerTreeWidget PopupMenu Layer Properties action, multi-selection suppression, group suppression, row double-click dispatch, and active target synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see {@link LayerTreeWidget}
 * @see {@link LayerPropertiesDialog}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

const require = createRequire(import.meta.url);
require.extensions['.svg'] = (mod: any) => {
  mod.exports = 'mock-logo.svg';
};

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
    const styleObj: Record<string, string> = {};
    this.style = Object.assign(styleObj, {
      setProperty: (name: string, val: string) => {
        styleObj[name] = val;
      },
      removeProperty: (name: string) => {
        delete styleObj[name];
      },
      getPropertyValue: (name: string) => styleObj[name] || ''
    });
  }

  setAttribute(key: string, val: string): void {
    this.attributes[key] = String(val);
    if (key === 'class') {
      this.className = String(val);
    }
  }

  getAttribute(key: string): string | null {
    return this.attributes[key] ?? null;
  }

  hasAttribute(key: string): boolean {
    return key in this.attributes;
  }

  removeAttribute(key: string): void {
    delete this.attributes[key];
  }

  appendChild(child: any): any {
    if (!child) return child;
    child.parentNode = this;
    if (!child.ownerDocument && this.ownerDocument) {
      child.ownerDocument = this.ownerDocument;
    }
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
    const idx = this.childNodes.indexOf(refChild);
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, newChild);
    } else {
      this.childNodes.push(newChild);
    }
    newChild.parentNode = this;
    if (!newChild.ownerDocument && this.ownerDocument) {
      newChild.ownerDocument = this.ownerDocument;
    }
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
    if (!event.target) event.target = this;
    event.currentTarget = this;
    const listeners = this.eventListeners[event.type] || [];
    for (const l of listeners) {
      l.cb(event);
    }
    if (!event._bubblesStopped && this.parentNode && typeof this.parentNode.dispatchEvent === 'function') {
      this.parentNode.dispatchEvent(event);
    }
    return true;
  }

  contains(node: any): boolean {
    if (node === this) return true;
    for (const child of this.childNodes) {
      if (child.contains && child.contains(node)) return true;
    }
    return false;
  }

  get textContent(): string {
    return this.childNodes
      .map((c) => (c.nodeType === 3 ? (c.nodeValue || c.textContent || '') : (c.textContent || '')))
      .join('');
  }

  set textContent(val: string) {
    this.childNodes = [];
    if (val) {
      this.appendChild({
        nodeType: 3,
        nodeValue: String(val),
        textContent: String(val),
        ownerDocument: this.ownerDocument,
        parentNode: this
      });
    }
  }

  getBoundingClientRect() {
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
  const head = new MockElement('head');
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
      nodeValue: String(text),
      textContent: String(text),
      ownerDocument: doc,
      parentNode: null
    }),
    createComment: (data?: string) => ({
      nodeType: 8,
      data: String(data || ''),
      ownerDocument: doc,
      parentNode: null
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null as any
  };

  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;
  head.ownerDocument = doc;

  const win = {
    innerWidth: 1024,
    innerHeight: 768,
    document: doc,
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
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement,
    electronAPI: {
      getLayerInfo: async () => ({})
    }
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
  editingNodeIdSignal,
  activeLayerIdSignal,
  clearNodeSelection,
  selectSingleNode,
  toggleNodeSelection
} = jiti('../../../src/renderer/state/projectSignals.ts');

const {
  activeLayerPropertiesIdSignal,
  closeLayerPropertiesDialog
} = jiti('../../../src/renderer/state/layerPropertiesSignals.ts');

const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');

const { LayerTreeWidget } = jiti('../../../src/renderer/workbench/widgets/LayerTreeWidget.tsx');

describe('LayerTreeWidget Layer Properties PopupMenu and Double-Click (Ticket #73)', () => {
  beforeEach(() => {
    setupDom();
    hasProjectSignal.value = true;
    projectNameSignal.value = 'Test GIS Project';
    editingNodeIdSignal.value = null;
    clearNodeSelection();
    activeLayerIdSignal.value = null;
    closeLayerPropertiesDialog();

    dictionarySignal.value = {
      layer_properties_menu_item: 'Layer Properties...',
      rename_layer_tree_node: 'Rename',
      create_group: 'Create Group',
      remove_layer: 'Remove Layer',
      remove_group: 'Remove Group',
      remove_selected_items: 'Remove Selected Items'
    };

    projectTreeSignal.value = [
      {
        id: 'group-1',
        name: 'Boundaries',
        visible: true,
        expanded: true,
        children: [
          {
            id: 'layer-cities',
            name: 'Major Cities',
            type: 'vector',
            source: '/data/cities.geojson',
            visible: true
          },
          {
            id: 'layer-rivers',
            name: 'Rivers',
            type: 'vector',
            source: '/data/rivers.geojson',
            visible: true
          }
        ]
      }
    ];
  });

  afterEach(() => {
    tearDownDom();
    closeLayerPropertiesDialog();
  });

  it('displays Layer Properties... in PopupMenu when a solitary layer is secondary-clicked', () => {
    act(() => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(
      container,
      (el) => el.className.includes('tree-node-row') && el.className.includes('tree-node-layer')
    );
    assert(layerRows.length > 0, 'Should find layer rows in tree');

    // Trigger secondary click (contextmenu) on the first layer row
    const event = {
      type: 'contextmenu',
      clientX: 120,
      clientY: 240,
      preventDefault: () => {},
      stopPropagation: () => {},
      _bubblesStopped: false
    };

    act(() => {
      layerRows[0].dispatchEvent(event);
    });

    // Verify PopupMenu item rendered with "Layer Properties..."
    const menuItems = findAllNodes(
      doc.body,
      (el) => el.className.includes('menu-item-label')
    );

    const propertiesItem = menuItems.find((el) => (el as any).textContent?.includes('Layer Properties'));

    assert(propertiesItem, 'PopupMenu must include "Layer Properties..." item for solitary layer');
  });

  it('hides Layer Properties... from PopupMenu when a group is secondary-clicked', () => {
    act(() => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const groupRows = findAllNodes(
      container,
      (el) => el.className.includes('tree-node-row') && el.className.includes('tree-node-group')
    );
    assert(groupRows.length > 0, 'Should find group rows in tree');

    const event = {
      type: 'contextmenu',
      clientX: 100,
      clientY: 150,
      preventDefault: () => {},
      stopPropagation: () => {},
      _bubblesStopped: false
    };

    act(() => {
      groupRows[0].dispatchEvent(event);
    });

    const menuItems = findAllNodes(
      doc.body,
      (el) => el.className.includes('menu-item-label')
    );

    const propertiesItem = menuItems.find((el) => (el as any).textContent?.includes('Layer Properties'));

    assert(!propertiesItem, 'PopupMenu must NOT include "Layer Properties..." for group nodes');
  });

  it('hides Layer Properties... from PopupMenu when multiple nodes are selected', () => {
    selectSingleNode('layer-cities');
    toggleNodeSelection('layer-rivers');

    act(() => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(
      container,
      (el) => el.className.includes('tree-node-row') && el.className.includes('tree-node-layer')
    );

    const event = {
      type: 'contextmenu',
      clientX: 120,
      clientY: 240,
      preventDefault: () => {},
      stopPropagation: () => {},
      _bubblesStopped: false
    };

    act(() => {
      layerRows[0].dispatchEvent(event);
    });

    const menuItems = findAllNodes(
      doc.body,
      (el) => el.className.includes('menu-item-label')
    );

    const propertiesItem = menuItems.find((el) => (el as any).textContent?.includes('Layer Properties'));

    assert(!propertiesItem, 'PopupMenu must NOT include "Layer Properties..." when multiple nodes are selected');
  });

  it('opens LayerPropertiesDialog on layer row double-click', () => {
    act(() => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(
      container,
      (el) => el.className.includes('tree-node-row') && el.className.includes('tree-node-layer')
    );
    assert(layerRows.length > 0, 'Should find layer row');

    const dblClickEvent = {
      type: 'dblclick',
      preventDefault: () => {},
      stopPropagation: () => {},
      _bubblesStopped: false
    };

    assert.equal(activeLayerPropertiesIdSignal.value, null);

    act(() => {
      layerRows[0].dispatchEvent(dblClickEvent);
    });

    assert.equal(activeLayerPropertiesIdSignal.value, 'layer-cities');
  });

  it('updates target layer ID and refocuses dialog when double-clicking a different layer', () => {
    act(() => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const layerRows = findAllNodes(
      container,
      (el) => el.className.includes('tree-node-row') && el.className.includes('tree-node-layer')
    );

    // First layer
    act(() => {
      layerRows[0].dispatchEvent({
        type: 'dblclick',
        preventDefault: () => {},
        stopPropagation: () => {},
        _bubblesStopped: false
      });
    });
    assert.equal(activeLayerPropertiesIdSignal.value, 'layer-cities');

    // Second layer
    act(() => {
      layerRows[1].dispatchEvent({
        type: 'dblclick',
        preventDefault: () => {},
        stopPropagation: () => {},
        _bubblesStopped: false
      });
    });
    assert.equal(activeLayerPropertiesIdSignal.value, 'layer-rivers');
  });
});
