/**
 * @file ProjectBroadcaster.ts
 * @module main/project/ProjectBroadcaster
 * @description Central IPC broadcast dispatcher for transmitting serialized Cartouche project state updates to active Renderer windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 */

import { BrowserWindow } from 'electron';
import type {
  ProjectGroupItem,
  ProjectLayerItem,
  ProjectMetadata,
  ProjectViewport,
  ProjectModel
} from '@shared/types';
import { projectStore } from './ProjectStore';
import { LayerTreeNode } from './models/LayerTreeNode';
import { LayerGroup } from './models/LayerGroup';
import { Layer } from './models/Layer';

/**
 * @description Recursively serializes a LayerTreeNode instance into a clean IPC-safe project item DTO.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {LayerTreeNode} node - Layer or group node to serialize.
 * @returns {ProjectLayerItem | ProjectGroupItem} Serialized layer or group DTO.
 */
export function serializeLayerTreeNode(node: LayerTreeNode): ProjectLayerItem | ProjectGroupItem {
  if (node instanceof LayerGroup) {
    return {
      id: node.id,
      name: node.name,
      visible: node.visible,
      selected: node.selected,
      expanded: node.expanded,
      children: node.getAllChildren().map(child => serializeLayerTreeNode(child))
    };
  }

  const layer = node as Layer;
  return {
    id: layer.id,
    name: layer.name,
    type: layer.fileType?.id || '',
    source: layer.filePath,
    visible: layer.visible,
    selected: layer.selected,
    opacity: layer.opacity,
    selectable: layer.selectable,
    readOnly: layer.readOnly,
    layerKind: layer.layerKind,
    geometryKind: layer.geometryKind,
    style: layer.style,
    crs: layer.crs,
    customProperties: layer.customProperties
  };
}

/**
 * @description Serializes the entire ProjectStore layer hierarchy into an array of project items.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @returns {Array<ProjectLayerItem | ProjectGroupItem>} Serialized layer tree items.
 */
export function serializeProjectLayersTree(): Array<ProjectLayerItem | ProjectGroupItem> {
  const rootGroup = projectStore.getRootGroup();
  return rootGroup.getAllChildren().map(child => serializeLayerTreeNode(child));
}

/**
 * @description Broadcasts the updated project layer hierarchy tree over IPC to all active BrowserWindow instances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @returns {void}
 */
export function broadcastProjectLayersTree(): void {
  const tree = serializeProjectLayersTree();
  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('project:layers-tree-updated', tree);
      }
    }
  }
}

/**
 * @description Stub broadcaster for sending updated project metadata over IPC to active windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {ProjectMetadata} [metadata] - Optional project metadata payload.
 * @returns {void}
 */
export function broadcastProjectMetadata(metadata?: ProjectMetadata): void {
  const meta = metadata || projectStore.getProject()?.metadata;
  if (!meta) return;
  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('project:metadata-updated', meta);
      }
    }
  }
}

/**
 * @description Stub broadcaster for sending updated project viewport configuration over IPC to active windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {ProjectViewport} [viewport] - Optional project viewport payload.
 * @returns {void}
 */
export function broadcastProjectViewport(viewport?: ProjectViewport): void {
  const vp = viewport || projectStore.getProject()?.viewport;
  if (!vp) return;
  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('project:viewport-updated', vp);
      }
    }
  }
}

/**
 * @description Stub broadcaster for sending full project model over IPC to active windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {ProjectModel} [project] - Optional project model payload.
 * @returns {void}
 */
export function broadcastFullProject(project?: ProjectModel): void {
  const proj = project || projectStore.getProject();
  if (!proj) return;
  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('project:loaded', proj);
      }
    }
  }
}

