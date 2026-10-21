/**
 * @file GeospatialEngine.ts
 * @module main/worker/GeospatialEngine
 * @description Decoupled geospatial engine wrapping native gdal-async operations, managing active dataset handles, extracting layer metadata, calculating spatial extent slices, and generating binary OGC WKB buffers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link GeospatialLayerMetadata}
 * @see {@link QueryExtentFeature}
 */

import * as path from "node:path";
import gdal from "gdal-async";
import { logging } from "../../shared/logging";
import type {
  BoundingBox,
  GeometryKind,
  ProjectCrs,
  QueryExtentFeature,
  QueryExtentOptions,
} from "../../shared/types";
import {
  WKB_PACKET_MAGIC,
  WKB_PACKET_VERSION,
  WKB_FLAG_HAS_GEOMETRY,
  WKB_FLAG_HAS_PROPERTIES,
} from "../../shared/types";
import type {
  GeospatialLayerMetadata,
  RehydrateLayerSpec,
  RehydrateResult,
} from "./types";

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
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {number} [geomType] - GDAL integer geometry type code.
 * @returns {GeometryKind} Canonical GeometryKind string.
 */
export function mapGdalGeometryKind(geomType?: number): GeometryKind {
  if (geomType === undefined) {
    return "Unknown";
  }
  const baseType = (geomType & 0x7fffffff) % 1000;
  if (baseType === 1 || baseType === 4) {
    return "Point";
  }
  if (
    baseType === 2
    || baseType === 5
    || baseType === 8
    || baseType === 9
    || baseType === 11
  ) {
    return "LineString";
  }
  if (
    baseType === 3
    || baseType === 6
    || baseType === 10
    || baseType === 12
    || baseType === 15
    || baseType === 16
    || baseType === 17
  ) {
    return "Polygon";
  }
  return "Unknown";
}

/**
 * @description Resolves the canonical GeometryKind for an individual GDAL Geometry instance, recursively inspecting GeometryCollection children if necessary.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {gdal.Geometry | null} [geom] - Native GDAL geometry instance.
 * @returns {GeometryKind | null} Resolved GeometryKind, 'Unknown' if heterogeneous, or null if geometry is null/empty.
 */
export function resolveGeometryKindFromGeometry(
  geom?: gdal.Geometry | null
): GeometryKind | null {
  if (!geom) {
    return null;
  }
  const kind = mapGdalGeometryKind(geom.wkbType);
  if (kind !== "Unknown") {
    return kind;
  }

  const children = (geom as any).children;
  if (children && typeof children.count === "function") {
    let count = 0;
    try {
      count = children.count();
    } catch {
      return "Unknown";
    }
    let commonChildKind: GeometryKind | null = null;
    for (let i = 0; i < count; i++) {
      let childGeom: gdal.Geometry | null = null;
      try {
        childGeom = children.get(i);
      } catch {
        return "Unknown";
      }
      const childKind = resolveGeometryKindFromGeometry(childGeom);
      if (childKind === "Unknown") {
        return "Unknown";
      }
      if (childKind !== null) {
        if (commonChildKind === null) {
          commonChildKind = childKind;
        } else if (commonChildKind !== childKind) {
          return "Unknown";
        }
      }
    }
    return commonChildKind;
  }

  return "Unknown";
}

/**
 * @description Determines the canonical GeometryKind for a GDAL Layer. Uses layer.geomType when concrete, and otherwise scans layer features with early exit if mixed geometry families are encountered.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {gdal.Layer} layer - Native GDAL vector layer handle.
 * @returns {GeometryKind} Resolved GeometryKind ('Point' | 'LineString' | 'Polygon' | 'Unknown').
 */
