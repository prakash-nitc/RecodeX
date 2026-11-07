/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
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
      try { files = fs.readdirSync(path.resolve(__dirname, 'public/art')); } catch { /* no folder */ }
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
  plugins: [react(), artManifest()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
    // Run tests in the user's time zone so calendar-day maths matches real use.
    env: { TZ: 'Asia/Kolkata' },
  },
});
