/**
 * @file ColourPickerDialog.test.ts
 * @module tests/renderer/dialogs/ColourPickerDialog.test
 * @description Component tests verifying ColourPickerDialog portal rendering, keyboard Escape dismissal, backdrop click cancellation, Apply/Cancel actions, and integration with ColorInput and PreferencesDialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see {@link ColourPickerDialog}
 * @see {@link ColorInput}
 * @see {@link PreferencesDialog}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createRendererJiti } from '../rendererJiti';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Lightweight mock element for headless Node.js React 19 testing.
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
  value = '';
  disabled = false;
  title = '';
  multiple = false;
  selected = false;
  selectedIndex = 0;

  get options(): any[] {
    return this.childNodes.filter((c) => c.tagName === 'OPTION');
  }

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

  setAttribute(k: string, v: string): void {
    this.attributes[k] = String(v);
    if (k === 'class') {
      this.className = String(v);
    }
    if (k === 'value') {
      this.value = String(v);
    }
    if (k === 'title') {
      this.title = String(v);
    }
    if (k === 'disabled') {
      this.disabled = true;
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
    if (k === 'disabled') {
      this.disabled = false;
    }
  }

  appendChild(child: any): any {
    this.childNodes.push(child);
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

  addEventListener(type: string, cb: (e: any) => void, capture?: boolean): void {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture: Boolean(capture) });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter((l) => l.cb !== cb);
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

  setPointerCapture(_id: number): void {}
  releasePointerCapture(_id: number): void {}

  contains(node: any): boolean {
    if (node === this) return true;
    for (const child of this.childNodes) {
      if (child.contains && child.contains(node)) return true;
    }
    return false;
  }

  getBoundingClientRect(): { width: number; height: number; top: number; left: number; right: number; bottom: number } {
    return { width: 380, height: 350, top: 50, left: 50, right: 430, bottom: 400 };
  }
}

let doc: any;
let container: MockElement;
let root: Root | null = null;
let windowListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};

function setupDom(): void {
  windowListeners = {};
  const documentElement = new MockElement('html');
  const head = new MockElement('head');
  (head as any).querySelectorAll = () => [];
  const body = new MockElement('body');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  doc = {
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

  const win: any = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: (type: string, cb: (e: any) => void, capture?: boolean) => {
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
    document: doc,
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement,
    electronAPI: {
      getPreferenceValue: async () => ({})
    },
    open: () => ({
      document: doc,
      addEventListener: () => {},
      removeEventListener: () => {},
      close: () => {}
    })
  };
  doc.defaultView = win;

  (globalThis as any).document = doc;
  (globalThis as any).window = win;
  (globalThis as any).HTMLElement = MockElement;
  (globalThis as any).Element = MockElement;
  (globalThis as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8, DOCUMENT_NODE: 9 };
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

  container = doc.createElement('div');
  body.appendChild(container);
  root = createRoot(container as any);
}

function teardownDom(): void {
  if (root) {
    try {
      act(() => {
        root?.unmount();
      });
    } catch {
      // Ignored
    }
    root = null;
  }
  delete (globalThis as any).document;
  delete (globalThis as any).window;
  delete (globalThis as any).HTMLElement;
  delete (globalThis as any).Element;
  delete (globalThis as any).Node;
  delete (globalThis as any).ResizeObserver;
  delete (globalThis as any).MutationObserver;
}

function findElementsByClass(el: MockElement, className: string): MockElement[] {
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

const jiti = createRendererJiti(import.meta.url);

const { ColourPickerDialog } = jiti(
  '../../../src/renderer/workbench/dialogs/ColourPickerDialog.tsx'
);
const { ColorInput } = jiti(
  '../../../src/renderer/components/common/ColorInput.tsx'
);
const { PreferencesDialog } = jiti(
  '../../../src/renderer/workbench/dialogs/PreferencesDialog.tsx'
);
const {
  isPreferencesOpenSignal,
  activeCategorySignal,
  preferencesMapSignal
} = jiti('../../../src/renderer/state/preferencesSignals.ts');
const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');

describe('ColourPickerDialog Component & Modal Integration (Ticket #206)', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    teardownDom();
  });

  it('does not render modal portal content when isOpen is false', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerDialog, {
          isOpen: false,
          initialColor: '#ff0000ff',
          onApply: () => {},
          onCancel: () => {}
        })
      );
    });

    const backdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(backdrops.length, 0, 'Must not render portal backdrop when closed');
  });

  it('renders modal dialog shell, title, embedded ColourPickerWidget, and buttons when open', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerDialog, {
          isOpen: true,
          title: 'Custom Title',
          initialColor: '#0000ffff',
          onApply: () => {},
          onCancel: () => {}
        })
      );
    });

    const backdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(backdrops.length, 1, 'Must render backdrop portal inside document.body');

    const headers = findElementsByClass(doc.body, 'colour-picker-dialog-header');
    assert.equal(headers.length, 1);

    const pickers = findElementsByClass(doc.body, 'colour-picker-widget');
    assert.equal(pickers.length, 1, 'Must render embedded ColourPickerWidget');

    const applyBtns = findElementsByClass(doc.body, 'colour-picker-dialog-apply-btn');
    assert.equal(applyBtns.length, 1, 'Must render Apply button');

    const cancelBtns = findElementsByClass(doc.body, 'colour-picker-dialog-cancel-btn');
    assert.equal(cancelBtns.length, 1, 'Must render Cancel button');
  });

  it('dismisses modal on Escape key press', async () => {
    let cancelled = false;
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerDialog, {
          isOpen: true,
          initialColor: '#ff0000ff',
          onApply: () => {},
          onCancel: () => {
            cancelled = true;
          }
        })
      );
    });

    // Dispatch Escape keydown on window
    await act(async () => {
      (globalThis as any).window.dispatchEvent({
        type: 'keydown',
        key: 'Escape',
        defaultPrevented: false,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    });

    assert.equal(cancelled, true, 'Escape key must trigger onCancel');
  });

  it('clicking Apply returns draft color; clicking Cancel dismisses without changes', async () => {
    let appliedColor = '';
    let wasCancelled = false;

    await act(async () => {
      root?.render(
        React.createElement(ColourPickerDialog, {
          isOpen: true,
          initialColor: '#00ff00ff',
          onApply: (c: string) => {
            appliedColor = c;
          },
          onCancel: () => {
            wasCancelled = true;
          }
        })
      );
    });

    const applyBtn = findElementsByClass(doc.body, 'colour-picker-dialog-apply-btn')[0];
    await act(async () => {
      applyBtn.dispatchEvent({
        type: 'click',
        bubbles: true
      });
    });

    assert.equal(appliedColor, '#00ff00ff', 'Clicking Apply must invoke onApply with initial/draft color');

    const cancelBtn = findElementsByClass(doc.body, 'colour-picker-dialog-cancel-btn')[0];
    await act(async () => {
      cancelBtn.dispatchEvent({
        type: 'click',
        bubbles: true
      });
    });

    assert.equal(wasCancelled, true, 'Clicking Cancel must invoke onCancel');
  });

  it('integrates ColourPickerDialog into ColorInput component', async () => {
    let emittedVal = '';
    await act(async () => {
      root?.render(
        React.createElement(ColorInput, {
          id: 'test-pref-color',
          value: '#ff0000ff',
          ariaLabel: 'Error Logging Color',
          onChange: (val: string) => {
            emittedVal = val;
          }
        })
      );
    });

    // Verify modal is initially closed
    let backdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(backdrops.length, 0);

    // Click swatch button
    const swatchBtn = findElementsByClass(container, 'preference-color-button-wrapper')[0];
    assert.ok(swatchBtn);

    await act(async () => {
      swatchBtn.dispatchEvent({
        type: 'click',
        bubbles: true
      });
    });

    // Verify modal opened
    backdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(backdrops.length, 1, 'Clicking swatch button must open ColourPickerDialog');

    // Confirm dialog with Apply
    const applyBtn = findElementsByClass(doc.body, 'colour-picker-dialog-apply-btn')[0];
    await act(async () => {
      applyBtn.dispatchEvent({
        type: 'click',
        bubbles: true
      });
    });

    // Verify modal closed and callback fired
    backdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(backdrops.length, 0, 'Applying dialog must close modal');
    assert.equal(emittedVal, '#ff0000ff', 'Applying dialog must propagate chosen color');
  });

  it('integrates with PreferencesDialog logging color settings', async () => {
    dictionarySignal.value = {};
    activeCategorySignal.value = 'general';
    preferencesMapSignal.value = {
      'general.logging.colours.level.error': {
        key: 'general.logging.colours.level.error',
        displayName: 'Error Color',
        value: '#ff0000ff',
        defaultValue: '#ff0000ff',
        category: 'general',
        group: 'logging',
        groupOrder: 1,
        order: 1,
        controls: ['colour']
      }
    };
    isPreferencesOpenSignal.value = true;

    await act(async () => {
      root?.render(React.createElement(PreferencesDialog));
    });

    // Verify color swatch button exists for logging preference in doc.body (rendered via Dialog portal)
    const swatchBtns = findElementsByClass(doc.body, 'preference-color-button-wrapper');
    assert.ok(swatchBtns.length >= 1, 'Must render color swatch button in PreferencesDialog');

    // Click the swatch button to trigger ColourPickerDialog
    await act(async () => {
      swatchBtns[0].dispatchEvent({
        type: 'click',
        bubbles: true
      });
    });

    const dialogBackdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(dialogBackdrops.length, 1, 'Clicking swatch in PreferencesDialog must open ColourPickerDialog');

    // Apply color in dialog
    const applyBtn = findElementsByClass(doc.body, 'colour-picker-dialog-apply-btn')[0];
    await act(async () => {
      applyBtn.dispatchEvent({
        type: 'click',
        bubbles: true
      });
    });

    // Modal closes after apply
    const remainingBackdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(remainingBackdrops.length, 0, 'Dialog should close after apply');
  });

/**
 * @description Creates a lightweight mock detached child window and document environment.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @param {{ current: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> }} [listenersRef] - Optional event listener bag ref.
 * @returns {{ childDoc: any; childWin: any }} Mock child document and window.
 */
