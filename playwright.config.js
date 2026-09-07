const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  webServer: process.env.E2E_LOCAL ? {
    command: 'python frontend/local_server.py',
    url: 'http://127.0.0.1:4181/super-admin',
    env: { FRONTEND_PORT: '4181' },
    reuseExistingServer: false,
  } : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL || (process.env.E2E_LOCAL ? 'http://127.0.0.1:4181' : 'https://frontend-teal-nine-80.vercel.app'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
