/**
 * @file queryExtent.ts
 * @module main/api/layers/queryExtent
 * @description Main Process spatial query and feature edit cache handler routing extent queries and uncommitted feature edits through GeospatialService across IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @see {@link GeospatialService}
 * @see {@link QueryExtentResult}
 */

import type {
  BoundingBox,
  QueryExtentOptions,
  QueryExtentBinaryResult,
  QueryExtentResult,
  StagedFeatureEdit
} from '@shared/types';
import { geospatialService } from '../../worker/GeospatialService';

/**
 * @description Executes a spatial query against a layer session via GeospatialService, streaming the contiguous binary WKB packet buffer across IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @param {string} layerId - Unique layer identifier.
 * @param {QueryExtentOptions | BoundingBox} [options] - Optional query options or extent [minX, minY, maxX, maxY].
 * @param {string} [targetProjection] - Optional CRS authority of the input extent (e.g. "EPSG:3857").
 * @returns {Promise<QueryExtentBinaryResult & QueryExtentResult>} Layer ID and contiguous binary WKB feature packet buffer.
 */
export async function queryExtent(
  layerId: string,
  options?: QueryExtentOptions | BoundingBox,
  targetProjection?: string
): Promise<QueryExtentBinaryResult & QueryExtentResult> {
  return (await geospatialService.queryExtent(layerId, options, targetProjection)) as any;
}

/**
 * @description Stages an uncommitted feature modification or newly added feature into Main's crash-resilient edit cache and forwards it to the Geospatial Worker.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @param {string} layerId - Target layer identifier.
 * @param {StagedFeatureEdit} edit - Feature edit or addition payload.
 * @returns {Promise<void>}
 */
export async function stageFeatureEdit(
  layerId: string,
  edit: StagedFeatureEdit
): Promise<void> {
  await geospatialService.stageFeatureEdit(layerId, edit);
}

/**
 * @description Clears all staged uncommitted feature edits and newly added features for a layer in Main's cache and the Geospatial Worker.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @param {string} layerId - Target layer identifier.
 * @returns {Promise<void>}
 */
export async function clearLayerEdits(layerId: string): Promise<void> {
  await geospatialService.clearLayerEdits(layerId);
}

/**
 * @description Returns the list of layer identifiers that currently have uncommitted feature edits or newly added features in Main's cache.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @returns {string[]} Array of dirty layer identifiers.
 */
export function getDirtyLayerIds(): string[] {
  return geospatialService.getDirtyLayerIds();
}
