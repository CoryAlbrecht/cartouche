/**
 * @file WorkbenchStatusBar.test.ts
 * @module tests/renderer/workbench/WorkbenchStatusBar.test
 * @description Unit and component tests for WorkbenchStatusBar verifying reactive signal updates for cursor coordinates, cartographic scale, selected features count, and active CRS, while ensuring zero re-renders of the root Workbench shell and outer ToolbarPanel components during coordinate signal mutations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @see {@link WorkbenchStatusBar}
 * @see {@link Workbench}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import createJiti from 'jiti';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const require = createRequire(import.meta.url);
require.extensions['.svg'] = (mod: any) => {
  mod.exports = 'mock-logo.svg';
};
require.extensions['.css'] = (mod: any) => {
  mod.exports = {};
};

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
  },
});

const {
  cursorCoordsSignal,
  scaleDenominatorSignal,
  activeCrsSignal,
  selectedFeatureIdsSignal,
  selectedFeaturesCountSignal,
} = jiti('@renderer/state/gisSignals');
const { dictionarySignal } = jiti('@renderer/state/i18nSignals');

/**
 * @class MockElement
 * @description Lightweight mock DOM Element for headless React 19 testing in Node.js.
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
  classList = {
    add: () => {},
    remove: () => {},
    contains: () => false,
    toggle: () => false,
  };
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
      getPropertyValue: (name: string) => styleObj[name] || '',
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

  prepend(child: any): any {
    this.childNodes.unshift(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child: any): any {
    this.childNodes = this.childNodes.filter((c) => c !== child);
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
    this.eventListeners[type] = this.eventListeners[type].filter((l) => l.cb !== cb);
  }

  dispatchEvent(event: any): boolean {
    event.target = event.target || this;
    event.currentTarget = this;
    const listeners = (this.eventListeners[event.type] || []).slice();
    for (const { cb } of listeners) {
      cb(event);
    }
    if (event.bubbles !== false && this.parentNode && !event.cancelBubble) {
      this.parentNode.dispatchEvent(event);
    }
    return !event.defaultPrevented;
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
        .map((c) => (c.nodeType === 3 ? c.nodeValue || c.textContent || '' : c.textContent || ''))
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
 * @description Recursively searches mock DOM tree for elements matching predicate.
 * @param {MockElement} rootNode - Root node to traverse.
 * @param {(el: MockElement) => boolean} predicate - Match predicate.
 * @returns {MockElement[]} Matching elements.
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
let container: MockElement;
let root: Root | null = null;

/**
 * @function setupDom
 * @description Initializes headless mock DOM environment for React 19 testing.
 * @returns {void}
 */
function setupDom(): void {
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
    dispatchEvent: () => true,
    defaultView: null as any,
  };
  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;
  documentElement.parentNode = doc;

  const MockResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  const win = {
    document: doc,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {},
    removeEventListener: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    ResizeObserver: MockResizeObserver,
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    electronAPI: {
      getActions: async () => [],
      executeAction: () => {},
      getPreferences: async () => [],
      isWindowMaximized: async () => false,
      onMaximizedState: () => () => {},
      onLayerAdded: () => () => {},
    },
  };

  doc.defaultView = win;
  (globalThis as any).window = win;
  (globalThis as any).document = doc;
  (globalThis as any).ResizeObserver = MockResizeObserver;
  (globalThis as any).localStorage = win.localStorage;
}

