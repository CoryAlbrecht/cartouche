/**
 * @file layerTreeDropTarget.ts
 * @module renderer/workbench/widgets/layerTreeDropTarget
 * @description Pure hit-zone and horizontal outdenting resolution helpers for LayerTreeWidget drag-and-drop reordering.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @see {@link LayerTreeWidget}
 */

import type { DropPosition, ProjectGroupItem, ProjectLayerItem } from '@shared/types';

export type { DropPosition };

/**
 * @typedef {Object} TreeDropTarget
 * @property {string} targetId - Target node ID passed to `reorderNodes(draggedIds, targetId, position)`.
 * @property {DropPosition} position - Resolved insertion position relative to `targetId`.
 * @property {number} indentLevel - Visual indentation depth (`1` = root-level child, `2` = child of root group, etc.) for `.tree-drop-marker` margin (`indentLevel * 18 + 6`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */
export interface TreeDropTarget {
  targetId: string;
  position: DropPosition;
  indentLevel: number;
}

/**
 * @typedef {Object} ResolveNodeDropTargetParams
 * @property {Array<ProjectLayerItem | ProjectGroupItem>} tree - Current hierarchical layer tree items under rootGroup.
 * @property {string[]} draggedIds - Array of dragged node identifiers.
 * @property {string} hoveredNodeId - Identifier of the hovered row (`'root'` / `'project'` or a layer/group ID).
 * @property {number} offsetY - Cursor vertical offset relative to the top of the hovered row (`e.clientY - rect.top`).
 * @property {number} rowHeight - Height in pixels of the hovered row (`rect.height`).
 * @property {number} offsetX - Cursor horizontal offset relative to the left of the hovered row (`e.clientX - rect.left`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */
export interface ResolveNodeDropTargetParams {
  tree: Array<ProjectLayerItem | ProjectGroupItem>;
  draggedIds: string[];
  hoveredNodeId: string;
  offsetY: number;
  rowHeight: number;
  offsetX: number;
}

/**
 * @typedef {Object} AncestorPathEntry
 * @property {ProjectLayerItem | ProjectGroupItem} node - Tree node at this path depth.
 * @property {string} id - Resolved node identifier (`node.id` or fallback `group-${node.name}`).
 * @property {number} indentLevel - Visual indentation depth (`1` for root children).
 * @property {boolean} isLastChildOfParent - True if this node is the last child (or last non-dragged child) of its parent `ProjectGroupItem`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */
interface AncestorPathEntry {
  node: ProjectLayerItem | ProjectGroupItem;
  id: string;
  indentLevel: number;
  isLastChildOfParent: boolean;
}

/**
 * @description Resolves the canonical identifier for a layer or group tree node, falling back to `group-${node.name}` when `node.id` is omitted on a group.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {ProjectLayerItem | ProjectGroupItem} node - Layer or group tree item.
 * @returns {string} Resolved node identifier.
 */
export function getTreeNodeId(node: ProjectLayerItem | ProjectGroupItem): string {
  return node.id || ('children' in node ? `group-${node.name}` : '');
}

/**
 * @description Recursively searches for and collects nodes matching provided identifiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Tree items to search.
 * @param {string[]} ids - Target node identifiers.
 * @returns {Array<ProjectLayerItem | ProjectGroupItem>} Matched nodes in traversal order.
 */
export function collectNodesByIds(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  ids: string[]
): Array<ProjectLayerItem | ProjectGroupItem> {
  const targetSet = new Set(ids);
  const matched: Array<ProjectLayerItem | ProjectGroupItem> = [];

  function traverse(list: Array<ProjectLayerItem | ProjectGroupItem>): void {
    for (const item of list) {
      const itemId = getTreeNodeId(item);
      if (itemId && targetSet.has(itemId)) {
        matched.push(item);
      }
      if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
        traverse((item as ProjectGroupItem).children);
      }
    }
  }

  traverse(items);
  return matched;
}

/**
 * @description Checks whether `candidateId` is a descendant of the `candidateParent` group.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {ProjectGroupItem} candidateParent - Potential ancestor group.
 * @param {string} candidateId - Node ID to test.
 * @returns {boolean} True if `candidateId` is inside `candidateParent`.
 */
export function isDescendantNode(candidateParent: ProjectGroupItem, candidateId: string): boolean {
  if (!Array.isArray(candidateParent.children)) return false;
  for (const child of candidateParent.children) {
    const childId = getTreeNodeId(child);
    if (childId === candidateId) return true;
    if ('children' in child && isDescendantNode(child as ProjectGroupItem, candidateId)) {
      return true;
    }
  }
  return false;
}

/**
 * @description Finds the ancestor path from a top-level tree item (`indentLevel = 1`) down to `targetNodeId`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Current level items.
 * @param {string} targetNodeId - Node ID to locate.
 * @param {Set<string>} draggedIdSet - Set of dragged node IDs for trailing sibling detection.
 * @param {number} [indentLevel=1] - Current indentation level.
 * @param {boolean} [hasParentGroup=false] - Whether `items` belong to a parent `ProjectGroupItem` (as opposed to root).
 * @returns {AncestorPathEntry[] | null} Ordered path from top-level ancestor to target node, or null if not found.
 */
