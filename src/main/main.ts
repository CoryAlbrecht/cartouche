/**
 * @file main.ts
 * @module main/main
 * @description Main entry point for the Cartouche Electron desktop application. Handles window creation, lifecycle events, Linux desktop integration, frameless window controls, dynamic *Window frame authorization, and IPC communication channels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 * @see {@link handleIpc}
 * @see {@link loggingHub}
 * @see {@link handleCliHelp}
 */

import { app, BrowserWindow, dialog, nativeImage } from 'electron';
import { handleIpc, onIpc } from './ipc/registerIpcHandler';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DropPosition, FileCategory } from '@shared/types';
import { PreferencesStore } from './api/ui/preferences/PreferencesStore';
import { defaultLayerStyles } from '@shared/styles/defaultLayerStyles';
import { fileTypeRegistry } from './filetypes/FileTypeRegistry';
import { pathExists, queryExtent, resolveDialogDefaultPath, updateDialogLocation } from "./api/ApiFunctions";
import { addLayers } from "./api/layers/addLayer";
import {
  setNodeVisibility,
  setNodeSelection,
  removeNodes,
  createGroup,
  reorderNodes
} from './api/project/layerTreeOperations';
import { renameLayerTreeNode } from './api/project/renameLayerTreeNode';
import { handleCliHelp, parseLogArgs, type LogCliConfig } from './cli/cliArgs';
import { loggingHub } from './logging/LoggingHub';
import { bindLoggingPreferences } from './logging/loggingPreferences';
import { logging } from '../shared/logging';

