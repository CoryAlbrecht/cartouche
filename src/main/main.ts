/**
 * @file main.ts
 * @module main/main
 * @description Main entry point for the Cartouche Electron desktop application. Handles window creation, lifecycle events, Linux desktop integration, frameless window controls, dynamic *Window frame authorization, and IPC communication channels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 * @see {@link handleIpc}
 */

import { app, BrowserWindow, dialog, nativeImage } from 'electron';
import { handleIpc, onIpc } from './ipc/registerIpcHandler';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FileCategory } from '@shared/types';
import { PreferencesStore } from './api/ui/preferences/PreferencesStore';
import { defaultLayerStyles } from '@shared/styles/defaultLayerStyles';
import { fileTypeRegistry } from './filetypes/FileTypeRegistry';
import { pathExists, resolveDialogParent, queryExtent } from "./api/ApiFunctions";
import { addLayers } from "./api/layers/addLayer";
import {
  setNodeVisibility,
  setNodeSelection,
  removeNodes,
  createGroup,
  reorderNodes
} from './api/project/layerTreeOperations';
import { renameLayerTreeNode } from './api/project/renameLayerTreeNode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

/**
 * @description Resolves the application icon file path across development, packaged assets, and system resource directories.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-28
 * @since 0.1.0-dev
 * @returns {string} Absolute file system path to the application icon.
 */
function getIconPath(): string {
  const candidates = [
    path.join(__dirname, '../../assets/icon.png'),
    path.join(__dirname, '../assets/icon.png'),
    path.join(app.getAppPath(), 'assets/icon.png'),
    path.join(process.resourcesPath, 'assets/icon.png')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, '../../assets/icon.png');
}

/**
 * @description Configures Linux desktop entry files, menu integration, and high-resolution application icon paths.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-28
 * @since 0.1.0-dev
 * @returns {void}
 */
function setupLinuxDesktopIntegration() {
  if (process.platform !== 'linux') return;
  try {
    const homeDir = app.getPath('home');
    const userIconDir = path.join(homeDir, '.local', 'share', 'icons', 'hicolor', '512x512', 'apps');
    const userAppDir = path.join(homeDir, '.local', 'share', 'applications');
    const pixmapsDir = path.join(homeDir, '.local', 'share', 'pixmaps');

    fs.mkdirSync(userIconDir, { recursive: true });
    fs.mkdirSync(userAppDir, { recursive: true });
    fs.mkdirSync(pixmapsDir, { recursive: true });

    const srcIcon = getIconPath();
    if (fs.existsSync(srcIcon)) {
      fs.copyFileSync(srcIcon, path.join(userIconDir, 'cartouche.png'));
      fs.copyFileSync(srcIcon, path.join(pixmapsDir, 'cartouche.png'));
    }

    const desktopPath = path.join(userAppDir, 'cartouche.desktop');
    const desktopContent = `[Desktop Entry]
Name=Cartouche
Exec=${process.execPath} ${path.join(__dirname, 'main.js')} %U
Terminal=false
Type=Application
Icon=cartouche
StartupWMClass=cartouche
Comment=Cartouche Desktop GIS Application
Categories=Graphics;Science;Geoscience;
`;
    fs.writeFileSync(desktopPath, desktopContent);
  } catch (err) {
    console.warn('[Main] Linux desktop integration setup warning:', err);
  }
}

// Ensure Linux sandbox safety & desktop integration
if (process.platform === 'linux') {
  if (app?.commandLine) {
    app.commandLine.appendSwitch('no-sandbox');
  }
  app.setName('cartouche');
  setupLinuxDesktopIntegration();
}

if (process.argv.includes('--test-worker')) {
  app.whenReady().then(async () => {
    const { utilityProcess } = await import('electron');
    const workerPath = path.resolve(__dirname, '../worker/worker_test.cjs');
    console.log('[Test Worker] Forking:', workerPath);
    const worker = utilityProcess.fork(workerPath);
    worker.on('spawn', () => {
      console.log('[Test Worker] Spawned, sending run');
      worker.postMessage('run');
    });
    worker.on('message', (msg) => {
      console.log('[Test Worker] Got message from worker:', msg);
      worker.kill();
      app.exit(0);
    });
    worker.on('exit', (code) => {
      console.log('[Test Worker] Worker exited with code:', code);
      if (code !== 0) app.exit(code);
    });
  });
}

