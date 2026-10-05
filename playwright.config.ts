import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium', channel: 'msedge', trace: 'off', screenshot: 'off' },
  webServer: { command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1', url: 'http://127.0.0.1:3000', reuseExistingServer: false, timeout: 60000 },
});
