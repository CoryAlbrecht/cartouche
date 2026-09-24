import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

// Ensure Linux sandbox safety
if (process.platform === 'linux' && app?.commandLine) {
  app.commandLine.appendSwitch('no-sandbox');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Cartouche',
    backgroundColor: '#ffffff',
    frame: false, // Frameless window with custom menubar & window controls
    icon: path.join(__dirname, '../../assets/svg/logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

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
