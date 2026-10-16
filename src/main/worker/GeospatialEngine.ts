/**
 * @file GeospatialEngine.ts
 * @module main/worker/GeospatialEngine
 * @description Decoupled geospatial engine wrapping native gdal-async operations, managing active dataset handles, extracting layer metadata, calculating spatial extent slices, and generating binary OGC WKB buffers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @see {@link GeospatialLayerMetadata}
 * @see {@link QueryExtentFeature}
 */

import * as path from 'node:path';
import gdal from 'gdal-async';
import type { BoundingBox, GeometryKind, ProjectCrs, QueryExtentFeature } from '@shared/types';
import type {
  GeospatialLayerMetadata,
  RehydrateLayerSpec,
  RehydrateResult
} from './types';

/**
 * @typedef {Object} EngineSession
 * @property {gdal.Dataset} dataset - Active native GDAL dataset handle.
 * @property {gdal.Layer} layer - Primary native GDAL spatial layer handle.
 * @property {string} filePath - Absolute path to underlying data file.
 */
interface EngineSession {
  dataset: gdal.Dataset;
  layer: gdal.Layer;
  filePath: string;
}

/**
 * @description Maps GDAL geometry type integer codes to canonical GeometryKind strings.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @param {number} [geomType] - GDAL integer geometry type code.
 * @returns {GeometryKind} Canonical GeometryKind string.
 */
export function mapGdalGeometryKind(geomType?: number): GeometryKind {
  if (geomType === undefined) {
    return 'Polygon';
  }
  const baseType = (geomType & 0x7fffffff) % 1000;
  if (baseType === 1 || baseType === 4) {
    return 'Point';
  }
  if (baseType === 2 || baseType === 5) {
    return 'LineString';
  }
  return 'Polygon';
}

/**
 * @description Extracts canonical uppercase CRS authority string (e.g. "EPSG:4326") from a GDAL SpatialReference.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @param {gdal.SpatialReference} [srs] - Native GDAL SpatialReference instance.
 * @returns {string | null} Canonical authority identifier or null if indeterminate.
 */
