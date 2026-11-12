/**
 * @file LayerTreeProjectPropertiesAction.test.ts
 * @module tests/renderer/widgets/LayerTreeProjectPropertiesAction.test
 * @description Unit and component tests verifying LayerTreeWidget PopupMenu Project Properties action, icon display, and dialog dispatch when secondary-clicking the project root node.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @see {@link LayerTreeWidget}
 * @see {@link openProjectPropertiesDialog}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mdiFolderCogOutline } from '@mdi/js';
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
  clearNodeSelection
} = jiti('../../../src/renderer/state/projectSignals.ts');

const {
  isProjectPropertiesOpenSignal,
  closeProjectPropertiesDialog
} = jiti('../../../src/renderer/state/gisSignals.ts');

const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');

const { LayerTreeWidget } = jiti('../../../src/renderer/workbench/widgets/LayerTreeWidget.tsx');

describe('LayerTreeWidget Project Properties PopupMenu (Ticket #258)', () => {
  beforeEach(() => {
    setupDom();
    hasProjectSignal.value = true;
    projectNameSignal.value = 'Test Cartouche Project';
    editingNodeIdSignal.value = null;
    clearNodeSelection();
    closeProjectPropertiesDialog();

    dictionarySignal.value = {
      project_properties: 'Project Properties...',
      rename_layer_tree_node: 'Rename'
    };

    projectTreeSignal.value = [];
  });

  afterEach(() => {
    tearDownDom();
    closeProjectPropertiesDialog();
  });

  it('displays Project Properties... in PopupMenu when project node is secondary-clicked', () => {
    act(() => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const projectRow = findAllNodes(
      container,
      (el) => el.className.includes('tree-node-row') && el.className.includes('tree-node-project')
    )[0];
    assert(projectRow, 'Should find project root row in tree');

    // Trigger secondary click (contextmenu) on the project root row
    const event = {
      type: 'contextmenu',
      clientX: 50,
      clientY: 100,
      preventDefault: () => {},
      stopPropagation: () => {},
      _bubblesStopped: false
    };

    act(() => {
      projectRow.dispatchEvent(event);
    });

    // Verify PopupMenu item rendered with "Project Properties..."
    const menuItems = findAllNodes(
      doc.body,
      (el) => el.className.includes('menu-item-label')
    );

    const propertiesItem = menuItems.find((el) => (el as any).textContent?.includes('Project Properties'));
    assert(propertiesItem, 'PopupMenu must include "Project Properties..." item for project root node');

    const propertiesRow = propertiesItem.parentNode;
    assert(propertiesRow, 'Project Properties item must have a parent menu row');
    const iconPaths = findAllNodes(
      propertiesRow,
      (el) => el.tagName === 'PATH' && el.getAttribute('d') === mdiFolderCogOutline
    );
    assert.equal(iconPaths.length, 1, 'Project Properties item must display mdiFolderCogOutline icon');

    const keySlots = findAllNodes(
      propertiesRow,
      (el) => el.className.includes('menu-key-slot')
    );
    assert.equal(keySlots.length, 1, 'Project Properties item must display an Action key slot');
    assert.equal(keySlots[0].textContent, 'Ctrl+Alt+,', 'Project Properties item must display "Ctrl+Alt+," formatted key');

    const renameItem = menuItems.find((el) => (el as any).textContent?.includes('Rename'));
    assert(renameItem, 'PopupMenu must also include "Rename" item for project root node');
  });

  it('invokes openProjectPropertiesDialog when Project Properties... is clicked', () => {
    act(() => {
      root!.render(React.createElement(LayerTreeWidget));
    });

    const projectRow = findAllNodes(
      container,
      (el) => el.className.includes('tree-node-row') && el.className.includes('tree-node-project')
    )[0];
    assert(projectRow, 'Should find project root row in tree');

    const event = {
      type: 'contextmenu',
      clientX: 50,
      clientY: 100,
      preventDefault: () => {},
      stopPropagation: () => {},
      _bubblesStopped: false
    };

    act(() => {
      projectRow.dispatchEvent(event);
    });

    const menuRows = findAllNodes(
      doc.body,
      (el) => el.className.includes('menu-dropdown-item')
    );

    const propertiesRow = menuRows.find((el) => (el as any).textContent?.includes('Project Properties'));
    assert(propertiesRow, 'Should find Project Properties dropdown item element');

    assert.equal(isProjectPropertiesOpenSignal.value, false, 'Dialog should start closed');

    act(() => {
      propertiesRow.dispatchEvent({
        type: 'click',
        preventDefault: () => {},
        stopPropagation: () => {},
        _bubblesStopped: false
      });
    });

    assert.equal(isProjectPropertiesOpenSignal.value, true, 'openProjectPropertiesDialog must be invoked when item is clicked');
  });
});
