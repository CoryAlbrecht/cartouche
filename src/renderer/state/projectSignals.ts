/**
 * @file projectSignals.ts
 * @module renderer/state/projectSignals
 * @description Preact reactive signals store managing Cartouche project state, hierarchical layer tree nodes, metadata, dirty state, selection, visibility, and IPC synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @see {@link ProjectModel}
 * @see {@link ProjectLayerItem}
 * @see {@link ProjectGroupItem}
 */

import { signal, computed, batch } from '@preact/signals-react';
import type {
  ProjectModel,
  ProjectLayerItem,
  ProjectGroupItem,
  LayerDescriptor
} from '@shared/types';
import { resolveLayerStyle } from '../../shared/styles/defaultLayerStyles';

/**
 * @typedef {Object} PopupMenuItem
 * @property {string} id - Unique action identifier.
 * @property {string} label - Display label text.
 * @property {string} [icon] - Optional MDI icon path string.
 * @property {boolean} [disabled] - True if menu action is disabled.
 * @property {boolean} [separator] - True if item is a horizontal divider.
 * @property {boolean} [checked] - True if checkmark indicator is displayed.
 * @property {() => void} [onClick] - Action execution callback handler.
 */
export interface PopupMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  checked?: boolean;
  onClick?: () => void;
}

/**
 * @typedef {Object} LayerTreeContextMenuContext
 * @property {Array<ProjectLayerItem | ProjectGroupItem>} actionableNodes - Target layers or groups subject to the action.
 * @property {boolean} isMultiple - True if multiple nodes are actionable.
 */
export interface LayerTreeContextMenuContext {
  actionableNodes: Array<ProjectLayerItem | ProjectGroupItem>;
  isMultiple: boolean;
}

/**
 * @typedef {(context: LayerTreeContextMenuContext) => PopupMenuItem[]} LayerTreeContextMenuHook
 */
export type LayerTreeContextMenuHook = (context: LayerTreeContextMenuContext) => PopupMenuItem[];

/**
 * @signal layerTreeContextMenuHooksSignal
 * @description Reactive signal holding registered context menu provider hooks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @type {Signal<LayerTreeContextMenuHook[]>}
 */
export const layerTreeContextMenuHooksSignal = signal<LayerTreeContextMenuHook[]>([]);

/**
 * @signal projectTreeSignal
 * @description Reactive signal holding the hierarchical project layer tree (layers and groups) for LayerTreeWidget rendering.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @type {Signal<Array<ProjectLayerItem | ProjectGroupItem>>}
 */
export const projectTreeSignal = signal<Array<ProjectLayerItem | ProjectGroupItem>>([]);

/**
 * @signal projectLayersSignal
 * @description Reactive signal holding flat list of loaded layer descriptors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {Signal<LayerDescriptor[]>}
 */
export const projectLayersSignal = signal<LayerDescriptor[]>([]);

/**
 * @signal layerStylesSignal
 * @description Reactive signal holding OpenLayers flat style rules keyed by layer UUID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {Signal<Record<string, Record<string, any>>>}
 */
export const layerStylesSignal = signal<Record<string, Record<string, any>>>({});

/**
 * @signal currentProjectSignal
 * @description Reactive signal holding the active ProjectModel document definition or null.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @type {Signal<ProjectModel | null>}
 */
export const currentProjectSignal = signal<ProjectModel | null>(null);

/**
 * @signal hasProjectSignal
 * @description Reactive signal indicating whether an active project is open.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const hasProjectSignal = signal<boolean>(false);

/**
 * @signal projectNameSignal
 * @description Reactive signal holding the display title string of the active project.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @type {Signal<string | null>}
 */
export const projectNameSignal = signal<string | null>(null);

/**
 * @signal projectFilePathSignal
 * @description Reactive signal holding the filesystem path of the currently open project document.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {Signal<string | null>}
 */
export const projectFilePathSignal = signal<string | null>(null);