export function getSrsAuthority(srs?: gdal.SpatialReference): string | null {
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
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @param {BoundingBox} extent - Geographic or projected bounding box [minX, minY, maxX, maxY].
 * @param {string} sourceProjection - Source projection authority or definition (e.g. "EPSG:3857").
 * @param {gdal.SpatialReference} targetSrs - Destination native GDAL SpatialReference.
 * @returns {BoundingBox} Reprojected bounding box conforming to target SRS coordinates.
 */
export function reprojectBoundingBox(
  extent: BoundingBox,
  sourceProjection: string,
  targetSrs: gdal.SpatialReference
): BoundingBox {
  const [minX, minY, maxX, maxY] = extent;
  let sourceSrs: gdal.SpatialReference;
  try {
    sourceSrs = gdal.SpatialReference.fromUserInput(sourceProjection);
  } catch (err) {
    console.warn(`[GeospatialEngine] Invalid sourceProjection "${sourceProjection}", using extent as-is:`, err);
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
    console.warn(`[GeospatialEngine] Failed to transform extent from "${sourceProjection}":`, err);
    return extent;
  }
}

/**
 * @class GeospatialEngine
 * @description Encapsulates native GDAL dataset operations, serializes per-layer spatial filters, and extracts OGC WKB buffers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 */
export class GeospatialEngine {
  private sessions = new Map<string, EngineSession>();
  private queues = new Map<string, Promise<unknown>>();

  /**
   * @description Opens a spatial dataset from disk, extracts metadata, and registers the session.
   * @param {string} layerId - Unique layer identifier.
   * @param {string} filePath - Absolute path to dataset file.
   * @returns {Promise<GeospatialLayerMetadata>} Extracted layer descriptor metadata.
   * @throws {Error} If dataset cannot be opened or contains no vector layers.
   */
  public async openDataset(layerId: string, filePath: string): Promise<GeospatialLayerMetadata> {
    if (this.sessions.has(layerId)) {
      this.closeDataset(layerId);
    }

    const dataset = await gdal.openAsync(filePath);
    if (dataset.layers.count() === 0) {
      dataset.close();
      throw new Error(`Vector dataset contains no layers: "${filePath}"`);
    }

    const layer = dataset.layers.get(0);
    this.sessions.set(layerId, { dataset, layer, filePath });

    const rawName = layer.name?.trim();
    const name = rawName && rawName.length > 0 ? rawName : path.basename(filePath);

    let featureCount = 0;
    try {
      featureCount = layer.features.count();
    } catch (err) {
      console.warn(`[GeospatialEngine] Failed to read feature count for "${layerId}":`, err);
    }

    const extent: BoundingBox = [0, 0, 0, 0];
    try {
      const env = layer.getExtent();
      if (env) {
        extent[0] = env.minX;
        extent[1] = env.minY;
        extent[2] = env.maxX;
        extent[3] = env.maxY;
      }
    } catch (err) {
      console.warn(`[GeospatialEngine] Failed to read extent for "${layerId}":`, err);
    }

    let crs: ProjectCrs | undefined;
    const srs = layer.srs;
    if (srs && typeof srs.getAuthorityCode === 'function') {
      const authCode =
        srs.getAuthorityCode('PROJCS') ||
        srs.getAuthorityCode('GEOGCS') ||
        srs.getAuthorityCode(null);
      const authName =
        srs.getAuthorityName('PROJCS') ||
        srs.getAuthorityName('GEOGCS') ||
        'EPSG';

      const wkt =
        typeof (srs as any).toWKT === 'function'
          ? (srs as any).toWKT()
          : typeof (srs as any).toWkt === 'function'
            ? (srs as any).toWkt()
            : undefined;

      crs = {
        authId: authCode ? `${authName}:${authCode}` : 'EPSG:4326',
        wkt,
        proj4: typeof srs.toProj4 === 'function' ? srs.toProj4() : undefined
      };
    }

    const geometryKind = mapGdalGeometryKind(layer.geomType);

    return {
      layerId,
      name,
      extent,
      featureCount,
      crs,
      geometryKind
    };
  }

  /**
   * @description Executes a spatial query against a cached layer session, serializing features as OGC WKB buffers.
   * @param {string} layerId - Unique layer identifier.
   * @param {BoundingBox} [extent] - Query bounding box [minX, minY, maxX, maxY].
   * @param {string} [targetProjection] - CRS authority of query bounding box (e.g. "EPSG:3857").
   * @returns {Promise<{ layerId: string; features: QueryExtentFeature[]; transferList: ArrayBuffer[] }>} Query results and transferable ArrayBuffers.
   * @throws {Error} If no active session exists for the layer identifier.
   */
  public async queryExtent(
    layerId: string,
    extent?: BoundingBox,
    targetProjection?: string
  ): Promise<{ layerId: string; features: QueryExtentFeature[]; transferList: ArrayBuffer[] }> {
    const session = this.sessions.get(layerId);
    if (!session) {
      throw new Error(`Layer session not found for layer UUID: "${layerId}"`);
    }

    return this.executeSequential(layerId, async () => {
      const activeSession = this.sessions.get(layerId);
      if (!activeSession) {
        throw new Error(`Layer session not found for layer UUID: "${layerId}"`);
      }

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
        const transferList: ArrayBuffer[] = [];

        layer.features.forEach((feature) => {
          try {
            const geom = feature.getGeometry();
            if (geom) {
              let wkb: Uint8Array | undefined;
              try {
                const rawWkb = geom.toWKB();
                const uint8 = new Uint8Array(rawWkb.byteLength);
                uint8.set(rawWkb);
                wkb = uint8;
                transferList.push(uint8.buffer);
              } catch {
                // Conversion to WKB fallback
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
            console.warn(`[GeospatialEngine] Failed to extract geometry for feature ${feature.fid}:`, featErr);
          }
        });

        return {
          layerId,
          features,
          transferList
        };
      } finally {
        try {
          layer.setSpatialFilter(null);
        } catch {
          // Suppress filter cleanup error
        }
      }
    });
  }

  /**
   * @description Closes a specific native dataset session and disposes its handles.
   * @param {string} layerId - Unique layer identifier.
   * @returns {boolean} True if dataset was found and closed, false otherwise.
   */
  public closeDataset(layerId: string): boolean {
    const session = this.sessions.get(layerId);
    if (!session) {
      return false;
    }

    this.sessions.delete(layerId);
    this.queues.delete(layerId);

    try {
      if (session.dataset && typeof session.dataset.close === 'function') {
        session.dataset.close();
      }
    } catch (err) {
      console.warn(`[GeospatialEngine] Failed to close dataset for "${layerId}":`, err);
    }

    return true;
  }

  /**
   * @description Closes all open native datasets and clears all sessions.
   * @returns {void}
   */
  public closeAll(): void {
    for (const layerId of Array.from(this.sessions.keys())) {
      this.closeDataset(layerId);
    }
    this.sessions.clear();
    this.queues.clear();
  }

  /**
   * @description Rehydrates a batch of layer datasets atomically into the engine cache.
   * @param {RehydrateLayerSpec[]} layers - Array of layer specifications to load.
   * @returns {Promise<RehydrateResult>} Collection of succeeded and failed layer IDs.
   */
  public async rehydrate(layers: RehydrateLayerSpec[]): Promise<RehydrateResult> {
    const rehydrated: string[] = [];
    const failed: Array<{ layerId: string; error: string }> = [];

    for (const item of layers) {
      try {
        await this.openDataset(item.layerId, item.filePath);
        rehydrated.push(item.layerId);
      } catch (err: any) {
        failed.push({
          layerId: item.layerId,
          error: err?.message || String(err)
        });
      }
    }

    return { rehydrated, failed };
  }

  /**
   * @description Checks if a dataset session is actively loaded for a layer ID.
   * @param {string} layerId - Unique layer identifier.
   * @returns {boolean} True if active session exists.
   */
  public hasDataset(layerId: string): boolean {
    return this.sessions.has(layerId);
  }

  /**
   * @description Returns all currently loaded layer identifiers.
   * @returns {string[]} Array of active layer IDs.
   */
  public getLoadedLayerIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * @description Returns the total count of loaded dataset sessions.
   * @returns {number} Loaded session count.
   */
  public get size(): number {
    return this.sessions.size;
  }

  /**
   * @description Executes an asynchronous task sequentially per layer to avoid concurrent C++ filter mutation.
   * @private
   * @template T
   * @param {string} layerId - Unique layer identifier.
   * @param {() => Promise<T>} task - Operation to execute.
   * @returns {Promise<T>} Task result promise.
   */
  private async executeSequential<T>(layerId: string, task: () => Promise<T>): Promise<T> {
    const previousPromise = this.queues.get(layerId) || Promise.resolve();
    const currentPromise = previousPromise.then(() => task());
    this.queues.set(layerId, currentPromise.catch(() => {}));
    return currentPromise;
  }
}