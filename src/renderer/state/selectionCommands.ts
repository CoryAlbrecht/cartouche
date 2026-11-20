/**
 * @file selectionCommands.ts
 * @module renderer/state/selectionCommands
 * @description The one place that decides whether the selection commands (Cut, Copy, Delete, Deselect All) are available, shared by the Edit menu, the toolbars and shortcut dispatch so they always agree. Each predicate takes a {@link SelectionCommandState} snapshot; {@link readSelectionCommandState} builds it from the signals (reading `.value`, so a rendering component re-renders when it changes). Cut and Copy work on features only: while the Selection Target is `vertices` (Vertex Editor Mode) they are unavailable, since vertices have no paste position (as in Inkscape and Illustrator). Delete and Deselect All act on the current Selection Target's selection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link selectionTargetSignal}
 * @see {@link selectedVertexKeysSignal}
 */

import {
  activeLayerIdSignal,
  editableLayerIdsSignal,
  isLayerInEditMode,
  selectedFeatureIdsSignal,
  selectedVertexKeysSignal,
  selectionTargetSignal,
  type SelectionTarget,
} from "./gisSignals";

/**
 * @typedef {Object} SelectionCommandState
 * @description What the selection command predicates depend on.
 * @property {SelectionTarget} selectionTarget - The current Selection Target.
 * @property {boolean} inEditMode - Whether the Active Layer is in Layer Edit Mode.
 * @property {number} selectedFeatureCount - Number of selected features.
 * @property {number} selectedVertexCount - Number of selected vertices.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface SelectionCommandState {
  selectionTarget: SelectionTarget;
  inEditMode: boolean;
  selectedFeatureCount: number;
  selectedVertexCount: number;
}

/**
 * @function readSelectionCommandState
 * @description Snapshots the selection command state from the signals. Reads `.value`, so a component calling it during render subscribes to every input.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @returns {SelectionCommandState} The current state.
 */
export function readSelectionCommandState(): SelectionCommandState {
  return {
    selectionTarget: selectionTargetSignal.value,
    inEditMode: isLayerInEditMode(
      activeLayerIdSignal.value,
      editableLayerIdsSignal.value
    ),
    selectedFeatureCount: selectedFeatureIdsSignal.value.size,
    selectedVertexCount: selectedVertexKeysSignal.value.size,
  };
}

/**
 * @function selectedItemCount
 * @description How many items of the current Selection Target are selected (vertices in Vertex Editor Mode, otherwise features).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectionCommandState} state - Selection command state.
 * @returns {number} Selected item count.
 */
export function selectedItemCount(state: SelectionCommandState): number {
  return state.selectionTarget === "vertices" ?
      state.selectedVertexCount
    : state.selectedFeatureCount;
}

/**
 * @function isCutSelectionEnabled
 * @description Whether Cut (`cut_selection`) is available: features are selected on a layer in Layer Edit Mode, and the Selection Target is features.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectionCommandState} state - Selection command state.
 * @returns {boolean} True when Cut is enabled.
 */
export function isCutSelectionEnabled(state: SelectionCommandState): boolean {
  return (
    state.selectionTarget === "features"
    && state.inEditMode
    && state.selectedFeatureCount > 0
  );
}

/**
 * @function isCopySelectionEnabled
 * @description Whether Copy (`copy_selection`) is available: features are selected and the Selection Target is features.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectionCommandState} state - Selection command state.
 * @returns {boolean} True when Copy is enabled.
 */
export function isCopySelectionEnabled(state: SelectionCommandState): boolean {
  return state.selectionTarget === "features" && state.selectedFeatureCount > 0;
}

/**
 * @function isDeleteSelectionEnabled
 * @description Whether Delete (`delete_selection`) is available: something of the current Selection Target is selected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectionCommandState} state - Selection command state.
 * @returns {boolean} True when Delete is enabled.
 */
export function isDeleteSelectionEnabled(
  state: SelectionCommandState
): boolean {
  return selectedItemCount(state) > 0;
}
