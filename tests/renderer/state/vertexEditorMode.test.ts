/**
 * @file vertexEditorMode.test.ts
 * @module tests/renderer/state/vertexEditorMode.test
 * @description Unit tests for the Vertex Editor Mode toggle (Ticket #377): toggling with the `vertex_editor` action independently of the active map tool, gating on the Active Layer's Layer Edit Mode, the derived Selection Target, and per-layer Ephemeral Layer Toolbar State.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link vertexEditorModeSignal}
 * @see {@link selectionTargetSignal}
 * @see {@link vertexEditorAction}
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  activeLayerIdSignal,
  activeToolSignal,
  editableLayerIdsSignal,
  selectionTargetSignal,
  toggleLayerEditingAction,
  vertexEditorAction,
  vertexEditorModeSignal,
} from "../../../src/renderer/state/gisSignals";
import {
  getLayerToolbarPreference,
  setLayerToolbarPreference,
  resetLayerToolbarMemoryState,
} from "../../../src/renderer/state/layerToolbarMemory";
import { preferencesMapSignal } from "../../../src/renderer/state/preferencesSignals";

describe("Vertex Editor Mode (Ticket #377)", () => {
  beforeEach(() => {
    activeLayerIdSignal.value = null;
    activeToolSignal.value = "pan";
    editableLayerIdsSignal.value = new Set();
    vertexEditorModeSignal.value = false;
    preferencesMapSignal.value = {};
    resetLayerToolbarMemoryState();
  });

  it("vertex_editor toggles Vertex Editor Mode without changing the active tool", () => {
    activeLayerIdSignal.value = "layer-a";
    editableLayerIdsSignal.value = new Set(["layer-a"]);
    activeToolSignal.value = "select_rectangle";

    vertexEditorAction();
    assert.equal(vertexEditorModeSignal.value, true);
    assert.equal(activeToolSignal.value, "select_rectangle");

    vertexEditorAction();
    assert.equal(vertexEditorModeSignal.value, false);
    assert.equal(activeToolSignal.value, "select_rectangle");
  });

  it("vertex_editor does nothing when the Active Layer is not in Layer Edit Mode", () => {
    activeLayerIdSignal.value = "layer-a";

    vertexEditorAction();
    assert.equal(vertexEditorModeSignal.value, false);

    activeLayerIdSignal.value = null;
    vertexEditorAction();
    assert.equal(vertexEditorModeSignal.value, false);
  });

  it("turning Layer Edit Mode off turns Vertex Editor Mode off", () => {
    activeLayerIdSignal.value = "layer-a";
    editableLayerIdsSignal.value = new Set(["layer-a"]);
    vertexEditorAction();
    assert.equal(vertexEditorModeSignal.value, true);

    toggleLayerEditingAction("layer-a");
    assert.equal(editableLayerIdsSignal.value.has("layer-a"), false);
    assert.equal(vertexEditorModeSignal.value, false);
  });

  it("Layer Edit Mode leaving by any route turns Vertex Editor Mode off", () => {
    activeLayerIdSignal.value = "layer-a";
    editableLayerIdsSignal.value = new Set(["layer-a"]);
    vertexEditorAction();

    editableLayerIdsSignal.value = new Set();
    assert.equal(vertexEditorModeSignal.value, false);
  });

  it("Selection Target is vertices exactly when Vertex Editor Mode is on", () => {
    vertexEditorModeSignal.value = false;
    assert.equal(selectionTargetSignal.value, "features");

    vertexEditorModeSignal.value = true;
    assert.equal(selectionTargetSignal.value, "vertices");

    vertexEditorModeSignal.value = false;
    assert.equal(selectionTargetSignal.value, "features");
  });

  it("switching Active Layer stores and restores the toggle per layer", () => {
    editableLayerIdsSignal.value = new Set(["layer-a", "layer-b"]);

    activeLayerIdSignal.value = "layer-a";
    vertexEditorAction();
    assert.equal(vertexEditorModeSignal.value, true);

    activeLayerIdSignal.value = "layer-b";
    assert.equal(
      getLayerToolbarPreference("layer-a", "vertexEditorMode"),
      true
    );
    assert.equal(
      vertexEditorModeSignal.value,
      false,
      "layer-b has no stored Vertex Editor Mode"
    );

    activeLayerIdSignal.value = "layer-a";
    assert.equal(vertexEditorModeSignal.value, true);

    activeLayerIdSignal.value = "layer-b";
    assert.equal(vertexEditorModeSignal.value, false);
  });

  it("switching to a layer not in Layer Edit Mode turns Vertex Editor Mode off", () => {
    editableLayerIdsSignal.value = new Set(["layer-a"]);
    activeLayerIdSignal.value = "layer-a";
    vertexEditorAction();

    activeLayerIdSignal.value = "layer-c";
    assert.equal(vertexEditorModeSignal.value, false);

    activeLayerIdSignal.value = null;
    assert.equal(vertexEditorModeSignal.value, false);
  });

  it("leaving Layer Edit Mode on an inactive layer discards its stored toggle", () => {
    editableLayerIdsSignal.value = new Set(["layer-a"]);
    activeLayerIdSignal.value = "layer-a";
    vertexEditorAction();
    activeLayerIdSignal.value = "layer-b";

    toggleLayerEditingAction("layer-a");
    toggleLayerEditingAction("layer-a");
    activeLayerIdSignal.value = "layer-a";

    assert.equal(vertexEditorModeSignal.value, false);
  });

  it("a tool stored as vertex_editor by an older build restores as pan", () => {
    editableLayerIdsSignal.value = new Set(["layer-a"]);
    setLayerToolbarPreference("layer-a", "digitizingTool", "vertex_editor");

    activeLayerIdSignal.value = "layer-a";
    assert.equal(activeToolSignal.value, "pan");

    toggleLayerEditingAction("layer-a");
    toggleLayerEditingAction("layer-a");
    assert.equal(activeToolSignal.value, "pan");
  });
});
