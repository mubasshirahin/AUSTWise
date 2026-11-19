// QA automation. Run against a TEST database only (local .env points at production).
// Usage: copy .env.test.example -> .env.test, fill it, then `npm run test:e2e`.
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });
const baseURL = process.env.QA_BASE_URL || 'http://localhost:5174';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { outputFolder: 'qa-report/html', open: 'never' }], ['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  globalSetup: './e2e/global-setup.js',
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  // Only auto-start the server when explicitly allowed (it must be using the test DB).
  webServer: process.env.QA_START_SERVER === '1'
    ? { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 180_000 }
    : undefined,
});
