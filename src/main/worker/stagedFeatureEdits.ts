/**
 * @file stagedFeatureEdits.ts
 * @module main/worker/stagedFeatureEdits
 * @description The one merge rule for staging an uncommitted feature edit into a layer's edit cache, shared by Main's crash-resilient cache ({@link GeospatialService}) and the Geospatial Worker's ({@link GeospatialEngine}) so both stay identical: an edit to a newly added feature updates it (a deletion forgets it), an edit to an existing feature merges into its staged modification (a deletion marks it `deleted`, so queries leave it out).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link StagedFeatureEdit}
 */

import type {
  LayerEditCacheEntry,
  StagedFeatureEdit,
} from "../../shared/types/project";

/**
 * @function mergeStagedFeatureEdit
 * @description Merges one staged edit into a layer's edit cache entry (mutating it). Properties merge key by key with earlier edits; geometry and flags are replaced. A `deleted` edit removes a newly added feature from `addedFeatures`, and marks an existing feature's modification as deleted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {LayerEditCacheEntry} entry - The layer's edit cache entry.
 * @param {StagedFeatureEdit} edit - The edit to stage.
 * @returns {void}
 */
export function mergeStagedFeatureEdit(
  entry: LayerEditCacheEntry,
  edit: StagedFeatureEdit
): void {
  const idKey = String(edit.id);
  const existingAddedIdx = entry.addedFeatures.findIndex(
    (f) => String(f.id) === idKey
  );

  if (edit.isNew || existingAddedIdx !== -1) {
    if (edit.deleted) {
      if (existingAddedIdx !== -1)
        entry.addedFeatures.splice(existingAddedIdx, 1);
      return;
    }
    if (existingAddedIdx !== -1) {
      const prev = entry.addedFeatures[existingAddedIdx];
      entry.addedFeatures[existingAddedIdx] = {
        ...prev,
        ...edit,
        isNew: true,
        properties: { ...prev.properties, ...edit.properties },
      };
    } else {
      entry.addedFeatures.push({
        ...edit,
        isNew: true,
        properties: { ...edit.properties },
      });
    }
    return;
  }

  const prevMod = entry.modifiedFeatures.get(idKey);
  entry.modifiedFeatures.set(idKey, {
    ...prevMod,
    ...edit,
    id: edit.id,
    properties: { ...prevMod?.properties, ...edit.properties },
  });
}
