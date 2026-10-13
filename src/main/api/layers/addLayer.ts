/**
 * @file addLayer.ts
 * @module main/api/layers/addLayer
 * @description Main Process API function for adding spatial dataset layers to the active in-memory ProjectStore and notifying the Renderer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link FileTypeRegistry}
 * @see {@link ProjectBroadcaster}
 */

import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { AddLayerParams, GeometryKind } from '@shared/types';
import { fileTypeRegistry } from '../../filetypes/FileTypeRegistry';
import { projectStore } from '../../project/ProjectStore';
import { Layer } from '../../project/models/Layer';
import { broadcastProjectLayersTree } from '../../project/ProjectBroadcaster';

/**
 * @description Helper mapping GDAL geometry type integer constants to standard GeometryKind strings.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {number} [geomType] - GDAL integer geometry type code.
 * @returns {GeometryKind} Canonical GeometryKind string.
 */
function mapGdalGeometryKind(geomType?: number): GeometryKind {
  if (geomType === undefined) {
    return 'Polygon';
  }
  const baseType = geomType & 0xff;
  if (baseType === 1 || baseType === 4) {
    return 'Point';
  }
  if (baseType === 2 || baseType === 5) {
    return 'LineString';
  }
  return 'Polygon';
}

/**
 * @description Main process handler for registering a new spatial layer in active project state.
 * Identifies the file type, loads native dataset objects via FileTypeRegistry, sets metadata,
 * appends to ProjectStore, and broadcasts updated layer hierarchy over IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {AddLayerParams} params - Layer creation specifications.
 * @returns {Promise<Layer>} Created runtime Layer instance.
 * @throws {Error} If file type is unsupported or loader execution fails.
 */
export async function addLayer(params: AddLayerParams): Promise<Layer> {
  // 1. Inspect filename to identify format descriptor from FileTypeRegistry
  const descriptor =
    (await fileTypeRegistry.identifyFile(params.filePath)) ||
    fileTypeRegistry.identifyByExtension(params.filePath);

  if (!descriptor) {
    throw new Error(`Unsupported or unrecognized file format for layer: "${params.filePath}"`);
  }

  // 2. Load dataset via FileTypeRegistry to retrieve the native handle
  const nativeObj = await fileTypeRegistry.load(params.filePath);

  // 3. Resolve display name
  let resolvedName = '';
  if (params.layerName && params.layerName.trim().length > 0) {
    resolvedName = params.layerName.trim();
  } else if (
    nativeObj &&
    typeof (nativeObj as any).name === 'string' &&
    (nativeObj as any).name.trim().length > 0
  ) {
    resolvedName = (nativeObj as any).name.trim();
  } else {
    resolvedName = path.basename(params.filePath);
  }

  // 4. Resolve unique layer ID
  let resolvedId = '';
  if (params.layerId && params.layerId.trim().length > 0) {
    resolvedId = params.layerId.trim();
  } else {
    const snakeBase =
      resolvedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'layer';

    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const randomBytes = crypto.randomBytes(4);
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[randomBytes[i] % chars.length];
    }
    resolvedId = `${snakeBase}_${suffix}`;
  }

  // 5. Construct Layer model and populate properties
  const isRaster = descriptor.category === 'raster' || params.sourceType === 'raster';
  const layerKind = isRaster ? 'raster' : 'vector';

  const newLayer = new Layer(resolvedName, params.filePath, layerKind, resolvedId);
  newLayer.fileType = descriptor;
  newLayer.attachNativeObject(nativeObj);

  if (isRaster) {
    newLayer.geometryKind = 'Raster';
  } else if (nativeObj && typeof (nativeObj as any).geomType === 'number') {
    newLayer.geometryKind = mapGdalGeometryKind((nativeObj as any).geomType);
  } else {
    newLayer.geometryKind = 'Polygon';
  }

  // Resolve CRS if available on native object
  const srs = (nativeObj as any)?.srs;
  if (srs && typeof srs.getAuthorityCode === 'function') {
    const authCode =
      srs.getAuthorityCode('PROJCS') ||
      srs.getAuthorityCode('GEOGCS') ||
      srs.getAuthorityCode(null);
    const authName =
      srs.getAuthorityName('PROJCS') ||
      srs.getAuthorityName('GEOGCS') ||
      'EPSG';

    newLayer.crs = {
      authId: authCode ? `${authName}:${authCode}` : 'EPSG:4326',
      wkt: typeof srs.toWkt === 'function' ? srs.toWkt() : undefined,
      proj4: typeof srs.toProj4 === 'function' ? srs.toProj4() : undefined
    };
  }

  // 6. Append to ProjectStore singleton
  if (!projectStore.hasProject()) {
    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: {
        title: 'Untitled Project',
        appVersion: '0.1.0-dev'
      },
      layers: []
    });
  }

  projectStore.getRootGroup().addChild(newLayer);
  projectStore.setProjectDirty(true);

  // 7. Broadcast updated layer hierarchy over IPC to Renderer
  broadcastProjectLayersTree();

  return newLayer;
}

/**
 * @description Wrapper for adding multiple layers sequentially over a single IPC call.
 * Unwraps the array and invokes addLayer sequentially for each layer parameter specification.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-08
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {AddLayerParams[]} layers - Array of layer creation specifications.
 * @returns {Promise<Layer[]>} Array of created runtime Layer instances.
 */
export async function addLayers(layers: AddLayerParams[]): Promise<Layer[]> {
  const createdLayers: Layer[] = [];
  for (const layerParams of layers) {
    createdLayers.push(await addLayer(layerParams));
  }
  return createdLayers;
}
