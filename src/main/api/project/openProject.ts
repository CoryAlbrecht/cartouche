/**
 * @file openProject.ts
 * @module main/api/project/openProject
 * @description Main Process API function for opening, deserializing, activating an existing project file, and hydrating native dataset sessions via GeospatialService.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link ProjectLoaderRegistry}
 * @see {@link ProjectModel}
 * @see {@link GeospatialService}
 */

import { dialog } from 'electron';
import { projectLoaderRegistry } from '../../project/loaders/ProjectLoaderRegistry';
import { projectStore } from '../../project/ProjectStore';
import { fileTypeRegistry } from '../../filetypes/FileTypeRegistry';
import { Layer } from '../../project/models/Layer';
import { LayerGroup } from '../../project/models/LayerGroup';
import { geospatialService } from '../../worker/GeospatialService';
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
 * @updated 2026-10-16
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
 * @updated 2026-10-16
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
 * @description Opens an existing Cartouche project document from disk, loads it into ProjectStore, hydrates native dataset sessions via GeospatialService, and broadcasts to renderer windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {string} [filePath] - Optional path to the project document; if omitted, displays the non-modal system file open dialog.
 * @returns {Promise<ProjectModel | null>} The loaded project model instance or null if canceled/failed.
 */
export default async function openProject(
  filePath?: string
): Promise<ProjectModel | null> {
  let targetPath = filePath;

  // If no filePath was supplied (e.g. invoked directly via shortcut), open the non-modal system file picker
  if (!targetPath) {
    const filters = fileTypeRegistry.getFileFilters('project');
    const result = await dialog.showOpenDialog({
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

  // Open physical datasets for each layer via GeospatialService in the background worker
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
        const isRaster = descriptor.category === 'raster' || layer.layerKind === 'raster';

        if (!isRaster) {
          try {
            const metadata = await geospatialService.openDataset(layer.id, layer.filePath);

            if (metadata.geometryKind) {
              layer.geometryKind = metadata.geometryKind;
            } else if (!layer.geometryKind) {
              layer.geometryKind = 'Unknown';
            }

            if (!layer.style) {
              layer.style = getDefaultLayerStyle(layer.geometryKind || 'Unknown');
            }

            if (!layer.crs && metadata.crs) {
              layer.crs = metadata.crs;
            }

            extent = metadata.extent;
            featureCount = metadata.featureCount;
          } catch (loadErr) {
            console.warn(`[openProject] Failed to load dataset for layer "${layer.name}" (${layer.filePath}):`, loadErr);
            if (!layer.geometryKind) {
              layer.geometryKind = 'Unknown';
            }
            if (!layer.style) {
              layer.style = getDefaultLayerStyle(layer.geometryKind || 'Unknown');
            }
          }
        } else {
          if (!layer.geometryKind) {
            layer.geometryKind = 'Raster';
          }
          if (!layer.style) {
            layer.style = getDefaultLayerStyle('Raster');
          }
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
