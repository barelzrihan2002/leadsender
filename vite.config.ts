import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            target: 'node18',
            minify: false,
            rollupOptions: {
              external: (id) => {
                // Always externalize electron and native modules
                if (id === 'electron' || id.startsWith('electron/')) return true;
                if (id === 'better-sqlite3') return true;
                if (id === 'node-machine-id') return true; // Native module
                
                // Externalize main dependencies (Supabase will be bundled)
                const externalPackages = [
                  'whatsapp-web.js',
                  'puppeteer',
                  'qrcode',
                  'xlsx',
                  'date-fns'
                ];
                
                return externalPackages.some(pkg => id === pkg || id.startsWith(pkg + '/'));
              },
              output: {
                format: 'cjs',
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]'
              }
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            target: 'node18',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].js'
              }
            }
          }
        }
      }
    ])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  },
  optimizeDeps: {
    exclude: ['@whiskeysockets/baileys']
  }
});
