/**
 * @file layerTreeOperations.ts
 * @module main/api/project/layerTreeOperations
 * @description Main Process API functions for layer tree visibility, selection, deletion, group creation, and reordering operations on the authoritative ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-19
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
 * @description Reorders nodes in the hierarchy, preserving top-to-bottom tree order, pruning redundant selected descendants, enforcing cycle checks, and updating parent linkage.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {string[]} draggedNodeIds - Array of dragged node identifiers.
 * @param {string} targetNodeId - Target node identifier for drop action (or 'root' for project root).
 * @param {import('@shared/types').DropPosition} position - Relative insertion position.
 * @returns {void}
 */
export function reorderNodes(
  draggedNodeIds: string[],
  targetNodeId: string,
  position: import('@shared/types').DropPosition
): void {
  const root = projectStore.getRootGroup();

  // Resolve dragged nodes in canonical top-to-bottom tree order
  const draggedIdSet = new Set(draggedNodeIds);
  const rawDraggedNodes = collectAllNodes(root).filter(
    (node) => node !== root && draggedIdSet.has(node.id)
  );

  // Prune descendants whose ancestor group is also in the dragged set
  const draggedNodes = rawDraggedNodes.filter((node) => {
    let curr = node.parent;
    while (curr && curr !== root) {
      if (rawDraggedNodes.includes(curr)) {
        return false;
      }
      curr = curr.parent;
    }
    return true;
  });

  if (draggedNodes.length === 0) {
    return;
  }

  // Cycle and self-drop prevention
  if (position !== 'append-root' && targetNodeId !== 'root') {
    for (const dragged of draggedNodes) {
      if (dragged.id === targetNodeId) {
        return;
      }
      if (dragged instanceof LayerGroup && isDescendant(dragged, targetNodeId)) {
        return; // Abort invalid cyclical move
      }
    }
  }

  const targetNode =
    position === 'append-root' || (targetNodeId === 'root' && position === 'into')
      ? root
      : findNode(root, targetNodeId);

  if (!targetNode || (targetNode === root && position !== 'append-root' && position !== 'into')) {
    return;
  }

  // Detach dragged nodes from their current parents before re-insertion
  for (const node of draggedNodes) {
    if (node.parent) {
      node.parent.removeChild(node);
    }
  }

  if (position === 'append-root') {
    for (const node of draggedNodes) {
      root.addChild(node);
    }
  } else if (targetNodeId === 'root' && position === 'into') {
    for (let i = 0; i < draggedNodes.length; i++) {
      root.addChild(draggedNodes[i], i);
    }
  } else if (position === 'into' && targetNode instanceof LayerGroup) {
    targetNode.expanded = true;
    for (let i = 0; i < draggedNodes.length; i++) {
      targetNode.addChild(draggedNodes[i], i);
    }
  } else {
    // position === 'before' or position === 'after'
    const parent = targetNode.parent || root;
    const targetIndex = parent.getAllChildren().indexOf(targetNode);
    const insertPos =
      targetIndex !== -1
        ? position === 'after'
          ? targetIndex + 1
          : targetIndex
        : parent.getAllChildren().length;

    for (let i = 0; i < draggedNodes.length; i++) {
      parent.addChild(draggedNodes[i], insertPos + i);
    }
  }

  projectStore.setProjectDirty(true);
  broadcastProjectLayersTree();
}


