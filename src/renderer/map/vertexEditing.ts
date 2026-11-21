/**
 * @file vertexEditing.ts
 * @module renderer/map/vertexEditing
 * @description Commits a vertex deletion in Vertex Editor Mode as one atomic edit: plans it with {@link planVertexDeletion}, replaces the changed geometries and removes the emptied features in the Active Layer's OpenLayers source, and hands every affected feature to the edit cache in a single staging call (`stageFeatureEdits`), geometry as ISO WKB in the layer's data CRS and deletions flagged `deleted`. One call per deletion is what lets a future undo history record it as one step; nothing is pushed to an undo stack here.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link planVertexDeletion}
 * @see {@link StagedFeatureEdit}
 */

import type VectorSource from "ol/source/Vector.js";
import type { Geometry } from "ol/geom.js";
import WKB from "ol/format/WKB.js";
import type { StagedFeatureEdit } from "@shared/types";
import { planVertexDeletion, type VertexDeletionPlan } from "./vertexDeletion";
import type { VertexKey } from "./vertexSelection";

/**
 * @typedef {Object} VertexEditProjections
 * @description The CRS a layer's features are stored in and the CRS they are drawn in.
 * @property {string} dataProjection - Layer data CRS (staged geometry is written in it).
 * @property {string} featureProjection - Display CRS of the features in the source.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface VertexEditProjections {
  dataProjection: string;
  featureProjection: string;
}

/**
 * @typedef {Object} VertexEditTarget
 * @description The valid Active Layer as a vertex edit sees it: its id, OpenLayers source (features in the display CRS) and data/display CRS pair.
 * @property {string} layerId - Active Layer id.
 * @property {VectorSource} source - The layer's OpenLayers vector source.
 * @property {string} dataProjection - Layer data CRS.
 * @property {string} featureProjection - Display CRS.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface VertexEditTarget extends VertexEditProjections {
  layerId: string;
  source: VectorSource;
}

/**
 * @typedef {Object} VertexDeletionCommit
 * @description What a committed vertex deletion changed.
 * @property {StagedFeatureEdit[]} edits - The edits staged in the single call.
 * @property {Array<string | number>} changedIds - Ids of features whose geometry changed.
 * @property {Array<string | number>} deletedIds - Ids of features deleted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface VertexDeletionCommit {
  edits: StagedFeatureEdit[];
  changedIds: Array<string | number>;
  deletedIds: Array<string | number>;
}

/**
 * @typedef {Object} VertexDeletionRequest
 * @description Inputs of {@link commitVertexDeletion}.
 * @property {VectorSource} source - The Active Layer's source (features in the display CRS).
 * @property {Iterable<VertexKey>} keys - The selected vertices.
 * @property {VertexEditProjections} projections - Data and display CRS of the layer.
 * @property {(edits: StagedFeatureEdit[]) => unknown} stage - Stages the edits in one operation (e.g. `electronAPI.stageFeatureEdits` bound to the layer).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface VertexDeletionRequest {
  source: VectorSource;
  keys: Iterable<VertexKey>;
  projections: VertexEditProjections;
  stage: (edits: StagedFeatureEdit[]) => unknown;
}

const wkbFormat = new WKB({ hex: false, ewkb: false });

/**
 * @function encodeGeometryWkb
 * @description Encodes a display-CRS geometry as ISO WKB in the layer's data CRS (no reprojection when both are the same, e.g. under No CRS).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Geometry} geometry - Geometry in the display CRS.
 * @param {VertexEditProjections} projections - Data and display CRS.
 * @returns {Uint8Array} WKB bytes.
 */
export function encodeGeometryWkb(
  geometry: Geometry,
  projections: VertexEditProjections
): Uint8Array {
  const options =
    projections.dataProjection === projections.featureProjection ?
      {}
    : projections;
  return new Uint8Array(
    wkbFormat.writeGeometry(geometry, options) as ArrayBuffer
  );
}

/**
 * @function buildVertexDeletionEdits
 * @description The staged edits of a vertex deletion plan: a geometry edit per changed feature, then a deletion per deleted feature.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {VertexDeletionPlan} plan - The plan.
 * @param {VertexEditProjections} projections - Data and display CRS.
 * @returns {StagedFeatureEdit[]} Staged edits.
 */
export function buildVertexDeletionEdits(
  plan: VertexDeletionPlan,
  projections: VertexEditProjections
): StagedFeatureEdit[] {
  const edits: StagedFeatureEdit[] = [];
  for (const { feature, geometry } of plan.changed) {
    const id = feature.getId();
    if (id === undefined) continue;
    edits.push({ id, wkb: encodeGeometryWkb(geometry, projections) });
  }
  for (const feature of plan.deleted) {
    const id = feature.getId();
    if (id === undefined) continue;
    edits.push({ id, deleted: true });
  }
  return edits;
}

/**
 * @function commitVertexDeletion
 * @description Deletes the selected vertices as one atomic edit: plans it, stages every affected feature with one `stage` call, then updates the source (new geometries set, emptied features removed). Does nothing and returns null when no selected vertex still exists.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {VertexDeletionRequest} request - Source, selection, projections and staging callback.
 * @returns {VertexDeletionCommit | null} What changed, or null when nothing did.
 */
export function commitVertexDeletion(
  request: VertexDeletionRequest
): VertexDeletionCommit | null {
  const { source, keys, projections, stage } = request;
  const plan = planVertexDeletion(keys, (id) => source.getFeatureById(id));
  if (plan.changed.length === 0 && plan.deleted.length === 0) return null;
  const edits = buildVertexDeletionEdits(plan, projections);
  stage(edits);
  for (const { feature, geometry } of plan.changed)
    feature.setGeometry(geometry);
  for (const feature of plan.deleted) {
    if (source.hasFeature(feature)) source.removeFeature(feature);
  }
  return {
    edits,
    changedIds: plan.changed.map((c) => c.feature.getId()!),
    deletedIds: plan.deleted.map((f) => f.getId()!),
  };
}
