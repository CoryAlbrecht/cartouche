/**
 * @file updateLayerTemporalConfig.ts
 * @module main/api/layers/updateLayerTemporalConfig
 * @description Main Process API function for updating dynamic temporal configuration on a layer in ProjectStore and setting Project Dirty State.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link projectStore}
 */

import { projectStore } from '../../project/ProjectStore';
import { broadcastProjectLayersTree } from '../../project/ProjectBroadcaster';
import { findNode } from '../project/layerTreeOperations';
import { Layer } from '../../project/models/Layer';
import type { LayerTemporalConfig } from '../../../shared/types';

/**
 * @description Updates dynamic temporal configuration and enabled status on a layer in ProjectStore, setting Project Dirty State.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {string} layerId - Unique identifier of the target layer.
 * @param {LayerTemporalConfig} [temporal] - Optional structured temporal configuration.
 * @param {boolean} [temporalEnabled] - Optional flag indicating whether dynamic temporal filtering is enabled.
 * @returns {Promise<boolean>} True if layer was found and updated.
 * @throws {Error} If layerId is invalid or layer not found in active project.
 */
export async function updateLayerTemporalConfig(
  layerId: string,
  temporal?: LayerTemporalConfig,
  temporalEnabled?: boolean
): Promise<boolean> {
  if (!layerId || typeof layerId !== 'string') {
    throw new Error('Layer ID is required.');
  }

  const root = projectStore.getRootGroup();
  const targetNode = findNode(root, layerId);
  if (!targetNode || !(targetNode instanceof Layer)) {
    throw new Error(`Layer "${layerId}" not found in active project.`);
  }

  targetNode.temporal = temporal;
  targetNode.temporalEnabled =
    temporalEnabled !== undefined
      ? temporalEnabled
      : (temporal ? temporal.enabled : false);

  projectStore.setProjectDirty(true);
  broadcastProjectLayersTree();

  return true;
}

export default updateLayerTemporalConfig;
