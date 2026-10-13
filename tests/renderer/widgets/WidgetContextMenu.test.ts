/**
 * @file WidgetContextMenu.test.ts
 * @module tests/renderer/widgets/WidgetContextMenu.test
 * @description Unit and component tests for Widget background context menu standardization, PopupMenu portal integration, Escape key dismissal, outside click dismissal, action execution, and viewport boundary collision clamping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link Widget}
 * @see {@link PopupMenu}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

// Set React act environment flag
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * @class MockElement
 * @description Lightweight mock DOM Element representation for headless React 19 testing in Node.js.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
class MockElement {
  nodeType = 1;
  tagName: string;
  nodeName: string;
  ownerDocument: any = null;
  parentNode: any = null;
  childNodes: any[] = [];
  style: Record<string, string> = {};
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};

  /**
   * @constructor
   * @description Constructs a new MockElement with the given tag name.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {string} [tag='div'] - HTML element tag name.
   */
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
  }

  /**
   * @description Sets an attribute value and updates className when key is 'class'.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @date 2026-10-13
   * @updated 2026-10-13
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
   * @description Computes bounding client rectangle dimensions for layout clamping tests.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {{ width: number, height: number, top: number, left: number, right: number, bottom: number }} Layout bounds.
   */
  getBoundingClientRect(): { width: number; height: number; top: number; left: number; right: number; bottom: number } {
    return { width: 160, height: 80, top: 0, left: 0, right: 160, bottom: 80 };
  }
}

/**
 * Setup simulated DOM environment.
 */
let doc: any;
let windowListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};
let container: MockElement;
let root: Root | null = null;

/**
 * @description Initializes mock window and document global objects for React DOM component testing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
function setupDom(): void {
  windowListeners = {};

  doc = {
    nodeType: 9,
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
      parentNode: null
    }),
    createComment: (data: string) => ({
      nodeType: 8,
      data,
      parentNode: null
    }),
    body: new MockElement('body'),
    documentElement: new MockElement('html'),
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null as any
  };
  doc.body.ownerDocument = doc;
  doc.documentElement.ownerDocument = doc;

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
  doc.body.appendChild(container);
  root = createRoot(container as any);
}

/**
 * @description Tears down simulated DOM environment and unmounts active React root.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
function tearDownDom(): void {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
}

/**
 * @description Recursively searches simulated DOM tree for first element satisfying predicate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {MockElement} rootNode - Root DOM node to traverse.
 * @param {(el: MockElement) => boolean} predicate - Match predicate function.
 * @returns {MockElement | null} First matching element or null.
 */
