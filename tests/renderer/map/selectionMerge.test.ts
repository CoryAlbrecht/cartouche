/**
 * @file selectionMerge.test.ts
 * @module tests/renderer/map/selectionMerge.test
 * @description Tests for the shared selection merge used by every Selection Tool: a plain gesture replaces the selection (or clears it when nothing was hit), Shift adds the hits, Ctrl toggles each hit, and a modified gesture that hits nothing leaves the selection unchanged.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link mergeSelection}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeSelection,
  readSelectionModifiers,
  resolveSelectionMergeMode,
} from "../../../src/renderer/map/selectionMerge";

const NONE = { shift: false, ctrl: false };
const SHIFT = { shift: true, ctrl: false };
const CTRL = { shift: false, ctrl: true };

/**
 * @function sorted
 * @description Lists a set's members in ascending order for comparison.
 * @param {ReadonlySet<number>} set - Selection set.
 * @returns {number[]} Sorted members.
 */
function sorted(set: ReadonlySet<number>): number[] {
  return [...set].sort((a, b) => a - b);
}

describe("mergeSelection", () => {
  it("no modifier with hits replaces the selection with the hits", () => {
    assert.deepEqual(sorted(mergeSelection(new Set([1, 2]), [3], NONE)), [3]);
  });

  it("no modifier with no hits clears the selection", () => {
    assert.deepEqual(sorted(mergeSelection(new Set([1, 2]), [], NONE)), []);
  });

  it("Shift with hits adds them to the selection", () => {
    assert.deepEqual(
      sorted(mergeSelection(new Set([1, 2]), [2, 3], SHIFT)),
      [1, 2, 3]
    );
  });

  it("Shift with no hits leaves the selection unchanged", () => {
    const current = new Set([1, 2]);
    assert.equal(mergeSelection(current, [], SHIFT), current);
  });

  it("Ctrl with hits toggles each hit", () => {
    assert.deepEqual(
      sorted(mergeSelection(new Set([1, 2]), [2, 3], CTRL)),
      [1, 3]
    );
  });

  it("Ctrl with no hits leaves the selection unchanged", () => {
    const current = new Set([1, 2]);
    assert.equal(mergeSelection(current, [], CTRL), current);
  });

  it("never mutates the current selection", () => {
    const current = new Set([1, 2]);
    mergeSelection(current, [3], SHIFT);
    mergeSelection(current, [1], CTRL);
    mergeSelection(current, [9], NONE);
    assert.deepEqual(sorted(current), [1, 2]);
  });
});

describe("resolveSelectionMergeMode", () => {
  it("maps the modifiers to replace, add and toggle; Ctrl wins over Shift", () => {
    assert.equal(resolveSelectionMergeMode(NONE), "replace");
    assert.equal(resolveSelectionMergeMode(SHIFT), "add");
    assert.equal(resolveSelectionMergeMode(CTRL), "toggle");
    assert.equal(
      resolveSelectionMergeMode({ shift: true, ctrl: true }),
      "toggle"
    );
  });
});

describe("readSelectionModifiers", () => {
  it("reads Shift and Ctrl from a pointer or keyboard event", () => {
    assert.deepEqual(
      readSelectionModifiers({ shiftKey: true, ctrlKey: false }),
      SHIFT
    );
    assert.deepEqual(
      readSelectionModifiers({ shiftKey: false, ctrlKey: true }),
      CTRL
    );
    assert.deepEqual(readSelectionModifiers(undefined), NONE);
  });
});
