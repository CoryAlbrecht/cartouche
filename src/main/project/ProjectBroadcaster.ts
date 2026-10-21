/**
 * @file ProjectBroadcaster.ts
 * @module main/project/ProjectBroadcaster
 * @description Central IPC broadcast dispatcher for transmitting serialized Cartouche project state updates to active Renderer windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 */

import { BrowserWindow } from 'electron';
import type {
  ProjectGroupItem,
  ProjectLayerItem,
  ProjectMetadata,
  ProjectViewport,
  ProjectModel,
  LayerDescriptor
} from '@shared/types';
import { projectStore } from './ProjectStore';
import { LayerTreeNode } from './models/LayerTreeNode';
import { LayerGroup } from './models/LayerGroup';
import { Layer } from './models/Layer';
import { logging } from '../../shared/logging';

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
    type: layer.type,
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
 * @typedef {(channel: string, payload: any) => void} BroadcastListener
 * @description Callback signature for testing or observing broadcasted project events.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
export type BroadcastListener = (channel: string, payload: any) => void;

let broadcastListeners: BroadcastListener[] = [];

/**
 * @description Registers an in-memory broadcast listener for unit and integration testing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {BroadcastListener} listener - Observer callback receiving channel and payload.
 * @returns {() => void} Unsubscribe function removing the listener.
 */
export function onBroadcast(listener: BroadcastListener): () => void {
  broadcastListeners.push(listener);
  return () => {
    broadcastListeners = broadcastListeners.filter((l) => l !== listener);
  };
}

/**
 * @description Dispatches an IPC channel message to active BrowserWindow instances and registered in-memory listeners.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {string} channel - Target IPC channel string.
 * @param {any} payload - Message payload data.
 * @returns {void}
 */
function emitToWindows(channel: string, payload: any): void {
  for (const listener of broadcastListeners) {
    try {
      listener(channel, payload);
    } catch (err) {
      logging.warn('Error in broadcast listener', err, { scope: 'ProjectBroadcaster', channel });
    }
  }

  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  }
}

/**
 * @description Broadcasts a newly added layer descriptor over IPC to all active BrowserWindow instances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {LayerDescriptor} descriptor - Lightweight metadata descriptor of the newly added layer.
 * @returns {void}
 */
export function broadcastLayerAdded(descriptor: LayerDescriptor): void {
  emitToWindows('project:layer-added', descriptor);
}

/**
 * @description Broadcasts the updated project layer hierarchy tree over IPC to all active BrowserWindow instances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
export function broadcastProjectLayersTree(): void {
  const tree = serializeProjectLayersTree();
  emitToWindows('project:layers-tree-updated', tree);
}

/**
 * @description Stub broadcaster for sending updated project metadata over IPC to active windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {ProjectMetadata} [metadata] - Optional project metadata payload.
 * @returns {void}
 */
export function broadcastProjectMetadata(metadata?: ProjectMetadata): void {
  const meta = metadata || projectStore.getProject()?.metadata;
  if (!meta) return;
  emitToWindows('project:metadata-updated', meta);
}

/**
 * @description Stub broadcaster for sending updated project viewport configuration over IPC to active windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {ProjectViewport} [viewport] - Optional project viewport payload.
 * @returns {void}
 */
export function broadcastProjectViewport(viewport?: ProjectViewport): void {
  const vp = viewport || projectStore.getProject()?.viewport;
  if (!vp) return;
  emitToWindows('project:viewport-updated', vp);
}

/**
 * @description Stub broadcaster for sending full project model over IPC to active windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {ProjectModel} [project] - Optional project model payload.
 * @returns {void}
 */
export function broadcastFullProject(project?: ProjectModel): void {
  const proj = project || projectStore.getProject();
  if (!proj) return;
  emitToWindows('project:loaded', proj);
}

/**
 * @description Broadcasts the project dirty modification state over IPC to all active BrowserWindow instances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {boolean} dirty - Current dirty state of the project.
 * @returns {void}
 */
export function broadcastProjectDirtyState(dirty: boolean): void {
  emitToWindows('project:dirty-state-changed', dirty);
}

// Automatically subscribe to projectStore dirty transitions to broadcast across windows
projectStore.onDirtyChange((dirty: boolean) => {
  broadcastProjectDirtyState(dirty);
});


