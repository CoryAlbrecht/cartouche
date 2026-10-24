/**
 * @file rekeyLayer.ts
 * @module main/api/layers/rekeyLayer
 * @description Main Process API function for atomically re-keying a layer identifier across ProjectStore, LayerSessionRegistry, and GeospatialService with project-wide uniqueness validation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see {@link projectStore}
 * @see {@link layerSessionRegistry}
 * @see {@link geospatialService}
 */

import { projectStore } from '../../project/ProjectStore';
import { layerSessionRegistry } from '../../project/LayerSessionRegistry';
import { geospatialService } from '../../worker/GeospatialService';
import { broadcastProjectLayersTree } from '../../project/ProjectBroadcaster';
import { findNode } from '../project/layerTreeOperations';

/**
 * @description Atomically re-keys a layer identifier across ProjectStore, LayerSessionRegistry, and GeospatialService.
 * Validates non-empty, trimmed identifier and enforces project-wide uniqueness.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @param {string} oldLayerId - Existing registered layer identifier.
 * @param {string} newLayerId - Proposed new layer identifier.
 * @returns {Promise<{ success: boolean; layerId: string }>} Result object containing the confirmed layerId.
 * @throws {Error} If identifier is invalid, duplicate, or layer is not found.
 */
export async function rekeyLayer(
  oldLayerId: string,
  newLayerId: string
): Promise<{ success: boolean; layerId: string }> {
  if (!oldLayerId || typeof oldLayerId !== 'string') {
    throw new Error('Original Layer ID is required.');
  }
  if (!newLayerId || typeof newLayerId !== 'string') {
    throw new Error('New Layer ID cannot be empty.');
  }

  const trimmed = newLayerId.trim();
  if (!trimmed) {
    throw new Error('New Layer ID cannot be empty or whitespace-only.');
  }

  // If identifier is unchanged, succeed immediately without mutating registries
  if (oldLayerId === trimmed) {
    return { success: true, layerId: trimmed };
  }

  const root = projectStore.getRootGroup();
  const targetNode = findNode(root, oldLayerId);
  if (!targetNode) {
    throw new Error(`Layer "${oldLayerId}" not found in active project.`);
  }

  // Validate project-wide uniqueness
  const existingNode = findNode(root, trimmed);
  if (existingNode) {
    throw new Error(`Layer ID "${trimmed}" already exists in the project.`);
  }

  // 1. Re-key in LayerSessionRegistry (native handles)
  if (layerSessionRegistry.has(oldLayerId)) {
    layerSessionRegistry.rekey(oldLayerId, trimmed);
  }

  // 2. Re-key in GeospatialService (background engine / utility process)
  await geospatialService.rekeySession(oldLayerId, trimmed);

  // 3. Re-key in runtime LayerTreeNode
  targetNode.rekey(trimmed);

  // 4. Set projectStore dirty flag and broadcast
  projectStore.setProjectDirty(true);
  broadcastProjectLayersTree();

  return { success: true, layerId: trimmed };
}

export default rekeyLayer;

