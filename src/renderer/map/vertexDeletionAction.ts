/**
 * @file vertexDeletionAction.ts
 * @module renderer/map/vertexDeletionAction
 * @description Orchestrates `delete_selection` in Vertex Editor Mode: {@link deleteSelectedVerticesAction} takes the vertex selection and the valid Active Layer's {@link VertexEditTarget} from the renderer state, commits the deletion through {@link commitVertexDeletion} (staging the edits over the Electron bridge), then updates the selection, Attribute Table rows and dirty state. Kept beside the pure commit logic in vertexEditing so the signal store does not own vertex editing; {@link deleteSelectionAction} dispatches here.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link commitVertexDeletion}
 * @see {@link deleteSelectionAction}
 */

import { batch } from "@preact/signals-react";
import { logging } from "../../shared/logging";
import {
  activeMapControllerSignal,
  dirtyLayerIdsSignal,
  editedFeatureIdsSignal,
  featuresSignal,
  isProjectDirtySignal,
  selectedFeatureIdsSignal,
  selectedVertexKeysSignal,
} from "../state/gisSignals";
import { commitVertexDeletion } from "./vertexEditing";

/**
 * @function deleteSelectedVerticesAction
 * @description Deletes the selected vertices of the valid Active Layer as one atomic edit ({@link commitVertexDeletion}): parts left with too few vertices are removed and features left with none are deleted, the source is updated and every affected feature is staged with one `stageFeatureEdits` call. Then clears the vertex selection, drops deleted features from the feature selection and the Attribute Table rows, and marks the features edited and the layer and project dirty. No undo entry is recorded (Undo/Redo are still stubs).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @returns {void}
 */
export function deleteSelectedVerticesAction(): void {
  const keys = selectedVertexKeysSignal.value;
  if (keys.size === 0) return;
  const target = activeMapControllerSignal.value?.getVertexEditTarget?.();
  if (!target) return;
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;
  const commit = commitVertexDeletion({
    source: target.source,
    keys,
    projections: target,
    stage: (edits) => {
      api
        ?.stageFeatureEdits?.(target.layerId, edits)
        ?.catch?.((err: unknown) =>
          logging.error("Failed to stage vertex deletion", err, {
            scope: "vertexDeletionAction",
            layerId: target.layerId,
          })
        );
    },
  });
  batch(() => {
    selectedVertexKeysSignal.value = new Set();
    if (!commit) return;
    const deleted = new Set(commit.deletedIds);
    if (deleted.size > 0) {
      const selected = selectedFeatureIdsSignal.value;
      if ([...selected].some((id) => deleted.has(id))) {
        selectedFeatureIdsSignal.value = new Set(
          [...selected].filter((id) => !deleted.has(id))
        );
      }
      featuresSignal.value = featuresSignal.value.filter(
        (f) => f.layerId !== target.layerId || !deleted.has(f.id)
      );
    }
    editedFeatureIdsSignal.value = new Set([
      ...editedFeatureIdsSignal.value,
      ...commit.changedIds,
      ...commit.deletedIds,
    ]);
    dirtyLayerIdsSignal.value = new Set([
      ...dirtyLayerIdsSignal.value,
      target.layerId,
    ]);
    isProjectDirtySignal.value = true;
  });
}
