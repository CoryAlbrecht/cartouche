/**
 * @file updateLayerFields.ts
 * @module main/api/layers/updateLayerFields
 * @description Main Process API function for updating field schema metadata on a layer in ProjectStore and setting Project Dirty State.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-02
 * @updated 2026-11-02
 * @since 0.1.0-dev
 * @see {@link projectStore}
 */

import { projectStore } from '../../project/ProjectStore';
import { broadcastProjectLayersTree } from '../../project/ProjectBroadcaster';
import { findNode } from '../project/layerTreeOperations';
import { Layer } from '../../project/models/Layer';
import type { LayerFieldInfo } from '../../../shared/types';

/**
 * @description Updates vector field metadata schema on a layer in ProjectStore, setting Project Dirty State.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-02
 * @updated 2026-11-02
 * @since 0.1.0-dev
 * @param {string} layerId - Unique identifier of the target layer.
 * @param {LayerFieldInfo[]} fields - Array of updated layer field definitions.
 * @returns {Promise<boolean>} True if layer was found and updated.
 * @throws {Error} If layerId is invalid or layer not found.
 */
export async function updateLayerFields(
  layerId: string,
  fields: LayerFieldInfo[]
): Promise<boolean> {
  if (!layerId || typeof layerId !== 'string') {
    throw new Error('Layer ID is required.');
  }

  const root = projectStore.getRootGroup();
  const targetNode = findNode(root, layerId);
  if (!targetNode || !(targetNode instanceof Layer)) {
    throw new Error(`Layer "${layerId}" not found in active project.`);
  }

  targetNode.fields = fields;
  projectStore.setProjectDirty(true);
  broadcastProjectLayersTree();

  return true;
}

export default updateLayerFields;
