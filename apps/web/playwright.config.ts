import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4322;
const WEB_PORT = 4323;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  // `localhost`, because passkeys can't use an IP address as their relying party.
  use: { baseURL: `http://localhost:${WEB_PORT}` },
  webServer: [
    {
      // Every test signs in from one address, so the sign-in limit is raised here. Unit tests cover the limit.
      command: `PORT=${API_PORT} LOG_LEVEL=warn AUTH_RATE_LIMIT=1000 WEB_ORIGIN=http://localhost:${WEB_PORT} RP_ID=localhost node ../api/dist/main.js`,
      url: `http://127.0.0.1:${API_PORT}/ready`,
      reuseExistingServer: !process.env['CI'],
    },
    {
      // The production build, as players get it. `ng serve` reloads pages while it bundles dependencies.
      command: `node e2e/server.mjs ${WEB_PORT} ${API_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env['CI'],
    },
  ],
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
