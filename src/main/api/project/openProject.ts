/**
 * @file openProject.ts
 * @module main/api/project/openProject
 * @description Main Process API function for opening, deserializing, activating an existing project file, and hydrating native GDAL layer sessions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link ProjectLoaderRegistry}
 * @see {@link ProjectModel}
 * @see {@link LayerSessionRegistry}
 */

import { dialog, BrowserWindow } from 'electron';
import { projectLoaderRegistry } from '../../project/loaders/ProjectLoaderRegistry';
import { projectStore } from '../../project/ProjectStore';
import { fileTypeRegistry } from '../../filetypes/FileTypeRegistry';
import { Layer } from '../../project/models/Layer';
import { LayerGroup } from '../../project/models/LayerGroup';
import { layerSessionRegistry } from '../../project/LayerSessionRegistry';
import { mapGdalGeometryKind } from '../layers/addLayer';
import { getDefaultLayerStyle } from '../../../shared/styles/defaultLayerStyles';
import { broadcastProjectLayersTree, broadcastFullProject } from '../../project/ProjectBroadcaster';
import type {
  ProjectModel,
  BoundingBox,
  ProjectLayerItem,
  ProjectGroupItem
} from '@shared/types';

/**
 * @description Recursively collects all leaf Layer instances from a root or group LayerTreeNode hierarchy.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @param {import('../../project/models/LayerTreeNode').LayerTreeNode} node - Tree node to traverse.
 * @returns {Layer[]} Flattened array of Layer instances.
 */
function getAllLeafLayers(node: import('../../project/models/LayerTreeNode').LayerTreeNode): Layer[] {
  const result: Layer[] = [];
  if (node instanceof Layer) {
    result.push(node);
  } else if (node instanceof LayerGroup) {
    for (const child of node.getAllChildren()) {
      result.push(...getAllLeafLayers(child));
    }
  }
  return result;
}

/**
 * @description Recursively enriches ProjectModel layer items with resolved native extents, feature counts, and styles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Project hierarchy items.
 * @param {Map<string, { layer: Layer; extent: BoundingBox; featureCount: number }>} layersMap - Metadata map keyed by layer ID.
 * @returns {void}
 */
function enrichProjectLayers(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  layersMap: Map<string, { layer: Layer; extent: BoundingBox; featureCount: number }>
): void {
  for (const item of items) {
    if ('children' in item && Array.isArray((item as any).children)) {
      enrichProjectLayers((item as any).children, layersMap);
    } else {
      const layerItem = item as ProjectLayerItem;
      const info = layerItem.id ? layersMap.get(layerItem.id) : undefined;
      if (info) {
        layerItem.geometryKind = info.layer.geometryKind;
        layerItem.style = info.layer.style;
        layerItem.crs = info.layer.crs;
        (layerItem as any).extent = info.extent;
        (layerItem as any).featureCount = info.featureCount;
      }
    }
  }
}

/**
 * @description Opens an existing Cartouche project document from disk, loads it into ProjectStore, hydrates native GDAL sessions, and broadcasts to renderer windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @param {string} [filePath] - Optional path to the project document; if omitted, displays the system file open dialog.
 * @returns {Promise<ProjectModel | null>} The loaded project model instance or null if canceled/failed.
 */
export default async function openProject(filePath?: string): Promise<ProjectModel | null> {
  let targetPath = filePath;

  // If no filePath was supplied (e.g. invoked directly via shortcut), open the system file picker
  if (!targetPath) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const filters = fileTypeRegistry.getFileFilters('project');
    const result = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, {
          title: 'Open Cartouche Project',
          properties: ['openFile'],
          filters
        })
      : await dialog.showOpenDialog({
          title: 'Open Cartouche Project',
          properties: ['openFile'],
          filters
        });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    targetPath = result.filePaths[0];
  }

  // Find compatible loader
  const loader = await projectLoaderRegistry.getLoaderForFile(targetPath);
  if (!loader) {
    throw new Error(`No compatible project loader found for file: "${targetPath}".`);
  }

  // Load into ProjectStore
  const project = await loader.load(targetPath);
  projectStore.setProject(project, targetPath);

  // Open physical datasets for each layer and register sessions in LayerSessionRegistry
  const leafLayers = getAllLeafLayers(projectStore.getRootGroup());
  const layersMap = new Map<string, { layer: Layer; extent: BoundingBox; featureCount: number }>();

  for (const layer of leafLayers) {
    let extent: BoundingBox = [0, 0, 0, 0];
    let featureCount = 0;

    if (layer.filePath) {
      const descriptor =
        (await fileTypeRegistry.identifyFile(layer.filePath)) ||
        fileTypeRegistry.identifyByExtension(layer.filePath);

      if (descriptor) {
        layer.fileType = descriptor;
        try {
          const nativeObj = await fileTypeRegistry.load(layer.filePath);
          layer.attachNativeObject(nativeObj);

          if (!layer.geometryKind) {
            if (descriptor.category === 'raster' || layer.layerKind === 'raster') {
              layer.geometryKind = 'Raster';
            } else if (nativeObj && typeof (nativeObj as any).geomType === 'number') {
              layer.geometryKind = mapGdalGeometryKind((nativeObj as any).geomType);
            } else {
              layer.geometryKind = 'Polygon';
            }
          }

          // Retain active native GDAL handles in LayerSessionRegistry
          const gdalLayer = (nativeObj as any)?.features ? (nativeObj as any) : undefined;
          const gdalDataset = (nativeObj as any)?.ds ?? ((nativeObj as any)?.layers ? nativeObj : undefined);
          if (gdalDataset && gdalLayer) {
            layerSessionRegistry.register(layer.id, gdalDataset, gdalLayer);
          }

          if (!layer.style) {
            layer.style = getDefaultLayerStyle(layer.geometryKind);
          }

          if (!layer.crs) {
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

              layer.crs = {
                authId: authCode ? `${authName}:${authCode}` : 'EPSG:4326',
                wkt: typeof srs.toWkt === 'function' ? srs.toWkt() : undefined,
                proj4: typeof srs.toProj4 === 'function' ? srs.toProj4() : undefined
              };
            }
          }

          if (nativeObj && typeof (nativeObj as any).getExtent === 'function') {
            try {
              const env = (nativeObj as any).getExtent();
              if (env) {
                extent = [env.minX, env.minY, env.maxX, env.maxY];
              }
            } catch {
              // Ignore extent read errors
            }
          }

          if (nativeObj && (nativeObj as any).features && typeof (nativeObj as any).features.count === 'function') {
            try {
              featureCount = (nativeObj as any).features.count();
            } catch {
              // Ignore feature count read errors
            }
          }
        } catch (loadErr) {
          console.warn(`[openProject] Failed to load dataset for layer "${layer.name}" (${layer.filePath}):`, loadErr);
        }
      }
    }

    layersMap.set(layer.id, { layer, extent, featureCount });
  }

  if (Array.isArray(project.layers)) {
    enrichProjectLayers(project.layers, layersMap);
  }

  // Broadcast loaded layer tree to all active windows
  broadcastProjectLayersTree();

  // Broadcast loaded project to all active windows
  broadcastFullProject(project);

  console.log(`[Main Core API] openProject successfully loaded "${project.metadata.title}" (${targetPath}) with ${leafLayers.length} layer(s).`);
  return project;
}
