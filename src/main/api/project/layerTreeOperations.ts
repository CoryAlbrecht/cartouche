/**
 * @file layerTreeOperations.ts
 * @module main/api/project/layerTreeOperations
 * @description Main Process API functions for layer tree visibility, selection, deletion, group creation, and reordering operations on the authoritative ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link LayerGroup}
 * @see {@link LayerTreeNode}
 * @see {@link ProjectBroadcaster}
 */

import { projectStore } from '../../project/ProjectStore';
import { LayerGroup } from '../../project/models/LayerGroup';
import { LayerTreeNode } from '../../project/models/LayerTreeNode';
import { broadcastProjectLayersTree } from '../../project/ProjectBroadcaster';

/**
 * @description Recursively searches for a LayerTreeNode by its identifier within a parent LayerGroup.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {LayerGroup} group - The parent group to search within.
 * @param {string} id - The unique identifier of the target node.
 * @returns {LayerTreeNode | null} The found node, or null if not found.
 */
export function findNode(group: LayerGroup, id: string): LayerTreeNode | null {
  if (group.id === id) {
    return group;
  }
  for (const child of group.getAllChildren()) {
    if (child.id === id) {
      return child;
    }
    if (child instanceof LayerGroup) {
      const found = findNode(child, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * @description Checks whether a candidate node ID is a descendant of a given group.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {LayerGroup} group - The ancestor group to test against.
 * @param {string} candidateId - The ID to check for descendant status.
 * @returns {boolean} True if candidateId is inside group.
 */
export function isDescendant(group: LayerGroup, candidateId: string): boolean {
  for (const child of group.getAllChildren()) {
    if (child.id === candidateId) {
      return true;
    }
    if (child instanceof LayerGroup && isDescendant(child, candidateId)) {
      return true;
    }
  }
  return false;
}

/**
 * @description Recursively collects all LayerTreeNode instances across the hierarchy.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {LayerGroup} group - Group container to traverse.
 * @returns {LayerTreeNode[]} Flat list of all nodes.
 */
function collectAllNodes(group: LayerGroup): LayerTreeNode[] {
  const result: LayerTreeNode[] = [];
  for (const child of group.getAllChildren()) {
    result.push(child);
    if (child instanceof LayerGroup) {
      result.push(...collectAllNodes(child));
    }
  }
  return result;
}

/**
 * @description Updates the visibility status of a layer or group node in the authoritative ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} nodeId - Target node identifier.
 * @param {boolean} visible - New visibility state.
 * @returns {void}
 */
export function setNodeVisibility(nodeId: string, visible: boolean): void {
  const root = projectStore.getRootGroup();
  const node = findNode(root, nodeId);
  if (node) {
    node.visible = visible;
    projectStore.setProjectDirty(true);
    broadcastProjectLayersTree();
  }
}

/**
 * @description Updates the in-memory selection status across all nodes in the ProjectStore layer tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string[]} selectedNodeIds - Array of node identifiers that should be selected.
 * @returns {void}
 */
export function setNodeSelection(selectedNodeIds: string[]): void {
  if (!projectStore.hasProject()) {
    return;
  }
  const root = projectStore.getRootGroup();
  const selectedSet = new Set(selectedNodeIds);
  const allNodes = collectAllNodes(root);

  for (const node of allNodes) {
    node.selected = selectedSet.has(node.id);
  }

  broadcastProjectLayersTree();
}

/**
 * @description Removes specified nodes from the ProjectStore, deterministically disposing native handles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string[]} nodeIds - Identifiers of nodes to remove.
 * @returns {void}
 */
export function removeNodes(nodeIds: string[]): void {
  const root = projectStore.getRootGroup();
  let changed = false;

  for (const id of nodeIds) {
    const node = findNode(root, id);
    if (node && node.parent) {
      node.parent.removeChild(node);
      if (Symbol.dispose in node && typeof (node as any)[Symbol.dispose] === 'function') {
        (node as any)[Symbol.dispose]();
      }
      changed = true;
    }
  }

  if (changed) {
    projectStore.setProjectDirty(true);
    broadcastProjectLayersTree();
  }
}

/**
 * @description Bundles actionable nodes into a new group, positioned immediately before the target node.
  * Automatically prunes redundant descendant nodes whose ancestor is already included.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {string} name - Display name for the newly created group.
 * @param {string} targetNodeId - Node identifier marking insertion point.
 * @param {string[]} childNodeIds - Node identifiers to move into the new group.
 * @param {string} [newGroupId] - Optional pre-generated UUID for the new group.
 * @returns {LayerGroup} The newly created group instance.
 */
export function createGroup(
  name: string,
  targetNodeId: string,
  childNodeIds: string[],
  newGroupId?: string
): LayerGroup {
  const root = projectStore.getRootGroup();
  const targetNode = findNode(root, targetNodeId);
  const targetParent = targetNode?.parent || root;

  // Resolve nodes to move
  const nodesToMove: LayerTreeNode[] = [];
  for (const id of childNodeIds) {
    const node = findNode(root, id);
    if (node && node !== root) {
      nodesToMove.push(node);
    }
  }

  // Prune descendants if an ancestor is also in the set
  const filteredNodes = nodesToMove.filter(node => {
    let curr = node.parent;
    while (curr && curr !== root) {
      if (nodesToMove.includes(curr)) {
        return false;
      }
      curr = curr.parent;
    }
    return true;
  });

  const newGroup = new LayerGroup(name, newGroupId);
  newGroup.expanded = true;
  newGroup.selected = true;

  // Calculate insertion index before targetNode
  let insertIndex = targetParent.getAllChildren().length;
  if (targetNode) {
    const idx = targetParent.getAllChildren().indexOf(targetNode);
    if (idx !== -1) {
      insertIndex = idx;
    }
  }

  // Insert newGroup into targetParent
  targetParent.addChild(newGroup, insertIndex);

  // Reparent filtered nodes into newGroup and deselect them
  for (const node of filteredNodes) {
    if (node.parent) {
      node.parent.removeChild(node);
    }
    node.selected = false;
    newGroup.addChild(node);
  }

  projectStore.setProjectDirty(true);
  broadcastProjectLayersTree();

  return newGroup;
}

/**
 * @description Renames an existing layer or group node in the authoritative ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} nodeId - Target node identifier.
 * @param {string} newName - New display name string.
 * @returns {void}
 */
export function renameNode(nodeId: string, newName: string): void {
  const root = projectStore.getRootGroup();
  const node = findNode(root, nodeId);
  if (node && newName.trim().length > 0) {
    node.name = newName.trim();
    projectStore.setProjectDirty(true);
    broadcastProjectLayersTree();
  }
}

/**
 * @description Reorders nodes in the hierarchy, enforcing cycle checks and updating parent linkage.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string[]} draggedNodeIds - Array of dragged node identifiers.
 * @param {string} targetNodeId - Target node identifier for drop action.
 * @param {'before' | 'into' | 'append-root'} position - Relative insertion position.
 * @returns {void}
 */
export function reorderNodes(
  draggedNodeIds: string[],
  targetNodeId: string,
  position: 'before' | 'into' | 'append-root'
): void {
  const root = projectStore.getRootGroup();

  // Resolve dragged nodes
  const draggedNodes: LayerTreeNode[] = [];
  for (const id of draggedNodeIds) {
    const node = findNode(root, id);
    if (node && node !== root) {
      draggedNodes.push(node);
    }
  }

  if (draggedNodes.length === 0) {
    return;
  }

  // Cycle prevention: no dragged node can be an ancestor of targetNode
  if (position !== 'append-root') {
    for (const dragged of draggedNodes) {
      if (dragged instanceof LayerGroup) {
        if (dragged.id === targetNodeId || isDescendant(dragged, targetNodeId)) {
          return; // Abort invalid cyclical move
        }
      }
    }
  }

  if (position === 'append-root') {
    for (const node of draggedNodes) {
      if (node.parent) {
        node.parent.removeChild(node);
      }
      root.addChild(node);
    }
    projectStore.setProjectDirty(true);
    broadcastProjectLayersTree();
    return;
  }

  const targetNode = findNode(root, targetNodeId);
  if (!targetNode) {
    return;
  }

  if (position === 'into' && targetNode instanceof LayerGroup) {
    for (const node of draggedNodes) {
      if (node.parent) {
        node.parent.removeChild(node);
      }
    }
    for (let i = 0; i < draggedNodes.length; i++) {
      targetNode.addChild(draggedNodes[i], i);
    }
    projectStore.setProjectDirty(true);
    broadcastProjectLayersTree();
    return;
  }

  // position === 'before'
  for (const node of draggedNodes) {
    if (node.parent) {
      node.parent.removeChild(node);
    }
  }

  const parent = targetNode.parent || root;
  const targetIndex = parent.getAllChildren().indexOf(targetNode);
  const insertPos = targetIndex !== -1 ? targetIndex : parent.getAllChildren().length;

  for (let i = 0; i < draggedNodes.length; i++) {
    parent.addChild(draggedNodes[i], insertPos + i);
  }

  projectStore.setProjectDirty(true);
  broadcastProjectLayersTree();
}
