/**
 * @file ColourPickerWidget.test.ts
 * @module tests/renderer/widgets/ColourPickerWidget.test
 * @description Component and unit tests verifying ColourPickerWidget full-size solid preview, 2D shade/tint surface, hue and alpha strips, eyedropper, format dropdown, bottom channel inputs, and UI preference scaling.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @see {@link ColourPickerWidget}
 * @see {@link prefsUiIconSize}
 * @see {@link prefsUiBaseFontSize}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import path from 'node:path';
import createJiti from 'jiti';

// Set React act environment flag
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Lightweight MockElement representation for headless React 19 testing in Node.js.
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
    return { width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100 };
  }
}

let doc: any;
let container: MockElement;
let root: Root | null = null;

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
    addEventListener: () => {},
    removeEventListener: () => {},
    document: doc,
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement
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

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
    '@main': path.resolve(process.cwd(), 'src/main')
  }
});
const { ColourPickerWidget } = jiti(
  '../../../src/renderer/workbench/widgets/ColourPickerWidget.tsx'
);
const { prefsUiIconSize, prefsUiBaseFontSize } = jiti(
  '../../../src/renderer/state/preferencesSignals.ts'
);

describe('Reusable ColourPickerWidget Component (Ticket #205)', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    teardownDom();
  });

  it('renders default ColourPickerWidget with solid preview box, hex input, surface, and strips', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#00ff00ff'
        })
      );
    });

    // 1. BasicWidget wrapper
    const widgetEls = findElementsByClass(container, 'colour-picker-widget');
    assert.equal(widgetEls.length, 1, 'ColourPickerWidget should render container with .colour-picker-widget');

    // 2. Full-Size Solid Preview Box matching surface dimensions (Opaque rgb(0, 255, 0))
    const previewBoxes = findElementsByClass(container, 'colour-picker-preview-box');
    assert.equal(previewBoxes.length, 1, 'Must render preview box');
    assert.equal(
      previewBoxes[0].style.backgroundColor,
      'rgb(0, 255, 0)',
      'Preview box must render pure opaque color without alpha'
    );
    assert.equal(previewBoxes[0].style.width, '100%');
    assert.equal(previewBoxes[0].style.height, '140px');
    assert.equal(previewBoxes[0].style.minHeight, '120px');

    // 3. Format Select
    const formatSelects = findElementsByClass(container, 'colour-picker-format-select');
    assert.equal(formatSelects.length, 1, 'Must render format selector dropdown');

    // 4. Hex input (default format)
    const hexInputs = findElementsByClass(container, 'colour-picker-hex-input');
    assert.equal(hexInputs.length, 1, 'Must render single hex text input');
    assert.equal(hexInputs[0].value, '#00ff00ff');

    // 5. 2D Surface and reticle
    const surfaces = findElementsByClass(container, 'colour-picker-surface');
    assert.equal(surfaces.length, 1, 'Must render 2D shade/tint surface');
    const reticles = findElementsByClass(container, 'colour-picker-reticle');
    assert.equal(reticles.length, 1, 'Must render surface reticle');

    // 6. Hue and Alpha strips
    const hueStrips = findElementsByClass(container, 'colour-picker-hue-strip');
    assert.equal(hueStrips.length, 1, 'Must render rainbow hue strip');
    const alphaStrips = findElementsByClass(container, 'colour-picker-alpha-strip');
    assert.equal(alphaStrips.length, 1, 'Must render alpha transparency strip');
  });

  it('handles format dropdown changes and switches to channel input mode', async () => {
    let lastColor = '';
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#ff0000ff',
          onChange: (c: string) => {
            lastColor = c;
          }
        })
      );
    });

    const formatSelects = findElementsByClass(container, 'colour-picker-format-select');
    assert.equal(formatSelects.length, 1);

    // Switch to RGB
    await act(async () => {
      formatSelects[0].value = 'RGB';
      formatSelects[0].dispatchEvent({
        type: 'change',
        bubbles: true
      });
    });

    // Verify 4 channel inputs: R, G, B, A
    const channelInputs = findElementsByClass(container, 'colour-picker-channel-input');
    assert.equal(channelInputs.length, 4, 'RGB format must render 4 channel inputs');
    assert.ok(lastColor.startsWith('rgb('), `Callback must return rgb format, got: ${lastColor}`);

    // Switch to HSL
    await act(async () => {
      formatSelects[0].value = 'HSL';
      formatSelects[0].dispatchEvent({
        type: 'change',
        bubbles: true
      });
    });

    const hslInputs = findElementsByClass(container, 'colour-picker-channel-input');
    assert.equal(hslInputs.length, 4, 'HSL format must render 4 channel inputs');
    assert.ok(lastColor.startsWith('hsl('), `Callback must return hsl format, got: ${lastColor}`);
  });

  it('updates color when channel input is modified', async () => {
    let emitted = '';
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: 'rgb(255 0 0)',
          format: 'RGB',
          onChange: (c: string) => {
            emitted = c;
          }
        })
      );
    });

    const blueInput = findElementsByClass(container, 'colour-picker-channel-b');
    assert.equal(blueInput.length, 1);

    // Update blue channel to 200
    await act(async () => {
      const tracker = (blueInput[0] as any)._valueTracker;
      if (tracker) tracker.setValue('0');
      blueInput[0].value = '200';
      blueInput[0].dispatchEvent({
        type: 'input',
        bubbles: true
      });
      blueInput[0].dispatchEvent({
        type: 'change',
        bubbles: true
      });
    });

    assert.ok(emitted.includes('200'), `Emitted color must reflect updated channel: ${emitted}`);
  });

  it('updates hue and alpha when interacting with strips', async () => {
    let latestColor = '';
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#ff0000ff',
          format: 'HEX',
          onChange: (c: string) => {
            latestColor = c;
          }
        })
      );
    });

    const hueStrip = findElementsByClass(container, 'colour-picker-hue-strip')[0];
    const alphaStrip = findElementsByClass(container, 'colour-picker-alpha-strip')[0];

    // Pointer down at 50% on hue strip (X = 100 on 200px width -> 180 deg hue = cyan)
    await act(async () => {
      hueStrip.dispatchEvent({
        type: 'pointerdown',
        button: 0,
        clientX: 100,
        pointerId: 1,
        currentTarget: hueStrip
      });
    });

    assert.ok(latestColor.length > 0);

    // Pointer down at 25% on alpha strip (X = 50 on 200px width -> alpha 0.25)
    await act(async () => {
      alphaStrip.dispatchEvent({
        type: 'pointerdown',
        button: 0,
        clientX: 50,
        pointerId: 2,
        currentTarget: alphaStrip
      });
    });

    assert.ok(latestColor.length === 9, 'Hex with alpha must be 9 chars (#rrggbbaa)');
  });

  it('updates saturation and value when interacting with 2D surface', async () => {
    let latestColor = '';
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#00ff00ff',
          format: 'HEX',
          onChange: (c: string) => {
            latestColor = c;
          }
        })
      );
    });

    const surface = findElementsByClass(container, 'colour-picker-surface')[0];

    // Pointer down at center (X=100, Y=50 on 200x100 rect -> S=50%, V=50%)
    await act(async () => {
      surface.dispatchEvent({
        type: 'pointerdown',
        button: 0,
        clientX: 100,
        clientY: 50,
        pointerId: 1,
        currentTarget: surface
      });
    });

    assert.ok(latestColor.length > 0);
    const reticle = findElementsByClass(container, 'colour-picker-reticle')[0];
    assert.equal(reticle.style.left, '50%');
    assert.equal(reticle.style.top, '50%');
  });

  it('respects showHeader={false} when embedded inside dialogs or other widgets', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          showHeader: false
        })
      );
    });

    const headers = findElementsByClass(container, 'basic-widget-header');
    assert.equal(headers.length, 0, 'Header bar should be hidden when showHeader=false');
  });

  it('verifies eyedropper fallback when unsupported and sampling when supported', async () => {
    // 1. Fallback when unsupported
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#00ff00ff'
        })
      );
    });

    let eyedropperBtn = findElementsByClass(container, 'colour-picker-eyedropper-btn')[0];
    assert.ok(eyedropperBtn.disabled, 'Eyedropper must be disabled when window.EyeDropper is not supported');
    assert.ok(
      eyedropperBtn.title.includes('not supported'),
      'Must display explanatory tooltip when EyeDropper is unsupported'
    );

    // 2. Supported when window.EyeDropper is present
    let sampledColor = '';
    (globalThis as any).window.EyeDropper = class {
      async open(): Promise<{ sRGBHex: string }> {
        return { sRGBHex: '#123456' };
      }
    };

    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#00ff00ff',
          onChange: (c: string) => {
            sampledColor = c;
          }
        })
      );
    });

    eyedropperBtn = findElementsByClass(container, 'colour-picker-eyedropper-btn')[0];
    assert.equal(eyedropperBtn.disabled, false, 'Eyedropper must be enabled when EyeDropper API is supported');

    await act(async () => {
      eyedropperBtn.dispatchEvent({
        type: 'click',
        bubbles: true
      });
    });

    assert.ok(sampledColor.includes('123456'), `Sampled color must be emitted: ${sampledColor}`);
    delete (globalThis as any).window.EyeDropper;
  });

  it('reorganizes vertical layout with full-size preview at top and controls at bottom (Ticket #208)', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#123456ff'
        })
      );
    });

    const pickerContainer = findElementsByClass(container, 'colour-picker-container')[0];
    assert.ok(pickerContainer, 'Must render .colour-picker-container');

    // Child elements in order
    const childNodes = pickerContainer.childNodes.filter((c: any) => c.nodeType === 1);
    assert.equal(childNodes.length, 4, 'Should contain 4 top-level sections: preview, surface, strips, controls');

    // Section 1: Preview box at the top
    assert.ok(
      childNodes[0].className.includes('colour-picker-preview-box'),
      'First child must be the full-size solid preview box'
    );
    assert.equal(childNodes[0].style.width, '100%');
    assert.equal(childNodes[0].style.height, '140px');

    // Section 2: 2D surface directly below preview box
    assert.ok(
      childNodes[1].className.includes('colour-picker-surface'),
      'Second child must be the 2D shade/tint surface'
    );

    // Section 3: Rainbow and alpha strips
    assert.ok(
      childNodes[2].className.includes('colour-picker-strips'),
      'Third child must be the colour-picker-strips container'
    );
    const hueStrips = findElementsByClass(childNodes[2], 'colour-picker-hue-strip');
    const alphaStrips = findElementsByClass(childNodes[2], 'colour-picker-alpha-strip');
    assert.equal(hueStrips.length, 1, 'Strips section must contain hue strip');
    assert.equal(alphaStrips.length, 1, 'Strips section must contain alpha strip');

    // Section 4: Bottom controls container
    assert.ok(
      childNodes[3].className.includes('colour-picker-bottom-controls'),
      'Fourth child must be the colour-picker-bottom-controls container'
    );
    const bottomRows = childNodes[3].childNodes.filter((c: any) => c.nodeType === 1);
    assert.equal(bottomRows.length, 2, 'Bottom controls must have 2 rows');

    // Row 1: Eyedropper + format select inline
    assert.ok(
      bottomRows[0].className.includes('colour-picker-format-row'),
      'First bottom row must be format row'
    );
    const eyedropperBtns = findElementsByClass(bottomRows[0], 'colour-picker-eyedropper-btn');
    const formatSelects = findElementsByClass(bottomRows[0], 'colour-picker-format-select');
    assert.equal(eyedropperBtns.length, 1, 'Format row must contain eyedropper button');
    assert.equal(formatSelects.length, 1, 'Format row must contain format dropdown');

    // Row 2: Inputs row
    assert.ok(
      bottomRows[1].className.includes('colour-picker-inputs-row'),
      'Second bottom row must be inputs row'
    );
    const hexInputs = findElementsByClass(bottomRows[1], 'colour-picker-hex-input');
    assert.equal(hexInputs.length, 1, 'Inputs row must contain text input(s)');
  });

  it('disables interactive controls, applies pointer-events none, and dims opacity when disabled=true (Ticket #216)', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#123456ff',
          disabled: true
        })
      );
    });

    const pickerContainer = findElementsByClass(container, 'colour-picker-container')[0];
    assert.ok(pickerContainer, 'Must render .colour-picker-container');
    assert.equal(pickerContainer.style.pointerEvents, 'none', 'Container must have pointerEvents none');
    assert.equal(pickerContainer.style.opacity, '0.55', 'Container must have dimmed opacity 0.55');

    // Format select is disabled
    const formatSelect = findElementsByClass(pickerContainer, 'colour-picker-format-select')[0];
    assert.ok(formatSelect, 'Must render format dropdown select');
    assert.equal(formatSelect.disabled, true, 'Format select must be disabled');

    // Eyedropper button is disabled
    const eyedropperBtn = findElementsByClass(pickerContainer, 'colour-picker-eyedropper-btn')[0];
    assert.ok(eyedropperBtn, 'Must render eyedropper button');
    assert.equal(eyedropperBtn.disabled, true, 'Eyedropper button must be disabled');

    // Hex input is disabled
    const hexInput = findElementsByClass(pickerContainer, 'colour-picker-hex-input')[0];
    assert.ok(hexInput, 'Must render hex text input');
    assert.equal(hexInput.disabled, true, 'Hex input must be disabled');

    // Rerender with RGB format to test channel inputs
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: 'rgb(255, 0, 0)',
          format: 'RGB',
          disabled: true
        })
      );
    });

    const channelInputs = findElementsByClass(container, 'colour-picker-channel-input');
    assert.ok(channelInputs.length >= 3, 'Must render RGB channel inputs');
    for (const input of channelInputs) {
      assert.equal(input.disabled, true, 'Channel input must be disabled');
    }
  });
});

describe('ColourPickerWidget UI Preferences & Typography Scaling (Ticket #229)', () => {
  beforeEach(() => {
    setupDom();
    prefsUiIconSize.value = 24;
    prefsUiBaseFontSize.value = 12;
  });

  afterEach(() => {
    teardownDom();
    prefsUiIconSize.value = undefined;
    prefsUiBaseFontSize.value = undefined;
  });

  it('sets format dropdown and HEX input font sizes to 1rem and reacts dynamically to prefsUiBaseFontSize', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#ff0000ff'
        })
      );
    });

    const formatSelect = findElementsByClass(container, 'colour-picker-format-select')[0];
    const hexInput = findElementsByClass(container, 'colour-picker-hex-input')[0];

    assert.ok(formatSelect, 'Must render format selector dropdown');
    assert.ok(hexInput, 'Must render HEX input');
    assert.equal(formatSelect.style.fontSize, '1rem', 'Format dropdown font size must be 1rem');
    assert.equal(hexInput.style.fontSize, '1rem', 'HEX input font size must be 1rem');

    // Dynamically update prefsUiBaseFontSize signal to 16pt
    await act(async () => {
      prefsUiBaseFontSize.value = 16;
    });

    assert.equal(formatSelect.style.fontSize, '1rem', 'Format dropdown retains 1rem relative font size');
    assert.equal(hexInput.style.fontSize, '1rem', 'HEX input retains 1rem relative font size');
  });

  it('sets channel number inputs to 1rem and channel labels to 0.9rem in non-HEX formats', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: 'rgb(255, 0, 0)',
          format: 'RGB'
        })
      );
    });

    const channelInputs = findElementsByClass(container, 'colour-picker-channel-input');
    assert.equal(channelInputs.length, 4, 'Must render 4 channel inputs for RGB format (R, G, B, A)');
    for (const input of channelInputs) {
      assert.equal(input.style.fontSize, '1rem', 'Channel input font size must be 1rem');
    }

    // Inspect label span elements (parent container of each channel input has a span child)
    for (const input of channelInputs) {
      const parent = input.parentNode;
      assert.ok(parent, 'Channel input must have a parent container');
      const labelSpan = parent.childNodes.find((c: any) => c.tagName === 'SPAN');
      assert.ok(labelSpan, 'Parent must contain label span');
      assert.equal(labelSpan.style.fontSize, '0.9rem', 'Channel label font size must be 0.9rem');
    }

    // Dynamically update prefsUiBaseFontSize signal
    await act(async () => {
      prefsUiBaseFontSize.value = 18;
    });

    for (const input of channelInputs) {
      assert.equal(input.style.fontSize, '1rem');
    }
  });

  it('scales eyedropper button and icon dimensions dynamically with prefsUiIconSize', async () => {
    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#00ff00ff'
        })
      );
    });

    const eyedropperBtn = findElementsByClass(container, 'colour-picker-eyedropper-btn')[0];
    assert.ok(eyedropperBtn, 'Must render eyedropper button');
    assert.equal(eyedropperBtn.style.width, '24px', 'Initial eyedropper button width must match iconSize=24');
    assert.equal(eyedropperBtn.style.height, '24px', 'Initial eyedropper button height must match iconSize=24');

    const iconSvg = eyedropperBtn.childNodes.find((c: any) => c.tagName?.toUpperCase() === 'SVG');
    assert.ok(iconSvg, 'Eyedropper button must contain SVG icon');
    assert.equal(iconSvg.style.width, '24px', 'SVG icon width must match iconSize=24');
    assert.equal(iconSvg.style.height, '24px', 'SVG icon height must match iconSize=24');

    // Dynamically update prefsUiIconSize to 32px
    await act(async () => {
      prefsUiIconSize.value = 32;
    });

    assert.equal(eyedropperBtn.style.width, '32px', 'Eyedropper button width must scale to 32px');
    assert.equal(eyedropperBtn.style.height, '32px', 'Eyedropper button height must scale to 32px');
    assert.equal(iconSvg.style.width, '32px', 'SVG icon width must scale to 32px');
    assert.equal(iconSvg.style.height, '32px', 'SVG icon height must scale to 32px');

    // Dynamically update prefsUiIconSize to 18px
    await act(async () => {
      prefsUiIconSize.value = 18;
    });

    assert.equal(eyedropperBtn.style.width, '18px', 'Eyedropper button width must scale to 18px');
    assert.equal(eyedropperBtn.style.height, '18px', 'Eyedropper button height must scale to 18px');
    assert.equal(iconSvg.style.width, '18px', 'SVG icon width must scale to 18px');
    assert.equal(iconSvg.style.height, '18px', 'SVG icon height must scale to 18px');
  });

  it('maintains proper flex layout and alignment across rows when preferences vary', async () => {
    prefsUiIconSize.value = 30;
    prefsUiBaseFontSize.value = 14;

    await act(async () => {
      root?.render(
        React.createElement(ColourPickerWidget, {
          initialColor: '#123456ff',
          format: 'RGB'
        })
      );
    });

    const formatRow = findElementsByClass(container, 'colour-picker-format-row')[0];
    assert.ok(formatRow, 'Format row must be rendered');
    assert.equal(formatRow.style.gap, '6px', 'Format row gap must be 6px');

    const inputsRow = findElementsByClass(container, 'colour-picker-inputs-row')[0];
    assert.ok(inputsRow, 'Inputs row must be rendered');
    assert.equal(inputsRow.style.gap, '4px', 'Inputs row gap must be 4px');

    const channelInputs = findElementsByClass(inputsRow, 'colour-picker-channel-input');
    assert.equal(channelInputs.length, 4, 'Must render 4 channels without clipping');
  });
});
