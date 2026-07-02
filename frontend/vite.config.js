import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'))
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['icons/*.png', 'screenshots/*.png'],
      manifest: {
        name: 'Haushalt',
        short_name: 'Haushalt',
        description: 'Haushalts-Aufgaben-App',
        theme_color: '#EA580C',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        screenshots: [
          { src: '/screenshots/login.png',     type: 'image/png', form_factor: 'narrow', label: 'Anmeldung' },
          { src: '/screenshots/home.png',      type: 'image/png', form_factor: 'narrow', label: 'Aufgaben-Übersicht' },
          { src: '/screenshots/admin.png',     type: 'image/png', form_factor: 'narrow', label: 'Verwaltung' },
          { src: '/screenshots/halloffame.png',type: 'image/png', form_factor: 'narrow', label: 'Ruhmeshalle' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: apiProxyTarget, changeOrigin: true },
    },
  },
  preview: {
    // Needed for Playwright e2e tests: `vite preview` serves the production
    // build (with the real service worker active), but has no API proxy by
    // default the way `vite dev` does.
    proxy: {
      '/api': { target: apiProxyTarget, changeOrigin: true },
    },
  },
})