function findNode(rootNode: MockElement, predicate: (el: MockElement) => boolean): MockElement | null {
  if (predicate(rootNode)) return rootNode;
  for (const child of rootNode.childNodes) {
    if (child && child.nodeType === 1) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

/**
 * @description Recursively searches simulated DOM tree for all elements satisfying predicate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
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

import path from 'node:path';

// Instantiate jiti with aliases
const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
    '@main': path.resolve(process.cwd(), 'src/main')
  }
});

const { Widget } = jiti('../../../src/renderer/workbench/widgets/Widget.tsx');
const { BasicWidget } = jiti('../../../src/renderer/workbench/widgets/BasicWidget.tsx');

describe('Widget Context Menu Standardization', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    tearDownDom();
  });

  it('renders context menu via shared PopupMenu portal component in document.body when secondary-clicked', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'test-widget',
          onClose: () => {},
          onUndock: () => {}
        }, 'Widget content')
      );
    });

    const widgetNode = findNode(container, el => el.className.includes('cartouche-widget'));
    assert.ok(widgetNode, 'Widget container node must exist');

    // Trigger context menu (secondary click)
    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 200,
        clientY: 300,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    // The standardized context menu must render into document.body as a portal using PopupMenu classes
    const popupPortalNode = findNode(doc.body, el =>
      el.className.includes('popup-menu') || el.className.includes('menu-dropdown')
    );
    assert.ok(popupPortalNode, 'PopupMenu portal must be rendered in document.body upon secondary click');

    // Should NOT use obsolete legacy inline div inside widget container
    const legacyMenuNode = findNode(widgetNode!, el => el.className.includes('widget-context-menu'));
    assert.equal(legacyMenuNode, null, 'Obsolete widget-context-menu inline element should no longer be rendered');
  });

  it('dismisses widget background context menu when pressing Escape key', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'test-widget',
          onClose: () => {}
        }, 'Widget content')
      );
    });

    const widgetNode = findNode(container, el => el.className.includes('cartouche-widget'));
    assert.ok(widgetNode);

    // Open context menu
    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 150,
        clientY: 150,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    let popupPortalNode = findNode(doc.body, el =>
      el.className.includes('popup-menu') || el.className.includes('menu-dropdown')
    );
    assert.ok(popupPortalNode, 'Context menu should be open');

    // Dispatch Escape keydown on window
    await act(async () => {
      (globalThis as any).window.dispatchEvent({
        type: 'keydown',
        key: 'Escape',
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    // Menu should be dismissed immediately
    popupPortalNode = findNode(doc.body, el =>
      el.className.includes('popup-menu') || el.className.includes('menu-dropdown')
    );
    assert.equal(popupPortalNode, null, 'Context menu must be dismissed after Escape key');
  });

  it('dismisses widget background context menu when clicking outside', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'test-widget',
          onClose: () => {}
        }, 'Widget content')
      );
    });

    const widgetNode = findNode(container, el => el.className.includes('cartouche-widget'));
    assert.ok(widgetNode);

    // Open context menu
    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 100,
        clientY: 100,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    assert.ok(
      findNode(doc.body, el => el.className.includes('popup-menu')),
      'Context menu should be open'
    );

    // Dispatch mousedown outside on an unrelated target
    const outsideTarget = doc.createElement('div');
    doc.body.appendChild(outsideTarget);

    await act(async () => {
      (globalThis as any).window.dispatchEvent({
        type: 'mousedown',
        target: outsideTarget,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    const popupPortalNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.equal(popupPortalNode, null, 'Context menu must be dismissed on outside click');
  });

  it('dismisses popup menu on outside primary click without activating underlying target action', async () => {
    let targetActionExecuted = false;
    const targetElement = doc.createElement('button');
    targetElement.addEventListener('click', () => {
      targetActionExecuted = true;
    });
    targetElement.addEventListener('mousedown', () => {
      targetActionExecuted = true;
    });
    doc.body.appendChild(targetElement);

    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'test-widget',
          onClose: () => {}
        }, 'Widget content')
      );
    });

    const widgetNode = findNode(container, el => el.className.includes('cartouche-widget'));

    // Open context menu
    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 100,
        clientY: 100,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    const popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.ok(popupNode, 'Context menu should be open');

    const backdropNode = findNode(doc.body, el => el.className.includes('popup-backdrop'));
    assert.ok(backdropNode, 'Backdrop element should be present');

    // Primary-click backdrop (outside click)
    await act(async () => {
      backdropNode!.dispatchEvent({
        type: 'mousedown',
        clientX: 50,
        clientY: 50,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
      backdropNode!.dispatchEvent({
        type: 'click',
        clientX: 50,
        clientY: 50,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    const closedPopup = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.equal(closedPopup, null, 'Context menu must be dismissed');
    assert.equal(targetActionExecuted, false, 'Underlying target action must NOT be executed');
  });

  it('executes context menu options and closes the menu upon selection', async () => {
    let closed = false;
    let undocked = false;

    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'test-widget',
          onClose: () => { closed = true; },
          onUndock: () => { undocked = true; }
        }, 'Widget content')
      );
    });

    const widgetNode = findNode(container, el => el.className.includes('cartouche-widget'));

    // Open context menu
    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 100,
        clientY: 100,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    let popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.ok(popupNode, 'Context menu should be open');

    // Find items in PopupMenu
    const items = findAllNodes(popupNode!, el => el.className.includes('menu-dropdown-item'));
    assert.ok(items.length >= 2, 'Should have Close and Undock items');

    // Click Close item
    await act(async () => {
      items[0].dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
        preventDefault: () => {}
      });
    });

    assert.equal(closed, true, 'Close action must have been called');
    assert.equal(undocked, false, 'Undock action must not be called yet');
    let closedPopup = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.equal(closedPopup, null, 'Menu should be dismissed after selecting an option');

    // Reopen menu and click Undock item
    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 100,
        clientY: 100,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.ok(popupNode, 'Context menu should be open again');
    const reopenItems = findAllNodes(popupNode!, el => el.className.includes('menu-dropdown-item'));
    assert.ok(reopenItems.length >= 2);

    await act(async () => {
      reopenItems[1].dispatchEvent({
        type: 'click',
        stopPropagation: () => {},
        preventDefault: () => {}
      });
    });

    assert.equal(undocked, true, 'Undock action must have been called');
    closedPopup = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.equal(closedPopup, null, 'Menu should be dismissed after undock selection');
  });

  it('clamps context menu coordinates within window viewport boundaries', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'test-widget',
          onClose: () => {}
        }, 'Widget content')
      );
    });

    const widgetNode = findNode(container, el => el.className.includes('cartouche-widget'));

    // Trigger context menu near bottom-right edge of 1024x768 window
    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 1000,
        clientY: 750,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    const popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.ok(popupNode, 'Popup must be rendered');

    // popup width is 160, padding is 8, window width is 1024 => targetX should clamp to 1024 - 160 - 8 = 856px
    const leftPx = parseFloat(popupNode!.style.left);
    const topPx = parseFloat(popupNode!.style.top);

    assert.ok(leftPx <= 1024 - 160, `leftPx (${leftPx}) should be clamped within viewport width (1024)`);
    assert.ok(topPx <= 768 - 80, `topPx (${topPx}) should be clamped within viewport height (768)`);

    // Trigger context menu near top-left edge (outside bounds at 2, -10)
    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 2,
        clientY: -10,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    const topLeftPopupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.ok(topLeftPopupNode, 'Popup must be rendered');
    const topLeftLeftPx = parseFloat(topLeftPopupNode!.style.left);
    const topLeftTopPx = parseFloat(topLeftPopupNode!.style.top);
    assert.ok(topLeftLeftPx >= 8, `topLeftLeftPx (${topLeftLeftPx}) should clamp to at least padding (8px)`);
    assert.ok(topLeftTopPx >= 8, `topLeftTopPx (${topLeftTopPx}) should clamp to at least padding (8px)`);
  });

  it('secondary-clicking empty space in BasicWidget propagates to Widget context menu', async () => {
    await act(async () => {
      root!.render(
        React.createElement(BasicWidget, {
          name: 'my-basic-widget',
          displayName: 'My Tool',
          onClose: () => {}
        }, React.createElement('div', { className: 'empty-area' }, 'Empty background space'))
      );
    });

    const basicWidgetNode = findNode(container, el => el.className.includes('basic-widget'));
    assert.ok(basicWidgetNode, 'Basic widget should be rendered');

    const emptyArea = findNode(basicWidgetNode!, el => el.className.includes('empty-area'));
    assert.ok(emptyArea, 'Empty background area exists');

    // Right clicking the empty background inside BasicWidget bubbles up to Widget
    await act(async () => {
      emptyArea!.dispatchEvent({
        type: 'contextmenu',
        clientX: 300,
        clientY: 400,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    const popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.ok(popupNode, 'Context menu should open from background click bubbling');
  });

  it('renders custom context menu items with checkmarks and executes actions upon selection', async () => {
    let toggledItem = false;
    const customItems = [
      {
        id: 'toggle-item',
        label: 'Show Grid',
        checked: true,
        action: () => {
          toggledItem = true;
        }
      }
    ];

    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'custom-widget',
          customContextMenuItems: customItems
        }, 'Custom content')
      );
    });

    const widgetNode = findNode(container, el => el.className.includes('cartouche-widget'));
    assert.ok(widgetNode);

    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 120,
        clientY: 120,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    const popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.ok(popupNode, 'Custom popup menu should be open');

    const checkSlot = findNode(popupNode!, el => el.className.includes('menu-item-check-slot'));
    assert.ok(checkSlot, 'Checkmark slot must exist for checked item');

    const menuItem = findNode(popupNode!, el => el.className.includes('menu-dropdown-item'));
    assert.ok(menuItem);

    await act(async () => {
      menuItem!.dispatchEvent({
        type: 'click',
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    assert.equal(toggledItem, true, 'Custom action must have been executed');
    const closedPopup = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.equal(closedPopup, null, 'Menu should close after selecting item');
  });

  it('does not open context menu when no menu items are available', async () => {
    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'empty-menu-widget'
          // No onClose, no onUndock, no customContextMenuItems
        }, 'Empty menu content')
      );
    });

    const widgetNode = findNode(container, el => el.className.includes('cartouche-widget'));
    assert.ok(widgetNode);

    await act(async () => {
      widgetNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 100,
        clientY: 100,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    const popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.equal(popupNode, null, 'No popup menu should open when there are no menu items');
  });

  it('differentiates between child rows that stop propagation and empty widget background', async () => {
    let rowMenuOpened = false;

    await act(async () => {
      root!.render(
        React.createElement(Widget, {
          id: 'tree-container-widget',
          onClose: () => {}
        }, React.createElement('div', { className: 'tree-body' }, [
          React.createElement('div', {
            key: 'row1',
            className: 'tree-node-row',
            onContextMenu: (e: any) => {
              e.preventDefault();
              e.stopPropagation();
              rowMenuOpened = true;
            }
          }, 'Node Row 1'),
          React.createElement('div', {
            key: 'empty',
            className: 'tree-empty-viewport'
          }, 'Empty Space')
        ]))
      );
    });

    const rowNode = findNode(container, el => el.className.includes('tree-node-row'));
    const emptyNode = findNode(container, el => el.className.includes('tree-empty-viewport'));
    assert.ok(rowNode);
    assert.ok(emptyNode);

    // 1. Right click node row -> stops propagation
    await act(async () => {
      rowNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 50,
        clientY: 50,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    assert.equal(rowMenuOpened, true, 'Node row handler was triggered');
    let popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.equal(popupNode, null, 'Widget background context menu must NOT open when child row stops propagation');

    // 2. Right click empty space -> bubbles up to Widget
    await act(async () => {
      emptyNode!.dispatchEvent({
        type: 'contextmenu',
        clientX: 50,
        clientY: 150,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    popupNode = findNode(doc.body, el => el.className.includes('popup-menu'));
    assert.ok(popupNode, 'Widget background context menu MUST open when clicking empty space');
  });
});