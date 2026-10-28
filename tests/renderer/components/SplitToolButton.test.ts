/**
 * @file SplitToolButton.test.ts
 * @module tests/renderer/components/SplitToolButton.test
 * @description Unit and component tests for SplitToolButton verifying composite rendering, chevron PopupMenu toggling, option selection, orientation layout, and action dispatching.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link SplitToolButton}
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

const { SplitToolButton } = jiti('@renderer/components/common/SplitToolButton');
const { registeredActionsSignal } = jiti('@renderer/state/actionSignals');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals');

/**
 * @class MockElement
 * @description Lightweight mock DOM Element representation for headless React 19 testing in Node.js.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
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
    cssText: string;
  };
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};
  disabled = false;

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
    if (key === 'disabled') {
      this.disabled = true;
    }
  }

  getAttribute(key: string): string | null {
    if (key === 'disabled' && this.disabled) return '';
    return this.attributes[key] ?? null;
  }

  hasAttribute(key: string): boolean {
    if (key === 'disabled') return this.disabled;
    return key in this.attributes;
  }

  removeAttribute(key: string): void {
    delete this.attributes[key];
    if (key === 'disabled') {
      this.disabled = false;
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

  addEventListener(type: string, cb: (e: any) => void, opts?: any): void {
    const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture);
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

  getBoundingClientRect() {
    return {
      left: 100,
      top: 50,
      right: 140,
      bottom: 80,
      width: 40,
      height: 30,
      x: 100,
      y: 50
    };
  }

  contains(other: any): boolean {
    if (other === this) return true;
    for (const child of this.childNodes) {
      if (child && child.contains && child.contains(other)) return true;
    }
    return false;
  }

  get textContent(): string {
    if (this.childNodes.length > 0) {
      return this.childNodes
        .map(c => (c.nodeType === 3 ? (c.nodeValue || c.textContent || '') : (c.textContent || '')))
        .join('');
    }
    return (this as any)._textContent || '';
  }

  set textContent(val: string) {
    (this as any)._textContent = String(val);
  }
}

/**
 * @function findAllNodes
 * @description Recursively searches mock DOM tree for nodes matching predicate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {MockElement} rootNode - Root node to traverse.
 * @param {(el: MockElement) => boolean} predicate - Search predicate.
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

let doc: any;
let docListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};
let container: MockElement;
let root: Root | null = null;

/**
 * @function setupDom
 * @description Initializes headless mock DOM environment for React 19 testing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @returns {void}
 */
function setupDom(): void {
  docListeners = {};
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
    addEventListener: (type: string, cb: (e: any) => void, opts?: any) => {
      const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture);
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push({ cb, capture });
    },
    removeEventListener: (type: string, cb: (e: any) => void) => {
      if (docListeners[type]) {
        docListeners[type] = docListeners[type].filter(l => l.cb !== cb);
      }
    },
    dispatchEvent: (event: any) => {
      event.target = event.target || doc;
      event.currentTarget = doc;
      const listeners = (docListeners[event.type] || []).slice();
      for (const { cb } of listeners) {
        cb(event);
      }
      return !event.defaultPrevented;
    },
    defaultView: null as any
  };
  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;
  documentElement.parentNode = doc;

  const win = {
    document: doc,
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement,
    electronAPI: {
      getActions: async () => [],
      executeAction: () => {}
    }
  };

  doc.defaultView = win;
  (globalThis as any).window = win;
  (globalThis as any).document = doc;
}

