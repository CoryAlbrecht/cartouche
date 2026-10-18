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

import type { BoundingBox, QueryExtentOptions, QueryExtentBinaryResult, QueryExtentResult } from '@shared/types';
import { geospatialService } from '../../worker/GeospatialService';

/**
 * @description Executes a spatial query against a layer session via GeospatialService, streaming the contiguous binary WKB packet buffer across IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @param {string} layerId - Unique layer identifier.
 * @param {QueryExtentOptions | BoundingBox} [options] - Optional query options or bounding box [minX, minY, maxX, maxY].
 * @param {string} [targetProjection] - Optional CRS authority of the input bounding box (e.g. "EPSG:3857").
 * @returns {Promise<QueryExtentBinaryResult | QueryExtentResult>} Layer ID and contiguous binary WKB feature packet buffer.
 */
export async function queryExtent(
  layerId: string,
  options?: QueryExtentOptions | BoundingBox,
  targetProjection?: string
): Promise<QueryExtentBinaryResult & QueryExtentResult> {
  return (await geospatialService.queryExtent(layerId, options, targetProjection)) as any;
}
