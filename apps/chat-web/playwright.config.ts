import { defineConfig } from '@playwright/test';

const baseURL = process.env.MARKETING_OPS_E2E_BASE_URL ?? 'http://127.0.0.1:8088';

export default defineConfig({
  testDir: './e2e',
  outputDir: '../../tmp/playwright-phase-2',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false
  },
  projects: [
    {
      name: 'desktop-chromium',
      grepInvert: /@mobile/,
      use: { viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'mobile-chromium',
      grep: /@mobile/,
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      }
    }
  ]
});