export function resolveLayerGeometryKind(layer: gdal.Layer): GeometryKind {
  const directKind = mapGdalGeometryKind(layer.geomType);
  if (directKind !== "Unknown") {
    return directKind;
  }

  let detectedKind: GeometryKind | null = null;
  if (layer.features && typeof layer.features.first === "function" && typeof layer.features.next === "function") {
    try {
      let feature = layer.features.first();
      while (feature) {
        const geom = typeof feature.getGeometry === "function" ? feature.getGeometry() : null;
        const featKind = resolveGeometryKindFromGeometry(geom);
        if (featKind === "Unknown") {
          return "Unknown";
        }
        if (featKind !== null) {
          if (detectedKind === null) {
            detectedKind = featKind;
          } else if (detectedKind !== featKind) {
            return "Unknown";
          }
        }
        feature = layer.features.next();
      }
    } catch {
      return detectedKind ?? "Unknown";
    }
  } else if (layer.features && typeof layer.features.forEach === "function") {
    let mixed = false;
    try {
      layer.features.forEach((feature) => {
        if (mixed) return;
        const geom = typeof feature.getGeometry === "function" ? feature.getGeometry() : null;
        const featKind = resolveGeometryKindFromGeometry(geom);
        if (featKind === "Unknown") {
          mixed = true;
          return;
        }
        if (featKind !== null) {
          if (detectedKind === null) {
            detectedKind = featKind;
          } else if (detectedKind !== featKind) {
            mixed = true;
          }
        }
      });
    } catch {
      return mixed ? "Unknown" : (detectedKind ?? "Unknown");
    }
    if (mixed) {
      return "Unknown";
    }
  }

  return detectedKind ?? "Unknown";
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
    srs.getAuthorityCode("PROJCS")
    || srs.getAuthorityCode("GEOGCS")
    || srs.getAuthorityCode(null);
  const name =
    srs.getAuthorityName("PROJCS") || srs.getAuthorityName("GEOGCS") || "EPSG";

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
    logging.warn(
      'Invalid sourceProjection, using extent as-is',
      err,
      { sourceProjection, scope: 'GeospatialEngine' }
    );
    return extent;
  }

  try {
    const transform = new gdal.CoordinateTransformation(sourceSrs, targetSrs);
    const corners = [
      transform.transformPoint(minX, minY),
      transform.transformPoint(maxX, minY),
      transform.transformPoint(maxX, maxY),
      transform.transformPoint(minX, maxY),
    ];

    const xs = corners.map((p) => p.x).filter((x) => !isNaN(x) && isFinite(x));
    const ys = corners.map((p) => p.y).filter((y) => !isNaN(y) && isFinite(y));

    if (xs.length === 0 || ys.length === 0) {
      return extent;
    }

    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  } catch (err) {
    logging.warn(
      'Failed to transform extent from sourceProjection',
      err,
      { sourceProjection, scope: 'GeospatialEngine' }
    );
    return extent;
  }
}

/**
 * @class GeospatialEngine
 * @description Encapsulates native GDAL dataset operations, serializes per-layer spatial filters, and extracts OGC WKB buffers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */
export class GeospatialEngine {
  private sessions = new Map<string, EngineSession>();
  private queues = new Map<string, Promise<unknown>>();

  /**
   * @description Opens a spatial dataset from disk, extracts metadata, and registers the session.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-15
   * @updated 2026-10-19
   * @since 0.1.0-dev
   * @param {string} layerId - Unique layer identifier.
   * @param {string} filePath - Absolute path to dataset file.
   * @returns {Promise<GeospatialLayerMetadata>} Extracted layer descriptor metadata.
   * @throws {Error} If dataset cannot be opened or contains no vector layers.
   */
  public async openDataset(
    layerId: string,
    filePath: string
  ): Promise<GeospatialLayerMetadata> {
    if (this.sessions.has(layerId)) {
      this.closeDataset(layerId);
    }

    let dataset: gdal.Dataset;
    try {
      dataset = await gdal.openAsync(filePath);
    } catch (openErr: any) {
      logging.error(
        'Failed to open dataset',
        openErr,
        { path: filePath, scope: 'GeospatialEngine' }
      );
      throw openErr;
    }

    try {
      if (dataset.layers.count() === 0) {
        dataset.close();
        throw new Error(`Vector dataset contains no layers: "${filePath}"`);
      }
    } catch (countErr: any) {
      try {
        dataset.close();
      } catch {
        // Suppress secondary close error
      }
      logging.error(
        'Error inspecting layers for dataset',
        countErr,
        { path: filePath, scope: 'GeospatialEngine' }
      );
      throw countErr;
    }

    const layer = dataset.layers.get(0);
    this.sessions.set(layerId, { dataset, layer, filePath });

    const rawName = layer.name?.trim();
    const name =
      rawName && rawName.length > 0 ? rawName : path.basename(filePath);

    let featureCount = 0;
    try {
      featureCount = layer.features.count();
    } catch (err) {
      logging.warn(
        'Failed to read feature count for layer',
        err,
        { layerId, scope: 'GeospatialEngine' }
      );
    }

    const extent: BoundingBox = [0, 0, 0, 0];
    if (featureCount > 0) {
      try {
        let env: any;
        try {
          env = layer.getExtent(false);
        } catch {
          // If bounding envelope is not pre-indexed in dataset header, force calculation across features
          env = layer.getExtent(true);
        }
        if (env) {
          extent[0] = env.minX;
          extent[1] = env.minY;
          extent[2] = env.maxX;
          extent[3] = env.maxY;
        }
      } catch (err) {
        logging.warn(
          'Failed to read or compute extent for layer',
          err,
          { layerId, scope: 'GeospatialEngine' }
        );
      }
    }

    let crs: ProjectCrs | undefined;
    const srs = layer.srs;
    if (srs && typeof srs.getAuthorityCode === "function") {
      const authCode =
        srs.getAuthorityCode("PROJCS")
        || srs.getAuthorityCode("GEOGCS")
        || srs.getAuthorityCode(null);
      const authName =
        srs.getAuthorityName("PROJCS")
        || srs.getAuthorityName("GEOGCS")
        || "EPSG";

      const wkt =
        typeof (srs as any).toWKT === "function" ? (srs as any).toWKT()
        : typeof (srs as any).toWkt === "function" ? (srs as any).toWkt()
        : undefined;

      crs = {
        authId: authCode ? `${authName}:${authCode}` : "EPSG:4326",
        wkt,
        proj4: typeof srs.toProj4 === "function" ? srs.toProj4() : undefined,
      };
    }

    const geometryKind = resolveLayerGeometryKind(layer);

    return { layerId, name, extent, featureCount, crs, geometryKind };
  }

