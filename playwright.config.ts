import { defineConfig } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT || '3000';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', channel: 'msedge', trace: 'off', screenshot: 'off' },
  webServer: { command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 60000 },
});
