import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '@shared/types';

const electronAPI: ElectronAPI = {
  platform: process.platform,
  version: process.versions.electron,
  nodeVersion: process.versions.node,
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedState: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window-maximized-state', handler);
    return () => {
      ipcRenderer.removeListener('window-maximized-state', handler);
    };
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
