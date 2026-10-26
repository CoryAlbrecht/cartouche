/**
 * @file LayerTreeWidgetInteraction.test.ts
 * @module tests/renderer/widgets/LayerTreeWidgetInteraction.test
 * @description Component tests for LayerTreeWidget interaction triggers verifying active layer transitions on primary click, double click, arrow navigation, PopupMenu preservation, and empty viewport clicks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @see {@link LayerTreeWidget}
 * @see docs/adr/0016-active-layer-vs-selected-layer-and-tree-node-title.md (ADR 0016)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import createJiti from 'jiti';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Mock .svg import for headless Node testing
const require = createRequire(import.meta.url);
require.extensions['.svg'] = (mod: any) => {
  mod.exports = 'mock-logo.svg';
};

import {
  hasProjectSignal,
  projectNameSignal,
  projectTreeSignal,
  selectedNodeIdsSignal,
  activeLayerIdSignal,
  editingNodeIdSignal,
  clearNodeSelection,
  selectSingleNode,
  setNodeSelection
} from '../../../src/renderer/state/projectSignals';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const { LayerTreeWidget } = jiti(
  '../../../src/renderer/workbench/widgets/LayerTreeWidget'
) as {
  LayerTreeWidget: React.FC;
};

class MockElement {
  tagName: string;
  nodeName: string;
  nodeType = 1;
  childNodes: any[] = [];
  parentNode: any = null;
  ownerDocument: any = null;
  style: any;
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
      }
    });
  }

  get textContent(): string {
    if (this.childNodes.length > 0) {
      return this.childNodes.map(c => c.textContent || c.nodeValue || '').join('');
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

  hasAttribute(k: string): boolean {
    return k in this.attributes;
  }

  removeAttribute(k: string): void {
    delete this.attributes[k];
  }

  appendChild(child: any): any {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: any): any {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      child.parentNode = null;
      this.childNodes.splice(idx, 1);
    }
    return child;
  }

  insertBefore(newChild: any, refChild: any): any {
    newChild.parentNode = this;
    const idx = this.childNodes.indexOf(refChild);
    if (idx === -1) {
      this.childNodes.push(newChild);
    } else {
      this.childNodes.splice(idx, 0, newChild);
    }
    return newChild;
  }

  addEventListener(type: string, cb: (e: any) => void, opts?: any): void {
    const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture);
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (this.eventListeners[type]) {
      this.eventListeners[type] = this.eventListeners[type].filter(l => l.cb !== cb);
    }
  }

  dispatchEvent(event: any): boolean {
    event.target = this;
    event.currentTarget = this;
    let curr: any = this;
    const path: any[] = [];
    while (curr) {
      path.push(curr);
      curr = curr.parentNode;
    }
    for (let i = path.length - 1; i >= 0; i--) {
      const node = path[i];
      const listeners = node.eventListeners?.[event.type] || [];
      for (const { cb, capture } of listeners) {
        if (capture) {
          cb.call(node, event);
        }
      }
    }
    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      const listeners = node.eventListeners?.[event.type] || [];
      for (const { cb, capture } of listeners) {
        if (!capture) {
          cb.call(node, event);
        }
      }
    }
    return true;
  }

  contains(other: any): boolean {
    if (other === this) return true;
    for (const child of this.childNodes) {
      if (child.contains && child.contains(other)) return true;
    }
    return false;
  }

  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      bottom: 24,
      right: 200,
      width: 200,
      height: 24,
      x: 0,
      y: 0
    };
  }

  focus() {}
  blur() {}
}

function findAllNodes(node: any, predicate: (el: any) => boolean): any[] {
  const result: any[] = [];
  if (predicate(node)) {
    result.push(node);
  }
  for (const child of node.childNodes || []) {
    result.push(...findAllNodes(child, predicate));
  }
  return result;
}

describe('LayerTreeWidget Interaction Triggers (Ticket #92, ADR 0016)', () => {
  let container: MockElement;
  let root: Root | null = null;
  let prevWindow: any;
  let prevDocument: any;

  beforeEach(() => {
    hasProjectSignal.value = true;
    projectNameSignal.value = 'Urban Transit Study';
    activeLayerIdSignal.value = null;
    editingNodeIdSignal.value = null;
    clearNodeSelection();

    projectTreeSignal.value = [
      {
        id: 'group-transport',
        name: 'Transportation',
        expanded: true,
        children: [
          {
            id: 'layer-roads',
            name: 'Road Network',
            visible: true,
            type: 'vector',
            featureCount: 1500
          } as any,
          {
            id: 'layer-rail',
            name: 'Railway Lines',
            visible: true,
            type: 'vector',
            featureCount: 420
          } as any
        ]
      },
      {
        id: 'layer-boundary',
        name: 'City Boundary',
        visible: true,
        type: 'vector',
        featureCount: 1
      } as any
    ];

    prevWindow = (globalThis as any).window;
    prevDocument = (globalThis as any).document;

    const documentElement = new MockElement('html');
    const head = new MockElement('head');
    const body = new MockElement('body');
    documentElement.appendChild(head);
    documentElement.appendChild(body);

    const mockDoc: any = {
      createElement: (tag: string) => {
        const el = new MockElement(tag);
        (el as any).ownerDocument = mockDoc;
        return el;
      },
      createElementNS: (_ns: string, tag: string) => {
        const el = new MockElement(tag);
        (el as any).ownerDocument = mockDoc;
        return el;
      },
      createTextNode: (text: string) => ({
        nodeType: 3,
        nodeValue: text,
        textContent: text,
        ownerDocument: mockDoc,
        parentNode: null
      }),
      createComment: (text: string) => ({
        nodeType: 8,
        nodeValue: text,
        textContent: text,
        ownerDocument: mockDoc,
        parentNode: null
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      documentElement,
      head,
      body,
      nodeType: 9
    };
    documentElement.ownerDocument = mockDoc;
    head.ownerDocument = mockDoc;
    body.ownerDocument = mockDoc;

    const mockWin: any = {
      document: mockDoc,
      HTMLIFrameElement: class {},
      HTMLElement: MockElement,
      Element: MockElement,
      addEventListener: () => {},
      removeEventListener: () => {},
      CustomEvent: class {
        type: string;
        bubbles: boolean;
        cancelable: boolean;
        detail: any;
        constructor(type: string, init?: any) {
          this.type = type;
          this.bubbles = Boolean(init?.bubbles);
          this.cancelable = Boolean(init?.cancelable);
          this.detail = init?.detail;
        }
      },
      Event: class {
        type: string;
        bubbles: boolean;
        cancelable: boolean;
        constructor(type: string, init?: any) {
          this.type = type;
          this.bubbles = Boolean(init?.bubbles);
          this.cancelable = Boolean(init?.cancelable);
        }
      },
      MouseEvent: class {
        type: string;
        bubbles: boolean;
        cancelable: boolean;
        clientX: number;
        clientY: number;
        button: number;
        ctrlKey: boolean;
        metaKey: boolean;
        shiftKey: boolean;
        constructor(type: string, init?: any) {
          this.type = type;
          this.bubbles = Boolean(init?.bubbles);
          this.cancelable = Boolean(init?.cancelable);
          this.clientX = init?.clientX || 0;
          this.clientY = init?.clientY || 0;
          this.button = init?.button || 0;
          this.ctrlKey = Boolean(init?.ctrlKey);
          this.metaKey = Boolean(init?.metaKey);
          this.shiftKey = Boolean(init?.shiftKey);
        }
        preventDefault() {}
        stopPropagation() {}
      },
      KeyboardEvent: class {
        type: string;
        bubbles: boolean;
        cancelable: boolean;
        key: string;
        constructor(type: string, init?: any) {
          this.type = type;
          this.bubbles = Boolean(init?.bubbles);
          this.cancelable = Boolean(init?.cancelable);
          this.key = init?.key || '';
        }
        preventDefault() {}
        stopPropagation() {}
      }
    };
    mockDoc.defaultView = mockWin;

    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as any).window = mockWin;
    (globalThis as any).document = mockDoc;
    (globalThis as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8, DOCUMENT_NODE: 9 };
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    container = new MockElement('div');
    (container as any).ownerDocument = mockDoc;
    root = createRoot(container as any);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    (globalThis as any).window = prevWindow;
    (globalThis as any).document = prevDocument;
  });

  it('primary click on a leaf layer sets it as the active layer', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const roadsRow = findAllNodes(
      container,
      el => el.className.includes('tree-node-layer') && el.textContent.includes('Road Network')
    )[0];
    assert.ok(roadsRow, 'Roads layer row must exist');

    await act(async () => {
      roadsRow.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
    });

    assert.strictEqual(activeLayerIdSignal.value, 'layer-roads');
  });

  it('primary click on group, project root, or empty viewport clears active layer to null', async () => {
    activeLayerIdSignal.value = 'layer-roads';

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    // 1. Click on group clears active layer
    const groupRow = findAllNodes(container, el => el.className.includes('tree-node-group'))[0];
    assert.ok(groupRow, 'Group row must exist');

    await act(async () => {
      groupRow.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
    });
    assert.strictEqual(activeLayerIdSignal.value, null, 'Clicking group must clear active layer');

    // Reset active layer
    activeLayerIdSignal.value = 'layer-rail';

    // 2. Click on project root clears active layer
    const projectRootRow = findAllNodes(container, el => el.className.includes('tree-node-project'))[0];
    assert.ok(projectRootRow, 'Project root row must exist');

    await act(async () => {
      projectRootRow.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
    });
    assert.strictEqual(activeLayerIdSignal.value, null, 'Clicking project root must clear active layer');

    // Reset active layer
    activeLayerIdSignal.value = 'layer-boundary';

    // 3. Click on empty viewport clears active layer
    const viewport = findAllNodes(container, el => el.className.includes('layer-tree-viewport'))[0];
    assert.ok(viewport, 'Viewport must exist');

    await act(async () => {
      viewport.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
    });
    assert.strictEqual(activeLayerIdSignal.value, null, 'Clicking empty viewport must clear active layer');
  });

  it('secondary click (right-click) preserves active layer unchanged', async () => {
    activeLayerIdSignal.value = 'layer-roads';

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    // Right-click on a different layer (layer-rail)
    const railRow = findAllNodes(
      container,
      el => el.className.includes('tree-node-layer') && el.textContent.includes('Railway Lines')
    )[0];
    assert.ok(railRow, 'Rail layer row must exist');

    await act(async () => {
      railRow.dispatchEvent(new (window as any).MouseEvent('contextmenu', { bubbles: true, button: 2 }));
    });

    // Active layer remains 'layer-roads'
    assert.strictEqual(activeLayerIdSignal.value, 'layer-roads');
  });

  it('keyboard arrow navigation updates active layer when landing on leaf layers and clears on groups', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const treeContainer = findAllNodes(container, el => el.className.includes('layer-tree-container'))[0];
    assert.ok(treeContainer, 'Tree container must exist');

    // Select group first
    selectSingleNode('group-transport');
    activeLayerIdSignal.value = null;

    // ArrowDown into layer-roads
    await act(async () => {
      treeContainer.dispatchEvent(new (window as any).KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    });
    assert.strictEqual(activeLayerIdSignal.value, 'layer-roads', 'ArrowDown onto layer-roads must set activeLayerId');

    // ArrowDown into layer-rail
    await act(async () => {
      treeContainer.dispatchEvent(new (window as any).KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    });
    assert.strictEqual(activeLayerIdSignal.value, 'layer-rail', 'ArrowDown onto layer-rail must set activeLayerId');

    // ArrowDown into layer-boundary
    await act(async () => {
      treeContainer.dispatchEvent(new (window as any).KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    });
    assert.strictEqual(activeLayerIdSignal.value, 'layer-boundary', 'ArrowDown onto layer-boundary must set activeLayerId');

    // ArrowDown wraps back to group-transport
    await act(async () => {
      treeContainer.dispatchEvent(new (window as any).KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    });
    assert.strictEqual(activeLayerIdSignal.value, null, 'ArrowDown onto group-transport must clear activeLayerId');
  });

  it('double click on leaf layer title activates layer and initiates inline rename', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const railRow = findAllNodes(
      container,
      el => el.className.includes('tree-node-layer') && el.textContent.includes('Railway Lines')
    )[0];
    const railTitle = findAllNodes(railRow, el => el.className.includes('tree-node-title'))[0];
    assert.ok(railTitle, 'Rail title element must exist');

    await act(async () => {
      railTitle.dispatchEvent(new (window as any).MouseEvent('dblclick', { bubbles: true }));
    });

    assert.strictEqual(activeLayerIdSignal.value, 'layer-rail');
    assert.strictEqual(editingNodeIdSignal.value, 'layer-rail');
  });

  it('double click on group title clears active layer and initiates inline rename', async () => {
    activeLayerIdSignal.value = 'layer-roads';

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const groupRow = findAllNodes(container, el => el.className.includes('tree-node-group'))[0];
    const groupTitle = findAllNodes(groupRow, el => el.className.includes('tree-node-title'))[0];
    assert.ok(groupTitle, 'Group title element must exist');

    await act(async () => {
      groupTitle.dispatchEvent(new (window as any).MouseEvent('dblclick', { bubbles: true }));
    });

    assert.strictEqual(activeLayerIdSignal.value, null, 'Double clicking group must clear active layer');
    assert.strictEqual(editingNodeIdSignal.value, 'group-transport');
  });

  it('primary click on already-selected leaf layer title designates it active while preserving multi-selection set', async () => {
    // Select both layers
    setNodeSelection(['layer-roads', 'layer-rail']);
    activeLayerIdSignal.value = 'layer-roads';

    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const railRow = findAllNodes(
      container,
      el => el.className.includes('tree-node-layer') && el.textContent.includes('Railway Lines')
    )[0];
    const railTitle = findAllNodes(railRow, el => el.className.includes('tree-node-title'))[0];
    assert.ok(railTitle, 'Rail title element must exist');

    await act(async () => {
      railTitle.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true }));
    });

    // Active layer updates to layer-rail
    assert.strictEqual(activeLayerIdSignal.value, 'layer-rail');
    // Multi-selection set is preserved
    assert.deepEqual(selectedNodeIdsSignal.value.slice().sort(), ['layer-rail', 'layer-roads']);
  });

  it('double clicking feature count activates layer without initiating inline rename', async () => {
    await act(async () => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const railRow = findAllNodes(
      container,
      el => el.className.includes('tree-node-layer') && el.textContent.includes('Railway Lines')
    )[0];
    const railCount = findAllNodes(railRow, el => el.className.includes('tree-node-count'))[0];
    assert.ok(railCount, 'Rail count element must exist');

    await act(async () => {
      railCount.dispatchEvent(new (window as any).MouseEvent('dblclick', { bubbles: true }));
    });

    assert.strictEqual(activeLayerIdSignal.value, 'layer-rail');
    assert.strictEqual(editingNodeIdSignal.value, null, 'Double clicking feature count must not initiate inline rename');
  });
});