/**
 * @signal projectVisibleSignal
 * @description Reactive signal toggling global visibility of all project layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const projectVisibleSignal = signal<boolean>(true);

/**
 * @signal isProjectDirtySignal
 * @description Reactive signal indicating whether the current project has unsaved modifications.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isProjectDirtySignal = signal<boolean>(false);

/**
 * @signal isDirtySignal
 * @description Backwards compatibility alias for isProjectDirtySignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isDirtySignal = isProjectDirtySignal;

/**
 * @signal activeLayerIdSignal
 * @description Reactive signal holding the identifier of the currently active layer in the tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @type {Signal<string | null>}
 */
export const activeLayerIdSignal = signal<string | null>(null);

/**
 * @signal editingNodeIdSignal
 * @description Reactive signal holding the identifier of the layer, group, or project root node currently in inline edit mode.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @type {Signal<string | null>}
 */
export const editingNodeIdSignal = signal<string | null>(null);

/**
 * @description Recursively counts total layers across the tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Tree items.
 * @returns {number} Total layer count.
 */
function countTotalLayers(items: Array<ProjectLayerItem | ProjectGroupItem>): number {
  let count = 0;
  for (const item of items) {
    if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
      count += countTotalLayers((item as ProjectGroupItem).children);
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * @description Recursively counts total and visible layers within the project tree taking ancestor visibility into account.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Tree items.
 * @param {boolean} [parentVisible=true] - Effective visibility of parent container.
 * @returns {{ total: number; visible: number }} Total and visible layer counts.
 */
function countLayers(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  parentVisible: boolean = true
): { total: number; visible: number } {
  let total = 0;
  let visible = 0;
  for (const item of items) {
    if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
      const group = item as ProjectGroupItem;
      const isGroupEffectiveVisible = parentVisible && group.visible !== false;
      const sub = countLayers(group.children, isGroupEffectiveVisible);
      total += sub.total;
      visible += sub.visible;
    } else {
      total += 1;
      if (parentVisible && item.visible !== false) {
        visible += 1;
      }
    }
  }
  return { total, visible };
}

/**
 * @signal projectTreeStatsSignal
 * @description Computed signal deriving total and visible layer counts across the project tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @type {ReadonlySignal<{ total: number; visible: number }>}
 */
export const projectTreeStatsSignal = computed(() => {
  if (!projectVisibleSignal.value) {
    return { total: countTotalLayers(projectTreeSignal.value), visible: 0 };
  }
  return countLayers(projectTreeSignal.value, true);
});

/**
 * @description Recursively extracts all selected node IDs from the tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Tree items.
 * @returns {string[]} Selected node IDs.
 */
function extractSelectedIds(items: Array<ProjectLayerItem | ProjectGroupItem>): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.selected) {
      if (item.id) ids.push(item.id);
    }
    if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
      ids.push(...extractSelectedIds((item as ProjectGroupItem).children));
    }
  }
  return ids;
}

/**
 * @signal isProjectSelectedSignal
 * @description Reactive signal indicating whether the project root row is selected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isProjectSelectedSignal = signal<boolean>(false);

/**
 * @signal selectedNodeIdsSignal
 * @description Computed signal deriving array of all currently selected node identifiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @type {ReadonlySignal<string[]>}
 */
export const selectedNodeIdsSignal = computed(() => {
  const ids = extractSelectedIds(projectTreeSignal.value);
  if (isProjectSelectedSignal.value) {
    ids.unshift('project');
  }
  return ids;
});

/**
 * @description Sets the active layer selection in the project tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string | null} layerId - Target layer identifier.
 * @returns {void}
 */
export function setActiveLayer(layerId: string | null): void {
  activeLayerIdSignal.value = layerId;
}

/**
 * @description Toggles the global project visibility flag.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @returns {void}
 */
export function toggleProjectVisibility(): void {
  projectVisibleSignal.value = !projectVisibleSignal.value;
}

