/**
 * @file renameLayerTreeNode.ts
 * @module main/api/project/renameLayerTreeNode
 * @description Main Process API function for renaming leaf layers, layer groups, or the active project root document in the authoritative ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link LayerTreeNode}
 * @see {@link broadcastProjectLayersTree}
 * @see {@link broadcastProjectMetadata}
 */

import { projectStore } from '../../project/ProjectStore';
import { broadcastProjectLayersTree, broadcastProjectMetadata } from '../../project/ProjectBroadcaster';
import { findNode } from './layerTreeOperations';

/**
 * @description Renames an existing leaf layer, layer group, or the project document root in the authoritative ProjectStore.
 * Trims extraneous whitespace, silences blank updates, flags unsaved project modifications, and broadcasts updates over IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {string} [nodeId] - Target node identifier or 'project' for the root document.
 * @param {string} [newName] - Proposed new display name string.
 * @returns {void}
 */
export function renameLayerTreeNode(nodeId?: string, newName?: string): void {
  if (!nodeId || typeof newName !== 'string') {
    return;
  }
  const trimmed = newName.replace(/[\r\n]+/g, ' ').trim();
  if (!trimmed) {
    return;
  }

  if (nodeId === 'project') {
    const project = projectStore.getProject();
    if (!project) {
      return;
    }
    if (project.metadata.title === trimmed) {
      return;
    }
    project.metadata.title = trimmed;
    projectStore.setDirty(true);
    broadcastProjectMetadata();
    return;
  }

  const root = projectStore.getRootGroup();
  const node = findNode(root, nodeId);
  if (!node) {
    return;
  }

  if (node.name === trimmed) {
    return;
  }

  node.name = trimmed;
  projectStore.setDirty(true);
  broadcastProjectLayersTree();
}

export default renameLayerTreeNode;

