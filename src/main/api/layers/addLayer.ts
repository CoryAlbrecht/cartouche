/**
 * @file addLayer.ts
 * @module main/api/layers/addLayer
 * @description Main Process API function for processing layer addition requests for Vector, Raster, and Database sources.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link ApiFunctions}
 */

import type { GisLayer } from "@shared/types";

/**
 * @typedef {Object} AddLayerParams
 * @property {'vector' | 'raster' | 'database'} sourceType - Format type of spatial data source.
 * @property {string} filePath - Absolute path or connection URI for spatial data file.
 * @property {string} [layerName] - Optional custom display name for spatial layer.
 */
export interface AddLayerParams {
  sourceType: "vector" | "raster" | "database";
  filePath: string;
  layerName?: string;
}

/**
 * @description Main process handler for registering a new spatial layer in active project state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {AddLayerParams} params - Layer creation specifications.
 * @returns {Promise<GisLayer>} Created spatial layer definition object.
 */
export async function addLayer(params: AddLayerParams): Promise<GisLayer> {
  const name =
    params.layerName || params.filePath.split(/[/\\]/).pop() || "New Layer";
  const newLayer: GisLayer = {
    id: `layer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name,
    kind: params.sourceType === "raster" ? "raster" : "vector",
    visible: true,
    opacity: 1,
    color: "#1b446c",
    featureCount: 0,
  };
  return newLayer;
}
