import { defineConfig, devices } from '@playwright/test';

// Feature and smoke tests. By default they run against a local-mode dev server (no Supabase, data in
// localStorage). Set E2E_BASE_URL plus E2E_EMAIL / E2E_PASSWORD to run the smoke test against a
// signed-in deployment instead.
const port = 5174;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}/`,
    trace: 'retain-on-failure',
    // Uses the installed Microsoft Edge by default; set PW_CHANNEL=chromium after `npx playwright install chromium`.
    channel: process.env.PW_CHANNEL ?? 'msedge',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Edge'], channel: process.env.PW_CHANNEL ?? 'msedge', viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: true,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