  /**
   * @description Executes a spatial query against a cached layer session, serializing features as a contiguous binary WKB packet buffer.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-15
   * @updated 2026-10-16
   * @since 0.1.0-dev
   * @param {string} layerId - Unique layer identifier.
   * @param {QueryExtentOptions | BoundingBox} [options] - Structured query options or legacy bounding box [minX, minY, maxX, maxY].
   * @param {string} [targetProjection] - CRS authority of query bounding box (e.g. "EPSG:3857").
   * @returns {Promise<{ layerId: string; buffer: ArrayBuffer; features: QueryExtentFeature[]; transferList: ArrayBuffer[] }>} Query results, contiguous binary packet, and transferable ArrayBuffers.
   * @throws {Error} If no active session exists for the layer identifier.
   */
  public async queryExtent(
    layerId: string,
    options?: QueryExtentOptions | BoundingBox,
    targetProjection?: string
  ): Promise<{
    layerId: string;
    buffer: ArrayBuffer;
    features: QueryExtentFeature[];
    transferList: ArrayBuffer[];
  }> {
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
        let extentBox: BoundingBox | undefined;
        let proj: string | undefined = targetProjection;
        let includeGeometry = true;
        let fields: string[] | undefined = undefined;

        if (Array.isArray(options)) {
          extentBox = options;
        } else if (options && typeof options === "object") {
          extentBox = options.extent;
          proj = options.targetProjection ?? targetProjection;
          if (options.includeGeometry !== undefined) {
            includeGeometry = options.includeGeometry;
          }
          fields = options.fields;
        }

        let shouldFilter = false;
        let filterExtent: BoundingBox = [0, 0, 0, 0];

        if (extentBox && Array.isArray(extentBox) && extentBox.length === 4) {
          const [minX, minY, maxX, maxY] = extentBox;
          if (
            isFinite(minX)
            && isFinite(minY)
            && isFinite(maxX)
            && isFinite(maxY)
            && (minX !== 0 || minY !== 0 || maxX !== 0 || maxY !== 0)
          ) {
            shouldFilter = true;
            filterExtent = [minX, minY, maxX, maxY];

            if (proj && layer.srs) {
              const layerAuth = getSrsAuthority(layer.srs);
              if (!layerAuth || proj.toUpperCase() !== layerAuth) {
                filterExtent = reprojectBoundingBox(
                  filterExtent,
                  proj,
                  layer.srs
                );
              }
            }
          }
        }

        if (shouldFilter) {
          layer.setSpatialFilter(
            filterExtent[0],
            filterExtent[1],
            filterExtent[2],
            filterExtent[3]
          );
        } else {
          layer.setSpatialFilter(null);
        }

        interface ExtractedRecord {
          fid: bigint;
          wkbBytes: Uint8Array | null;
          propsBytes: Uint8Array | null;
          properties: Record<string, unknown>;
        }

        const encoder = new TextEncoder();
        const extracted: ExtractedRecord[] = [];
        const features: QueryExtentFeature[] = [];

        layer.features.forEach((feature) => {
          try {
            const fid = BigInt(feature.fid);
            let wkbBytes: Uint8Array | null = null;

            if (includeGeometry) {
              const geom = feature.getGeometry();
              if (geom) {
                try {
                  const rawWkb = geom.toWKB();
                  wkbBytes = new Uint8Array(
                    rawWkb.buffer,
                    rawWkb.byteOffset,
                    rawWkb.byteLength
                  );
                } catch {
                  // Fallback if WKB extraction fails
                }
              }
            }

            let propsBytes: Uint8Array | null = null;
            let properties: Record<string, unknown> = {};

            if (fields === undefined) {
              properties = feature.fields.toObject();
              propsBytes = encoder.encode(JSON.stringify(properties));
            } else if (fields.length > 0) {
              for (const f of fields) {
                try {
                  const val = feature.fields.get(f);
                  if (val !== undefined) {
                    properties[f] = val;
                  }
                } catch {
                  // Field might not exist
                }
              }
              propsBytes = encoder.encode(JSON.stringify(properties));
            } else {
              // fields === []: properties completely omitted
              propsBytes = null;
              properties = {};
            }

            extracted.push({ fid, wkbBytes, propsBytes, properties });

            features.push({
              id: feature.fid,
              wkb: wkbBytes ?? undefined,
              properties,
            });
          } catch (featErr) {
            logging.warn('Failed to process feature', featErr, { fid: feature.fid, scope: 'GeospatialEngine' });
          }
        });

        let hasGeometry = false;
        let hasProperties = false;
        let totalSize = 12; // 12-byte header

        for (const rec of extracted) {
          const wkbLen = rec.wkbBytes ? rec.wkbBytes.byteLength : 0;
          const propsLen = rec.propsBytes ? rec.propsBytes.byteLength : 0;
          if (wkbLen > 0) hasGeometry = true;
          if (propsLen > 0) hasProperties = true;
          // fid (8) + wkbLength (4) + W + propsLength (4) + P
          totalSize += 8 + 4 + wkbLen + 4 + propsLen;
        }

        const flags =
          (hasGeometry ? WKB_FLAG_HAS_GEOMETRY : 0)
          | (hasProperties ? WKB_FLAG_HAS_PROPERTIES : 0);

        const packetBuffer = new ArrayBuffer(totalSize);
        const view = new DataView(packetBuffer);
        const uint8View = new Uint8Array(packetBuffer);

        // Header (12 bytes, Little-Endian)
        view.setUint32(0, WKB_PACKET_MAGIC, true);
        view.setUint16(4, WKB_PACKET_VERSION, true);
        view.setUint16(6, flags, true);
        view.setUint32(8, extracted.length, true);

        let offset = 12;
        for (const rec of extracted) {
          // int64 fid (8 bytes)
          view.setBigInt64(offset, rec.fid, true);
          offset += 8;

          // uint32 wkbLength (4 bytes)
          const wkbLen = rec.wkbBytes ? rec.wkbBytes.byteLength : 0;
          view.setUint32(offset, wkbLen, true);
          offset += 4;
          if (wkbLen > 0 && rec.wkbBytes) {
            uint8View.set(rec.wkbBytes, offset);
            offset += wkbLen;
          }

          // uint32 propsLength (4 bytes)
          const propsLen = rec.propsBytes ? rec.propsBytes.byteLength : 0;
          view.setUint32(offset, propsLen, true);
          offset += 4;
          if (propsLen > 0 && rec.propsBytes) {
            uint8View.set(rec.propsBytes, offset);
            offset += propsLen;
          }
        }

        return {
          layerId,
          buffer: packetBuffer,
          features,
          transferList: [packetBuffer],
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
      if (session.dataset && typeof session.dataset.close === "function") {
        session.dataset.close();
      }
    } catch (err) {
      logging.warn('Failed to close dataset for layer', err, { layerId, scope: 'GeospatialEngine' });
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
  public async rehydrate(
    layers: RehydrateLayerSpec[]
  ): Promise<RehydrateResult> {
    const rehydrated: string[] = [];
    const failed: Array<{ layerId: string; error: string }> = [];

    for (const item of layers) {
      try {
        await this.openDataset(item.layerId, item.filePath);
        rehydrated.push(item.layerId);
      } catch (err: any) {
        failed.push({
          layerId: item.layerId,
          error: err?.message || String(err),
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
  private async executeSequential<T>(
    layerId: string,
    task: () => Promise<T>
  ): Promise<T> {
    const previousPromise = this.queues.get(layerId) || Promise.resolve();
    const currentPromise = previousPromise.then(() => task());
    this.queues.set(
      layerId,
      currentPromise.catch(() => {})
    );
    return currentPromise;
  }
}
