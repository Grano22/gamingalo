import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4322;
const WEB_PORT = 4323;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  use: { baseURL: `http://127.0.0.1:${WEB_PORT}` },
  webServer: [
    {
      command: `PORT=${API_PORT} LOG_LEVEL=warn node ../api/dist/main.js`,
      url: `http://127.0.0.1:${API_PORT}/ready`,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: `API_PORT=${API_PORT} npx ng serve --port ${WEB_PORT} --host 127.0.0.1`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120000,
    },
  ],
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
