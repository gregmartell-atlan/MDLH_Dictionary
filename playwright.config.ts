import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    headless: process.env.E2E_HEADLESS !== 'false' && process.env.E2E_MANUAL !== '1',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
