import { defineConfig, devices } from '@playwright/test';

const LOCAL_URL = 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: process.env.BASE_URL ?? LOCAL_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Auto-start dev server only when running locally (no BASE_URL override).
  // E2E tests are NOT run in CI — Playwright requires a browser + live server.
  ...(process.env.BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: `${LOCAL_URL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }),
});
