/**
 * @file preload.ts
 * @module main/preload
 * @description Electron preload script establishing a secure contextBridge interface (`electronAPI`) between the main process and the renderer process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @see {@link ElectronAPI}
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '@shared/types';

/**
 * @description Safe API exposed to the renderer window via contextBridge, mapping IPC invocations and event listeners.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-02
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
  /** @ipc gis:execute-shortcut */
  executeShortcut: (name: string) => ipcRenderer.invoke('gis:execute-shortcut', name),
  /** @ipc gis:get-shortcuts */
  getShortcuts: () => ipcRenderer.invoke('gis:get-shortcuts'),
  /** @ipc gis:get-preference */
  getPreferenceValue: (name?: string) => ipcRenderer.invoke('gis:get-preference', name),
  /** @ipc gis:set-preference */
  setPreferenceValue: (name: string, value: any) => ipcRenderer.invoke('gis:set-preference', name, value),
  /** @ipc dialog:open-files */
  openFiles: (options?: any) => ipcRenderer.invoke('dialog:open-files', options)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
