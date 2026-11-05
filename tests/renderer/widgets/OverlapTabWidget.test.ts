/**
 * @file OverlapTabWidget.test.ts
 * @module tests/renderer/widgets/OverlapTabWidget.test
 * @description Unit tests for OverlapTabWidget container, verifying double-header hierarchy, tab switching, extraction, single-child auto-dissolution, master close, and recursive nesting prohibition.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-04
 * @updated 2026-11-04
 * @since 0.1.0-dev
 * @see {@link OverlapTabWidget}
 * @see {@link BasicWidget}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

// Mock .svg and .css imports for headless Node testing
const nodeRequire = createRequire(import.meta.url);
nodeRequire.extensions['.svg'] = (mod: any) => {
  mod.exports = 'mock-logo.svg';
};
nodeRequire.extensions['.css'] = (mod: any) => {
  mod.exports = '';
};

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
      },
    });
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

  addEventListener(type: string, cb: any, options?: any): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture: Boolean(options && options.capture) });
  }

  removeEventListener(type: string, cb: any): void {
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

  get textContent(): string {
    if (this.childNodes.length > 0) {
      return this.childNodes.map(c => c.textContent || c.nodeValue || '').join('');
    }
    return (this as any)._textContent || '';
  }

  set textContent(val: string) {
    (this as any)._textContent = String(val);
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
      parentNode: null,
    }),
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
    Element: MockElement,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };

  doc.defaultView = win;
  (globalThis as any).window = win;
  (globalThis as any).document = doc;
  (globalThis as any).HTMLIFrameElement = win.HTMLIFrameElement;
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

const { BasicWidget } = jiti('../../../src/renderer/workbench/widgets/BasicWidget.tsx');
const { OverlapTabWidget } = jiti('../../../src/renderer/workbench/widgets/OverlapTabWidget.tsx');

describe('OverlapTabWidget Component (Ticket #168)', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    tearDownDom();
  });

  it('renders outer "Tab Group" title and master close button, with active child rendering its own header', async () => {
    const testTabs = [
      {
        id: 'tab-1',
        title: 'First Tab',
        render: ({ onClose }: any) =>
          React.createElement(BasicWidget, {
            name: 'child-widget-1',
            displayName: 'First Child Header',
            onClose,
          }, React.createElement('div', {}, 'Content 1')),
      },
      {
        id: 'tab-2',
        title: 'Second Tab',
        render: ({ onClose }: any) =>
          React.createElement(BasicWidget, {
            name: 'child-widget-2',
            displayName: 'Second Child Header',
            onClose,
          }, React.createElement('div', {}, 'Content 2')),
      },
    ];

    await act(async () => {
      root!.render(
        React.createElement(OverlapTabWidget, {
          name: 'test-overlap-group',
          tabs: testTabs,
          activeTabId: 'tab-1',
        })
      );
    });

    // Check titles: Outer header has "Tab Group", child in tab pane has "First Child Header"
    const titles = findAllNodes(container, el => el.className.includes('basic-widget-title'));
    assert.strictEqual(titles.length, 2, 'Must have 2 header titles (outer Tab Group + active child)');

    const titleTexts = titles.map(t => t.textContent.trim());
    assert.ok(titleTexts.includes('Tab Group'), 'Outer header must be titled "Tab Group"');
    assert.ok(titleTexts.includes('First Child Header'), 'Active child must render its own header title');

    // Check tab strip items
    const tabItems = findAllNodes(container, el => el.className.includes('overlap-tab-item'));
    assert.strictEqual(tabItems.length, 2, 'Tab strip must contain 2 tabs');
  });

  it('switches active tab when clicking a tab in the tab strip', async () => {
    let activeTabChangedTo = '';

    const testTabs = [
      {
        id: 'tab-a',
        title: 'Tab A',
        render: () => React.createElement('div', { id: 'pane-a' }, 'Pane A Content'),
      },
      {
        id: 'tab-b',
        title: 'Tab B',
        render: () => React.createElement('div', { id: 'pane-b' }, 'Pane B Content'),
      },
    ];

    await act(async () => {
      root!.render(
        React.createElement(OverlapTabWidget, {
          tabs: testTabs,
          activeTabId: 'tab-a',
          onTabChange: (id: string) => {
            activeTabChangedTo = id;
          },
        })
      );
    });

    const tabB = findAllNodes(container, el => el.className.includes('overlap-tab-item'))[1];
    assert.ok(tabB, 'Second tab must exist');

    await act(async () => {
      tabB.dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
        preventDefault: () => {},
      });
    });

    assert.strictEqual(activeTabChangedTo, 'tab-b', 'Clicking tab must trigger onTabChange with "tab-b"');
  });

  it('sets application/x-cartouche-tab-extract dataTransfer when dragging a tab out to extract', async () => {
    let extractedTabId = '';
    const recordedData: Record<string, string> = {};

    const testTabs = [
      {
        id: 'extract-me',
        title: 'Extract Me',
        render: () => React.createElement('div', {}, 'Extractable Content'),
      },
      {
        id: 'keep-me',
        title: 'Keep Me',
        render: () => React.createElement('div', {}, 'Keeper Content'),
      },
    ];

    await act(async () => {
      root!.render(
        React.createElement(OverlapTabWidget, {
          name: 'group-extract',
          tabs: testTabs,
          onTabExtract: (id: string) => {
            extractedTabId = id;
          },
        })
      );
    });

    const firstTab = findAllNodes(container, el => el.className.includes('overlap-tab-item'))[0];
    assert.ok(firstTab);

    const mockDataTransfer = {
      effectAllowed: '',
      setData: (format: string, data: string) => {
        recordedData[format] = data;
      },
    };

    firstTab.dispatchEvent({
      type: 'dragstart',
      stopPropagation: () => {},
      preventDefault: () => {},
      dataTransfer: mockDataTransfer,
    });

    assert.strictEqual(extractedTabId, 'extract-me');
    assert.strictEqual(recordedData['text/plain'], 'extract-me');
    assert.ok(recordedData['application/x-cartouche-tab-extract']);
    const parsedPayload = JSON.parse(recordedData['application/x-cartouche-tab-extract']);
    assert.strictEqual(parsedPayload.containerId, 'group-extract');
    assert.strictEqual(parsedPayload.tabId, 'extract-me');
  });

  it('triggers onGroupClose and closes all children when master close button is clicked', async () => {
    let groupClosed = false;

    const testTabs = [
      {
        id: 'child-1',
        title: 'Child 1',
        render: () => React.createElement('div', {}, '1'),
      },
      {
        id: 'child-2',
        title: 'Child 2',
        render: () => React.createElement('div', {}, '2'),
      },
    ];

    await act(async () => {
      root!.render(
        React.createElement(OverlapTabWidget, {
          tabs: testTabs,
          onGroupClose: () => {
            groupClosed = true;
          },
          onClose: () => {},
        })
      );
    });

    // Outer close button is in the top-level basic-widget-header
    const closeBtn = findAllNodes(container, el => el.tagName === 'BUTTON' && el.attributes.title === 'Close')[0];
    assert.ok(closeBtn, 'Outer master close button must exist');

    await act(async () => {
      closeBtn.dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
        preventDefault: () => {},
      });
    });

    assert.strictEqual(groupClosed, true, 'Clicking outer close button must call onGroupClose');
  });

  it('auto-dissolves when children drop to 1 and unwraps solitary child', async () => {
    let dissolvedWithId = '';

    const testTabs = [
      {
        id: 'remaining-child',
        title: 'Remaining Solitary Child',
        render: () => React.createElement('div', { className: 'solitary-body' }, 'Solitary Content'),
      },
    ];

    await act(async () => {
      root!.render(
        React.createElement(OverlapTabWidget, {
          tabs: testTabs,
          onDissolve: (childId: string) => {
            dissolvedWithId = childId;
          },
        })
      );
    });

    // Single-child auto-dissolution un-mounts outer Tab Group and renders solitary child in .overlap-tab-dissolved
    const dissolvedWrapper = findAllNodes(container, el => el.className.includes('overlap-tab-dissolved'))[0];
    assert.ok(dissolvedWrapper, 'Solitary child must be unwrapped inside .overlap-tab-dissolved');

    const titles = findAllNodes(container, el => el.className.includes('basic-widget-title'));
    assert.strictEqual(titles.length, 0, 'Outer "Tab Group" header must not exist when dissolved');

    assert.strictEqual(dissolvedWithId, 'remaining-child', 'onDissolve must be called with remaining child id');
  });

  it('rejects nested OverlapTabWidget children (recursive nesting prohibition)', async () => {
    const testTabs = [
      {
        id: 'valid-widget',
        title: 'Valid Widget',
        render: () => React.createElement('div', {}, 'Valid'),
      },
      {
        id: 'overlap-nested',
        title: 'Illegal Nested Group',
        isOverlapContainer: true,
        render: () => React.createElement('div', {}, 'Illegal Nested'),
      },
    ];

    await act(async () => {
      root!.render(
        React.createElement(OverlapTabWidget, {
          tabs: testTabs,
        })
      );
    });

    // The nested container should be rejected, leaving only 'valid-widget' (length 1 -> auto-dissolved)
    const tabStrip = findAllNodes(container, el => el.className.includes('overlap-tab-strip'))[0];
    assert.strictEqual(tabStrip, undefined, 'Nested group must be rejected so only 1 child remains and unwraps');
  });
});
