/**
 * @file mockDom.ts
 * @module tests/renderer/mockDom
 * @description Shared headless DOM harness for renderer component tests that need real event dispatch (clicks, keydown, portals): a lightweight MockElement, a mock document and window installed on globalThis, a React root, and lookup helpers. Like the DOM, `getAttribute` returns `null` for a missing attribute, `document.getElementById` searches the document, and `focus()` / `blur()` move `document.activeElement` (back to `body` when the focused element is removed); focus does not dispatch focus events. Not a test file itself.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-18
 * @since 0.1.0-dev
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Lightweight mock element for headless Node.js React 19 testing.
 */
export class MockElement {
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
  className = "";
  attributes: Record<string, string> = {};
  eventListeners: Record<
    string,
    Array<{ cb: (e: any) => void; capture: boolean }>
  > = {};
  value = "";
  disabled = false;
  title = "";
  multiple = false;
  selected = false;
  selectedIndex = 0;

  get options(): any[] {
    return this.childNodes.filter((c) => c.tagName === "OPTION");
  }

  constructor(tag = "div") {
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
        return styleProps[name] || "";
      },
    });
  }

  setAttribute(k: string, v: string): void {
    this.attributes[k] = String(v);
    if (k === "class") {
      this.className = String(v);
    }
    if (k === "value") {
      this.value = String(v);
    }
    if (k === "title") {
      this.title = String(v);
    }
    if (k === "disabled") {
      this.disabled = true;
    }
  }

  getAttribute(k: string): string | null {
    return Object.hasOwn(this.attributes, k) ? this.attributes[k] : null;
  }

  /**
   * @function ownerDoc
   * @description The mock document this element belongs to, or the installed global one.
   * @returns {any} The mock document, if any.
   */
  private ownerDoc(): any {
    return this.ownerDocument ?? (globalThis as any).document;
  }

  /**
   * @function focus
   * @description Makes this element the document's `activeElement`. No focus events are dispatched; tests that need them fire `focusin` themselves.
   */
  focus(): void {
    const doc = this.ownerDoc();
    if (doc) doc.activeElement = this;
  }

  /**
   * @function blur
   * @description Returns focus to the document body when this element has it.
   */
  blur(): void {
    const doc = this.ownerDoc();
    if (doc && doc.activeElement === this) doc.activeElement = doc.body;
  }

  removeAttribute(k: string): void {
    delete this.attributes[k];
    if (k === "class") {
      this.className = "";
    }
    if (k === "disabled") {
      this.disabled = false;
    }
  }

  appendChild(child: any): any {
    // Like the real DOM, inserting a node that is already in the tree moves it (React reorders keyed children this way).
    if (child.parentNode) child.parentNode.removeChild(child);
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child: any): any {
    this.childNodes = this.childNodes.filter((c) => c !== child);
    child.parentNode = null;
    // Like the DOM, removing the focused element (or an ancestor of it) returns focus to the body.
    const doc = this.ownerDoc();
    const active = doc?.activeElement;
    if (
      active
      && active !== doc.body
      && (child === active || child.contains?.(active))
    )
      doc.activeElement = doc.body;
    return child;
  }

  insertBefore(newChild: any, refChild: any): any {
    if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
    const idx = this.childNodes.indexOf(refChild);
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, newChild);
    } else {
      this.childNodes.push(newChild);
    }
    newChild.parentNode = this;
    return newChild;
  }

  addEventListener(
    type: string,
    cb: (e: any) => void,
    capture?: boolean
  ): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture: Boolean(capture) });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(
      (l) => l.cb !== cb
    );
  }

  dispatchEvent(event: any): boolean {
    if (!event.target || !(event.target instanceof MockElement)) {
      if (event.target && event.target.value !== undefined) {
        this.value = event.target.value;
      }
      event.target = this;
    }
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
   * @function getContext
   * @description Headless canvases have no rendering context; components that guard on a null context skip drawing.
   * @returns {null} Always null.
   */
  getContext(): null {
    return null;
  }

  /**
   * @function attachEvent
   * @description No-op legacy listener hook. The mock document has no `oninput`, so React falls back to its old input-event polyfill, which watches the focused input with `attachEvent`; key events dispatched on a focused input need it to exist.
   */
  attachEvent(): void {}

  /**
   * @function detachEvent
   * @description No-op counterpart of {@link MockElement.attachEvent}, called when the polyfill stops watching an input.
   */
  detachEvent(): void {}

  setPointerCapture(_id: number): void {}
  releasePointerCapture(_id: number): void {}

  contains(node: any): boolean {
    if (node === this) return true;
    for (const child of this.childNodes) {
      if (child.contains && child.contains(node)) return true;
    }
    return false;
  }

  getBoundingClientRect(): {
    width: number;
    height: number;
    top: number;
    left: number;
    right: number;
    bottom: number;
  } {
    return {
      width: 380,
      height: 350,
      top: 50,
      left: 50,
      right: 430,
      bottom: 400,
    };
  }
}

