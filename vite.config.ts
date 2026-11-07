/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
    // Run tests in the user's time zone so calendar-day maths matches real use.
    env: { TZ: 'Asia/Kolkata' },
  },
});
