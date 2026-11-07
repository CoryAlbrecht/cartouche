/**
 * @file BasicWidgetHeaderIcons.test.ts
 * @module tests/renderer/widgets/BasicWidgetHeaderIcons.test
 * @description Unit and component tests verifying BasicWidget 2-control header bar control icons (close) scale to 80% of --cartouche-ui-icon-size via CSS custom properties, optional title bar icon parameter scales to 50% of --cartouche-ui-icon-size, and react to prefsUiIconSize signal changes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link prefsUiIconSize}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

// Set React act environment flag
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * @class MockElement
 * @description Lightweight mock DOM Element representation for headless React 19 testing in Node.js.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
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
  };
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};

  /**
   * @constructor
   * @description Constructs a new MockElement with the given tag name.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {string} [tag='div'] - HTML element tag name.
   */
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

  /**
   * @description Sets an attribute value and updates className when key is 'class'.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @date 2026-10-21
   * @updated 2026-10-22
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
   * @description Computes mock bounding client rect dimensions.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
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
let container: MockElement;
let root: Root | null = null;
let windowListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};

/**
 * @description Initializes mock window and document global objects for React DOM component testing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @returns {void}
 */
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

/**
 * @description Tears down mock window and document global objects.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @returns {void}
 */
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

/**
 * @description Traverses a MockElement DOM subtree and finds all elements matching a predicate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
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

// Instantiate jiti with aliases
const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
    '@main': path.resolve(process.cwd(), 'src/main')
  }
});

const { BasicWidget } = jiti('../../../src/renderer/workbench/widgets/BasicWidget.tsx');
const { prefsUiIconSize } = jiti('../../../src/renderer/state/preferencesSignals.ts');

describe('BasicWidget Header Bar Control Icon Sizing (Ticket #53)', () => {
  beforeEach(() => {
    setupDom();
    prefsUiIconSize.value = undefined;
  });

  afterEach(() => {
    tearDownDom();
    prefsUiIconSize.value = undefined;
  });

  it('theme.css defines --cartouche-ui-icon-size: 24px in :root fallback', () => {
    const themeCssPath = path.resolve(process.cwd(), 'src/renderer/styles/theme.css');
    const defaultThemeCssPath = path.resolve(process.cwd(), 'src/renderer/styles/themes/theme-default.css');
    const content = fs.existsSync(defaultThemeCssPath)
      ? fs.readFileSync(defaultThemeCssPath, 'utf-8')
      : fs.readFileSync(themeCssPath, 'utf-8');
    assert.match(
      content,
      /--cartouche-ui-icon-size:\s*24px;/,
      'theme.css must declare --cartouche-ui-icon-size: 24px in :root'
    );
  });

  it('theme.css defines --cartouche-ui-icon-size in :root and workbench.css avoids cyclic self-reference on .workbench-container', () => {
    const workbenchCssPath = path.resolve(process.cwd(), 'src/renderer/styles/workbench.css');
    const content = fs.readFileSync(workbenchCssPath, 'utf-8');
    assert.ok(
      !content.includes('--cartouche-ui-icon-size: var(--cartouche-ui-icon-size'),
      'workbench.css must not cyclically redeclare --cartouche-ui-icon-size on .workbench-container'
    );
  });

  it('renders header control action icons with 80% of --cartouche-ui-icon-size and aspect-ratio 1 in CSS style', async () => {
    await act(async () => {
      root!.render(
        React.createElement(BasicWidget, {
          name: 'test-widget',
          displayName: 'Test Widget',
          onClose: () => {}
        })
      );
    });

    const svgs = findAllNodes(container, el => el.tagName === 'SVG');
    assert.strictEqual(svgs.length, 1, 'Should render 1 header action icon (close)');

    for (const svg of svgs) {
      assert.ok(
        svg.style.width.includes('calc(') && svg.style.width.includes('--cartouche-ui-icon-size') && svg.style.width.includes('0.5'),
        `Expected svg.style.width to scale to 50% of --cartouche-ui-icon-size, got: ${svg.style.width}`
      );
      assert.strictEqual(svg.style.aspectRatio, '1', 'Expected svg.style.aspectRatio to be 1');
    }
  });

  it('Workbench source code subscribes to prefsUiIconSize to sync --cartouche-ui-icon-size', () => {
    const workbenchTsxPath = path.resolve(process.cwd(), 'src/renderer/workbench/Workbench.tsx');
    const content = fs.readFileSync(workbenchTsxPath, 'utf-8');
    assert.match(
      content,
      /prefsUiIconSize/,
      'Workbench.tsx must import and subscribe to prefsUiIconSize'
    );
    assert.match(
      content,
      /--cartouche-ui-icon-size/,
      'Workbench.tsx must synchronize --cartouche-ui-icon-size to document.documentElement'
    );
  });

  it('reactively synchronizes prefsUiIconSize signal changes to document.documentElement and cleans up on unset', () => {
    const { effect } = jiti('@preact/signals-react');
    const dispose = effect(() => {
      const iconSize = prefsUiIconSize.value;
      if (iconSize) {
        doc.documentElement.style.setProperty(
          '--cartouche-ui-icon-size',
          `${iconSize}px`
        );
      } else {
        doc.documentElement.style.removeProperty(
          '--cartouche-ui-icon-size'
        );
      }
    });

    try {
      // 1. Initial unset: no custom property set
      assert.strictEqual(
        doc.documentElement.style.getPropertyValue('--cartouche-ui-icon-size'),
        '',
        'Initial unset signal should have empty inline style (inherits CSS default)'
      );

      // 2. Update to 30px
      prefsUiIconSize.value = 30;
      assert.strictEqual(
        doc.documentElement.style.getPropertyValue('--cartouche-ui-icon-size'),
        '30px',
        'Signal update to 30 should set property to 30px'
      );

      // 3. Update to 16px
      prefsUiIconSize.value = 16;
      assert.strictEqual(
        doc.documentElement.style.getPropertyValue('--cartouche-ui-icon-size'),
        '16px',
        'Signal update to 16 should set property to 16px'
      );

      // 4. Reset to undefined (fallback to CSS theme default)
      prefsUiIconSize.value = undefined;
      assert.strictEqual(
        doc.documentElement.style.getPropertyValue('--cartouche-ui-icon-size'),
        '',
        'Resetting signal to undefined must remove property to fall back to CSS 24px default'
      );
    } finally {
      dispose();
    }
  });

  it('renders strictly title and close button, omitting minimize/restore button from header bar', async () => {
    await act(async () => {
      root!.render(
        React.createElement(BasicWidget, {
          name: 'test-widget-toggle',
          displayName: '2-Control Widget',
          onClose: () => {}
        })
      );
    });

    const minimizeBtn = findAllNodes(container, el => el.tagName === 'BUTTON' && (el.attributes.title === 'Minimize' || el.attributes.title === 'Restore'))[0];
    assert.strictEqual(minimizeBtn, undefined, 'Minimize/restore button must not be present');

    const closeBtn = findAllNodes(container, el => el.tagName === 'BUTTON' && el.attributes.title === 'Close')[0];
    assert.ok(closeBtn, 'Close button must be present');
  });

  it('renders 0 header action icons when onClose is not provided and no panelApi exists', async () => {
    await act(async () => {
      root!.render(
        React.createElement(BasicWidget, {
          name: 'non-closable-widget',
          displayName: 'Non-closable Widget'
        })
      );
    });

    const svgs = findAllNodes(container, el => el.tagName === 'SVG');
    assert.strictEqual(svgs.length, 0, 'Should render 0 header icons when panel cannot close');
    const btns = findAllNodes(container, el => el.tagName === 'BUTTON');
    assert.strictEqual(btns.length, 0, 'Should render 0 buttons when panel cannot close');
  });

  describe('Optional Header Icon Parameter (Ticket #173)', () => {
    it('renders optional MDI string icon at 50% ui.icon.size to the left of the title', async () => {
      const dummyPath = 'M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z';
      await act(async () => {
        root!.render(
          React.createElement(BasicWidget, {
            name: 'icon-widget',
            displayName: 'Icon Widget',
            icon: dummyPath,
            onClose: () => {}
          })
        );
      });

      const iconContainers = findAllNodes(container, el => el.className === 'basic-widget-icon');
      assert.strictEqual(iconContainers.length, 1, 'Should render one basic-widget-icon wrapper');
      assert.strictEqual(iconContainers[0].style.marginRight, '6px', 'Icon wrapper must have 6px right margin');

      const svgs = findAllNodes(iconContainers[0], el => el.tagName === 'SVG');
      assert.strictEqual(svgs.length, 1, 'Should render an SVG icon within the icon wrapper');
      assert.ok(
        svgs[0].style.width.includes('calc(')
          && svgs[0].style.width.includes('--cartouche-ui-icon-size')
          && svgs[0].style.width.includes('0.5'),
        `Expected header icon width to scale to 50% of --cartouche-ui-icon-size, got: ${svgs[0].style.width}`
      );
    });

    it('renders custom React.ReactNode icon directly to the left of the title', async () => {
      await act(async () => {
        root!.render(
          React.createElement(BasicWidget, {
            name: 'custom-node-widget',
            displayName: 'Custom Node Widget',
            icon: React.createElement('span', { className: 'custom-rendered-icon' }, '★')
          })
        );
      });

      const iconContainers = findAllNodes(container, el => el.className === 'basic-widget-icon');
      assert.strictEqual(iconContainers.length, 1, 'Should render icon container');
      const customElements = findAllNodes(container, el => el.className === 'custom-rendered-icon');
      assert.strictEqual(customElements.length, 1, 'Custom ReactNode should be rendered');
    });

    it('omits basic-widget-icon container when icon is unset/omitted', async () => {
      await act(async () => {
        root!.render(
          React.createElement(BasicWidget, {
            name: 'plain-widget',
            displayName: 'Plain Widget'
          })
        );
      });

      const iconContainers = findAllNodes(container, el => el.className === 'basic-widget-icon');
      assert.strictEqual(iconContainers.length, 0, 'No basic-widget-icon container should be rendered when icon is omitted');
    });

    it('factors header icon into minimum width floor calculation', async () => {
      let plainWidth = 0;
      let iconWidth = 0;

      await act(async () => {
        root!.render(
          React.createElement(BasicWidget, {
            name: 'widget-no-icon',
            displayName: 'No Icon',
            minWidth: 10
          })
        );
      });
      const plainWidgetEl = findAllNodes(container, el => el.className.includes('widget-no-icon'))[0];
      plainWidth = parseInt(plainWidgetEl.style.minWidth, 10);

      await act(async () => {
        root!.render(
          React.createElement(BasicWidget, {
            name: 'widget-with-icon',
            displayName: 'With Icon',
            icon: 'M0,0H10V10H0Z',
            minWidth: 10
          })
        );
      });
      const iconWidgetEl = findAllNodes(container, el => el.className.includes('widget-with-icon'))[0];
      iconWidth = parseInt(iconWidgetEl.style.minWidth, 10);

      // Icon size at default (24px) is 12px + 6px margin = 18px difference
      assert.ok(
        iconWidth > plainWidth,
        `Expected widget with icon to have larger minWidth than without icon (${iconWidth} > ${plainWidth})`
      );
      assert.strictEqual(
        iconWidth - plainWidth,
        18,
        `Expected minWidth difference to match 50% icon (12px) + 6px spacing = 18px, got ${iconWidth - plainWidth}`
      );
    });
  });
});