function findNodePath(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  targetNodeId: string,
  draggedIdSet: Set<string>,
  indentLevel: number = 1,
  hasParentGroup: boolean = false
): AncestorPathEntry[] | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemId = getTreeNodeId(item);
    const allSubsequentDragged = items
      .slice(i + 1)
      .every((sibling) => draggedIdSet.has(getTreeNodeId(sibling)));
    const isLastChildOfParent = hasParentGroup && (i === items.length - 1 || allSubsequentDragged);
    const entry: AncestorPathEntry = {
      node: item,
      id: itemId,
      indentLevel,
      isLastChildOfParent
    };

    if (itemId === targetNodeId) {
      return [entry];
    }

    if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
      const subPath = findNodePath(
        (item as ProjectGroupItem).children,
        targetNodeId,
        draggedIdSet,
        indentLevel + 1,
        true
      );
      if (subPath) {
        return [entry, ...subPath];
      }
    }
  }
  return null;
}

/**
 * @description Resolves the target node ID, drop position (`'before' | 'after' | 'into'`), and drop marker indentation level for a drag-over or drop gesture on a LayerTreeWidget row.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {ResolveNodeDropTargetParams} params - Tree state, dragged node IDs, hovered node ID, and pointer coordinates.
 * @returns {TreeDropTarget | null} Resolved drop target descriptor, or null when the drop is invalid (e.g. self-drop or ancestor-into-descendant cycle).
 */
export function resolveNodeDropTarget(params: ResolveNodeDropTargetParams): TreeDropTarget | null {
  const { tree, draggedIds, hoveredNodeId, offsetY, rowHeight, offsetX } = params;

  if (!hoveredNodeId || draggedIds.length === 0) {
    return null;
  }

  const draggedNodes = collectNodesByIds(tree, draggedIds);
  if (draggedNodes.length === 0) {
    return null;
  }

  // Project root row (`.tree-node-project`) always inserts into `root` at index 0 (`indentLevel = 1`)
  if (hoveredNodeId === 'root' || hoveredNodeId === 'project') {
    return {
      targetId: 'root',
      position: 'into',
      indentLevel: 1
    };
  }

  const draggedIdSet = new Set(draggedIds);

  // Reject dropping any dragged group into its own descendant
  for (const dragged of draggedNodes) {
    if ('children' in dragged && isDescendantNode(dragged as ProjectGroupItem, hoveredNodeId)) {
      return null;
    }
  }

  const path = findNodePath(tree, hoveredNodeId, draggedIdSet);
  if (!path || path.length === 0) {
    return null;
  }

  const hoveredEntry = path[path.length - 1];
  const hoveredNode = hoveredEntry.node;
  const nodeIndentLevel = hoveredEntry.indentLevel;

  const effectiveHeight = rowHeight > 0 ? rowHeight : 24;
  const ratio = Math.max(0, Math.min(1, offsetY / effectiveHeight));

  const isGroup = 'children' in hoveredNode && Array.isArray((hoveredNode as ProjectGroupItem).children);
  let rawPosition: 'before' | 'into' | 'after';

  if (isGroup) {
    const groupNode = hoveredNode as ProjectGroupItem;
    const isExpandedAndNonEmpty = groupNode.expanded !== false && groupNode.children.length > 0;
    if (isExpandedAndNonEmpty) {
      rawPosition = ratio < 0.5 ? 'before' : 'into';
    } else {
      if (ratio < 1 / 3) {
        rawPosition = 'before';
      } else if (ratio <= 2 / 3) {
        rawPosition = 'into';
      } else {
        rawPosition = 'after';
      }
    }
  } else {
    rawPosition = ratio < 0.5 ? 'before' : 'after';
  }

  if (rawPosition === 'before') {
    if (draggedIdSet.has(hoveredEntry.id)) {
      return null;
    }
    return {
      targetId: hoveredEntry.id,
      position: 'before',
      indentLevel: nodeIndentLevel
    };
  }

  if (rawPosition === 'into') {
    if (draggedIdSet.has(hoveredEntry.id)) {
      return null;
    }
    return {
      targetId: hoveredEntry.id,
      position: 'into',
      indentLevel: nodeIndentLevel + 1
    };
  }

  // rawPosition === 'after':
  // Check if hoveredNode is in the trailing child slot of one or more contiguous ancestor groups,
  // allowing horizontal X-axis outdenting.
  let minPathIdx = path.length - 1;
  while (minPathIdx > 0 && path[minPathIdx].isLastChildOfParent) {
    minPathIdx--;
  }

  const minValidIndentLevel = path[minPathIdx].indentLevel;
  const maxValidIndentLevel = nodeIndentLevel;
  const desiredIndentLevel = Math.floor((offsetX - 6) / 18);
  const clampedIndentLevel = Math.max(
    minValidIndentLevel,
    Math.min(maxValidIndentLevel, desiredIndentLevel)
  );

  const targetEntry = path[clampedIndentLevel - 1];
  if (draggedIdSet.has(targetEntry.id)) {
    return null;
  }

  return {
    targetId: targetEntry.id,
    position: 'after',
    indentLevel: targetEntry.indentLevel
  };
}


