import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    entry: resolve(__dirname, 'src/main/index.ts'),
    resolve: {
      alias: {
        '@lumalite/core': resolve(__dirname, '../core/src/index.ts')
      }
    },
    build: {
      outDir: 'dist/main'
    }
  },
  preload: {
    entry: resolve(__dirname, 'src/preload/index.ts'),
    resolve: {
      alias: {
        '@lumalite/core': resolve(__dirname, '../core/src/index.ts')
      }
    },
    build: {
      outDir: 'dist/preload'
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@lumalite/core': resolve(__dirname, '../core/src/index.ts')
      }
    },
    server: {
      host: '127.0.0.1',
      strictPort: true
    },
    build: {
      outDir: 'dist/renderer'
    },
    plugins: [react()]
  }
});
