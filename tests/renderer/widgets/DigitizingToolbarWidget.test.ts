/**
 * @file DigitizingToolbarWidget.test.ts
 * @module tests/renderer/widgets/DigitizingToolbarWidget.test
 * @description Unit and component tests for DigitizingToolbarWidget verifying that editing and drawing tools remain disabled when activeLayerId is null, enable when activeLayerId is set, and revert active tool to pan when active layer is cleared.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @see {@link DigitizingToolbarWidget}
 * @see {@link isDigitizingToolbarDisabled}
 * @see docs/adr/0016-active-layer-vs-selected-layer-and-tree-node-title.md (ADR 0016)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  activeToolSignal,
  activeLayerIdSignal
} from '../../../src/renderer/state/gisSignals';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const { DigitizingToolbarWidget, isDigitizingToolbarDisabled } = jiti(
  '../../../src/renderer/workbench/widgets/toolbars/DigitizingToolbarWidget'
) as {
  DigitizingToolbarWidget: React.FC<{ zone?: string }>;
  isDigitizingToolbarDisabled: (activeLayerId: string | null) => boolean;
};

class MockElement {
  tagName: string;
  nodeName: string;
  nodeType = 1;
  childNodes: any[] = [];
  parentNode: any = null;
  style: any;
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};
  disabled = false;

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
    if (k === 'disabled') {
      this.disabled = true;
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
    if (k === 'disabled') {
      this.disabled = false;
    }
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

describe('DigitizingToolbarWidget Guardrails (Ticket #92, ADR 0016)', () => {
  let container: MockElement;
  let root: Root | null = null;
  let prevWindow: any;
  let prevDocument: any;

  beforeEach(() => {
    activeLayerIdSignal.value = null;
    activeToolSignal.value = 'pan';

    prevWindow = (globalThis as any).window;
    prevDocument = (globalThis as any).document;

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
        parentNode: null
      }),
      createComment: (text: string) => ({
        nodeType: 8,
        nodeValue: text,
        textContent: text,
        parentNode: null
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      documentElement: new MockElement('html'),
      head: new MockElement('head'),
      body: new MockElement('body'),
      nodeType: 9
    };

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

  it('isDigitizingToolbarDisabled returns true when activeLayerId is null', () => {
    assert.strictEqual(isDigitizingToolbarDisabled(null), true);
    assert.strictEqual(isDigitizingToolbarDisabled('layer-uuid-123'), false);
  });

  it('renders all 4 digitizing toolbar buttons as disabled when activeLayerId is null', async () => {
    await act(async () => {
      root!.render(React.createElement(DigitizingToolbarWidget, { zone: 'top' }));
    });

    const buttons = findAllNodes(container, el => el.tagName === 'BUTTON');
    assert.strictEqual(buttons.length, 4, 'Should render 4 toolbar buttons');

    for (const btn of buttons) {
      assert.strictEqual(
        btn.hasAttribute('disabled'),
        true,
        `Button ${btn.getAttribute('title')} must be disabled when activeLayerId is null`
      );
    }
  });

  it('clicking Add Point Feature when activeLayerId is null does not activate point tool', async () => {
    await act(async () => {
      root!.render(React.createElement(DigitizingToolbarWidget, { zone: 'top' }));
    });

    const pointBtn = findAllNodes(
      container,
      el => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Add Point Feature'
    )[0];
    assert.ok(pointBtn, 'Add Point Feature button should exist');

    await act(async () => {
      pointBtn.dispatchEvent(new (window as any).Event('click', { bubbles: true }));
    });

    assert.strictEqual(activeToolSignal.value, 'pan', 'activeToolSignal should remain pan');
  });

  it('enables all 4 digitizing buttons when activeLayerId is set and allows tool selection', async () => {
    activeLayerIdSignal.value = 'active-vector-layer-id';

    await act(async () => {
      root!.render(React.createElement(DigitizingToolbarWidget, { zone: 'top' }));
    });

    const buttons = findAllNodes(container, el => el.tagName === 'BUTTON');
    for (const btn of buttons) {
      assert.strictEqual(
        btn.hasAttribute('disabled'),
        false,
        `Button ${btn.getAttribute('title')} should be enabled when activeLayerId is set`
      );
    }

    const pointBtn = findAllNodes(
      container,
      el => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Add Point Feature'
    )[0];

    await act(async () => {
      pointBtn.dispatchEvent(new (window as any).Event('click', { bubbles: true }));
    });

    assert.strictEqual(activeToolSignal.value, 'point', 'activeToolSignal should transition to point');
  });

  it('automatically reverts activeToolSignal to pan when activeLayerId becomes null', () => {
    activeLayerIdSignal.value = 'active-layer-uuid';
    activeToolSignal.value = 'line';

    assert.strictEqual(activeToolSignal.value, 'line');

    // Layer is removed or active layer is cleared
    activeLayerIdSignal.value = null;

    assert.strictEqual(activeToolSignal.value, 'pan', 'activeToolSignal must revert to pan when active layer is cleared');
  });
});
