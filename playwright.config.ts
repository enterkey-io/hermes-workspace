import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/browser',
  timeout: 60_000,
  workers: 1,
  use: {
    ...(process.env.BOT_WEB_TEST_CHROMIUM
      ? { launchOptions: { executablePath: process.env.BOT_WEB_TEST_CHROMIUM } }
      : {}),
    baseURL: 'https://127.0.0.1:5443',
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
  },
});
