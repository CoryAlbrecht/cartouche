/**
 * @file getLayerInfo.ts
 * @module main/api/layers/getLayerInfo
 * @description Main Process API handler retrieving comprehensive read-only layer metadata, schema field definitions, and provider details via GeospatialService.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see {@link GeospatialService}
 * @see {@link LayerDetailedInfo}
 */

import type { LayerDetailedInfo } from '@shared/types';
import { geospatialService } from '../../worker/GeospatialService';

/**
 * @description Retrieves detailed layer metadata, OGR field definitions, and provider driver properties via GeospatialService.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} layerId - Unique layer identifier.
 * @returns {Promise<LayerDetailedInfo>} Detailed layer metadata and attribute schema fields.
 */
export async function getLayerInfo(layerId: string): Promise<LayerDetailedInfo> {
  return await geospatialService.getLayerInfo(layerId);
}

export default getLayerInfo;