describe('SplitToolButton component', () => {
  beforeEach(() => {
    setupDom();
    container = doc.createElement('div');
    doc.body.appendChild(container);
    root = createRoot(container as any);

    // Mock i18n dictionary
    dictionarySignal.value = {
      select_feature: 'Select Feature',
      select_features_by_drag: 'Select Features by Drag',
      select_features_by_freehand: 'Select Features by Freehand'
    };

    // Mock registered actions
    registeredActionsSignal.value = [
      {
        name: 'select_feature',
        description: 'Select Feature',
        icon: 'M-SELECT-PATH',
        formattedKey: 'Q',
        keyCombination: { key: 'q' }
      },
      {
        name: 'select_features_by_drag',
        description: 'Select Features by Drag',
        icon: 'M-DRAG-PATH',
        formattedKey: 'Shift+Q',
        keyCombination: { key: 'q', shift: true }
      },
      {
        name: 'select_features_by_freehand',
        description: 'Select Features by Freehand',
        icon: 'M-FREEHAND-PATH',
        formattedKey: 'Alt+Q',
        keyCombination: { key: 'q', alt: true }
      }
    ];
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
  });

  it('renders a primary button displaying the active action icon and tooltip, alongside attached chevron button', async () => {
    await act(async () => {
      root!.render(
        React.createElement(SplitToolButton, {
          activeAction: 'select_feature',
          options: ['select_feature', 'select_features_by_drag', 'select_features_by_freehand']
        })
      );
    });

    const buttons = findAllNodes(container, (n) => n.tagName === 'BUTTON');
    assert.equal(buttons.length, 2, 'Should render exactly two buttons: primary and chevron');

    const primaryBtn = buttons[0];
    const chevronBtn = buttons[1];

    assert.ok(primaryBtn.className.includes('split-tool-primary'), 'First button should be primary segment');
    assert.ok(chevronBtn.className.includes('split-tool-chevron'), 'Second button should be chevron segment');

    // Title should format with localized name and key combination
    const title = primaryBtn.getAttribute('title');
    assert.equal(title, 'Select Feature (Q)');

    // Primary button should render the active action icon
    const svgs = findAllNodes(primaryBtn, (n) => n.tagName === 'SVG');
    assert.ok(svgs.length > 0, 'Primary button should render an icon');
  });

  it('clicking the primary button executes the active action via onExecute', async () => {
    let executedAction: string | null = null;

    await act(async () => {
      root!.render(
        React.createElement(SplitToolButton, {
          activeAction: 'select_feature',
          options: ['select_feature', 'select_features_by_drag', 'select_features_by_freehand'],
          onExecute: (action: string) => {
            executedAction = action;
          }
        })
      );
    });

    const primaryBtn = findAllNodes(container, (n) => n.className.includes('split-tool-primary'))[0];
    assert.ok(primaryBtn, 'Primary button must exist');

    await act(async () => {
      primaryBtn.dispatchEvent({
        type: 'click',
        bubbles: true,
        stopPropagation: () => {},
        preventDefault: () => {}
      });
    });

    assert.equal(executedAction, 'select_feature', 'Clicking primary should execute select_feature');
  });

  it('clicking the chevron opens modeless PopupMenu listing alternative actions with icons, localized titles, and formatted key combinations', async () => {
    await act(async () => {
      root!.render(
        React.createElement(SplitToolButton, {
          activeAction: 'select_feature',
          options: ['select_feature', 'select_features_by_drag', 'select_features_by_freehand']
        })
      );
    });

    const chevronBtn = findAllNodes(container, (n) => n.className.includes('split-tool-chevron'))[0];
    assert.ok(chevronBtn, 'Chevron button must exist');

    // Click chevron to toggle PopupMenu open
    await act(async () => {
      chevronBtn.dispatchEvent({
        type: 'click',
        bubbles: true,
        clientX: 120,
        clientY: 65,
        stopPropagation: () => {},
        preventDefault: () => {}
      });
    });

    // Modeless PopupMenu renders in document.body via React portal
    const popupMenu = findAllNodes(doc.body, (n) => n.className.includes('popup-menu'))[0];
    assert.ok(popupMenu, 'PopupMenu should be open and rendered in document.body');

    const menuItems = findAllNodes(popupMenu, (n) => n.className.includes('menu-dropdown-item'));
    assert.equal(menuItems.length, 3, 'PopupMenu should display all 3 options');

    // Verify labels, formatted key slots, and icons in menu items
    const dragItem = menuItems[1];
    const dragLabel = findAllNodes(dragItem, (n) => n.className.includes('menu-item-label'))[0];
    assert.equal(dragLabel.textContent, 'Select Features by Drag');

    const dragKeySlot = findAllNodes(dragItem, (n) => n.className.includes('menu-key-slot'))[0];
    assert.equal(dragKeySlot?.textContent, 'Shift+Q');

    const dragIcon = findAllNodes(dragItem, (n) => n.className.includes('menu-item-icon-slot'))[0];
    assert.ok(dragIcon, 'Menu item must have an icon slot');
  });

  it('selecting an option from PopupMenu updates primary button icon/label and immediately dispatches that action', async () => {
    let selectedAction: string | null = null;
    let executedAction: string | null = null;

    await act(async () => {
      root!.render(
        React.createElement(SplitToolButton, {
          activeAction: 'select_feature',
          options: ['select_feature', 'select_features_by_drag', 'select_features_by_freehand'],
          onSelect: (action: string) => {
            selectedAction = action;
          },
          onExecute: (action: string) => {
            executedAction = action;
          }
        })
      );
    });

    const chevronBtn = findAllNodes(container, (n) => n.className.includes('split-tool-chevron'))[0];
    await act(async () => {
      chevronBtn.dispatchEvent({
        type: 'click',
        bubbles: true,
        clientX: 120,
        clientY: 65,
        stopPropagation: () => {},
        preventDefault: () => {}
      });
    });

    const popupMenu = findAllNodes(doc.body, (n) => n.className.includes('popup-menu'))[0];
    assert.ok(popupMenu, 'PopupMenu should be rendered');

    const menuItems = findAllNodes(popupMenu, (n) => n.className.includes('menu-dropdown-item'));
    const freehandItem = menuItems[2];

    await act(async () => {
      freehandItem.dispatchEvent({
        type: 'click',
        bubbles: true,
        stopPropagation: () => {},
        preventDefault: () => {}
      });
    });

    assert.equal(selectedAction, 'select_features_by_freehand', 'onSelect should receive selected option');
    assert.equal(executedAction, 'select_features_by_freehand', 'onExecute should immediately dispatch selected action');

    // Primary button should now reflect the newly selected action
    const primaryBtn = findAllNodes(container, (n) => n.className.includes('split-tool-primary'))[0];
    assert.equal(primaryBtn.getAttribute('title'), 'Select Features by Freehand (Alt+Q)');

    // Menu should be closed
    const closedMenu = findAllNodes(doc.body, (n) => n.className.includes('popup-menu'))[0];
    assert.equal(closedMenu, undefined, 'PopupMenu should be closed after selection');
  });

  it('supports horizontal (top/bottom) and vertical (left/right) dock zone orientations', async () => {
    await act(async () => {
      root!.render(
        React.createElement(SplitToolButton, {
          activeAction: 'select_feature',
          options: ['select_feature'],
          zone: 'top'
        })
      );
    });

    let wrapper = findAllNodes(container, (n) => n.className.includes('split-tool-button'))[0];
    assert.ok(wrapper.className.includes('horizontal'), 'zone="top" should have horizontal class');

    await act(async () => {
      root!.render(
        React.createElement(SplitToolButton, {
          activeAction: 'select_feature',
          options: ['select_feature'],
          zone: 'left'
        })
      );
    });

    wrapper = findAllNodes(container, (n) => n.className.includes('split-tool-button'))[0];
    assert.ok(wrapper.className.includes('vertical'), 'zone="left" should have vertical class');
  });

  it('respects disabled and active props', async () => {
    await act(async () => {
      root!.render(
        React.createElement(SplitToolButton, {
          activeAction: 'select_feature',
          options: ['select_feature'],
          disabled: true,
          active: true
        })
      );
    });

    const primaryBtn = findAllNodes(container, (n) => n.className.includes('split-tool-primary'))[0];
    const chevronBtn = findAllNodes(container, (n) => n.className.includes('split-tool-chevron'))[0];

    assert.ok(primaryBtn.disabled, 'Primary button should be disabled');
    assert.ok(chevronBtn.disabled, 'Chevron button should be disabled');
    assert.ok(primaryBtn.className.includes('active'), 'Primary button should have active class');
  });
});
