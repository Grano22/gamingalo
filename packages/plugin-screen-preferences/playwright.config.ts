import { defineConfig, devices } from '@playwright/test';

const PORT = 4311;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `node e2e/server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/plugin-screen-preferences/e2e/fixture.html`,
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