/**
 * @description Recursively toggles the visibility flag of a layer or group node in local tree state and synchronizes over IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} nodeId - Target node identifier.
 * @returns {void}
 */
export function toggleNodeVisibility(nodeId: string): void {
  let nextVisibility = true;
  function updateNode(items: Array<ProjectLayerItem | ProjectGroupItem>): Array<ProjectLayerItem | ProjectGroupItem> {
    return items.map(item => {
      if (item.id === nodeId) {
        nextVisibility = item.visible === false ? true : false;
        return { ...item, visible: nextVisibility };
      }
      if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
        return {
          ...item,
          children: updateNode((item as ProjectGroupItem).children)
        };
      }
      return item;
    });
  }
  projectTreeSignal.value = updateNode(projectTreeSignal.value);
  isProjectDirtySignal.value = true;

  if (typeof window !== 'undefined' && window.electronAPI?.setNodeVisibility) {
    window.electronAPI.setNodeVisibility(nodeId, nextVisibility);
  }
}

/**
 * @description Recursively toggles the expanded accordion flag of a group node in local tree state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} groupId - Target group identifier.
 * @returns {void}
 */
export function toggleGroupExpanded(groupId: string): void {
  function updateGroup(items: Array<ProjectLayerItem | ProjectGroupItem>): Array<ProjectLayerItem | ProjectGroupItem> {
    return items.map(item => {
      if ('children' in item && item.id === groupId) {
        const group = item as ProjectGroupItem;
        return { ...group, expanded: group.expanded === false ? true : false };
      }
      if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
        return {
          ...item,
          children: updateGroup((item as ProjectGroupItem).children)
        };
      }
      return item;
    });
  }
  projectTreeSignal.value = updateGroup(projectTreeSignal.value);
}

/**
 * @description Requests inline editing for the currently selected node if exactly one node (or the project root) is selected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @returns {void}
 */
export function requestRenameSelectedNode(): void {
  const selected = selectedNodeIdsSignal.value;
  if (selected.length === 1) {
    editingNodeIdSignal.value = selected[0];
  }
}

/**
 * @description Renames a layer, group, or project document root locally and dispatches update over IPC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {string} nodeId - Target node identifier or 'project' for root document.
 * @param {string} newName - New name string.
 * @returns {void}
 */
export function renameNode(nodeId: string, newName: string): void {
  const trimmed = newName.replace(/[\r\n]+/g, ' ').trim();
  if (!trimmed) {
    return;
  }

  if (nodeId === 'project') {
    if (projectNameSignal.value !== trimmed) {
      projectNameSignal.value = trimmed;
      isProjectDirtySignal.value = true;
    }
  } else {
    let changed = false;
    function update(items: Array<ProjectLayerItem | ProjectGroupItem>): Array<ProjectLayerItem | ProjectGroupItem> {
      return items.map(item => {
        if (item.id === nodeId) {
          if (item.name !== trimmed) {
            changed = true;
            return { ...item, name: trimmed };
          }
          return item;
        }
        if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
          return {
            ...item,
            children: update((item as ProjectGroupItem).children)
          };
        }
        return item;
      });
    }
    const nextTree = update(projectTreeSignal.value);
    if (changed) {
      projectTreeSignal.value = nextTree;
      isProjectDirtySignal.value = true;
    }
  }

  if (typeof window !== 'undefined') {
    if (window.electronAPI?.renameLayerTreeNode) {
      window.electronAPI.renameLayerTreeNode(nodeId, trimmed);
    } else if (window.electronAPI?.renameNode) {
      window.electronAPI.renameNode(nodeId, trimmed);
    }
  }
}

/**
 * @description Updates the selected node IDs across the local tree and sends IPC update to Main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {string[]} selectedNodeIds - Node identifiers to select.
 * @returns {void}
 */
