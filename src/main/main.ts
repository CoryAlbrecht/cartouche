import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Cartouche',
    backgroundColor: '#ffffff',
    frame: false, // Frameless window with custom menubar & window controls
    icon: iconImage,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

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
    mainWindow?.webContents.send('window-maximized-state', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized-state', false);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
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
