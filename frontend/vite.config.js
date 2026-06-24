import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'screenshots/*.png'],
      manifest: {
        name: 'Haushalt',
        short_name: 'Haushalt',
        description: 'Haushalts-Aufgaben-App',
        theme_color: '#7F77DD',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        screenshots: [
          { src: '/screenshots/mobile.png', type: 'image/png', form_factor: 'narrow', label: 'Aufgaben-Übersicht' },
          { src: '/screenshots/desktop.png', type: 'image/png', form_factor: 'wide', label: 'Aufgaben-Übersicht Desktop' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