describe('WorkbenchStatusBar Reactivity and Workbench Render Isolation', () => {
  beforeEach(() => {
    setupDom();
    container = doc.createElement('div');
    doc.body.appendChild(container);
    root = createRoot(container as any);

    cursorCoordsSignal.value = null;
    scaleDenominatorSignal.value = 25000000;
    activeCrsSignal.value = {
      authId: 'EPSG:3857',
      name: 'WGS 84 / Pseudo-Mercator',
      units: 'meters',
    };
    selectedFeatureIdsSignal.value = new Set();
    dictionarySignal.value = {};
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    cursorCoordsSignal.value = null;
    scaleDenominatorSignal.value = 25000000;
    activeCrsSignal.value = {
      authId: 'EPSG:3857',
      name: 'WGS 84 / Pseudo-Mercator',
      units: 'meters',
    };
    selectedFeatureIdsSignal.value = new Set();
  });

  it('renders default status bar items when cursorCoordsSignal is null', async () => {
    const { WorkbenchStatusBar } = jiti('@renderer/workbench/WorkbenchStatusBar') as {
      WorkbenchStatusBar: React.FC;
    };

    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });

    const footers = findAllNodes(container, (el) => el.tagName === 'FOOTER' && el.className === 'workbench-statusbar');
    assert.equal(footers.length, 1, 'Expected footer.workbench-statusbar element');

    const text = footers[0].textContent;
    assert.ok(text.includes('Coordinate: 0.0000°, 0.0000°'), 'Expected fallback coordinate text');
    assert.ok(text.includes(`Scale: 1 : ${(25000000).toLocaleString()}`), 'Expected formatted cartographic scale');
    assert.ok(text.includes('Selected: 0'), 'Expected selected features count');
    assert.ok(text.includes('🌐 EPSG:3857'), 'Expected active CRS authId');
    assert.ok(text.includes('● Ready'), 'Expected application core status');
  });

  it('updates reactively when cursorCoordsSignal, scaleDenominatorSignal, activeCrsSignal, and selectedFeaturesCountSignal change', async () => {
    const { WorkbenchStatusBar } = jiti('@renderer/workbench/WorkbenchStatusBar') as {
      WorkbenchStatusBar: React.FC;
    };

    await act(async () => {
      root!.render(React.createElement(WorkbenchStatusBar));
    });

    await act(async () => {
      cursorCoordsSignal.value = { lon: 12.3456, lat: 45.6789, x: 100, y: 200 };
    });
    assert.ok(
      container.textContent.includes('12.3456°E, 45.6789°N'),
      `Expected positive E/N coordinates in status bar, got: ${container.textContent}`
    );

    await act(async () => {
      cursorCoordsSignal.value = { lon: -75.6972, lat: -33.4489, x: 300, y: 400 };
    });
    assert.ok(
      container.textContent.includes('75.6972°W, 33.4489°S'),
      `Expected negative W/S coordinates in status bar, got: ${container.textContent}`
    );

    await act(async () => {
      scaleDenominatorSignal.value = 50000;
      activeCrsSignal.value = {
        authId: 'EPSG:4326',
        name: 'WGS 84',
        units: 'degrees',
      };
      selectedFeatureIdsSignal.value = new Set(['feat-1', 'feat-2', 'feat-3']);
    });

    assert.equal(selectedFeaturesCountSignal.value, 3);
    assert.ok(
      container.textContent.includes(`Scale: 1 : ${(50000).toLocaleString()}`),
      'Expected updated scale denominator'
    );
    assert.ok(container.textContent.includes('Selected: 3'), 'Expected updated selected feature count');
    assert.ok(container.textContent.includes('🌐 EPSG:4326'), 'Expected updated active CRS');
  });

  it('isolates coordinate and status bar signal mutations from Workbench and ToolbarPanel re-renders', async () => {
    let workbenchRenderCount = 0;
    let toolbarPanelRenderCount = 0;
    let statusBarRenderCount = 0;

    const { Workbench } = jiti('@renderer/workbench/Workbench') as {
      Workbench: React.FC;
    };
    const { DockviewReact } = jiti('dockview-react');
    const { ToolbarContainerWidget } = jiti(
      '@renderer/workbench/widgets/ToolbarContainerWidget'
    ) as {
      ToolbarContainerWidget: React.FC<any>;
    };

    const origCreateElement = React.createElement;
    (React as any).createElement = function (type: any, props: any, ...children: any[]) {
      if (type === 'div' && props?.className === 'workbench-container') {
        workbenchRenderCount++;
      }
      if (type === ToolbarContainerWidget) {
        toolbarPanelRenderCount++;
      }
      if (type === 'footer' && props?.className === 'workbench-statusbar') {
        statusBarRenderCount++;
      }
      if (type === DockviewReact) {
        return origCreateElement('div', { className: 'mock-dockview' });
      }
      return origCreateElement(type, props, ...children);
    };

    try {
      await act(async () => {
        root!.render(origCreateElement(Workbench));
      });

      const initialWorkbenchRenders = workbenchRenderCount;
      const initialToolbarRenders = toolbarPanelRenderCount;
      const initialStatusBarRenders = statusBarRenderCount;
      assert.ok(initialWorkbenchRenders >= 1, 'Workbench must render on initial mount');
      assert.ok(initialToolbarRenders >= 4, 'All 4 outer ToolbarPanel zones must render on initial mount');
      assert.ok(initialStatusBarRenders >= 1, 'WorkbenchStatusBar must render on initial mount');

      // Mutate cursorCoordsSignal, scaleDenominatorSignal, and activeCrsSignal repeatedly (simulating pointermove and pan/zoom frames)
      await act(async () => {
        cursorCoordsSignal.value = { lon: 10.1234, lat: 20.5678, x: 50, y: 60 };
      });
      await act(async () => {
        cursorCoordsSignal.value = { lon: 11.2345, lat: 21.6789, x: 55, y: 65 };
      });
      await act(async () => {
        cursorCoordsSignal.value = { lon: 12.3456, lat: 22.789, x: 60, y: 70 };
        scaleDenominatorSignal.value = 100000;
        activeCrsSignal.value = { authId: 'EPSG:4326', name: 'WGS 84', units: 'degrees' };
      });

      // Verify WorkbenchStatusBar inside Workbench updated its rendered output and re-rendered
      const footers = findAllNodes(container, (el) => el.tagName === 'FOOTER' && el.className === 'workbench-statusbar');
      assert.equal(footers.length, 1);
      assert.ok(footers[0].textContent.includes('12.3456°E, 22.7890°N'));
      assert.ok(footers[0].textContent.includes(`Scale: 1 : ${(100000).toLocaleString()}`));
      assert.ok(footers[0].textContent.includes('🌐 EPSG:4326'));
      assert.ok(
        statusBarRenderCount > initialStatusBarRenders,
        'WorkbenchStatusBar must re-render when status bar signals mutate'
      );

      // Verify Workbench and ToolbarPanel render counts remained completely constant
      assert.equal(
        workbenchRenderCount,
        initialWorkbenchRenders,
        'Workbench must not re-render when cursor coordinates, scale, or CRS signals mutate'
      );
      assert.equal(
        toolbarPanelRenderCount,
        initialToolbarRenders,
        'Outer ToolbarPanel components must not re-render when cursor coordinates, scale, or CRS signals mutate'
      );
    } finally {
      (React as any).createElement = origCreateElement;
    }
  });
});
