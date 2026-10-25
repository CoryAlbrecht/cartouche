/**
 * @file addLayer.ts
 * @module main/api/layers/addLayer
 * @description Main Process API function for adding spatial dataset layers to the active in-memory ProjectStore and notifying the Renderer via GeospatialService.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link FileTypeRegistry}
 * @see {@link GeospatialService}
 * @see {@link ProjectBroadcaster}
 */

import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { AddLayerParams, GeometryKind, BoundingBox, LayerDescriptor } from '@shared/types';
import { fileTypeRegistry } from '../../filetypes/FileTypeRegistry';
import { projectStore } from '../../project/ProjectStore';
import { Layer } from '../../project/models/Layer';
import { geospatialService } from '../../worker/GeospatialService';
import { mapGdalGeometryKind } from '../../worker/GeospatialEngine';
import { generateDefaultVectorStyleJson } from '../../../shared/styles/defaultLayerStyles';
import { broadcastProjectLayersTree, broadcastLayerAdded } from '../../project/ProjectBroadcaster';

export { mapGdalGeometryKind };

/**
 * @description Main process handler for registering a new spatial layer in active project state.
 * Identifies the file type, opens dataset metadata via GeospatialService in the background worker,
 * appends to ProjectStore, and broadcasts updated layer hierarchy over IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-25
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

  // 2. Resolve unique layer ID
  let resolvedId = '';
  if (params.layerId && params.layerId.trim().length > 0) {
    resolvedId = params.layerId.trim();
  } else {
    const baseName = params.layerName || path.basename(params.filePath);
    const snakeBase =
      baseName
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

  // 3. Register spatial dataset via GeospatialService in worker/engine
  const isRaster = descriptor.category === 'raster' || params.sourceType === 'raster';
  let metadata: {
    name?: string;
    extent: BoundingBox;
    featureCount: number;
    crs?: import('@shared/types').ProjectCrs;
    geometryKind?: GeometryKind;
  } = {
    extent: [0, 0, 0, 0],
    featureCount: 0
  };

  if (!isRaster) {
    metadata = await geospatialService.openDataset(resolvedId, params.filePath);
  }

  // 4. Resolve display name
  let resolvedName = '';
  if (params.layerName && params.layerName.trim().length > 0) {
    resolvedName = params.layerName.trim();
  } else if (metadata.name && metadata.name.trim().length > 0) {
    resolvedName = metadata.name.trim();
  } else {
    resolvedName = path.basename(params.filePath);
  }

  // 5. Construct Layer model and populate properties
  const layerKind = isRaster ? 'raster' : 'vector';

  const newLayer = new Layer(resolvedName, params.filePath, layerKind, resolvedId);
  newLayer.fileType = descriptor;
  newLayer.geometryKind = isRaster ? 'Raster' : (metadata.geometryKind || 'Unknown');
  newLayer.crs = metadata.crs;

  // Attach default multi-geometry OpenLayers Flat Style rules to vector layers (exclude raster)
  if (!isRaster) {
    newLayer.style = {
      content: generateDefaultVectorStyleJson(),
      format: 'openlayers'
    };
  }

  const extent = metadata.extent;
  const featureCount = metadata.featureCount;

  const layerDescriptor: LayerDescriptor = {
    id: newLayer.id,
    name: newLayer.name,
    type: newLayer.type,
    source: newLayer.filePath,
    visible: newLayer.visible,
    selected: newLayer.selected,
    opacity: newLayer.opacity,
    selectable: newLayer.selectable,
    readOnly: newLayer.readOnly,
    layerKind: newLayer.layerKind,
    geometryKind: newLayer.geometryKind,
    style: newLayer.style,
    crs: newLayer.crs,
    customProperties: newLayer.customProperties,
    extent,
    featureCount
  };

  // 6. Append to ProjectStore singleton
  if (!projectStore.hasProject()) {
    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: {
        title: 'Untitled Project',
        appVersion: '0.1.0-dev'
      },
      layers: [],
      styles: []
    });
  }

  projectStore.getRootGroup().addChild(newLayer);
  projectStore.setProjectDirty(true);

  // 7. Broadcast layer added event and updated hierarchy over IPC to Renderer
  broadcastLayerAdded(layerDescriptor);
  broadcastProjectLayersTree();

  return newLayer;
}

/**
 * @description Wrapper for adding multiple layers sequentially over a single IPC call.
 * Unwraps the array and invokes addLayer sequentially for each layer parameter specification.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-08
 * @updated 2026-10-13
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
