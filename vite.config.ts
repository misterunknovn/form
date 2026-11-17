import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Auf GitHub Pages liegt die App unter /form/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/form/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Form',
        short_name: 'Form',
        description: 'Lauf- und Krafttraining planen, erfassen und mit Claude auswerten.',
        lang: 'de',
        theme_color: '#0d0e0e',
        background_color: '#0d0e0e',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: { environment: 'jsdom' },
})
