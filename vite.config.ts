/**
 * @file vite.config.ts
 * @module config/vite
 * @description Vite configuration for Cartouche desktop GIS application, configuring Electron main, preload, and React renderer compilation with vendor chunk splitting.
 * In dev mode a single start/reload handler launches Electron for all three entries with a sanitized environment and overridable debug ports and user data directory (`CARTOUCHE_CDP_PORT`, `CARTOUCHE_INSPECT_PORT`, `CARTOUCHE_USER_DATA_DIR`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-11-11
 * @since 0.1.0-dev
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @description Built Electron main-process entry; Electron must not be started before it exists.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @type {string}
 */
const MAIN_BUNDLE = path.resolve(__dirname, 'dist-electron/main/main.js');

/**
 * @typedef {Object} ElectronOnstartArgs
 * @property {Function} startup - Spawns (or restarts) the Electron app with the given argv and spawn options.
 * @property {Function} reload - Reloads the renderer if the app is running, otherwise starts it with default argv.
 */
type ElectronOnstartArgs = {
  startup: (argv?: string[], options?: { env?: NodeJS.ProcessEnv }) => Promise<unknown>;
  reload: () => void;
};

/**
 * @description Builds the Electron dev argv: V8 inspector and DevTools protocol (CDP) ports plus `--no-sandbox`, with an optional isolated user data directory.
 * Ports default to 5858 (inspector) and 9222 (CDP) and are overridable via `CARTOUCHE_INSPECT_PORT` and `CARTOUCHE_CDP_PORT`; `CARTOUCHE_USER_DATA_DIR` adds `--user-data-dir`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @returns {string[]} Electron command-line arguments.
 */
function electronDevArgv(): string[] {
  const argv = [
    '.',
    `--inspect=${process.env.CARTOUCHE_INSPECT_PORT || '5858'}`,
    `--remote-debugging-port=${process.env.CARTOUCHE_CDP_PORT || '9222'}`,
    '--no-sandbox',
  ];
  if (process.env.CARTOUCHE_USER_DATA_DIR) {
    argv.push(`--user-data-dir=${process.env.CARTOUCHE_USER_DATA_DIR}`);
  }
  return argv;
}

/**
 * @description Returns the spawn environment for Electron without `ELECTRON_RUN_AS_NODE`, which hosts such as the VS Code extension host export and which would make Electron run as plain Node.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @returns {NodeJS.ProcessEnv} Sanitized environment.
 */
function electronDevEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/**
 * @description Shared `onstart` handler for the main, preload, and worker entries. vite-plugin-electron fires it from whichever entry's build closes the startup count, so any entry may arrive first:
 * the main entry (re)starts Electron; other entries reload a running app, start it once the main bundle exists, and otherwise wait for the main entry's own build to start it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {ElectronOnstartArgs} args - Plugin-provided startup and reload functions.
 * @param {boolean} isMainEntry - True when invoked for the Electron main-process entry.
 * @returns {void}
 */
function startOrReloadElectron(args: ElectronOnstartArgs, isMainEntry: boolean): void {
  // vite-plugin-electron mounts the spawned app on `process.electronApp` (documented in its startup() JSDoc).
  const running = Boolean((process as NodeJS.Process & { electronApp?: unknown }).electronApp);
  if (!isMainEntry && running) {
    args.reload();
    return;
  }
  if (fs.existsSync(MAIN_BUNDLE)) {
    void args.startup(electronDevArgv(), { env: electronDevEnv() });
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: path.resolve(__dirname, 'src/main/main.ts'),
        onstart(options) {
          startOrReloadElectron(options, true);
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            sourcemap: true,
            rollupOptions: {
              external: ['electron', 'gdal-async', 'better-sqlite3']
            }
          },
          resolve: {
            alias: {
              '@main': path.resolve(__dirname, 'src/main'),
              '@shared': path.resolve(__dirname, 'src/shared')
            }
          }
        }
      },
      {
        entry: path.resolve(__dirname, 'src/main/preload.ts'),
        onstart(options) {
          startOrReloadElectron(options, false);
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            sourcemap: true,
            lib: {
              entry: path.resolve(__dirname, 'src/main/preload.ts'),
              formats: ['cjs'],
              fileName: () => 'preload.cjs'
            },
            rollupOptions: {
              external: ['electron']
            }
          },
          resolve: {
            alias: {
              '@main': path.resolve(__dirname, 'src/main'),
              '@shared': path.resolve(__dirname, 'src/shared')
            }
          }
        }
      },
      {
        entry: path.resolve(__dirname, 'src/worker/geospatialWorker.ts'),
        onstart(options) {
          startOrReloadElectron(options, false);
        },
        vite: {
          build: {
            outDir: 'dist-electron/worker',
            sourcemap: true,
            lib: {
              entry: path.resolve(__dirname, 'src/worker/geospatialWorker.ts'),
              formats: ['cjs'],
              fileName: () => 'geospatialWorker.cjs'
            },
            rollupOptions: {
              external: ['electron', 'gdal-async', 'better-sqlite3']
            }
          },
          resolve: {
            alias: {
              '@main': path.resolve(__dirname, 'src/main'),
              '@shared': path.resolve(__dirname, 'src/shared')
            }
          }
        }
      }
    ])
  ],
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@assets': path.resolve(__dirname, 'assets')
    }
  },
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/ol/') ||
              id.includes('ol-ext') ||
              id.includes('proj4') ||
              id.includes('flatgeobuf') ||
              id.includes('@turf') ||
              id.includes('geostyler') ||
              id.includes('geotiff')
            ) {
              return 'vendor-gis';
            }
            if (id.includes('dockview')) {
              return 'vendor-dockview';
            }
            if (id.includes('react') || id.includes('@preact')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 5173
  }
});
