/**
 * @file selectionShapeCancel.test.ts
 * @module tests/renderer/map/selectionShapeCancel.test
 * @description Tests for the Selection Shape cancel registry that lets Escape abandon a rectangle or lasso drag in progress before the global cancel_action runs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link cancelSelectionShape}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  beginSelectionShape,
  cancelSelectionShape,
} from "../../../src/renderer/map/selectionShapeCancel";

describe("Selection Shape cancel registry", () => {
  it("reports no shape when none is in progress", () => {
    assert.equal(cancelSelectionShape(), false);
  });

  it("cancels the shape in progress once", () => {
    let cancelled = 0;
    beginSelectionShape(() => cancelled++);
    assert.equal(cancelSelectionShape(), true);
    assert.equal(cancelled, 1);
    assert.equal(cancelSelectionShape(), false, "already abandoned");
  });

  it("forgets a shape that ended normally", () => {
    let cancelled = 0;
    const end = beginSelectionShape(() => cancelled++);
    end();
    assert.equal(cancelSelectionShape(), false);
    assert.equal(cancelled, 0);
  });

  it("does not let a stale end forget a newer shape", () => {
    const endOld = beginSelectionShape(() => {});
    let cancelled = 0;
    beginSelectionShape(() => cancelled++);
    endOld();
    assert.equal(cancelSelectionShape(), true);
    assert.equal(cancelled, 1);
  });
});
