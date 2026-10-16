/**
 * @file queryExtent.ts
 * @module main/api/layers/queryExtent
 * @description Main Process spatial query execution handler streaming visible vector feature slices (GeoJSON geometry objects and attributes) intersecting a bounding box extent.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @see {@link LayerSessionRegistry}
 * @see {@link QueryExtentResult}
 */

import gdal from 'gdal-async';
import type { BoundingBox, QueryExtentFeature, QueryExtentResult } from '@shared/types';
import { layerSessionRegistry } from '../../project/LayerSessionRegistry';

/**
 * @description Extracts canonical uppercase authority string (e.g. "EPSG:4326") from a GDAL SpatialReference.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {gdal.SpatialReference} [srs] - Native GDAL SpatialReference instance.
 * @returns {string | null} Canonical authority identifier or null if indeterminate.
 */
function getSrsAuthority(srs?: gdal.SpatialReference): string | null {
  if (!srs) {
    return null;
  }
  const code =
    srs.getAuthorityCode('PROJCS') ||
    srs.getAuthorityCode('GEOGCS') ||
    srs.getAuthorityCode(null);
  const name =
    srs.getAuthorityName('PROJCS') ||
    srs.getAuthorityName('GEOGCS') ||
    'EPSG';

  return code ? `${name}:${code}`.toUpperCase() : null;
}

/**
 * @description Reprojects a 2D bounding box extent from an input CRS string to a target GDAL SpatialReference.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {BoundingBox} extent - Geographic or projected bounding box [minX, minY, maxX, maxY].
 * @param {string} sourceProjection - Source projection authority or definition (e.g. "EPSG:3857").
 * @param {gdal.SpatialReference} targetSrs - Destination native GDAL SpatialReference.
 * @returns {BoundingBox} Reprojected bounding box conforming to target SRS coordinates.
 */
function reprojectBoundingBox(
  extent: BoundingBox,
  sourceProjection: string,
  targetSrs: gdal.SpatialReference
): BoundingBox {
  const [minX, minY, maxX, maxY] = extent;
  let sourceSrs: gdal.SpatialReference;
  try {
    sourceSrs = gdal.SpatialReference.fromUserInput(sourceProjection);
  } catch (err) {
    console.warn(`[queryExtent] Invalid sourceProjection "${sourceProjection}", using extent as-is:`, err);
    return extent;
  }

  try {
    const transform = new gdal.CoordinateTransformation(sourceSrs, targetSrs);
    const corners = [
      transform.transformPoint(minX, minY),
      transform.transformPoint(maxX, minY),
      transform.transformPoint(maxX, maxY),
      transform.transformPoint(minX, maxY)
    ];

    const xs = corners.map((p) => p.x).filter((x) => !isNaN(x) && isFinite(x));
    const ys = corners.map((p) => p.y).filter((y) => !isNaN(y) && isFinite(y));

    if (xs.length === 0 || ys.length === 0) {
      return extent;
    }

    return [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys)
    ];
  } catch (err) {
    console.warn(`[queryExtent] Failed to transform extent from "${sourceProjection}":`, err);
    return extent;
  }
}

/**
 * @description Executes a spatial query against a cached native GDAL layer handle, serializing intersecting features as OGC WKB buffers and attribute objects.
 * Executes within LayerSessionRegistry's sequential execution queue to protect native GDAL C++ filter state from concurrent mutation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @param {string} layerId - Unique layer identifier.
 * @param {BoundingBox} [extent] - Optional query bounding box [minX, minY, maxX, maxY].
 * @param {string} [targetProjection] - Optional CRS authority of the input bounding box (e.g. "EPSG:3857").
 * @returns {Promise<QueryExtentResult>} Layer ID and collection of intersecting spatial feature records.
 * @throws {Error} If no active session exists for the specified layer UUID.
 */
export async function queryExtent(
  layerId: string,
  extent?: BoundingBox,
  targetProjection?: string
): Promise<QueryExtentResult> {
  const session = layerSessionRegistry.get(layerId);
  if (!session) {
    throw new Error(`Layer session not found for layer UUID: "${layerId}"`);
  }

  return await layerSessionRegistry.executeSequential(layerId, async (activeSession) => {
    const { layer } = activeSession;

    try {
      let shouldFilter = false;
      let filterExtent: BoundingBox = [0, 0, 0, 0];

      if (extent && Array.isArray(extent) && extent.length === 4) {
        const [minX, minY, maxX, maxY] = extent;
        if (
          isFinite(minX) &&
          isFinite(minY) &&
          isFinite(maxX) &&
          isFinite(maxY) &&
          (minX !== 0 || minY !== 0 || maxX !== 0 || maxY !== 0)
        ) {
          shouldFilter = true;
          filterExtent = [minX, minY, maxX, maxY];

          if (targetProjection && layer.srs) {
            const layerAuth = getSrsAuthority(layer.srs);
            if (!layerAuth || targetProjection.toUpperCase() !== layerAuth) {
              filterExtent = reprojectBoundingBox(filterExtent, targetProjection, layer.srs);
            }
          }
        }
      }

      if (shouldFilter) {
        layer.setSpatialFilter(filterExtent[0], filterExtent[1], filterExtent[2], filterExtent[3]);
      } else {
        layer.setSpatialFilter(null);
      }

      const features: QueryExtentFeature[] = [];
      layer.features.forEach((feature) => {
        try {
          const geom = feature.getGeometry();
          if (geom) {
            let wkb: Uint8Array | undefined;
            try {
              const rawWkb = geom.toWKB();
              // Allocate a fresh Uint8Array inside V8's sandbox memory space and copy bytes
              wkb = new Uint8Array(rawWkb.byteLength);
              wkb.set(rawWkb);
            } catch {
              // WKB conversion fallback
            }

            if (wkb) {
              features.push({
                id: feature.fid,
                wkb,
                properties: feature.fields.toObject()
              });
            } else {
              const jsonStr = geom.toJSON();
              features.push({
                id: feature.fid,
                geojson: JSON.parse(jsonStr),
                properties: feature.fields.toObject()
              });
            }
          }
        } catch (featErr) {
          console.warn(`[queryExtent] Failed to extract geometry for feature ${feature.fid}:`, featErr);
        }
      });

      return {
        layerId,
        features
      };
    } finally {
      try {
        layer.setSpatialFilter(null);
      } catch {
        // Suppress cleanup error on disposed layer
      }
    }
  });
}
