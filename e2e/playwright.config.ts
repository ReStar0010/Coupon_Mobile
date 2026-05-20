import { defineConfig, devices } from '@playwright/test';

/**
 * Two-project Playwright suite:
 *
 *   1. `web-app`        — drives the Expo Web build of Mobile-Frontend.
 *                         Covers auth/onboarding/upgrade-prompt/feedback
 *                         /error-boundary surfaces. Camera + map + spinner
 *                         co-op are explicitly out of scope (no web binding).
 *
 *   2. `backend-landing` — drives the Django HTML landing pages served by
 *                         Backend (collection / claim / voucher links).
 *                         These are the fallback web pages a recipient sees
 *                         when they tap a share link without the app
 *                         installed. Hits staging directly by default;
 *                         override via E2E_BACKEND_BASE_URL.
 *
 * Defaults are conservative: 30 s timeout, retries=2 on CI, single worker
 * for the Expo Web project because cold builds are slow and parallel
 * runs against one dev server are flaky.
 */

const EXPO_WEB_PORT = Number(process.env.EXPO_WEB_PORT ?? 8081);
const WEB_BASE_URL = process.env.E2E_WEB_BASE_URL ?? `http://localhost:${EXPO_WEB_PORT}`;
const BACKEND_BASE_URL =
  process.env.E2E_BACKEND_BASE_URL ?? 'https://coupon-mobile-dev.onrender.com';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    // Slow networks + Expo Web's first paint can be glacial; the per-action
    // timeout below shields specific waits from the global timeout.
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'web-app',
      testDir: './tests/web-app',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_BASE_URL,
        // Metro's first bundle compile + cold-start signaling can take
        // 30-60s. The global 30s navigation timeout is too tight for the
        // `page.goto('/')` that triggers the initial build; per-project
        // override gives us headroom without slowing the backend project.
        navigationTimeout: 90_000,
      },
    },
    {
      name: 'backend-landing',
      testDir: './tests/backend-landing',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BACKEND_BASE_URL,
      },
    },
  ],

  // `expo start --web` is slow to boot (~30-60s cold). We let the user
  // start it manually for local iteration, and the CI workflow boots it
  // explicitly before running this suite. Uncomment the webServer block
  // below if you want Playwright to manage the dev server itself.
  //
  // webServer: {
  //   command: 'npm --prefix ../Mobile-Frontend start -- --web --non-interactive',
  //   url: WEB_BASE_URL,
  //   timeout: 180_000,
  //   reuseExistingServer: !process.env.CI,
  // },
});
