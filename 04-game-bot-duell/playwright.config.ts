import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node tools/server.mjs',
    url: 'http://localhost:4174',
    reuseExistingServer: true,
  },
});
