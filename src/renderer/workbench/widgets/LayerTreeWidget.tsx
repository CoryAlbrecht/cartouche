/**
 * @file LayerTreeWidget.tsx
 * @module renderer/workbench/widgets/LayerTreeWidget
 * @description Layer tree panel widget managing project layer hierarchy, multi-selection, context menus, drag-and-drop reordering, inline group creation, and modal removal confirmations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link PopupMenu}
 * @see {@link ModalDialog}
 */

import React, { useState, useRef, useCallback } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { BasicWidget } from "./BasicWidget";
import Icon from "@renderer/components/common/Icon";
import { PopupMenu } from "@renderer/components/common/PopupMenu";
import { InlineRenameInput } from "@renderer/components/common/InlineRenameInput";
import { ModalDialog } from "@renderer/workbench/dialogs/ModalDialog";
import { useTranslation } from "@renderer/hooks/useTranslation";
import {
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiVectorPolygon,
  mdiVectorPolyline,
  mdiVectorPoint,
  mdiCheckerboard,
  mdiChevronDown,
  mdiChevronRight,
  mdiTrashCanOutline,
  mdiFolderPlusOutline,
  mdiPencilOutline,
} from "@mdi/js";
import {
  projectTreeSignal,
  hasProjectSignal,
  projectNameSignal,
  projectVisibleSignal,
  activeLayerIdSignal,
  projectTreeStatsSignal,
  selectedNodeIdsSignal,
  layerTreeContextMenuHooksSignal,
  editingNodeIdSignal,
  requestRenameSelectedNode,
  toggleProjectVisibility,
  toggleNodeVisibility,
  toggleGroupExpanded,
  setActiveLayer,
  selectSingleNode,
  toggleNodeSelection,
  selectRangeNodes,
  clearNodeSelection,
  renameNode,
  isProjectDirtySignal,
  type PopupMenuItem,
} from "@renderer/state/projectSignals";
import type { ProjectLayerItem, ProjectGroupItem, GeometryKind } from "@shared/types";
import logoSvg from "../../../../assets/svg/logo.svg";
import type { IDockviewPanelProps } from "dockview-react";

/**
 * @description Resolves Material Design Icon path corresponding to layer geometry kind.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {GeometryKind} [geometryKind] - Layer geometry kind string.
 * @returns {string} MDI icon SVG path string.
 */
function getLayerIcon(geometryKind?: GeometryKind): string {
  switch (geometryKind) {
    case "Point":
      return mdiVectorPoint;
    case "LineString":
      return mdiVectorPolyline;
    case "Polygon":
      return mdiVectorPolygon;
    case "Raster":
      return mdiCheckerboard;
    default:
      return mdiVectorPolygon;
  }
}

/**
 * @description Flattens visible tree items according to current expansion state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Tree items.
 * @returns {Array<ProjectLayerItem | ProjectGroupItem>} Flat list of currently visible nodes.
 */
function flattenVisibleTree(items: Array<ProjectLayerItem | ProjectGroupItem>): Array<ProjectLayerItem | ProjectGroupItem> {
  const result: Array<ProjectLayerItem | ProjectGroupItem> = [];
  for (const item of items) {
    result.push(item);
    if ('children' in item && item.expanded !== false && Array.isArray((item as ProjectGroupItem).children)) {
      result.push(...flattenVisibleTree((item as ProjectGroupItem).children));
    }
  }
  return result;
}

/**
 * @description Recursively searches for and collects nodes matching provided identifiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Tree items.
 * @param {string[]} ids - Target identifiers.
 * @returns {Array<ProjectLayerItem | ProjectGroupItem>} Matched nodes.
 */
