import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      {
        name: 'precompress-static-assets',
        apply: 'build',
        closeBundle() {
          const folder = path.resolve('dist/assets');
          if (!fs.existsSync(folder)) return;
          for (const name of fs.readdirSync(folder).filter(name => /\.(js|css)$/.test(name))) {
            const file = path.join(folder, name), bytes = fs.readFileSync(file);
            fs.writeFileSync(file + '.br', brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }));
            fs.writeFileSync(file + '.gz', gzipSync(bytes, { level: 9 }));
          }
        },
      },
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'favicon.ico',
          'favicon.png',
          'apple-touch-icon.png',
          'icon.svg',
          'icon-maskable.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png'
        ],
        manifest: {
          id: '/',
          name: 'Novo Hiper',
          short_name: 'Novo Hiper',
          lang: 'pt-BR',
          description: 'Novo Hiper - Plantas e Jardinagem. Loja infantil de plantas com catálogo, fotos reais, gestão de pedidos de clientes e entregas no mapa de Olinda, Pernambuco.',
          theme_color: '#065f46',
          background_color: '#fafaf9',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          categories: ['education', 'lifestyle', 'kids'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,json,html,ico,png,jpg,jpeg,webp,svg,woff,woff2}'],
          globIgnores: ['**/assets/bernardo-sprites/**'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/unpkg\.com\/leaflet.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'leaflet-assets-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Somente dev: encaminha /api ao backend local isolado quando DEV_API_TARGET estiver definido.
      proxy: process.env.DEV_API_TARGET
        ? {
            '/api': { target: process.env.DEV_API_TARGET, changeOrigin: false },
            '/uploads': { target: process.env.DEV_API_TARGET, changeOrigin: false },
          }
        : undefined,
    },
  };
});
