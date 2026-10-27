/**
 * @file LayerPropertiesDialogEscape.test.ts
 * @module tests/renderer/dialogs/LayerPropertiesDialogEscape.test
 * @description Unit tests verifying Escape key cancellation behavior and draft reversion for LayerPropertiesDialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link LayerPropertiesDialog}
 * @see {@link cancelLayerPropertiesEdits}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const { LayerPropertiesDialog } = jiti('@renderer/workbench/dialogs/LayerPropertiesDialog');
const {
  activeLayerPropertiesIdSignal,
  layerPropertiesDraftSignal,
  openLayerPropertiesDialog,
  cancelLayerPropertiesEdits,
  updateLayerPropertiesDraft
} = jiti('@renderer/state/layerPropertiesSignals');
const {
  activeDialogStackSignal,
  cancelTopDialog
} = jiti('@renderer/state/dialogSignals');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals');

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
    cssText: string;
  };
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};

  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
    const styleObj: Record<string, string> = { cssText: '' };
    this.style = Object.assign(styleObj, {
      cssText: '',
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
      newChild.parentNode = this;
    } else {
      this.appendChild(newChild);
    }
    return newChild;
  }

  addEventListener(type: string, cb: (e: any) => void, capture = false): void {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push({ cb, capture });
  }

  removeEventListener(type: string, cb: (e: any) => void, _capture = false): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter((l) => l.cb !== cb);
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

  querySelectorAll(_selector?: string): any[] {
    return [];
  }

  querySelector(_selector?: string): any {
    return null;
  }

  cloneNode(_deep?: boolean): any {
    const cloned = new MockElement(this.tagName);
    cloned.attributes = { ...this.attributes };
    cloned.className = this.className;
    return cloned;
  }
}

describe('LayerPropertiesDialog Escape & Cancel Handling', () => {
  let originalDocument: typeof globalThis.document;
  let originalWindow: typeof globalThis.window;
  let originalMutationObserver: typeof globalThis.MutationObserver;
  let mockChildWindow: any;
  let childListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>>;
  let root: Root | null = null;
  let container: MockElement;

  beforeEach(() => {
    activeLayerPropertiesIdSignal.value = null;
    activeDialogStackSignal.value = [];
    dictionarySignal.value = {};

    originalDocument = globalThis.document;
    originalWindow = (globalThis as any).window;
    originalMutationObserver = globalThis.MutationObserver;

    childListeners = {};
    const childDocElement = new MockElement('html');
    const childBody = new MockElement('body');
    const childHead = new MockElement('head');
    childDocElement.appendChild(childHead);
    childDocElement.appendChild(childBody);

    const childDoc: any = {
      nodeType: 9,
      title: '',
      documentElement: childDocElement,
      body: childBody,
      head: childHead,
      querySelectorAll: () => [],
      createElement: (tag: string) => {
        const el = new MockElement(tag);
        el.ownerDocument = childDoc;
        return el;
      },
      createElementNS: (_ns: string, tag: string) => {
        const el = new MockElement(tag);
        el.ownerDocument = childDoc;
        return el;
      },
      createTextNode: (text: string) => ({
        nodeType: 3,
        nodeValue: String(text),
        textContent: String(text),
        ownerDocument: childDoc,
        parentNode: null
      }),
      createComment: (data?: string) => ({
        nodeType: 8,
        data: String(data || ''),
        ownerDocument: childDoc,
        parentNode: null
      }),
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    childHead.ownerDocument = childDoc;
    childBody.ownerDocument = childDoc;

    mockChildWindow = {
      closed: false,
      document: childDoc,
      addEventListener: (type: string, cb: (e: any) => void, capture = false) => {
        if (!childListeners[type]) childListeners[type] = [];
        childListeners[type].push({ cb, capture });
      },
      removeEventListener: (type: string, cb: (e: any) => void, _capture = false) => {
        if (!childListeners[type]) return;
        childListeners[type] = childListeners[type].filter((l) => l.cb !== cb);
      },
      dispatchEvent: (event: any) => {
        const listeners = childListeners[event.type] || [];
        for (const l of listeners) {
          l.cb(event);
        }
        return true;
      },
      close: () => {
        mockChildWindow.closed = true;
      }
    };

    const mainDocElement = new MockElement('html');
    const mainBody = new MockElement('body');
    const mainHead = new MockElement('head');
    mainDocElement.appendChild(mainHead);
    mainDocElement.appendChild(mainBody);

    const mainDoc: any = {
      nodeType: 9,
      documentElement: mainDocElement,
      body: mainBody,
      head: mainHead,
      createElement: (tag: string) => {
        const el = new MockElement(tag);
        el.ownerDocument = mainDoc;
        return el;
      },
      createElementNS: (_ns: string, tag: string) => {
        const el = new MockElement(tag);
        el.ownerDocument = mainDoc;
        return el;
      },
      createTextNode: (text: string) => ({
        nodeType: 3,
        nodeValue: String(text),
        textContent: String(text),
        ownerDocument: mainDoc,
        parentNode: null
      }),
      createComment: (data?: string) => ({
        nodeType: 8,
        data: String(data || ''),
        ownerDocument: mainDoc,
        parentNode: null
      }),
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    mainHead.ownerDocument = mainDoc;
    mainBody.ownerDocument = mainDoc;

    const win = {
      open: () => mockChildWindow,
      document: mainDoc,
      addEventListener: () => {},
      removeEventListener: () => {},
      HTMLIFrameElement: class {},
      HTMLElement: MockElement,
      Element: MockElement,
      electronAPI: {
        getLayerInfo: async (layerId: string) => ({
          layerId,
          name: 'Lakes',
          fields: []
        })
      }
    };

    mainDoc.defaultView = win;
    childDoc.defaultView = mockChildWindow;
    mockChildWindow.HTMLIFrameElement = class {};
    mockChildWindow.HTMLElement = MockElement;
    mockChildWindow.Element = MockElement;

    (globalThis as any).document = mainDoc;
    (globalThis as any).window = win;
    (globalThis as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8, DOCUMENT_NODE: 9 };

    (globalThis as any).MutationObserver = class {
      observe() {}
      disconnect() {}
    };

    container = new MockElement('div');
    container.ownerDocument = mainDoc;
    mainBody.appendChild(container);
    root = createRoot(container as any);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
      });
      root = null;
    }
    activeLayerPropertiesIdSignal.value = null;
    activeDialogStackSignal.value = [];
    if (originalDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      globalThis.document = originalDocument;
    }
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
    if (originalMutationObserver === undefined) {
      delete (globalThis as any).MutationObserver;
    } else {
      globalThis.MutationObserver = originalMutationObserver;
    }
  });

  it('cancelLayerPropertiesEdits reverts pending draft changes and closes dialog', () => {
    openLayerPropertiesDialog('layer-1');
    assert.equal(activeLayerPropertiesIdSignal.value, 'layer-1');

    updateLayerPropertiesDraft({ layerName: 'Draft Modified Name' });
    assert.equal(layerPropertiesDraftSignal.value.layerName, 'Draft Modified Name');

    cancelLayerPropertiesEdits();

    assert.equal(activeLayerPropertiesIdSignal.value, null, 'activeLayerPropertiesIdSignal should be null');
    assert.equal(layerPropertiesDraftSignal.value.layerName, '', 'draft changes should be reset');
  });

  it('cancelTopDialog prioritizes LayerPropertiesDialog cancellation when active', () => {
    openLayerPropertiesDialog('layer-1');
    assert.equal(activeLayerPropertiesIdSignal.value, 'layer-1');

    updateLayerPropertiesDraft({ layerName: 'Unsaved Edits' });
    assert.equal(layerPropertiesDraftSignal.value.layerName, 'Unsaved Edits');

    const handled = cancelTopDialog();
    assert.equal(handled, true, 'cancelTopDialog must handle open layer properties dialog');
    assert.equal(activeLayerPropertiesIdSignal.value, null, 'dialog should be closed');
    assert.equal(layerPropertiesDraftSignal.value.layerName, '', 'draft should be cleared');
  });

  it('pressing Escape while LayerPropertiesDialog is focused cancels edits and closes dialog', async () => {
    openLayerPropertiesDialog('layer-1');
    assert.equal(activeLayerPropertiesIdSignal.value, 'layer-1');

    await act(async () => {
      root!.render(React.createElement(LayerPropertiesDialog));
    });

    await act(async () => {
      updateLayerPropertiesDraft({ layerName: 'Changed Name In Draft' });
    });
    assert.equal(layerPropertiesDraftSignal.value.layerName, 'Changed Name In Draft');

    assert.equal(activeDialogStackSignal.value.length, 1, 'LayerPropertiesDialog should register in activeDialogStackSignal');
    assert.equal(activeDialogStackSignal.value[0].name, 'layerPropertiesWindow');

    // Dispatch Escape in child window inside act
    await act(async () => {
      const escapeEvent = {
        type: 'keydown',
        key: 'Escape',
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {}
      };
      mockChildWindow.dispatchEvent(escapeEvent);
    });

    assert.equal(activeLayerPropertiesIdSignal.value, null, 'LayerPropertiesDialog should be closed after Escape');
    assert.equal(layerPropertiesDraftSignal.value.layerName, '', 'Draft should be reverted');
  });
});