function createMockSecondaryWindow(listenersRef: { current: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> } = { current: {} }): { childDoc: any; childWin: any } {
  const childDocElement = new MockElement('html');
  const childBody = new MockElement('body');
  childDocElement.appendChild(childBody);

  const childDoc: any = {
    nodeType: 9,
    documentElement: childDocElement,
    body: childBody,
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
    createTextNode: (text: string) => ({ nodeType: 3, nodeValue: text, ownerDocument: childDoc, parentNode: null }),
    createComment: (data: string) => ({ nodeType: 8, data, ownerDocument: childDoc, parentNode: null }),
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null as any
  };
  childDocElement.ownerDocument = childDoc;
  childBody.ownerDocument = childDoc;

  const childWin: any = {
    innerWidth: 600,
    innerHeight: 400,
    addEventListener: (type: string, cb: (e: any) => void, capture?: boolean) => {
      if (!listenersRef.current[type]) listenersRef.current[type] = [];
      listenersRef.current[type].push({ cb, capture: Boolean(capture) });
    },
    removeEventListener: (type: string, cb: (e: any) => void) => {
      if (!listenersRef.current[type]) return;
      listenersRef.current[type] = listenersRef.current[type].filter((l) => l.cb !== cb);
    },
    dispatchEvent: (event: any) => {
      const listeners = (listenersRef.current[event.type] || []).slice();
      for (const { cb } of listeners) {
        cb(event);
      }
      return !event.defaultPrevented;
    },
    document: childDoc,
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement
  };
  childDoc.defaultView = childWin;

  return { childDoc, childWin };
}

  it('portals into target container and listens to container window Escape key (Ticket #209)', async () => {
    let wasCancelled = false;

    // Create a secondary child window and document
    const childListeners = { current: {} };
    const { childDoc, childWin } = createMockSecondaryWindow(childListeners);

    await act(async () => {
      root?.render(
        React.createElement(ColourPickerDialog, {
          isOpen: true,
          initialColor: '#123456ff',
          container: childDoc.body,
          onApply: () => {},
          onCancel: () => {
            wasCancelled = true;
          }
        })
      );
    });

    // Check that dialog is in childDoc.body, NOT in doc.body
    const childBackdrops = findElementsByClass(childDoc.body, 'colour-picker-dialog-backdrop');
    assert.equal(childBackdrops.length, 1, 'Modal must portal into childDoc.body');

    const mainBackdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(mainBackdrops.length, 0, 'Modal must NOT portal into Workbench doc.body');

    // Press Escape on childWin
    await act(async () => {
      childWin.dispatchEvent({
        type: 'keydown',
        key: 'Escape',
        bubbles: true
      });
    });

    assert.equal(wasCancelled, true, 'Escape key on childWin must trigger onCancel');
  });

  it('ColorInput resolves container from ownerDocument.body when rendered inside a secondary window (Ticket #209)', async () => {
    // Create a secondary child window and document
    const { childDoc } = createMockSecondaryWindow();

    const childContainer = childDoc.createElement('div');
    childDoc.body.appendChild(childContainer);
    const childRoot = createRoot(childContainer as any);

    await act(async () => {
      childRoot.render(
        React.createElement(ColorInput, {
          value: '#336699',
          onChange: () => {}
        })
      );
    });

    const swatchBtns = findElementsByClass(childContainer, 'preference-color-button-wrapper');
    assert.ok(swatchBtns.length >= 1, 'Must render swatch button in child container');

    // Click swatch button
    await act(async () => {
      swatchBtns[0].dispatchEvent({
        type: 'click',
        bubbles: true
      });
    });

    // Dialog must be portaled into childDoc.body, NOT doc.body
    const childBackdrops = findElementsByClass(childDoc.body, 'colour-picker-dialog-backdrop');
    assert.equal(childBackdrops.length, 1, 'ColourPickerDialog must portal into childDoc.body');

    const mainBackdrops = findElementsByClass(doc.body, 'colour-picker-dialog-backdrop');
    assert.equal(mainBackdrops.length, 0, 'ColourPickerDialog must NOT portal into Workbench doc.body');

    act(() => {
      childRoot.unmount();
    });
  });
});
