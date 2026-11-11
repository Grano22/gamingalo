import { defineConfig, devices } from '@playwright/test';

const PORT = 4330;
// The same base path as GitHub Pages, so links and search are tested as they'll be deployed.
export const BASE_PATH = '/gamingalo';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  use: { baseURL: `http://127.0.0.1:${PORT}${BASE_PATH}/` },
  webServer: {
    command: `DOCS_BASE_PATH=${BASE_PATH} npm run build && node e2e/server.mjs ${PORT} ${BASE_PATH}`,
    url: `http://127.0.0.1:${PORT}${BASE_PATH}/`,
    reuseExistingServer: !process.env['CI'],
    timeout: 240000,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
