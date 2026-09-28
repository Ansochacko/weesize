import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const brandSource = readFileSync(new URL('./src/brand.ts', import.meta.url), 'utf8');
const brandName = brandSource.match(/name: '([^']+)'/)?.[1] ?? 'Weesize';
const brandDescription = brandSource.match(/description: '([^']+)'/)?.[1] ?? '';

function previewPages(): Plugin {
  return {
    name: 'weesize-preview-pages',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = (req.url ?? '/').split('?')[0] ?? '/';
        if (raw.includes('.') && !raw.endsWith('/')) return next();
        const path = raw.replace(/\/+$/, '') || '/';
        if (path !== raw && raw !== '/') {
          res.statusCode = 301;
          res.setHeader('location', path);
          res.end();
          return;
        }
        const file = path === '/' ? join('dist', 'index.html') : join('dist', path.slice(1), 'index.html');
        if (existsSync(file)) {
          res.statusCode = 200;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(readFileSync(file));
          return;
        }
        if (!raw.includes('.')) {
          const missing = join('dist', '404.html');
          res.statusCode = 404;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(existsSync(missing) ? readFileSync(missing) : 'Not found');
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    previewPages(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'favicon.ico', 'theme-init.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: brandName,
        short_name: brandName,
        description: brandDescription,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F5F6F8',
        theme_color: '#2340C9',
        share_target: {
          action: '/',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [{ name: 'files', accept: ['application/pdf', 'image/*', '.docx', '.html'] }],
          },
        },
        file_handlers: [
          {
            action: '/',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: 'weesize',
        globPatterns: ['**/*.{js,css,svg,woff2,webmanifest}', 'index.html'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  worker: {
    format: 'iife',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('jszip')) return 'jszip';
        },
      },
    },
  },
});
