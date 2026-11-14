/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

/** Lists artwork placed in public/art so the app can use it instead of the built-in SVG scenes. */
function artManifest(): Plugin {
  const id = 'virtual:recodex-art', resolved = '\0' + id;
  return {
    name: 'recodex-art',
    resolveId(source) { return source === id ? resolved : undefined; },
    load(source) {
      if (source !== resolved) return;
      let files: string[] = [];
      try { files = fs.readdirSync(path.resolve(process.cwd(), 'public/art')); } catch { /* no folder */ }
      const map: Record<string, string> = {};
      for (const f of files) {
        const m = /^(dawn|day|dusk|night|hero)\.(webp|jpe?g|png|avif)$/i.exec(f);
        if (m) map[m[1].toLowerCase()] = `/art/${f}`;
      }
      return `export default ${JSON.stringify(map)};`;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    artManifest(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'icon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
      ],
      manifest: {
        name: 'RecodeX',
        short_name: 'RecodeX',
        description: 'RecodeX: a calm, daily training ground for mastering data structures and algorithms with spaced repetition.',
        theme_color: '#6A4BD1',
        background_color: '#F6F4FB',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,gif,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
    // Run tests in the user's time zone so calendar-day maths matches real use.
    env: { TZ: 'Asia/Kolkata' },
  },
});