let cliLogConfig: LogCliConfig;

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
Icon=${srcIcon}
StartupWMClass=cartouche
Comment=Cartouche Desktop GIS Application
Categories=Graphics;Science;Geoscience;
`;
    fs.writeFileSync(desktopPath, desktopContent);
  } catch (err) {
    logging.warn('Linux desktop integration setup warning', err, { scope: 'Main' });
  }
}

/**
 * @description Instantiates and configures the main Electron browser window, restoring bounds from PreferencesStore, configuring dynamic *Window dialog open handlers, and attaching IPC event handlers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-18
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 * @returns {void}
 */
function createWindow() {
  const iconPath = getIconPath();
  const iconImage = nativeImage.createFromPath(iconPath);

  PreferencesStore.loadFromDisk();
  bindLoggingPreferences(loggingHub, PreferencesStore, {
    cliLogFile: cliLogConfig.logFile,
    cliLevel: cliLogConfig.level
  });
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
    roundedCorners: false, // Prevent Linux CSD border distortion and clipping on Electron 44
    show: false, // Hide until Cartouche preferences bounds are explicitly set
    icon: iconImage.isEmpty() ? iconPath : iconImage,
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

  if (process.platform === 'linux') {
    mainWindow.setIcon(iconImage.isEmpty() ? iconPath : iconImage);
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
        roundedCorners: false, // Prevent Linux CSD border distortion and clipping on Electron 44
        resizable: true,
        show: true,
        parent: mainWindow || undefined,
        icon: iconImage.isEmpty() ? iconPath : iconImage,
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
    logging.info('Main window loaded successfully', { scope: 'Main' });
    if (process.argv.includes('--test-boot')) {
      logging.debug('Test boot verification passed, exiting cleanly', { scope: 'TestBoot' });
      app.exit(0);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event: any, errorCode: any, errorDescription: any, validatedURL: any) => {
    logging.error('Main window page failed to load', { errorCode, errorDescription, url: validatedURL, scope: 'Main' });
  });

  mainWindow.webContents.on('console-message', (event: any) => {
    const meta = { sourceId: event?.sourceId, line: event?.line, scope: 'RendererConsole' };
    const level = event?.level;
    const message = event?.message;
    if (level === 'error' || level === 2) {
      logging.error(message, meta);
    } else if (level === 'warning' || level === 1) {
      logging.warn(message, meta);
    } else {
      logging.debug(message, meta);
    }
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

/**
 * @description Initializes and boots the main application lifecycle, logging hub, and window managers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @returns {void}
 */
function startApp(): void {
  // Early logging hub initialization using CLI flags
  cliLogConfig = parseLogArgs();
  loggingHub.configure({
    level: cliLogConfig.level,
    ...(cliLogConfig.logFile ? { logFile: cliLogConfig.logFile } : {})
  });

  // Ensure Linux sandbox safety & desktop integration
  if (process.platform === 'linux') {
    if (app?.commandLine) {
      app.commandLine.appendSwitch('no-sandbox');
    }
    app.setName('cartouche');
    if (typeof (app as any).setDesktopName === 'function') {
      (app as any).setDesktopName('cartouche.desktop');
    }
    setupLinuxDesktopIntegration();
  }

  if (process.argv.includes('--test-worker')) {
    app.whenReady().then(async () => {
      const { utilityProcess } = await import('electron');
      const workerPath = path.resolve(__dirname, '../worker/worker_test.cjs');
      logging.debug('Test worker forking', { workerPath, scope: 'TestWorker' });
      const worker = utilityProcess.fork(workerPath);
      worker.on('spawn', () => {
        logging.debug('Test worker spawned, sending run', { scope: 'TestWorker' });
        worker.postMessage('run');
      });
      worker.on('message', (msg) => {
        logging.debug('Test worker message received', { message: msg, scope: 'TestWorker' });
        worker.kill();
        app.exit(0);
      });
      worker.on('exit', (code) => {
        logging.debug('Test worker exited', { code, scope: 'TestWorker' });
        if (code !== 0) app.exit(code);
      });
    });
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
   * @description Handles dialog:open-files IPC invocation to present native file picker non-modal to calling window.
   * Native file chooser is non-modal and independently movable/resizable.
   * Concurrency is guarded via isFileDialogOpen to prevent re-entrant file chooser deadlocks.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-02
   * @updated 2026-10-20
   * @since 0.1.0-dev
   * @param {Electron.IpcMainInvokeEvent} _event - IPC invoke event containing sender WebContents.
   * @param {Object} [options] - Dialog options including category, filters, defaultPath, and multiSelections.
   * @returns {Promise<string[]>} Selected file paths or empty array if canceled.
   */
  handleIpc('dialog:open-files', async (_event, options?: { title?: string; defaultPath?: string; category?: FileCategory; filters?: Array<{ name: string; extensions: string[] }>; multiSelections?: boolean }) => {
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
      const defaultPath = resolveDialogDefaultPath('open', options?.defaultPath);
      const dialogOptions: Electron.OpenDialogOptions = {
        title: options?.title || 'Select Data Files',
        ...(defaultPath ? { defaultPath } : {}),
        properties,
        filters
      };
      const res = await dialog.showOpenDialog(dialogOptions);
      if (res.canceled || res.filePaths.length === 0) return [];
      updateDialogLocation('open', res.filePaths[0]);
      return res.filePaths;
    } catch (err) {
      logging.error('Failed to show open files dialog', err, { scope: 'Main' });
      return [];
    } finally {
      isFileDialogOpen = false;
    }
  });

  /**
   * @description Handles dialog:save-file IPC invocation to present native file save dialog non-modal to calling window.
   * Native file chooser is non-modal and independently movable/resizable.
   * Concurrency is guarded via isFileDialogOpen to prevent re-entrant file chooser deadlocks.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-21
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
      const defaultPath = resolveDialogDefaultPath('save', options?.defaultPath);
      const dialogOptions: Electron.SaveDialogOptions = {
        title: options?.title || 'Save Cartouche Project',
        ...(defaultPath ? { defaultPath } : {}),
        filters
      };
      const res = await dialog.showSaveDialog(dialogOptions);
      if (res.canceled || !res.filePath) return null;
      updateDialogLocation('save', res.filePath);
      return res.filePath;
    } catch (err) {
      logging.error('Failed to show save file dialog', err, { scope: 'Main' });
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
      logging.error('FlatGeobuf encoding failed', err, { scope: 'Main' });
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

  handleIpc('layers:queryExtent', async (_event, layerId: string, options?: any, targetProjection?: string) => {
    return await queryExtent(layerId, options, targetProjection);
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

  handleIpc('gis:reorder-nodes', async (_event, draggedNodeIds: string[], targetNodeId: string, position: DropPosition) => {
    reorderNodes(draggedNodeIds, targetNodeId, position);
  });

  onIpc('gis:log', (_event, payload: any) => {
    loggingHub.handleLogPayload(payload);
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

  app.on('will-quit', () => {
    loggingHub.destroy();
  });
}

// Handle -h / --help CLI options before logging hub initialization or window creation
if (handleCliHelp(process.argv.slice(2), {
  exitHandler: (code) => {
    if (app?.exit) {
      app.exit(code);
    } else {
      process.exit(code);
    }
  }
})) {
  // CLI help displayed; early exit initiated.
} else {
  startApp();
}
