import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'AUSTWise',
        short_name: 'AUSTWise',
        description: 'Your campus companion for AUST students',
        theme_color: '#171717',
        background_color: '#0f0f0f',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,svg}'],
        globIgnores: ['**/vendor-three*', '**/vendor-pdfgen*', '**/vendor-pdfjs*', '**/vendor-diagram*', '**/vendor-gsap*'],
        maximumFileSizeToCacheInBytes: 500 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        runtimeCaching: [
          { urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'cdnjs-cache', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
          { urlPattern: /\/assets\/vendor-(three|pdfgen|pdfjs|diagram|gsap)-.*/i, handler: 'CacheFirst', options: { cacheName: 'heavy-vendor', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]three[\\/]/.test(id)) return 'vendor-three';
            if (/[\\/]pdfjs-dist[\\/]/.test(id)) return 'vendor-pdfjs';
            if (/[\\/](jspdf|html2canvas-pro|html2canvas)[\\/]/.test(id)) return 'vendor-pdfgen';
            if (/[\\/](mermaid|markmap-)[\\/]/.test(id)) return 'vendor-diagram';
            if (/[\\/](react|react-dom|react-router|scheduler|use-sync-external-store)[\\/]/.test(id)) return 'vendor-react';
            if (/[\\/](d3|d3-)[\\/]/.test(id)) return 'vendor-d3';
            if (/[\\/](chart\.js|react-chartjs-2)[\\/]/.test(id)) return 'vendor-chartjs';
            if (/[\\/]gsap[\\/]/.test(id)) return 'vendor-gsap';
            if (/[\\/]leaflet[\\/]/.test(id)) return 'vendor-leaflet';
          }
        },
      },
    },
    // Keep rolldownOptions for rolldown-based Vite (future compat) — mirrors rollupOptions
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Core React runtime + router: the only dependencies the app shell
            // needs on every page. Splitting them out keeps the entry chunk
            // small and lets browsers cache them independently of app code.
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|use-sync-external-store|react-is|object-assign)[\\/]/,
              priority: 30,
            },
            // Three.js — only needed by StalkRoadScene, massive bundle
            {
              name: 'vendor-three',
              test: /node_modules[\\/](three)[\\/]/,
              priority: 20,
            },
            // D3 — only needed by campus heatmap & analytics
            {
              name: 'vendor-d3',
              test: /node_modules[\\/](d3|d3-)[\\/]/,
              priority: 20,
            },
            // Chart.js + react-chartjs-2 — analytics & campus pulse
            {
              name: 'vendor-chartjs',
              test: /node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
              priority: 20,
            },
            // GSAP animation library — landing, stalk-road, pro
            {
              name: 'vendor-gsap',
              test: /node_modules[\\/](gsap)[\\/]/,
              priority: 20,
            },
            // Leaflet maps — campus page
            {
              name: 'vendor-leaflet',
              test: /node_modules[\\/](leaflet)[\\/]/,
              priority: 20,
            },
            // PDF.js rendering engine — heaviest PDF dep (~430 kB)
            {
              name: 'vendor-pdfjs',
              test: /node_modules[\\/](pdfjs-dist)[\\/]/,
              priority: 25,
            },
            // jsPDF + html2canvas — cover page generator, notebook, etc.
            {
              name: 'vendor-pdfgen',
              test: /node_modules[\\/](jspdf|html2canvas-pro|html2canvas)[\\/]/,
              priority: 20,
            },
            // Mermaid / markmap — notebook mindmaps
            {
              name: 'vendor-diagram',
              test: /node_modules[\\/](mermaid|markmap-)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
})
