import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: 'test/ui-review',
  outputDir: 'test-results/ui-review',
  workers: 1,
  timeout: 30000,
  use: {
    serviceWorkers: 'block',
    baseURL: 'http://127.0.0.1:8095',
    viewport: { width: 1440, height: 900 },
    ...(process.env.BOT_WEB_TEST_CHROMIUM
      ? { launchOptions: { executablePath: process.env.BOT_WEB_TEST_CHROMIUM } }
      : {}),
  },
  webServer: {
    command: 'node scripts/serve-static.mjs',
    env: {
      BOT_WEB_STATIC_PORT: '8095',
      BOT_WEB_STATIC_DIRECTORY: resolve('artifacts/ui-reset/build'),
    },
    url: 'http://127.0.0.1:8095/ui-lab.html',
    reuseExistingServer: !process.env.CI,
  },
});
