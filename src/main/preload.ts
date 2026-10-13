/**
 * @file preload.ts
 * @module main/preload
 * @description Electron preload script establishing a secure contextBridge interface (`electronAPI`) between the main process and the renderer process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ElectronAPI}
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '@shared/types';

/**
 * @description Safe API exposed to the renderer window via contextBridge, mapping IPC invocations and event listeners.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {ElectronAPI}
 */
const electronAPI: ElectronAPI = {
  platform: process.platform,
  version: process.versions.electron,
  nodeVersion: process.versions.node,
  /** @ipc window-minimize */
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  /** @ipc window-maximize */
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  /** @ipc window-close */
  closeWindow: () => ipcRenderer.send('window-close'),
  /** @ipc window-is-maximized */
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  /** @ipc window-maximized-state */
  onMaximizedState: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window-maximized-state', handler);
    return () => {
      ipcRenderer.removeListener('window-maximized-state', handler);
    };
  },
  /** @ipc gis:fetch-layer-flatgeobuf */
  fetchLayerFlatGeobuf: (layerId: string) => ipcRenderer.invoke('gis:fetch-layer-flatgeobuf', layerId),
  /** @ipc gis:encode-flatgeobuf */
  encodeFeaturesToFlatGeobuf: (features: any[], geometryKind: any) =>
    ipcRenderer.invoke('gis:encode-flatgeobuf', features, geometryKind),
  /** @ipc gis:execute-action */
  executeAction: (name: string) => ipcRenderer.invoke('gis:execute-action', name),
  /** @ipc gis:get-actions */
  getActions: () => ipcRenderer.invoke('gis:get-actions'),
  /** @ipc gis:get-preference */
  getPreferenceValue: (name?: string) => ipcRenderer.invoke('gis:get-preference', name),
  /** @ipc gis:set-preference */
  setPreferenceValue: (name: string, value: any) => ipcRenderer.invoke('gis:set-preference', name, value),
  /** @ipc gis:get-filetypes */
  getFileTypes: () => ipcRenderer.invoke('gis:get-filetypes'),
  /** @ipc gis:identify-file */
  identifyFile: (filePath: string) => ipcRenderer.invoke('gis:identify-file', filePath),
  /** @ipc dialog:open-files */
  /** @ipc gis:add-layers */
  addLayers: (layers: any[]) => ipcRenderer.invoke('gis:add-layers', layers),
  /** @ipc gis:path-exists */
  pathExists: (filePath: string) => ipcRenderer.invoke('gis:path-exists', filePath),

  openFiles: (options?: any) => ipcRenderer.invoke('dialog:open-files', options),
  /** @ipc dialog:save-file */
  saveFile: (options?: any) => ipcRenderer.invoke('dialog:save-file', options),
  /** @ipc gis:open-project */
  openProject: (filePath?: string) => ipcRenderer.invoke('gis:open-project', filePath),
  /** @ipc gis:get-current-project */
  getCurrentProject: () => ipcRenderer.invoke('gis:get-current-project'),
  /** @ipc gis:save-project */
  saveProject: (filePath?: string, viewport?: any) => ipcRenderer.invoke('gis:save-project', filePath, viewport),
  /** @ipc project:loaded */
  onProjectLoaded: (callback: (project: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, project: any) => callback(project);
    ipcRenderer.on('project:loaded', handler);
    return () => {
      ipcRenderer.removeListener('project:loaded', handler);
    };
  },
  /** @ipc project:layers-tree-updated */
  onProjectLayersTreeUpdated: (callback: (tree: any[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tree: any[]) => callback(tree);
    ipcRenderer.on('project:layers-tree-updated', handler);
    return () => {
      ipcRenderer.removeListener('project:layers-tree-updated', handler);
    };
  },
  /** @ipc project:metadata-updated */
  onProjectMetadataUpdated: (callback: (metadata: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, metadata: any) => callback(metadata);
    ipcRenderer.on('project:metadata-updated', handler);
    return () => {
      ipcRenderer.removeListener('project:metadata-updated', handler);
    };
  },
  /** @ipc project:dirty-state-changed */
  onProjectDirtyStateChanged: (callback: (isDirty: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isDirty: boolean) => callback(isDirty);
    ipcRenderer.on('project:dirty-state-changed', handler);
    return () => {
      ipcRenderer.removeListener('project:dirty-state-changed', handler);
    };
  },
  /** @ipc gis:get-i18n-state */
  getI18nState: () => ipcRenderer.invoke('gis:get-i18n-state'),
  /** @ipc i18n:state-changed */
  onI18nStateChanged: (callback: (state: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: any) => callback(state);
    ipcRenderer.on('i18n:state-changed', handler);
    return () => {
      ipcRenderer.removeListener('i18n:state-changed', handler);
    };
  },
  /** @ipc gis:set-node-visibility */
  setNodeVisibility: (nodeId: string, visible: boolean) => ipcRenderer.invoke('gis:set-node-visibility', nodeId, visible),
  /** @ipc gis:set-node-selection */
  setNodeSelection: (selectedNodeIds: string[]) => ipcRenderer.invoke('gis:set-node-selection', selectedNodeIds),
  /** @ipc gis:remove-nodes */
  removeNodes: (nodeIds: string[]) => ipcRenderer.invoke('gis:remove-nodes', nodeIds),
  /** @ipc gis:create-group */
  createGroup: (name: string, targetNodeId: string, childNodeIds: string[], newGroupId?: string) =>
    ipcRenderer.invoke('gis:create-group', name, targetNodeId, childNodeIds, newGroupId),
  /** @ipc gis:rename-node */
  renameNode: (nodeId: string, newName: string) => ipcRenderer.invoke('gis:rename-node', nodeId, newName),
  /** @ipc gis:rename-layer-tree-node */
  renameLayerTreeNode: (nodeId: string, newName: string) =>
    ipcRenderer.invoke('gis:rename-layer-tree-node', nodeId, newName),
  /** @ipc gis:reorder-nodes */
  reorderNodes: (draggedNodeIds: string[], targetNodeId: string, position: 'before' | 'into' | 'append-root') =>
    ipcRenderer.invoke('gis:reorder-nodes', draggedNodeIds, targetNodeId, position)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
