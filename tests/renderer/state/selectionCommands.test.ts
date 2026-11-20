/**
 * @file selectionCommands.test.ts
 * @module tests/renderer/state/selectionCommands.test
 * @description Tests for the shared selection command predicates used by the Edit menu, toolbars and shortcut dispatch: Cut needs selected features in Layer Edit Mode, Copy needs selected features, both are disabled while the Selection Target is vertices (Ticket #382); Delete and the selected item count follow the current Selection Target; the state snapshot reads the signals.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link isCutSelectionEnabled}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isCopySelectionEnabled,
  isCutSelectionEnabled,
  isDeleteSelectionEnabled,
  readSelectionCommandState,
  selectedItemCount,
  type SelectionCommandState,
} from "../../../src/renderer/state/selectionCommands";
import {
  activeLayerIdSignal,
  editableLayerIdsSignal,
  selectedFeatureIdsSignal,
  selectedVertexKeysSignal,
  vertexEditorModeSignal,
} from "../../../src/renderer/state/gisSignals";

/**
 * @function state
 * @description Builds a selection command state with defaults (features, not editing, nothing selected).
 * @param {Partial<SelectionCommandState>} overrides - Fields to set.
 * @returns {SelectionCommandState} State.
 */
function state(
  overrides: Partial<SelectionCommandState> = {}
): SelectionCommandState {
  return {
    selectionTarget: "features",
    inEditMode: false,
    selectedFeatureCount: 0,
    selectedVertexCount: 0,
    ...overrides,
  };
}

describe("selection command predicates", () => {
  it("enables Cut only with selected features in Layer Edit Mode", () => {
    assert.equal(
      isCutSelectionEnabled(state({ selectedFeatureCount: 3 })),
      false
    );
    assert.equal(isCutSelectionEnabled(state({ inEditMode: true })), false);
    assert.equal(
      isCutSelectionEnabled(
        state({ inEditMode: true, selectedFeatureCount: 2 })
      ),
      true
    );
  });

  it("enables Copy only with selected features", () => {
    assert.equal(isCopySelectionEnabled(state()), false);
    assert.equal(
      isCopySelectionEnabled(state({ selectedFeatureCount: 1 })),
      true
    );
  });

  it("disables Cut and Copy while the Selection Target is vertices", () => {
    const vertices = state({
      selectionTarget: "vertices",
      inEditMode: true,
      selectedFeatureCount: 2,
      selectedVertexCount: 4,
    });
    assert.equal(isCutSelectionEnabled(vertices), false);
    assert.equal(isCopySelectionEnabled(vertices), false);
  });

  it("enables Delete and counts items for the current Selection Target", () => {
    assert.equal(
      isDeleteSelectionEnabled(state({ selectedFeatureCount: 1 })),
      true
    );
    assert.equal(
      isDeleteSelectionEnabled(state({ selectedVertexCount: 1 })),
      false
    );
    const vertices = state({
      selectionTarget: "vertices",
      selectedFeatureCount: 5,
    });
    assert.equal(isDeleteSelectionEnabled(vertices), false);
    assert.equal(selectedItemCount({ ...vertices, selectedVertexCount: 2 }), 2);
    assert.equal(selectedItemCount(state({ selectedFeatureCount: 3 })), 3);
  });
});

describe("readSelectionCommandState", () => {
  afterEach(() => {
    vertexEditorModeSignal.value = false;
    activeLayerIdSignal.value = null;
    editableLayerIdsSignal.value = new Set();
    selectedFeatureIdsSignal.value = new Set();
    selectedVertexKeysSignal.value = new Set();
  });

  it("snapshots the Selection Target, Layer Edit Mode and selection sizes", () => {
    activeLayerIdSignal.value = "layer-a";
    editableLayerIdsSignal.value = new Set(["layer-a"]);
    selectedFeatureIdsSignal.value = new Set([1, 2]);
    vertexEditorModeSignal.value = true;
    selectedVertexKeysSignal.value = new Set(["k"]);
    assert.deepEqual(readSelectionCommandState(), {
      selectionTarget: "vertices",
      inEditMode: true,
      selectedFeatureCount: 2,
      selectedVertexCount: 1,
    });
  });
});
