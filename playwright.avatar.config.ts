import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/avatar-lab',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8092',
    viewport: { width: 1280, height: 900 },
    ...(process.env.BOT_WEB_TEST_CHROMIUM
      ? { launchOptions: { executablePath: process.env.BOT_WEB_TEST_CHROMIUM } }
      : {}),
    trace: 'off',
  },
  webServer: {
    command: 'node scripts/serve-static.mjs',
    env: { BOT_WEB_STATIC_PORT: '8092' },
    url: 'http://127.0.0.1:8092/avatar-lab.html',
  },
});
