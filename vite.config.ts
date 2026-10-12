/**
 * @file vite.config.ts
 * @module config/vite
 * @description Vite configuration for Cartouche desktop GIS application, configuring Electron main, preload, and React renderer compilation with vendor chunk splitting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-12
 * @since 0.1.0-dev
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: path.resolve(__dirname, 'src/main/main.ts'),
        onstart(options) {
          // Open V8 inspect port for the Main process without remote-debugging-port contention
          options.startup(['.', '--inspect=5858', '--no-sandbox']);
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
          options.reload();
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
