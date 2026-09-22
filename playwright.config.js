const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000, // two-client tests need more time
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:7890',
    headless: true,
    viewport: { width: 1280, height: 800 },
    // Clear storage between tests
    storageState: undefined,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
