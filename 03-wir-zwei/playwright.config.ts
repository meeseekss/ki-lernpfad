import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block', // Tests sollen immer die aktuellen Dateien sehen
  },
  projects: [
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 15'],
        browserName: 'chromium',
        // Ausgedachte Kamera für die Foto-Tests (Testbild statt echter Kamera)
        permissions: ['camera'],
        launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
      },
    },
  ],
  webServer: {
    command: 'node tools/server.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