export function setNodeSelection(selectedNodeIds: string[]): void {
  isProjectSelectedSignal.value = selectedNodeIds.includes('project');
  const selectedSet = new Set(selectedNodeIds);
  function updateSelection(items: Array<ProjectLayerItem | ProjectGroupItem>): Array<ProjectLayerItem | ProjectGroupItem> {
    return items.map(item => {
      const isSelected = item.id ? selectedSet.has(item.id) : false;
      const updated = { ...item, selected: isSelected };
      if ('children' in updated && Array.isArray((updated as ProjectGroupItem).children)) {
        (updated as ProjectGroupItem).children = updateSelection((updated as ProjectGroupItem).children);
      }
      return updated;
    });
  }
  projectTreeSignal.value = updateSelection(projectTreeSignal.value);

  if (typeof window !== 'undefined' && window.electronAPI?.setNodeSelection) {
    window.electronAPI.setNodeSelection(selectedNodeIds.filter(id => id !== 'project'));
  }
}

/**
 * @description Selects a single tree node, clearing all other selections.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} nodeId - Target node identifier.
 * @returns {void}
 */
export function selectSingleNode(nodeId: string): void {
  setNodeSelection([nodeId]);
}

/**
 * @description Toggles selection status of a target node without modifying other selections.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} nodeId - Target node identifier.
 * @returns {void}
 */
export function toggleNodeSelection(nodeId: string): void {
  const current = new Set(selectedNodeIdsSignal.value);
  if (current.has(nodeId)) {
    current.delete(nodeId);
  } else {
    current.add(nodeId);
  }
  setNodeSelection(Array.from(current));
}

/**
 * @description Clears all active node selections in the tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @returns {void}
 */
export function clearNodeSelection(): void {
  setNodeSelection([]);
}

/**
 * @description Selects a range of nodes between an anchor node and target node based on visible display order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} anchorId - Range anchor node identifier.
 * @param {string} targetId - Range end node identifier.
 * @returns {void}
 */
export function selectRangeNodes(anchorId: string, targetId: string): void {
  function flattenVisible(items: Array<ProjectLayerItem | ProjectGroupItem>): string[] {
    const list: string[] = [];
    for (const item of items) {
      if (item.id) list.push(item.id);
      if ('children' in item && item.expanded !== false && Array.isArray((item as ProjectGroupItem).children)) {
        list.push(...flattenVisible((item as ProjectGroupItem).children));
      }
    }
    return list;
  }
  const flat = flattenVisible(projectTreeSignal.value);
  const idx1 = flat.indexOf(anchorId);
  const idx2 = flat.indexOf(targetId);
  if (idx1 === -1 || idx2 === -1) {
    setNodeSelection([targetId]);
    return;
  }
  const start = Math.min(idx1, idx2);
  const end = Math.max(idx1, idx2);
  const range = flat.slice(start, end + 1);
  setNodeSelection(range);
}

/**
 * @description Registers an extensible hook allowing external modules to inject popup context menu items.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {LayerTreeContextMenuHook} hook - Context menu items provider function.
 * @returns {() => void} Unsubscribe callback.
 */
export function registerLayerTreeContextMenuHook(hook: LayerTreeContextMenuHook): () => void {
  layerTreeContextMenuHooksSignal.value = [...layerTreeContextMenuHooksSignal.value, hook];
  return () => {
    layerTreeContextMenuHooksSignal.value = layerTreeContextMenuHooksSignal.value.filter(h => h !== hook);
  };
}

/**
 * @description Recursively extracts all active leaf layer IDs present in a project layers tree hierarchy.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Tree items to traverse.
 * @param {Set<string>} idSet - Accumulator set collecting leaf layer identifiers.
 * @returns {void}
 */
export function extractLeafLayerIds(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  idSet: Set<string>
): void {
  for (const item of items) {
    if ('children' in item && Array.isArray((item as any).children)) {
      extractLeafLayerIds((item as any).children, idSet);
    } else if (item.id) {
      idSet.add(item.id);
    }
  }
}

