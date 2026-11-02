import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block', // Tests sollen immer die aktuellen Dateien sehen
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 15'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'node tools/server.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
