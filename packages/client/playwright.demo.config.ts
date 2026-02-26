import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'demo.ts',
  fullyParallel: false,
  retries: 0,
  timeout: 600_000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    launchOptions: {
      slowMo: 80,
    },
  },
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd ../server && npm run dev',
      url: 'http://localhost:3001/api/auth/me',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
