/**
 * @file queryExtent.ts
 * @module main/api/layers/queryExtent
 * @description Main Process spatial query execution handler routing bounding box queries through GeospatialService and streaming binary OGC WKB buffers across IPC to the Renderer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @see {@link GeospatialService}
 * @see {@link QueryExtentResult}
 */

import type { BoundingBox, QueryExtentResult } from '@shared/types';
import { geospatialService } from '../../worker/GeospatialService';

/**
 * @description Executes a spatial query against a layer session via GeospatialService, streaming intersecting features as binary OGC WKB buffers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @param {string} layerId - Unique layer identifier.
 * @param {BoundingBox} [extent] - Optional query bounding box [minX, minY, maxX, maxY].
 * @param {string} [targetProjection] - Optional CRS authority of the input bounding box (e.g. "EPSG:3857").
 * @returns {Promise<QueryExtentResult>} Layer ID and collection of intersecting spatial feature records.
 */
export async function queryExtent(
  layerId: string,
  extent?: BoundingBox,
  targetProjection?: string
): Promise<QueryExtentResult> {
  return await geospatialService.queryExtent(layerId, extent, targetProjection);
}
