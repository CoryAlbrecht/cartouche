import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PreferencesStore } from './api/ui/preferences/PreferencesStore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

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
    if (details.frameName === 'preferencesWindow') {
      PreferencesStore.loadFromDisk();
      const prefs = PreferencesStore.get();
      const savedX = prefs['ui.preferencesDialog.location.x']?.value;
      const savedY = prefs['ui.preferencesDialog.location.y']?.value;
      const savedWidth = prefs['ui.preferencesDialog.location.width']?.value;
      const savedHeight = prefs['ui.preferencesDialog.location.height']?.value;

      const width = typeof savedWidth === 'number' && savedWidth >= 480 ? Math.floor(savedWidth) : 720;
      const height = typeof savedHeight === 'number' && savedHeight >= 360 ? Math.floor(savedHeight) : 520;

      const windowOptions: Electron.BrowserWindowConstructorOptions = {
        width,
        height,
        minWidth: 480,
        minHeight: 360,
        title: 'Preferences',
        autoHideMenuBar: true,
        frame: true,
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
    if (details.frameName === 'preferencesWindow') {
      const saveChildBounds = () => {
        if (childWindow && !childWindow.isDestroyed()) {
          const bounds = childWindow.getBounds();
          PreferencesStore.set('ui.preferencesDialog.location.x', bounds.x);
          PreferencesStore.set('ui.preferencesDialog.location.y', bounds.y);
          PreferencesStore.set('ui.preferencesDialog.location.width', bounds.width);
          PreferencesStore.set('ui.preferencesDialog.location.height', bounds.height);
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

app.whenReady().then(() => {
  PreferencesStore.loadFromDisk();
  createWindow();

  ipcMain?.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain?.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain?.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain?.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // Keyboard Shortcuts System IPC Handlers
  ipcMain?.handle('gis:execute-shortcut', async (_event, shortcutName: string) => {
    const { ShortcutRegistry } = await import('./shortcuts/ShortcutRegistry');
    ShortcutRegistry.executeShortcut(shortcutName);
  });

  ipcMain?.handle('gis:get-shortcuts', async () => {
    const { ShortcutRegistry } = await import('./shortcuts/ShortcutRegistry');
    return ShortcutRegistry.getAllShortcutDefinitions();
  });

  // Preferences System IPC Handlers
  ipcMain?.handle('gis:get-preference', async (_event, name?: string) => {
    const { default: getPreferenceValue } = await import('./api/ui/preferences/GetPreferenceValue');
    return getPreferenceValue(name);
  });

  ipcMain?.handle('gis:set-preference', async (_event, name: string, value: any) => {
    const { default: setPreferenceValue } = await import('./api/ui/preferences/SetPreferenceValue');
    return setPreferenceValue(name, value);
  });

  // FlatGeobuf Zero-Copy IPC Pipeline & OpenLayers Flat Styling
  ipcMain?.handle('gis:encode-flatgeobuf', async (_event, features: any[], geometryKind: string) => {
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

  ipcMain?.handle('gis:fetch-layer-flatgeobuf', async (_event, layerId: string) => {
    // Return default style per user specification
    const defaultStyles: Record<string, any> = {
      Polygon: {
        'fill-color': '#0000FF',
        'stroke-color': '#00007F',
        'stroke-width': 2
      },
      LineString: {
        'stroke-color': '#007F00',
        'stroke-width': 2
      },
      Point: {
        'circle-radius': 8,
        'circle-fill-color': '#7F0000',
        'circle-stroke-color': '#FF0000',
        'circle-stroke-width': 1
      }
    };

    return {
      layerId,
      buffer: new ArrayBuffer(0),
      flatStyle: defaultStyles.Polygon
    };
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
