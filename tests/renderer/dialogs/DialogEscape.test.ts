/**
 * @file DialogEscape.test.ts
 * @module tests/renderer/dialogs/DialogEscape.test
 * @description Unit tests verifying Dialog base container Escape key handling, onCancel with onClose fallback, DetachedWindowPortal keydown capturing, and active dialog stack management, and Escape deferral to a picker dialog open over a Dialog in its detached window (Ticket #365).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link cancelTopDialog}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRendererJiti } from "../rendererJiti";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const jiti = createRendererJiti(import.meta.url);

const { Dialog } = jiti("@renderer/workbench/dialogs/Dialog");
const { PickerDialogFrame } = jiti(
  "@renderer/workbench/dialogs/PickerDialogFrame"
);
const {
  activeDialogStackSignal,
  registerActiveDialog,
  focusActiveDialog,
  cancelTopDialog,
} = jiti("@renderer/state/dialogSignals");

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
  className = "";
  attributes: Record<string, string> = {};
  eventListeners: Record<
    string,
    Array<{ cb: (e: any) => void; capture: boolean }>
  > = {};

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
    const styleObj: Record<string, string> = { cssText: "" };
    this.style = Object.assign(styleObj, {
      cssText: "",
      setProperty: (name: string, val: string) => {
        styleObj[name] = val;
      },
      removeProperty: (name: string) => {
        delete styleObj[name];
      },
      getPropertyValue: (name: string) => styleObj[name] || "",
    });
  }

  setAttribute(key: string, val: string): void {
    this.attributes[key] = String(val);
    if (key === "class") {
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

  removeEventListener(
    type: string,
    cb: (e: any) => void,
    _capture = false
  ): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(
      (l) => l.cb !== cb
    );
  }

  dispatchEvent(event: any): boolean {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    const listeners = this.eventListeners[event.type] || [];
    for (const l of listeners) {
      l.cb(event);
    }
    if (
      !event._bubblesStopped
      && this.parentNode
      && typeof this.parentNode.dispatchEvent === "function"
    ) {
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

describe("Dialog Escape & Active Stack Handling", () => {
  let originalDocument: typeof globalThis.document;
  let originalWindow: typeof globalThis.window;
  let originalMutationObserver: typeof globalThis.MutationObserver;
  let mockChildWindow: any;
  let childListeners: Record<
    string,
    Array<{ cb: (e: any) => void; capture: boolean }>
  >;
  let root: Root | null = null;
  let container: MockElement;

  beforeEach(() => {
    activeDialogStackSignal.value = [];
    originalDocument = globalThis.document;
    originalWindow = (globalThis as any).window;
    originalMutationObserver = globalThis.MutationObserver;

    childListeners = {};
    const childDocElement = new MockElement("html");
    const childBody = new MockElement("body");
    const childHead = new MockElement("head");
    childDocElement.appendChild(childHead);
    childDocElement.appendChild(childBody);

    const childDoc: any = {
      nodeType: 9,
      title: "",
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
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    childHead.ownerDocument = childDoc;
    childBody.ownerDocument = childDoc;

    mockChildWindow = {
      closed: false,
      document: childDoc,
      addEventListener: (
        type: string,
        cb: (e: any) => void,
        capture = false
      ) => {
        if (!childListeners[type]) childListeners[type] = [];
        childListeners[type].push({ cb, capture });
      },
      removeEventListener: (
        type: string,
        cb: (e: any) => void,
        _capture = false
      ) => {
        if (!childListeners[type]) return;
        childListeners[type] = childListeners[type].filter((l) => l.cb !== cb);
      },
      dispatchEvent: (event: any) => {
        // Event on the window itself: its capture listeners run before its
        // bubble listeners, and stopPropagation() in the capture pass skips
        // the bubble pass, as in the DOM dispatch algorithm.
        event.currentTarget = mockChildWindow;
        const listeners = childListeners[event.type] || [];
        const ordered = [
          ...listeners.filter((l) => l.capture),
          ...listeners.filter((l) => !l.capture),
        ];
        for (const l of ordered) {
          if (event.propagationStopped) break;
          l.cb(event);
        }
        return true;
      },
      close: () => {
        mockChildWindow.closed = true;
      },
    };

    const mainDocElement = new MockElement("html");
    const mainBody = new MockElement("body");
    const mainHead = new MockElement("head");
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
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
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
    };

    mainDoc.defaultView = win;
    childDoc.defaultView = mockChildWindow;
    mockChildWindow.HTMLIFrameElement = class {};
    mockChildWindow.HTMLElement = MockElement;
    mockChildWindow.Element = MockElement;

    (globalThis as any).document = mainDoc;
    (globalThis as any).window = win;
    (globalThis as any).Node = {
      ELEMENT_NODE: 1,
      TEXT_NODE: 3,
      COMMENT_NODE: 8,
      DOCUMENT_NODE: 9,
    };

    (globalThis as any).MutationObserver = class {
      observe() {}
      disconnect() {}
    };

    container = new MockElement("div");
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

  it("registerActiveDialog pushes dialog entry and returns unregister cleanup function", () => {
    let cancelCalled = false;
    const unregister = registerActiveDialog("preferencesWindow", () => {
      cancelCalled = true;
    });

    assert.equal(activeDialogStackSignal.value.length, 1);
    assert.equal(activeDialogStackSignal.value[0].name, "preferencesWindow");

    const result = cancelTopDialog();
    assert.equal(
      result,
      true,
      "cancelTopDialog should return true when a dialog is open"
    );
    assert.equal(
      cancelCalled,
      true,
      "cancel callback should have been invoked"
    );

    unregister();
    assert.equal(
      activeDialogStackSignal.value.length,
      0,
      "stack should be empty after unregister"
    );
  });

  it("focusActiveDialog promotes dialog to top of stack", () => {
    registerActiveDialog("preferencesWindow", () => {});
    registerActiveDialog("addLayersWindow", () => {});

    assert.equal(
      activeDialogStackSignal.value[activeDialogStackSignal.value.length - 1]
        .name,
      "addLayersWindow"
    );

    focusActiveDialog("preferencesWindow");
    assert.equal(
      activeDialogStackSignal.value[activeDialogStackSignal.value.length - 1]
        .name,
      "preferencesWindow"
    );
  });

  it("cancelTopDialog returns false when no dialogs are open", () => {
    assert.equal(cancelTopDialog(), false);
  });

  it("renders Dialog, registers into active stack, and invokes onCancel on Escape keydown in child window", async () => {
    let cancelCalled = false;
    let closeCalled = false;

    await act(async () => {
      root!.render(
        React.createElement(
          Dialog,
          {
            name: "preferencesWindow",
            title: "Preferences",
            isOpen: true,
            onClose: () => {
              closeCalled = true;
            },
            onCancel: () => {
              cancelCalled = true;
            },
          },
          React.createElement("div", null, "Dialog Body")
        )
      );
    });

    assert.equal(
      activeDialogStackSignal.value.length,
      1,
      "Dialog should register in activeDialogStackSignal when mounted"
    );
    assert.equal(activeDialogStackSignal.value[0].name, "preferencesWindow");

    // Dispatch Escape keydown in child window
    const escapeEvent = {
      type: "keydown",
      key: "Escape",
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {},
    };
    mockChildWindow.dispatchEvent(escapeEvent);

    assert.equal(cancelCalled, true, "Escape must invoke onCancel");
    assert.equal(
      closeCalled,
      false,
      "onClose should not be called when onCancel is supplied"
    );
  });

  it("Dialog falls back to onClose on Escape when onCancel is not supplied", async () => {
    let closeCalled = false;

    await act(async () => {
      root!.render(
        React.createElement(
          Dialog,
          {
            name: "addLayersWindow",
            title: "Add Layers",
            isOpen: true,
            onClose: () => {
              closeCalled = true;
            },
          },
          React.createElement("div", null, "Dialog Body")
        )
      );
    });

    const escapeEvent = {
      type: "keydown",
      key: "Escape",
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {},
    };
    mockChildWindow.dispatchEvent(escapeEvent);

    assert.equal(
      closeCalled,
      true,
      "Escape must fall back to onClose when onCancel is omitted"
    );
  });

  /**
   * @function escapeEvent
   * @description Builds an Escape keydown event that records preventDefault() and stopPropagation() calls.
   * @returns {any} Mock keyboard event.
   */
  function escapeEvent(): any {
    return {
      type: "keydown",
      key: "Escape",
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
    };
  }

  /**
   * @function renderDialogWithPicker
   * @description Renders a Dialog whose body hosts a PickerDialogFrame portaled into the Dialog's detached window when `pickerOpen` is true, counting each dismissal callback.
   * @param {{ pickerOpen: boolean }} options - Whether the picker is open.
   * @returns {Promise<Record<string, number>>} Live call counts for the Dialog's onCancel / onClose and the picker's onCancel / onApply.
   */
  async function renderDialogWithPicker(options: {
    pickerOpen: boolean;
  }): Promise<Record<string, number>> {
    const calls = {
      dialogCancel: 0,
      dialogClose: 0,
      pickerCancel: 0,
      pickerApply: 0,
    };
    const picker =
      options.pickerOpen ?
        React.createElement(
          PickerDialogFrame,
          {
            title: "Pick a Colour",
            classPrefix: "colour-picker-dialog",
            container: mockChildWindow.document.body,
            onApply: () => {
              calls.pickerApply++;
            },
            onCancel: () => {
              calls.pickerCancel++;
            },
          },
          React.createElement("div", null, "Picker Body")
        )
      : null;
    await act(async () => {
      root!.render(
        React.createElement(
          Dialog,
          {
            name: "projectPropertiesWindow",
            title: "Project Properties",
            isOpen: true,
            onClose: () => {
              calls.dialogClose++;
            },
            onCancel: () => {
              calls.dialogCancel++;
            },
          },
          React.createElement("div", null, "Dialog Body"),
          picker
        )
      );
    });
    return calls;
  }

  it("Escape with a picker dialog open over the Dialog cancels only the picker", async () => {
    const calls = await renderDialogWithPicker({ pickerOpen: true });

    await act(async () => {
      mockChildWindow.dispatchEvent(escapeEvent());
    });

    assert.equal(calls.pickerCancel, 1, "Escape must cancel the picker");
    assert.equal(
      calls.pickerApply,
      0,
      "Escape must not apply the picked value"
    );
    assert.equal(
      calls.dialogCancel,
      0,
      "the parent Dialog must not be cancelled"
    );
    assert.equal(calls.dialogClose, 0, "the parent Dialog must not be closed");
  });

  it("Escape after the picker dialog closes cancels the parent Dialog", async () => {
    await renderDialogWithPicker({ pickerOpen: true });
    const calls = await renderDialogWithPicker({ pickerOpen: false });

    await act(async () => {
      mockChildWindow.dispatchEvent(escapeEvent());
    });

    assert.equal(calls.dialogCancel, 1, "Escape must cancel the parent Dialog");
    assert.equal(calls.pickerCancel, 0);
  });

  it("Escape inside an open dropdown list in the picker dialog dismisses neither the picker nor the Dialog", async () => {
    const calls = await renderDialogWithPicker({ pickerOpen: true });
    const openSelect = { matches: (q: string) => q === ":open" };
    const event = escapeEvent();
    event.target = {
      closest: (q: string) => (q === "select" ? openSelect : null),
    };

    await act(async () => {
      mockChildWindow.dispatchEvent(event);
    });

    assert.equal(calls.pickerCancel, 0, "the picker must stay open");
    assert.equal(calls.dialogCancel, 0, "the parent Dialog must stay open");
    assert.equal(calls.dialogClose, 0);
  });

  it("Escape inside an open dropdown list in the Dialog, with no picker dialog open, leaves the Dialog open", async () => {
    const calls = await renderDialogWithPicker({ pickerOpen: false });
    const openSelect = { matches: (q: string) => q === ":open" };
    const event = escapeEvent();
    event.target = {
      closest: (q: string) => (q === "select" ? openSelect : null),
    };

    await act(async () => {
      mockChildWindow.dispatchEvent(event);
    });

    assert.equal(calls.dialogCancel, 0, "the Dialog must stay open");
    assert.equal(calls.dialogClose, 0);
  });
});