/**
 * @description Instantiates and configures the main Electron browser window, restoring bounds from PreferencesStore, configuring dynamic *Window dialog open handlers, and attaching IPC event handlers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 * @returns {void}
 */
function createWindow() {
  const iconPath = getIconPath();
  const iconImage = nativeImage.createFromPath(iconPath);

  PreferencesStore.loadFromDisk();
  const wbPrefs = PreferencesStore.get();
  const savedWbX = wbPrefs['ui.workbench.location.x']?.value;
  const savedWbY = wbPrefs['ui.workbench.location.y']?.value;
  const savedWbW = wbPrefs['ui.workbench.location.width']?.value;
  const savedWbH = wbPrefs['ui.workbench.location.height']?.value;

  const hasValidWidth = typeof savedWbW === 'number' && savedWbW >= 960;
  const hasValidHeight = typeof savedWbH === 'number' && savedWbH >= 640;
  const hasValidPos = typeof savedWbX === 'number' && typeof savedWbY === 'number' && (savedWbX !== -1 || savedWbY !== -1);

  const wbWidth = hasValidWidth ? Math.floor(savedWbW) : 1400;
  const wbHeight = hasValidHeight ? Math.floor(savedWbH) : 900;

  const mainWindowOptions: Electron.BrowserWindowConstructorOptions = {
    width: wbWidth,
    height: wbHeight,
    minWidth: 960,
    minHeight: 640,
    title: 'Cartouche',
    backgroundColor: '#ffffff',
    frame: false, // Frameless window with custom menubar & window controls
    show: false, // Hide until Cartouche preferences bounds are explicitly set
    icon: iconImage,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };

  if (hasValidPos) {
    mainWindowOptions.x = Math.floor(savedWbX);
    mainWindowOptions.y = Math.floor(savedWbY);
  }

  mainWindow = new BrowserWindow(mainWindowOptions);

  // Explicitly apply Cartouche preferences bounds to override Electron/Chromium internal userData/Preferences
  if (hasValidPos && hasValidWidth && hasValidHeight) {
    mainWindow.setBounds({
      x: Math.floor(savedWbX),
      y: Math.floor(savedWbY),
      width: Math.floor(savedWbW),
      height: Math.floor(savedWbH)
    });
  } else if (hasValidWidth && hasValidHeight) {
    mainWindow.setSize(Math.floor(savedWbW), Math.floor(savedWbH));
  }

  const isMaximized = wbPrefs['ui.workbench.location.maximized']?.value === true;
  if (isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.show();

  const saveWorkbenchBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      PreferencesStore.set('ui.workbench.location.x', bounds.x);
      PreferencesStore.set('ui.workbench.location.y', bounds.y);
      PreferencesStore.set('ui.workbench.location.width', bounds.width);
      PreferencesStore.set('ui.workbench.location.height', bounds.height);
    }
  };

  mainWindow.on('resize', saveWorkbenchBounds);
  mainWindow.on('resized', saveWorkbenchBounds);
  mainWindow.on('move', saveWorkbenchBounds);
  mainWindow.on('moved', saveWorkbenchBounds);
  mainWindow.on('close', saveWorkbenchBounds);

  if (process.platform === 'linux' && !iconImage.isEmpty()) {
    mainWindow.setIcon(iconImage);
  }

  // Handle URL loading in Vite dev vs production build
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    const targetUrl = devServerUrl.endsWith('/')
      ? `${devServerUrl}src/renderer/index.html`
      : `${devServerUrl}/src/renderer/index.html`;
    mainWindow.loadURL(targetUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/src/renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const frameName = details.frameName;
    if (frameName && (frameName.endsWith('Window') || frameName === 'preferencesWindow')) {
      PreferencesStore.loadFromDisk();
      const prefs = PreferencesStore.get();
      const dialogKey = frameName.replace(/Window$/, '');
      const locationKeyPrefix = frameName === 'preferencesWindow' ? 'ui.preferencesDialog.location' : `ui.${dialogKey}.location`;

      const savedX = prefs[`${locationKeyPrefix}.x`]?.value;
      const savedY = prefs[`${locationKeyPrefix}.y`]?.value;
      const savedWidth = prefs[`${locationKeyPrefix}.width`]?.value;
      const savedHeight = prefs[`${locationKeyPrefix}.height`]?.value;

      const defaultW = frameName === 'addLayersWindow' ? 640 : (frameName === 'preferencesWindow' ? 720 : 640);
      const defaultH = frameName === 'addLayersWindow' ? 480 : (frameName === 'preferencesWindow' ? 520 : 480);
      const minW = frameName === 'addLayersWindow' ? 400 : 360;
      const minH = frameName === 'addLayersWindow' ? 300 : 280;

      const width = typeof savedWidth === 'number' && savedWidth >= minW ? Math.floor(savedWidth) : defaultW;
      const height = typeof savedHeight === 'number' && savedHeight >= minH ? Math.floor(savedHeight) : defaultH;

      const windowOptions: Electron.BrowserWindowConstructorOptions = {
        width,
        height,
        minWidth: minW,
        minHeight: minH,
        autoHideMenuBar: true,
        frame: false, // Frameless child dialog window with custom title bar
        resizable: true,
        show: true,
        parent: mainWindow || undefined,
        icon: iconImage,
        webPreferences: {
          preload: path.join(__dirname, '../preload/preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        }
      };

      if (typeof savedX === 'number' && savedX >= 0 && typeof savedY === 'number' && savedY >= 0) {
        windowOptions.x = Math.floor(savedX);
        windowOptions.y = Math.floor(savedY);
      }

      return {
        action: 'allow',
        overrideBrowserWindowOptions: windowOptions
      };
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (childWindow, details) => {
    const frameName = details.frameName;
    if (frameName && (frameName.endsWith('Window') || frameName === 'preferencesWindow')) {
      const dialogKey = frameName.replace(/Window$/, '');
      const locationKeyPrefix = frameName === 'preferencesWindow' ? 'ui.preferencesDialog.location' : `ui.${dialogKey}.location`;
      const saveChildBounds = () => {
        if (childWindow && !childWindow.isDestroyed()) {
          const bounds = childWindow.getBounds();
          PreferencesStore.set(`${locationKeyPrefix}.x`, bounds.x);
          PreferencesStore.set(`${locationKeyPrefix}.y`, bounds.y);
          PreferencesStore.set(`${locationKeyPrefix}.width`, bounds.width);
          PreferencesStore.set(`${locationKeyPrefix}.height`, bounds.height);
        }
      };

      childWindow.on('resize', saveChildBounds);
      childWindow.on('resized', saveChildBounds);
      childWindow.on('move', saveChildBounds);
      childWindow.on('moved', saveChildBounds);
      childWindow.on('close', saveChildBounds);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Window loaded successfully');
  });

  mainWindow.webContents.on('did-fail-load', (_event: any, errorCode: any, errorDescription: any, validatedURL: any) => {
    console.error(`[Main] Page failed to load: ${errorCode} - ${errorDescription} (${validatedURL})`);
  });

  mainWindow.webContents.on('console-message', (_event: any, level: any, message: any, line: any, sourceId: any) => {
    console.log(`[Renderer] [${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('maximize', () => {
    PreferencesStore.set('ui.workbench.location.maximized', true);
    mainWindow?.webContents.send('window-maximized-state', true);
  });

  mainWindow.on('unmaximize', () => {
    PreferencesStore.set('ui.workbench.location.maximized', false);
    saveWorkbenchBounds();
    mainWindow?.webContents.send('window-maximized-state', false);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  PreferencesStore.loadFromDisk();

  const { i18nStore } = await import('./i18n/I18nStore');
  i18nStore.loadSystemLocale();

  createWindow();

  onIpc('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  onIpc('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  onIpc('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  handleIpc('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // File System Dialog IPC Handlers
  let isFileDialogOpen = false;

  /**
   * @description Handles dialog:open-files IPC invocation to present native file picker modal to calling window.
   * Resolves target window via resolveDialogParent (prioritizing the focused child window, sender, or fallback mainWindow).
   * Concurrency is guarded via isFileDialogOpen to prevent re-entrant file chooser deadlocks.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-02
   * @updated 2026-10-12
   * @since 0.1.0-dev
   * @param {Electron.IpcMainInvokeEvent} _event - IPC invoke event containing sender WebContents.
   * @param {Object} [options] - Dialog options including category, filters, and multiSelections.
   * @returns {Promise<string[]>} Selected file paths or empty array if canceled.
   */
  handleIpc('dialog:open-files', async (_event, options?: { title?: string; category?: FileCategory; filters?: Array<{ name: string; extensions: string[] }>; multiSelections?: boolean }) => {
    if (isFileDialogOpen) {
      return [];
    }
    isFileDialogOpen = true;
    try {
      const properties: Array<'openFile' | 'multiSelections'> = ['openFile'];
      if (options?.multiSelections !== false) {
        properties.push('multiSelections');
      }
      const filters = options?.filters || fileTypeRegistry.getFileFilters(options?.category);
      const dialogOptions: Electron.OpenDialogOptions = {
        title: options?.title || 'Select Data Files',
        properties,
        filters
      };
      const targetWindow = resolveDialogParent(_event.sender, mainWindow);
      const res = targetWindow ? await dialog.showOpenDialog(targetWindow, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
      if (res.canceled) return [];
      return res.filePaths;
    } catch (err) {
      console.error('[Main] dialog:open-files error:', err);
      return [];
    } finally {
      isFileDialogOpen = false;
    }
  });

  /**
   * @description Handles dialog:save-file IPC invocation to present native file save dialog modal to calling window.
   * Resolves target window via resolveDialogParent (prioritizing the focused child window, sender, or fallback mainWindow).
   * Concurrency is guarded via isFileDialogOpen to prevent re-entrant file chooser deadlocks.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {Electron.IpcMainInvokeEvent} _event - IPC invoke event containing sender WebContents.
   * @param {Object} [options] - Dialog options including title, defaultPath, category, and filters.
   * @returns {Promise<string | null>} Selected save file path or null if canceled.
   */
  handleIpc('dialog:save-file', async (_event, options?: { title?: string; defaultPath?: string; category?: FileCategory; filters?: Array<{ name: string; extensions: string[] }> }) => {
    if (isFileDialogOpen) {
      return null;
    }
    isFileDialogOpen = true;
    try {
      const filters = options?.filters || fileTypeRegistry.getFileFilters(options?.category || 'project');
      const dialogOptions: Electron.SaveDialogOptions = {
        title: options?.title || 'Save Cartouche Project',
        defaultPath: options?.defaultPath,
        filters
      };
      const targetWindow = resolveDialogParent(_event.sender, mainWindow);
      const res = targetWindow ? await dialog.showSaveDialog(targetWindow, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
      if (res.canceled || !res.filePath) return null;
      return res.filePath;
    } catch (err) {
      console.error('[Main] dialog:save-file error:', err);
      return null;
    } finally {
      isFileDialogOpen = false;
    }
  });

  // Project Management IPC Handlers
  handleIpc('gis:open-project', async (_event, filePath?: string) => {
    const { default: openProject } = await import('./api/project/openProject');
    return openProject(filePath);
  });

  handleIpc('gis:get-current-project', async () => {
    const { projectStore } = await import('./project/ProjectStore');
    return projectStore.getProject();
  });

  handleIpc('gis:save-project', async (_event, filePath?: string, viewport?: import('../shared/types/project').ProjectViewport) => {
    const { default: saveProject } = await import('./api/project/saveProject');
    return saveProject(filePath, viewport);
  });

  // Localization IPC Handlers
  handleIpc('gis:get-i18n-state', async () => {
    const { i18nStore } = await import('./i18n/I18nStore');
    return i18nStore.getState();
  });

  // File Types Registry IPC Handlers
  handleIpc('gis:get-filetypes', async () => {
    return fileTypeRegistry.getAllDescriptors();
  });

  handleIpc('gis:identify-file', async (_event, filePath: string) => {
    return fileTypeRegistry.identifyFile(filePath);
  });

  // Keyboard Shortcuts System IPC Handlers
  handleIpc('gis:execute-action', async (_event, shortcutName: string) => {
    const { ActionRegistry } = await import('./actions/ActionRegistry');
    ActionRegistry.executeAction(shortcutName);
  });

  handleIpc('gis:get-actions', async () => {
    const { ActionRegistry } = await import('./actions/ActionRegistry');
    return ActionRegistry.getAllActionDefinitions();
  });

  // Preferences System IPC Handlers
  handleIpc('gis:get-preference', async (_event, name?: string) => {
    const { default: getPreferenceValue } = await import('./api/ui/preferences/GetPreferenceValue');
    return getPreferenceValue(name);
  });

  handleIpc('gis:set-preference', async (_event, name: string, value: any) => {
    const { default: setPreferenceValue } = await import('./api/ui/preferences/SetPreferenceValue');
    return setPreferenceValue(name, value);
  });

  // FlatGeobuf Zero-Copy IPC Pipeline & OpenLayers Flat Styling
  handleIpc('gis:encode-flatgeobuf', async (_event, features: any[], geometryKind: string) => {
    try {
      const { geojson } = await import('flatgeobuf');
      const geojsonFeatures = (features || []).map((f: any) => {
        let geom = f.geometry;
        if (!geom && f.coordinates) {
          const gKind = (geometryKind || f.geometryType || 'Point').toLowerCase();
          if (gKind.includes('polygon')) {
            geom = { type: 'Polygon', coordinates: f.coordinates };
          } else if (gKind.includes('line')) {
            geom = { type: 'LineString', coordinates: f.coordinates };
          } else {
            geom = { type: 'Point', coordinates: f.coordinates };
          }
        }
        return {
          type: 'Feature',
          id: f.id,
          properties: f.properties || {},
          geometry: geom || { type: 'Point', coordinates: [0, 0] }
        };
      });

      const fc = { type: 'FeatureCollection', features: geojsonFeatures };
      const uint8 = geojson.serialize(fc as any);
      return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
    } catch (err) {
      console.error('[Main] FlatGeobuf encoding error:', err);
      return new ArrayBuffer(0);
    }
  });

  handleIpc('gis:fetch-layer-flatgeobuf', async (_event, layerId: string) => {
    return {
      layerId,
      buffer: new ArrayBuffer(0),
      flatStyle: defaultLayerStyles.Polygon
    };
  });

  handleIpc('gis:add-layers', async (_event, layers: any[]) => {
    await addLayers(layers);
  });

  handleIpc('layers:queryExtent', async (_event, layerId: string, extent?: any, targetProjection?: string) => {
    return await queryExtent(layerId, extent, targetProjection);
  });

  handleIpc('gis:path-exists', async (_event, filePath: string) => {
    return await pathExists(filePath);
  });

  handleIpc('gis:set-node-visibility', async (_event, nodeId: string, visible: boolean) => {
    setNodeVisibility(nodeId, visible);
  });

  handleIpc('gis:set-node-selection', async (_event, selectedNodeIds: string[]) => {
    setNodeSelection(selectedNodeIds);
  });

  handleIpc('gis:remove-nodes', async (_event, nodeIds: string[]) => {
    removeNodes(nodeIds);
  });

  handleIpc('gis:create-group', async (_event, name: string, targetNodeId: string, childNodeIds: string[], newGroupId?: string) => {
    createGroup(name, targetNodeId, childNodeIds, newGroupId);
  });

  handleIpc('gis:rename-node', async (_event, nodeId: string, newName: string) => {
    renameLayerTreeNode(nodeId, newName);
  });

  handleIpc('gis:rename-layer-tree-node', async (_event, nodeId: string, newName: string) => {
    renameLayerTreeNode(nodeId, newName);
  });

  handleIpc('gis:reorder-nodes', async (_event, draggedNodeIds: string[], targetNodeId: string, position: 'before' | 'into' | 'append-root') => {
    reorderNodes(draggedNodeIds, targetNodeId, position);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