/**
 * @typedef {Object} MockDom
 * @property {any} doc - Mock document installed as `globalThis.document`.
 * @property {any} win - Mock window installed as `globalThis.window`; `win.dispatchEvent` delivers window-level events.
 * @property {MockElement} container - Element in `doc.body` the React root renders into.
 * @property {Root} root - React root bound to `container`.
 */
export interface MockDom {
  doc: any;
  win: any;
  container: MockElement;
  root: Root;
}

/**
 * @function installMockDom
 * @description Installs a fresh mock document, window and DOM constructors on globalThis and creates a React root in the body.
 * @returns {MockDom} The installed harness.
 */
export function installMockDom(): MockDom {
  const windowListeners: Record<
    string,
    Array<{ cb: (e: any) => void; capture: boolean }>
  > = {};
  const documentElement = new MockElement("html");
  const head = new MockElement("head");
  (head as any).querySelectorAll = () => [];
  const body = new MockElement("body");
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const doc: any = {
    nodeType: 9,
    documentElement,
    head,
    body,
    querySelectorAll: () => [],
    querySelector: () => null,
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
    activeElement: body as any,
    getElementById: (id: string) => findById(documentElement, id),
  };
  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;

  const win: any = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: (
      type: string,
      cb: (e: any) => void,
      capture?: boolean
    ) => {
      if (!windowListeners[type]) windowListeners[type] = [];
      windowListeners[type].push({ cb, capture: Boolean(capture) });
    },
    removeEventListener: (type: string, cb: (e: any) => void) => {
      if (!windowListeners[type]) return;
      windowListeners[type] = windowListeners[type].filter((l) => l.cb !== cb);
    },
    dispatchEvent: (event: any) => {
      const listeners = (windowListeners[event.type] || []).slice();
      for (const { cb } of listeners) {
        cb(event);
      }
      return !event.defaultPrevented;
    },
    // An empty selection: React's select-event handling reads it once an input has focus.
    getSelection: () => ({
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
      rangeCount: 0,
    }),
    document: doc,
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement,
    electronAPI: { getPreferenceValue: async () => ({}) },
    open: () => ({
      document: doc,
      addEventListener: () => {},
      removeEventListener: () => {},
      close: () => {},
    }),
  };
  doc.defaultView = win;

  (globalThis as any).document = doc;
  (globalThis as any).window = win;
  (globalThis as any).HTMLElement = MockElement;
  (globalThis as any).Element = MockElement;
  (globalThis as any).Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
  };
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (globalThis as any).MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };

  const container: MockElement = doc.createElement("div");
  body.appendChild(container);
  const root = createRoot(container as any);
  return { doc, win, container, root };
}

/**
 * @function teardownMockDom
 * @description Unmounts the React root and removes the mock globals installed by {@link installMockDom}.
 * @param {MockDom | null} dom - Harness to tear down.
 */
export function teardownMockDom(dom: MockDom | null): void {
  if (dom) {
    try {
      act(() => {
        dom.root.unmount();
      });
    } catch {
      // Ignored
    }
  }
  delete (globalThis as any).document;
  delete (globalThis as any).window;
  delete (globalThis as any).HTMLElement;
  delete (globalThis as any).Element;
  delete (globalThis as any).Node;
  delete (globalThis as any).ResizeObserver;
  delete (globalThis as any).MutationObserver;
}

/**
 * @function findElementsByClass
 * @description Depth-first search for mock elements carrying a CSS class.
 * @param {MockElement} el - Search root.
 * @param {string} className - Class to match.
 * @returns {MockElement[]} Matching elements in document order.
 */
export function findElementsByClass(
  el: MockElement,
  className: string
): MockElement[] {
  const matches: MockElement[] = [];
  if (el.className && el.className.split(/\s+/).includes(className)) {
    matches.push(el);
  }
  for (const child of el.childNodes) {
    if (child.nodeType === 1) {
      matches.push(...findElementsByClass(child, className));
    }
  }
  return matches;
}

/**
 * @function findById
 * @description Depth-first search for a mock element by its id attribute.
 * @param {MockElement} el - Search root.
 * @param {string} id - Element id.
 * @returns {MockElement | null} The element, or null.
 */
export function findById(el: MockElement, id: string): MockElement | null {
  if (el.getAttribute?.("id") === id) return el;
  for (const child of el.childNodes ?? []) {
    const found = child.nodeType === 1 ? findById(child, id) : null;
    if (found) return found;
  }
  return null;
}

/**
 * @function textOf
 * @description Collects the rendered text of a mock element, whether React wrote it as `textContent` or as text nodes.
 * @param {any} el - Mock element or text node.
 * @returns {string} Concatenated text content.
 */
export function textOf(el: any): string {
  if (el.nodeType === 3) return String(el.nodeValue ?? "");
  if (typeof el.textContent === "string") return el.textContent;
  return (el.childNodes ?? []).map(textOf).join("");
}