/**
 * @function findItemInTree
 * @description Recursively searches for a LayerTreeNode by its identifier.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Tree items to search.
 * @param {string} id - Target identifier.
 * @returns {ProjectLayerItem | ProjectGroupItem | null} Matching item, or null if not found.
 */
export function findItemInTree(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  id: string
): ProjectLayerItem | ProjectGroupItem | null {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
    if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
      const found = findItemInTree((item as ProjectGroupItem).children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// Automatically subscribe to projectTreeSignal changes to reset activeLayerIdSignal if active layer is removed
projectTreeSignal.subscribe((tree) => {
  if (activeLayerIdSignal.value) {
    const activeLayerIds = new Set<string>();
    extractLeafLayerIds(tree, activeLayerIds);
    if (!activeLayerIds.has(activeLayerIdSignal.value)) {
      activeLayerIdSignal.value = null;
    }
  } else if (tree.length === 0) {
    activeLayerIdSignal.value = null;
  }
});

// Automatically subscribe to IPC tree broadcasts from Electron Main process
if (typeof window !== 'undefined' && window.electronAPI?.onProjectLayersTreeUpdated) {
  window.electronAPI.onProjectLayersTreeUpdated((tree: Array<ProjectLayerItem | ProjectGroupItem>) => {
    // Preserve featureCount from projectLayersSignal or previous tree if incoming item lacks it
    const enrichTreeWithCounts = (
      items: Array<ProjectLayerItem | ProjectGroupItem>
    ): Array<ProjectLayerItem | ProjectGroupItem> => {
      return items.map((item) => {
        if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
          return {
            ...item,
            children: enrichTreeWithCounts((item as ProjectGroupItem).children)
          };
        }
        if (item.id) {
          const desc = projectLayersSignal.value.find((l) => l.id === item.id);
          const currentInTree = findItemInTree(projectTreeSignal.value, item.id) as ProjectLayerItem | null;
          const count = (item as ProjectLayerItem).featureCount ?? desc?.featureCount ?? currentInTree?.featureCount;
          if (count !== undefined) {
            return { ...item, featureCount: count };
          }
        }
        return item;
      });
    };

    const enrichedTree = enrichTreeWithCounts(tree);
    projectTreeSignal.value = enrichedTree;
    if (enrichedTree.length > 0 || hasProjectSignal.value) {
      hasProjectSignal.value = true;
      if (!projectNameSignal.value) {
        projectNameSignal.value = 'Untitled Project';
      }
    }

    // Synchronize projectLayersSignal and layerStylesSignal to remove deleted layers
    const activeLayerIds = new Set<string>();
    extractLeafLayerIds(enrichedTree, activeLayerIds);

    if (projectLayersSignal.value.length > 0) {
      const remainingLayers = projectLayersSignal.value.filter((layer) => activeLayerIds.has(layer.id));
      projectLayersSignal.value = remainingLayers.map((desc) => {
        const treeItem = findItemInTree(enrichedTree, desc.id) as ProjectLayerItem | null;
        if (treeItem && treeItem.featureCount !== undefined && desc.featureCount !== treeItem.featureCount) {
          return { ...desc, featureCount: treeItem.featureCount };
        }
        return desc;
      });
    }

    const currentStyles = { ...layerStylesSignal.value };
    let stylesPruned = false;
    for (const styleId of Object.keys(currentStyles)) {
      if (!activeLayerIds.has(styleId)) {
        delete currentStyles[styleId];
        stylesPruned = true;
      }
    }
    if (stylesPruned) {
      layerStylesSignal.value = currentStyles;
    }
  });
}

// Automatically subscribe to IPC metadata broadcasts from Electron Main process
if (typeof window !== 'undefined' && window.electronAPI?.onProjectMetadataUpdated) {
  window.electronAPI.onProjectMetadataUpdated((metadata: any) => {
    if (metadata && typeof metadata.title === 'string') {
      projectNameSignal.value = metadata.title;
    }
  });
}

// Automatically subscribe to IPC dirty state broadcasts from Electron Main process
if (typeof window !== 'undefined' && window.electronAPI?.onProjectDirtyStateChanged) {
  window.electronAPI.onProjectDirtyStateChanged((dirty: boolean) => {
    isProjectDirtySignal.value = dirty;
  });
}

/**
 * @description Ingests a new LayerDescriptor into renderer state, updating layerStylesSignal, projectLayersSignal, and projectTreeSignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {LayerDescriptor} descriptor - Newly added layer descriptor.
 * @returns {void}
 */
export function handleLayerAdded(descriptor: LayerDescriptor): void {
  batch(() => {
    // 1. Parse and register style into layerStylesSignal FIRST before projectLayersSignal triggers MapController sync
    const resolvedStyle = resolveLayerStyle(
      descriptor.style,
      currentProjectSignal.value?.styles,
      descriptor.geometryKind || 'Unknown'
    );

    layerStylesSignal.value = {
      ...layerStylesSignal.value,
      [descriptor.id]: resolvedStyle
    };

    // 2. Update projectLayersSignal (insert or replace in-place)
    const existingIndex = projectLayersSignal.value.findIndex((l) => l.id === descriptor.id);
    if (existingIndex >= 0) {
      const updated = [...projectLayersSignal.value];
      updated[existingIndex] = descriptor;
      projectLayersSignal.value = updated;
    } else {
      projectLayersSignal.value = [...projectLayersSignal.value, descriptor];
    }

    // 3. Ensure layer appears in projectTreeSignal if not already present, or update its count
    const existingTreeItem = findItemInTree(projectTreeSignal.value, descriptor.id);
    if (!existingTreeItem) {
      projectTreeSignal.value = [...projectTreeSignal.value, descriptor];
    } else {
      const updateCountInTree = (
        items: Array<ProjectLayerItem | ProjectGroupItem>
      ): Array<ProjectLayerItem | ProjectGroupItem> => {
        return items.map((item) => {
          if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
            return {
              ...item,
              children: updateCountInTree((item as ProjectGroupItem).children)
            };
          }
          if (item.id === descriptor.id) {
            return { ...item, featureCount: descriptor.featureCount, extent: descriptor.extent };
          }
          return item;
        });
      };
      projectTreeSignal.value = updateCountInTree(projectTreeSignal.value);
    }

    // Ensure project state is marked open
    hasProjectSignal.value = true;
    if (!projectNameSignal.value) {
      projectNameSignal.value = 'Untitled Project';
    }

    // Newly added layer becomes active (in batch additions, the last added layer becomes active)
    activeLayerIdSignal.value = descriptor.id;
  });
}

/**
 * @function updateLayerFeatureCount
 * @description Updates the spatial feature count for a specific layer across projectLayersSignal and projectTreeSignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {string} layerId - Unique identifier of the layer.
 * @param {number} featureCount - New total feature count.
 * @returns {void}
 */
export function updateLayerFeatureCount(layerId: string, featureCount: number): void {
  projectLayersSignal.value = projectLayersSignal.value.map((l) =>
    l.id === layerId ? { ...l, featureCount } : l
  );

  const updateTree = (
    items: Array<ProjectLayerItem | ProjectGroupItem>
  ): Array<ProjectLayerItem | ProjectGroupItem> => {
    return items.map((item) => {
      if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
        return {
          ...item,
          children: updateTree((item as ProjectGroupItem).children)
        };
      }
      if (item.id === layerId) {
        return { ...item, featureCount };
      }
      return item;
    });
  };
  projectTreeSignal.value = updateTree(projectTreeSignal.value);
}

// Automatically subscribe to IPC layer added broadcasts from Electron Main process
if (typeof window !== 'undefined' && window.electronAPI?.onLayerAdded) {
  window.electronAPI.onLayerAdded((descriptor: LayerDescriptor) => {
    handleLayerAdded(descriptor);
  });
}