function collectNodesByIds(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  ids: string[]
): Array<ProjectLayerItem | ProjectGroupItem> {
  const targetSet = new Set(ids);
  const matched: Array<ProjectLayerItem | ProjectGroupItem> = [];

  function traverse(list: Array<ProjectLayerItem | ProjectGroupItem>) {
    for (const item of list) {
      if (item.id && targetSet.has(item.id)) {
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
 * @description Checks whether candidateId is a descendant of the candidateParent group.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {ProjectGroupItem} candidateParent - Potential ancestor group.
 * @param {string} candidateId - Node ID to test.
 * @returns {boolean} True if candidateId is inside candidateParent.
 */
function isDescendantNode(candidateParent: ProjectGroupItem, candidateId: string): boolean {
  if (!Array.isArray(candidateParent.children)) return false;
  for (const child of candidateParent.children) {
    if (child.id === candidateId) return true;
    if ('children' in child && isDescendantNode(child as ProjectGroupItem, candidateId)) {
      return true;
    }
  }
  return false;
}

/**
 * Movement tolerance threshold in pixels before an interaction is considered a drag gesture rather than a click.
 * @constant {number}
 */
const MOUSE_DRAG_MOVE_THRESHOLD_PX = 5;

/**
 * Maximum dwell hold time in milliseconds for click-and-hold without movement to be treated as a click gesture.
 * @constant {number}
 */
const MOUSE_CLICK_HOLD_TIMEOUT_MS = 800;



/**
 * @typedef {Object} LayerTreeWidgetProps
 * @property {() => void} [onClose] - Callback when widget is closed.
 * @property {() => void} [onUndock] - Callback when widget is undocked.
 */
export interface LayerTreeWidgetProps extends Partial<IDockviewPanelProps> {
  onClose?: () => void;
  onUndock?: () => void;
}

/**
 * @component LayerTreeWidget
 * @description Subclasses BasicWidget to render the hierarchical GIS layer tree view, multi-selection, context menus, drag-and-drop reordering, and modal removal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {LayerTreeWidgetProps} props - Component properties.
 * @returns {React.ReactElement} Layer tree widget panel instance.
 */
export const LayerTreeWidget: React.FC<LayerTreeWidgetProps> = (props) => {
  useSignals();
  const { t } = useTranslation();
  const tree = projectTreeSignal.value;
  const hasProject = hasProjectSignal.value;
  const projectName = projectNameSignal.value || "New Project";
  const projectVisible = projectVisibleSignal.value;
  const activeLayerId = activeLayerIdSignal.value;
  const selectedNodeIds = selectedNodeIdsSignal.value;
  const { total: totalCount, visible: visibleCount } = projectTreeStatsSignal.value;

  // Selection range anchor reference
  const selectionAnchorRef = useRef<string | null>(null);

  // Drag and drop state
  const draggedNodeIdsRef = useRef<string[]>([]);
  const [dragOverState, setDragOverState] = useState<{
    targetId: string;
    position: 'before' | 'into' | 'append-root';
    indentLevel: number;
  } | null>(null);

  // Inline rename editing state driven by signal
  const editingNodeId = editingNodeIdSignal.value;
  const setEditingNodeId = useCallback((id: string | null) => {
    editingNodeIdSignal.value = id;
  }, []);

  // Pointer down state tracking for click vs hold vs drag accessibility gesture discrimination
  const rowPointerDownRef = useRef<{
    nodeId: string;
    isLayer: boolean;
    startX: number;
    startY: number;
    startTime: number;
    button: number;
  } | null>(null);

  // Imperative commit handler ref and input DOM node ref for active inline edit
  const commitInlineEditRef = useRef<(() => void) | null>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const commitInlineEdit = useCallback(() => {
    if (commitInlineEditRef.current) {
      commitInlineEditRef.current();
    } else {
      setEditingNodeId(null);
    }
  }, [setEditingNodeId]);

  // Popup Menu state
  const [contextMenuState, setContextMenuState] = useState<{
    position: { x: number; y: number } | null;
    actionableNodes: Array<ProjectLayerItem | ProjectGroupItem>;
    targetNode: ProjectLayerItem | ProjectGroupItem | null;
  }>({
    position: null,
    actionableNodes: [],
    targetNode: null,
  });

  // Modal Dialog confirmation state for removal
  const [removalModalState, setRemovalModalState] = useState<{
    isOpen: boolean;
    actionableNodes: Array<ProjectLayerItem | ProjectGroupItem>;
  }>({
    isOpen: false,
    actionableNodes: [],
  });

  // Dynamic displayName formatted as "Layers %1/%2" (e.g. Layers 0/0)
  const displayName = `Layers ${visibleCount}/${totalCount}`;

  // Keyboard navigation handler
  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ignore tree keyboard shortcuts when editing a node title or when focused on editable input elements
      if (editingNodeIdSignal.value !== null) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const flatNodes = flattenVisibleTree(tree);
      if (flatNodes.length === 0) return;

      const currentSelectedIds = selectedNodeIdsSignal.value;
      const lastSelectedId = currentSelectedIds[currentSelectedIds.length - 1];
      const currentIndex = flatNodes.findIndex((n) => n.id === lastSelectedId);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = currentIndex < flatNodes.length - 1 ? currentIndex + 1 : 0;
          const nextNode = flatNodes[nextIndex];
          if (nextNode && nextNode.id) {
            selectSingleNode(nextNode.id);
            selectionAnchorRef.current = nextNode.id;
            if (!('children' in nextNode)) {
              setActiveLayer(nextNode.id);
            }
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : flatNodes.length - 1;
          const prevNode = flatNodes[prevIndex];
          if (prevNode && prevNode.id) {
            selectSingleNode(prevNode.id);
            selectionAnchorRef.current = prevNode.id;
            if (!('children' in prevNode)) {
              setActiveLayer(prevNode.id);
            }
          }
          break;
        }
        case "ArrowRight": {
          if (currentIndex !== -1) {
            const current = flatNodes[currentIndex];
            if ('children' in current && current.id && current.expanded === false) {
              e.preventDefault();
              toggleGroupExpanded(current.id);
            }
          }
          break;
        }
        case "ArrowLeft": {
          if (currentIndex !== -1) {
            const current = flatNodes[currentIndex];
            if ('children' in current && current.id && current.expanded !== false) {
              e.preventDefault();
              toggleGroupExpanded(current.id);
            }
          }
          break;
        }
        case " ": {
          e.preventDefault();
          if (currentSelectedIds.length > 0) {
            for (const id of currentSelectedIds) {
              toggleNodeVisibility(id);
            }
          }
          break;
        }
        case "Delete": {
          e.preventDefault();
          if (currentSelectedIds.length > 0) {
            const nodes = collectNodesByIds(tree, currentSelectedIds);
            if (nodes.length > 0) {
              setRemovalModalState({
                isOpen: true,
                actionableNodes: nodes,
              });
            }
          }
          break;
        }
        case "F2": {
          e.preventDefault();
          requestRenameSelectedNode();
          break;
        }
      }
    },
    [tree]
  );

  // Row selection handler
  const handleRowClick = (
    e: React.MouseEvent,
    nodeId: string,
    isLayer: boolean
  ) => {
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      toggleNodeSelection(nodeId);
      selectionAnchorRef.current = nodeId;
    } else if (e.shiftKey && selectionAnchorRef.current) {
      selectRangeNodes(selectionAnchorRef.current, nodeId);
    } else {
      selectSingleNode(nodeId);
      selectionAnchorRef.current = nodeId;
    }

    if (isLayer) {
      setActiveLayer(nodeId);
    } else {
      setActiveLayer(null);
    }
  };

  /**
   * @description Handles mousedown on a layer tree row, preventing focus steal and premature cancellation of active inline edits while tracking coordinates for click vs hold vs drag gesture discrimination.
   * @param {React.MouseEvent} e - Mouse event.
   * @param {string} nodeId - Target node identifier.
   * @param {boolean} isLayer - True if target node is a leaf layer.
   */
  const handleRowMouseDown = (
    e: React.MouseEvent,
    nodeId: string,
    isLayer: boolean
  ) => {
    if (editingNodeId !== null) {
      // Prevent focus steal and premature cancellation on mousedown:
      // wait for mouseup / release to distinguish click vs hold vs drag.
      e.preventDefault();
    }
    rowPointerDownRef.current = {
      nodeId,
      isLayer,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      button: e.button,
    };
  };

  /**
   * @description Handles row click with gesture validation and edit state synchronization, ensuring accessibility compliance for click-and-hold vs drag.
   * @param {React.MouseEvent} e - Mouse event.
   * @param {string} nodeId - Target node identifier.
   * @param {boolean} isLayer - True if target node is a leaf layer.
   */
  const handleRowClickWithEditCheck = (
    e: React.MouseEvent,
    nodeId: string,
    isLayer: boolean
  ) => {
    const downInfo = rowPointerDownRef.current;
    rowPointerDownRef.current = null;

    if (downInfo) {
      const dx = Math.abs(e.clientX - downInfo.startX);
      const dy = Math.abs(e.clientY - downInfo.startY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - downInfo.startTime;

      // Pointer cancellation & accessibility gesture discrimination:
      // If the mouse moved more than MOUSE_DRAG_MOVE_THRESHOLD_PX (5px)
      // or was held longer than MOUSE_CLICK_HOLD_TIMEOUT_MS (800ms),
      // it is a drag/hold gesture rather than a click gesture.
      if (dist > MOUSE_DRAG_MOVE_THRESHOLD_PX || duration > MOUSE_CLICK_HOLD_TIMEOUT_MS) {
        return;
      }
    }

    if (editingNodeId !== null) {
      if (nodeId === editingNodeId) {
        // Clicking row currently being edited keeps editing intact
        inlineInputRef.current?.focus();
        return;
      }
      // Commit active edit cleanly before switching selection to new row
      commitInlineEdit();
    }

    handleRowClick(e, nodeId, isLayer);
  };

  // Secondary click (right-click) context menu handler
  const handleContextMenu = (
    e: React.MouseEvent,
    node: ProjectLayerItem | ProjectGroupItem
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (editingNodeId !== null) {
      commitInlineEdit();
    }

    let actionable: Array<ProjectLayerItem | ProjectGroupItem>;
    if (node.id && selectedNodeIds.includes(node.id)) {
      // Selected item clicked: apply to all currently selected nodes
      actionable = collectNodesByIds(tree, selectedNodeIds);
    } else {
      // Unselected item clicked: target only that individual node, preserving existing selections
      actionable = [node];
    }

    setContextMenuState({
      position: { x: e.clientX, y: e.clientY },
      actionableNodes: actionable,
      targetNode: node,
    });
  };

  // Secondary click (right-click) context menu handler on project root
  const handleProjectContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (editingNodeId !== null) {
      commitInlineEdit();
    }

    const projectNode = { id: 'project', name: projectName } as ProjectLayerItem;
    setContextMenuState({
      position: { x: e.clientX, y: e.clientY },
      actionableNodes: [projectNode],
      targetNode: projectNode,
    });
  };

  // Build context menu items
  const buildContextMenuItems = (): PopupMenuItem[] => {
    const { actionableNodes, targetNode } = contextMenuState;
    if (actionableNodes.length === 0 || !targetNode) return [];

    if (targetNode.id === 'project') {
      return [
        {
          id: 'rename_layer_tree_node',
          label: t('rename_layer_tree_node') || 'Rename',
          icon: mdiPencilOutline,
          onClick: () => {
            setEditingNodeId('project');
          },
        },
      ];
    }

    const isMultiple = actionableNodes.length > 1;
    const isSingleGroup = !isMultiple && 'children' in actionableNodes[0];

    let removeLabel: string;
    if (isMultiple) {
      removeLabel = t('remove_selected_items') || 'Remove Selected Items';
    } else if (isSingleGroup) {
      removeLabel = t('remove_group') || 'Remove Group';
    } else {
      removeLabel = t('remove_layer') || 'Remove Layer';
    }

    const items: PopupMenuItem[] = [];

    if (!isMultiple && targetNode.id) {
      const targetId = targetNode.id;
      items.push({
        id: 'rename_layer_tree_node',
        label: t('rename_layer_tree_node') || 'Rename',
        icon: mdiPencilOutline,
        onClick: () => {
          setEditingNodeId(targetId);
        },
      });
    }

    items.push(
      {
        id: 'create-group',
        label: t('create_group') || 'Create Group',
        icon: mdiFolderPlusOutline,
        onClick: () => {
          const newGroupId = `group-${Date.now()}`;
          const childIds = actionableNodes.map((n) => n.id).filter(Boolean) as string[];
          if (targetNode.id) {
            isProjectDirtySignal.value = true;
            if (window.electronAPI?.createGroup) {
              window.electronAPI.createGroup("New Group", targetNode.id, childIds, newGroupId);
            }
            selectSingleNode(newGroupId);
            setActiveLayer(null);
            setEditingNodeId(newGroupId);
          }
        },
      },
      {
        id: 'remove-nodes',
        label: removeLabel,
        icon: mdiTrashCanOutline,
        onClick: () => {
          setRemovalModalState({
            isOpen: true,
            actionableNodes,
          });
        },
      }
    );

    // External hooks contributions
    const externalHooks = layerTreeContextMenuHooksSignal.value;
    if (externalHooks.length > 0) {
      const extraItems: PopupMenuItem[] = [];
      for (const hook of externalHooks) {
        extraItems.push(...hook({ actionableNodes, isMultiple }));
      }
      if (extraItems.length > 0) {
        items.push({ id: 'divider-external', label: '', separator: true });
        items.push(...extraItems);
      }
    }

    return items;
  };

  // Drag and Drop handlers
  const handleDragStart = (
    e: React.DragEvent,
    node: ProjectLayerItem | ProjectGroupItem
  ) => {
    if (editingNodeIdSignal.value !== null || !node.id) {
      e.preventDefault();
      return;
    }
    if (selectedNodeIds.includes(node.id)) {
      draggedNodeIdsRef.current = selectedNodeIds;
    } else {
      draggedNodeIdsRef.current = [node.id];
    }
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (
    e: React.DragEvent,
    node: ProjectLayerItem | ProjectGroupItem,
    indentLevel: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedIds = draggedNodeIdsRef.current;
    if (draggedIds.length === 0 || !node.id) return;

    // Check cycles: no dragged group can drop into itself or its descendants
    const draggedNodes = collectNodesByIds(tree, draggedIds);
    for (const dragged of draggedNodes) {
      if (dragged.id === node.id) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      if ('children' in dragged && isDescendantNode(dragged as ProjectGroupItem, node.id)) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
    }

    const position = 'children' in node ? 'into' : 'before';
    setDragOverState({
      targetId: node.id,
      position,
      indentLevel,
    });
  };

  const handleDrop = (
    e: React.DragEvent,
    node: ProjectLayerItem | ProjectGroupItem
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedIds = draggedNodeIdsRef.current;
    if (draggedIds.length === 0 || !node.id) {
      setDragOverState(null);
      return;
    }

    // Abort if dropping into self or descendant
    const draggedNodes = collectNodesByIds(tree, draggedIds);
    for (const dragged of draggedNodes) {
      if (dragged.id === node.id || ('children' in dragged && isDescendantNode(dragged as ProjectGroupItem, node.id))) {
        setDragOverState(null);
        return;
      }
    }

    const position = 'children' in node ? 'into' : 'before';
    isProjectDirtySignal.value = true;
    if (window.electronAPI?.reorderNodes) {
      window.electronAPI.reorderNodes(draggedIds, node.id, position);
    }

    draggedNodeIdsRef.current = [];
    setDragOverState(null);
  };

  const handleDragEnd = () => {
    draggedNodeIdsRef.current = [];
    setDragOverState(null);
  };

  const handleEmptyViewportDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverState({
      targetId: 'root',
      position: 'append-root',
      indentLevel: 1,
    });
  };

  const handleEmptyViewportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedIds = draggedNodeIdsRef.current;
    if (draggedIds.length > 0) {
      isProjectDirtySignal.value = true;
      if (window.electronAPI?.reorderNodes) {
        window.electronAPI.reorderNodes(draggedIds, 'root', 'append-root');
      }
    }
    draggedNodeIdsRef.current = [];
    setDragOverState(null);
  };

  // Render an individual layer tree node row
  const renderLayerRow = (
    layer: ProjectLayerItem,
    indentLevel: number = 0,
    ancestorVisible: boolean = true
  ) => {
    const isSelected = layer.id ? selectedNodeIds.includes(layer.id) : false;
    const isActive = layer.id === activeLayerId;
    const resolvedName = layer.name;
    const iconPath = getLayerIcon(layer.geometryKind);
    const isDimmed = !projectVisible || !ancestorVisible || layer.visible === false;
    const isDropTarget = dragOverState?.targetId === layer.id;
    const isEditing = Boolean(layer.id && editingNodeId === layer.id);

    return (
      <React.Fragment key={layer.id}>
        {isDropTarget && dragOverState?.position === 'before' && (
          <div
            className='tree-drop-marker'
            style={{ marginLeft: `${dragOverState.indentLevel * 18 + 6}px` }}
          />
        )}
        <div
          className={`tree-node-row tree-node-layer ${isActive ? "active" : ""} ${isSelected ? "selected" : ""} ${isDimmed ? "dimmed" : ""}`}
          style={{ paddingLeft: `${indentLevel * 18 + 6}px` }}
          draggable={editingNodeId === null}
          onDragStart={(e) => handleDragStart(e, layer)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, layer, indentLevel)}
          onDrop={(e) => handleDrop(e, layer)}
          onMouseDown={(e) => handleRowMouseDown(e, layer.id, true)}
          onClick={(e) => handleRowClickWithEditCheck(e, layer.id, true)}
          onContextMenu={(e) => handleContextMenu(e, layer)}>
          <span className='tree-indent' />

          <input
            type='checkbox'
            className='tree-checkbox'
            checked={layer.visible !== false}
            onChange={() => toggleNodeVisibility(layer.id)}
            onClick={(e) => e.stopPropagation()}
            title='Toggle layer visibility'
          />

          <span
            className='tree-icon-slot'
            style={{ color: "#2563eb" }}>
            <Icon path={iconPath} size='16px' />
          </span>

          {isEditing ? (
            <InlineRenameInput
              initialValue={resolvedName}
              commitRef={commitInlineEditRef}
              inputRef={inlineInputRef}
              onSave={(val) => {
                renameNode(layer.id, val);
                setEditingNodeId(null);
              }}
              onCancel={() => setEditingNodeId(null)}
            />
          ) : (
            <span
              className='tree-node-title'
              title={resolvedName}
              onClick={(e) => {
                if (isSelected) {
                  e.stopPropagation();
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (layer.id) {
                  setEditingNodeId(layer.id);
                }
              }}>
              {resolvedName}
            </span>
          )}
        </div>
      </React.Fragment>
    );
  };

  // Render a layer group node row and its children
  const renderGroupRow = (
    group: ProjectGroupItem,
    indentLevel: number = 1,
    ancestorVisible: boolean = true
  ) => {
    const isExpanded = group.expanded !== false;
    const groupId = group.id || `group-${group.name}`;
    const isSelected = group.id ? selectedNodeIds.includes(group.id) : false;
    const isGroupEffectiveVisible = ancestorVisible && group.visible !== false;
    const isDimmed = !projectVisible || !ancestorVisible || group.visible === false;
    const isEditing = editingNodeId === groupId;
    const isDropTarget = dragOverState?.targetId === groupId;

    return (
      <React.Fragment key={groupId}>
        {isDropTarget && dragOverState?.position === 'before' && (
          <div
            className='tree-drop-marker'
            style={{ marginLeft: `${dragOverState.indentLevel * 18 + 6}px` }}
          />
        )}
        <div
          className={`tree-node-row tree-node-group ${isSelected ? "selected" : ""} ${isDimmed ? "dimmed" : ""}`}
          style={{ paddingLeft: `${indentLevel * 18 + 6}px` }}
          draggable={editingNodeId === null}
          onDragStart={(e) => handleDragStart(e, group)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, group, indentLevel)}
          onDrop={(e) => handleDrop(e, group)}
          onMouseDown={(e) => handleRowMouseDown(e, groupId, false)}
          onClick={(e) => handleRowClickWithEditCheck(e, groupId, false)}
          onContextMenu={(e) => handleContextMenu(e, group)}>
          <span
            className='tree-chevron'
            onClick={(e) => {
              e.stopPropagation();
              toggleGroupExpanded(groupId);
            }}>
            <Icon
              path={isExpanded ? mdiChevronDown : mdiChevronRight}
              size='16px'
            />
          </span>

          <input
            type='checkbox'
            className='tree-checkbox'
            checked={group.visible !== false}
            onChange={() => toggleNodeVisibility(groupId)}
            onClick={(e) => e.stopPropagation()}
            title='Toggle group visibility'
          />

          <span className='tree-icon-slot group-icon'>
            <Icon
              path={isExpanded ? mdiFolderOpenOutline : mdiFolderOutline}
              size='16px'
            />
          </span>

          {isEditing ? (
            <InlineRenameInput
              initialValue={group.name}
              commitRef={commitInlineEditRef}
              inputRef={inlineInputRef}
              onSave={(val) => {
                renameNode(groupId, val);
                setEditingNodeId(null);
              }}
              onCancel={() => setEditingNodeId(null)}
            />
          ) : (
            <span
              className='tree-node-title'
              onClick={(e) => {
                if (isSelected) {
                  e.stopPropagation();
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingNodeId(groupId);
              }}>
              {group.name}
            </span>
          )}
        </div>

        {isDropTarget && dragOverState?.position === 'into' && (
          <div
            className='tree-drop-marker'
            style={{ marginLeft: `${(indentLevel + 1) * 18 + 6}px` }}
          />
        )}

        {isExpanded && Array.isArray(group.children) && (
          <div className='tree-node-children'>
            {group.children.map((child) =>
              renderTreeNode(child, indentLevel + 1, isGroupEffectiveVisible)
            )}
          </div>
        )}
      </React.Fragment>
    );
  };

  // Render any tree node (group or leaf layer)
  const renderTreeNode = (
    item: ProjectLayerItem | ProjectGroupItem,
    indentLevel: number = 1,
    ancestorVisible: boolean = true
  ) => {
    if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
      return renderGroupRow(item as ProjectGroupItem, indentLevel, ancestorVisible);
    }
    return renderLayerRow(item as ProjectLayerItem, indentLevel, ancestorVisible);
  };

  // Formulate removal modal strings
  const getRemovalModalContent = () => {
    const { actionableNodes } = removalModalState;
    if (actionableNodes.length === 0) return { title: '', prompt: '' };

    const isMultiple = actionableNodes.length > 1;
    const isSingleGroup = !isMultiple && 'children' in actionableNodes[0];

    let title: string;
    let prompt: string;

    if (isMultiple) {
      title = t('remove_items_title') || 'Remove Selected Items';
      prompt = t('remove_items_prompt', { 0: actionableNodes.length }) ||
        `Are you sure you want to remove the ${actionableNodes.length} selected items from the project? Any groups will also have their contents removed.`;
    } else if (isSingleGroup) {
      title = t('remove_group_title') || 'Remove Group';
      prompt = t('remove_group_prompt', { 0: actionableNodes[0].name }) ||
        `Are you sure you want to remove group '${actionableNodes[0].name}'? This will also remove all items inside it.`;
    } else {
      title = t('remove_layer_title') || 'Remove Layer';
      prompt = t('remove_layer_prompt', { 0: actionableNodes[0].name }) ||
        `Are you sure you want to remove layer '${actionableNodes[0].name}' from the project?`;
    }

    return { title, prompt };
  };

  const { title: modalTitle, prompt: modalPrompt } = getRemovalModalContent();

  return (
    <BasicWidget
      name='layer-tree-widget'
      displayName={displayName}
      className='layer-tree-panel-widget'
      {...props}>
      <div
        className='layer-tree-container'
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverState(null);
          }
        }}
        style={{
          backgroundColor: "#ffffff",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          outline: "none",
        }}>
        {/* Tree Control Content (Pure White Background) */}
        <div
          className='layer-tree-viewport'
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && editingNodeId !== null) {
              e.preventDefault();
              rowPointerDownRef.current = {
                nodeId: 'empty',
                isLayer: false,
                startX: e.clientX,
                startY: e.clientY,
                startTime: Date.now(),
                button: e.button,
              };
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const downInfo = rowPointerDownRef.current;
              rowPointerDownRef.current = null;
              if (downInfo) {
                const dx = Math.abs(e.clientX - downInfo.startX);
                const dy = Math.abs(e.clientY - downInfo.startY);
                const dist = Math.sqrt(dx * dx + dy * dy);
                const duration = Date.now() - downInfo.startTime;
                if (dist > MOUSE_DRAG_MOVE_THRESHOLD_PX || duration > MOUSE_CLICK_HOLD_TIMEOUT_MS) {
                  return;
                }
              }
              if (editingNodeId !== null) {
                commitInlineEdit();
              }
              if (hasProject) {
                clearNodeSelection();
                setActiveLayer(null);
              }
            }
          }}
          onDragOver={handleEmptyViewportDragOver}
          onDrop={handleEmptyViewportDrop}
          style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#ffffff",
            padding: "4px 0",
          }}>
          {hasProject && (
            <div className='layer-tree-root'>
              {/* Top-Level Project Root Item */}
              <div
                className={`tree-node-row tree-node-project ${selectedNodeIds.includes('project') ? "selected" : ""}`}
                onMouseDown={(e) => handleRowMouseDown(e, 'project', false)}
                onClick={(e) => handleRowClickWithEditCheck(e, 'project', false)}
                onContextMenu={handleProjectContextMenu}>
                <input
                  type='checkbox'
                  className='tree-checkbox'
                  checked={projectVisible}
                  onChange={toggleProjectVisibility}
                  onClick={(e) => e.stopPropagation()}
                  title='Toggle project visibility'
                />
                <span className='tree-icon-slot project-icon'>
                  <img
                    src={logoSvg}
                    alt='Cartouche'
                    style={{ width: 14, height: 14 }}
                  />
                </span>
                {editingNodeId === 'project' ? (
                  <InlineRenameInput
                    initialValue={projectName}
                    commitRef={commitInlineEditRef}
                    inputRef={inlineInputRef}
                    onSave={(val) => {
                      renameNode('project', val);
                      setEditingNodeId(null);
                    }}
                    onCancel={() => setEditingNodeId(null)}
                  />
                ) : (
                  <span
                    className='tree-node-title project-title'
                    onClick={(e) => {
                      if (selectedNodeIds.includes('project')) {
                        e.stopPropagation();
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingNodeId('project');
                    }}>
                    {projectName}
                  </span>
                )}
              </div>

              {/* Children: Hierarchical Layer Tree */}
              <div className='tree-project-children'>
                {tree.map((item) => renderTreeNode(item, 1, projectVisible))}
              </div>

              {dragOverState?.position === 'append-root' && (
                <div
                  className='tree-drop-marker'
                  style={{ marginLeft: '24px' }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Popup Context Menu */}
      <PopupMenu
        isOpen={Boolean(contextMenuState.position)}
        position={contextMenuState.position}
        items={buildContextMenuItems()}
        onClose={() =>
          setContextMenuState({
            position: null,
            actionableNodes: [],
            targetNode: null,
          })
        }
      />

      {/* Confirmation ModalDialog for Deletion */}
      <ModalDialog
        isOpen={removalModalState.isOpen}
        title={modalTitle}
        onClose={() => setRemovalModalState({ isOpen: false, actionableNodes: [] })}
        buttons={[
          {
            label: t('dialog_cancel') || 'Cancel',
            onClick: () => setRemovalModalState({ isOpen: false, actionableNodes: [] }),
          },
          {
            label: t('dialog_remove') || 'Remove',
            primary: true,
            onClick: () => {
              const nodeIds = removalModalState.actionableNodes
                .map((n) => n.id)
                .filter(Boolean) as string[];
              if (nodeIds.length > 0) {
                isProjectDirtySignal.value = true;
                if (window.electronAPI?.removeNodes) {
                  window.electronAPI.removeNodes(nodeIds);
                }
              }
              setRemovalModalState({ isOpen: false, actionableNodes: [] });
            },
          },
        ]}>
        <div>{modalPrompt}</div>
      </ModalDialog>
    </BasicWidget>
  );
};
