import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        skipWaiting: true,
      },
      includeAssets: [
        'polesheadlamp-app-logo-round-192.png',
        'polesheadlamp-app-logo-round-512.png',
      ],
      manifest: {
        name: 'Restoration Headlamp Indonesia',
        short_name: 'RHI System',
        description: 'Sistem Manajemen Operasional Teknisi Restoration Headlamp Indonesia',
        theme_color: '#0F172A',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'polesheadlamp-app-logo-round-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'polesheadlamp-app-logo-round-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (
            normalizedId.includes('vite/preload-helper') ||
            normalizedId.includes('commonjsHelpers') ||
            normalizedId.includes('rollupPluginBabelHelpers')
          ) return 'vendor-runtime'

          if (!normalizedId.includes('node_modules')) return undefined

          if (
            normalizedId.includes('/node_modules/clsx/') ||
            normalizedId.includes('/node_modules/tailwind-merge/') ||
            normalizedId.includes('/node_modules/class-variance-authority/')
          ) return 'vendor-utils'

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) return 'vendor-react'
          if (normalizedId.includes('@supabase')) return 'vendor-supabase'
          if (normalizedId.includes('@radix-ui') || normalizedId.includes('cmdk') || normalizedId.includes('vaul')) return 'vendor-ui'
          if (normalizedId.includes('recharts') || normalizedId.includes('/d3-')) return 'vendor-charts'
          if (normalizedId.includes('html2canvas')) return 'vendor-html2canvas'
          if (normalizedId.includes('jspdf')) return 'vendor-pdf'
          if (normalizedId.includes('xlsx')) return 'vendor-xlsx'
          if (normalizedId.includes('papaparse')) return 'vendor-csv'
          if (normalizedId.includes('leaflet')) return 'vendor-map'

          return undefined
        },
      },
    },
  },
})
