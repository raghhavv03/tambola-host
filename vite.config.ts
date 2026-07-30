import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Vite ignores PORT by default. Honour it so a tool that picks the port for us
    // (the editor's dev-preview runner) and this config can't disagree about where
    // the server actually is.
    port: Number(process.env.PORT) || 5175,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // We own the service worker (src/sw.ts) so the airgap "no client relay"
      // invariant is asserted against source we control, not a generated file.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // Everything is local, so precaching every built asset == full offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
      },
      manifest: {
        name: 'Tambola',
        short_name: 'Tambola',
        description:
          'Run a physical tambola game: call the numbers, hand out tickets, check claims.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
