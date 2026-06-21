import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Gilded Aces — premium private casino simulation.
// Virtual chips only. No payments, no IAP, no real-money path anywhere.
//
// Deployed to GitHub Pages as a project site at https://blindmo.github.io/TheRoad/,
// so production assets are served under the `/TheRoad/` base path. Dev stays at `/`.
export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/TheRoad/' : '/';
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Gilded Aces',
          short_name: 'Gilded Aces',
          description: 'A private high-roller poker & slots lounge. Virtual chips only.',
          theme_color: '#0B3D2E',
          background_color: '#1A1410',
          display: 'standalone',
          orientation: 'portrait',
          // start_url/scope are derived from `base` by the plugin.
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
      }),
    ],
    build: {
      target: 'es2021',
      chunkSizeWarningLimit: 1500,
    },
  };
});
