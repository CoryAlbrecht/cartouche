/**
 * @file PlainNumberSpinner.test.ts
 * @module tests/renderer/components/PlainNumberSpinner.test
 * @description Tests for the Plain Number spinner used for From and To when the Time Reckoning is Plain Number (#397): one number field showing bare numbers, decimals allowed, typed text saved after a pause or on Enter, Escape restoring, arrows stepping by Step, and every value kept within ±Number.MAX_SAFE_INTEGER.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link PlainNumberSpinner}
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRendererJiti } from "../rendererJiti";
import {
  installMockDom,
  teardownMockDom,
  findElementsByClass,
  type MockDom,
  type MockElement,
} from "../mockDom";

const jiti = createRendererJiti(import.meta.url);
const { PlainNumberSpinner } = jiti(
  "@renderer/components/common/PlainNumberSpinner.tsx"
);

describe("PlainNumberSpinner (Ticket #397)", () => {
  let dom: MockDom | null = null;
  let emitted: number[];

  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    dom = installMockDom();
    emitted = [];
  });

  afterEach(() => {
    teardownMockDom(dom);
    dom = null;
    mock.timers.reset();
  });

  /** @description Renders the spinner at `value` with `step`. */
  function renderAt(value: number, step = 1): MockElement {
    act(() => {
      dom!.root.render(
        React.createElement(PlainNumberSpinner, {
          value,
          step,
          ariaLabel: "From",
          onChange: (v: number) => emitted.push(v),
        })
      );
    });
    const [input] = findElementsByClass(
      dom!.container,
      "plain-number-spinner-input"
    );
    assert.ok(input, "renders the number field");
    // React's input-event polyfill watches the focused input; key events need it to be focused.
    Object.assign(input, { select: () => {} });
    act(() => {
      input.focus();
      input.dispatchEvent({ type: "focusin", bubbles: true });
    });
    return input;
  }

  /** @description Dispatches a keydown inside act. */
  function press(el: MockElement, key: string): void {
    act(() => {
      el.dispatchEvent({
        type: "keydown",
        key,
        bubbles: true,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    });
  }

  it("shows the bare number", () => {
    assert.equal(renderAt(-12.5).value, "-12.5");
  });

  it("holds typed text, decimals and sign included, and saves it after a 1000 ms pause", () => {
    const input = renderAt(0);
    for (const ch of "-3.25") press(input, ch);
    assert.equal(input.value, "-3.25");
    assert.equal(emitted.length, 0);
    act(() => {
      mock.timers.tick(1000);
    });
    assert.deepEqual(emitted, [-3.25]);
  });

  it("Enter saves at once; Escape throws typed text away", () => {
    const input = renderAt(7);
    press(input, "4");
    press(input, "2");
    press(input, "Escape");
    assert.equal(input.value, "7");
    press(input, "9");
    press(input, "Enter");
    assert.deepEqual(emitted, [9]);
  });

  it("arrows step by Step", () => {
    const input = renderAt(10, 0.5);
    press(input, "ArrowUp");
    press(input, "ArrowDown");
    assert.deepEqual(emitted, [10.5, 9.5]);
  });

  it("keeps values within ±Number.MAX_SAFE_INTEGER", () => {
    const input = renderAt(Number.MAX_SAFE_INTEGER);
    press(input, "ArrowUp");
    assert.deepEqual(emitted, [Number.MAX_SAFE_INTEGER]);
    for (const ch of "-99999999999999999999") press(input, ch);
    press(input, "Enter");
    assert.equal(emitted.at(-1), -Number.MAX_SAFE_INTEGER);
  });
});
