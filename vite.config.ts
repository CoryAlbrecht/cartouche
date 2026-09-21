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
          options.startup(['.', '--no-sandbox']);
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
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
        entry: path.resolve(__dirname, 'src/main/preload.ts'),
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
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
      input: path.resolve(__dirname, 'src/renderer/index.html')
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});
