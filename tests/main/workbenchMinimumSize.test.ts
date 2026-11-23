/**
 * @file workbenchMinimumSize.test.ts
 * @module tests/main/workbenchMinimumSize.test
 * @description Unit tests for applying the renderer-computed Workbench window minimum size: input validation, setting the minimum, and growing a window smaller than it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link applyWorkbenchMinimumSize}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyWorkbenchMinimumSize,
  sanitizeMinimumSize,
  type MinimumSizeWindow,
} from "../../src/main/workbenchMinimumSize";

/**
 * Builds a fake window that records calls.
 * @param {number} width - Current width.
 * @param {number} height - Current height.
 * @param {boolean} [maximized=false] - Whether it is maximized.
 * @returns {{ win: MinimumSizeWindow; calls: string[] }} The fake window and its call log.
 */
function fakeWindow(
  width: number,
  height: number,
  maximized = false
): { win: MinimumSizeWindow; calls: string[] } {
  const calls: string[] = [];
  const win: MinimumSizeWindow = {
    isDestroyed: () => false,
    isMaximized: () => maximized,
    isFullScreen: () => false,
    getSize: () => [width, height],
    setSize: (w, h) => calls.push(`setSize ${w}x${h}`),
    setMinimumSize: (w, h) => calls.push(`setMinimumSize ${w}x${h}`),
  };
  return { win, calls };
}

describe("sanitizeMinimumSize", () => {
  it("rounds up and caps valid sizes", () => {
    assert.deepEqual(sanitizeMinimumSize({ width: 829.2, height: 99999 }), {
      width: 830,
      height: 16384,
    });
  });

  it("rejects missing, non-finite and non-positive values", () => {
    assert.equal(sanitizeMinimumSize(null), null);
    assert.equal(sanitizeMinimumSize({ width: "800", height: 600 }), null);
    assert.equal(sanitizeMinimumSize({ width: Infinity, height: 600 }), null);
    assert.equal(sanitizeMinimumSize({ width: 0, height: 600 }), null);
  });
});

describe("applyWorkbenchMinimumSize", () => {
  it("sets the minimum without resizing a larger window", () => {
    const { win, calls } = fakeWindow(1400, 900);
    assert.equal(
      applyWorkbenchMinimumSize(win, { width: 800, height: 600 }),
      true
    );
    assert.deepEqual(calls, ["setMinimumSize 800x600"]);
  });

  it("grows a window smaller than the new minimum", () => {
    const { win, calls } = fakeWindow(700, 900);
    applyWorkbenchMinimumSize(win, { width: 800, height: 600 });
    assert.deepEqual(calls, ["setMinimumSize 800x600", "setSize 800x900"]);
  });

  it("does not resize a maximized window", () => {
    const { win, calls } = fakeWindow(700, 500, true);
    applyWorkbenchMinimumSize(win, { width: 800, height: 600 });
    assert.deepEqual(calls, ["setMinimumSize 800x600"]);
  });

  it("ignores invalid sizes and missing windows", () => {
    const { win, calls } = fakeWindow(700, 500);
    assert.equal(
      applyWorkbenchMinimumSize(win, { width: -1, height: 600 }),
      false
    );
    assert.equal(
      applyWorkbenchMinimumSize(null, { width: 800, height: 600 }),
      false
    );
    assert.deepEqual(calls, []);
  });
});
