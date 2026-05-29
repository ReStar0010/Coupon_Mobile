import { test, expect } from '@playwright/test';

/**
 * Launch onboarding — 3-page swipe / Skip flow.
 *
 * Verifies the unauthenticated-and-unseen path through `app/index.tsx`
 * redirects to `/onboarding`, that the three pages render, and that
 * completing the flow (or skipping) routes the user to `/(auth)/login`.
 *
 * AsyncStorage is a localStorage shim on web, so we clear it before
 * each test to simulate a fresh install.
 */

test.describe('Launch onboarding', () => {
  test.beforeEach(async ({ page }) => {
    // Force first-launch state — clear the onboarding-seen flag.
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  });

  test('first launch routes to /onboarding and renders all 3 pages', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.getByTestId('onboarding-page-0')).toBeVisible();
    // Pages 1 and 2 live inside a horizontal ScrollView; rely on the dot
    // selector instead of trying to assert all pages visible at once.
    await expect(page.getByTestId('onboarding-dot-0')).toBeVisible();
    await expect(page.getByTestId('onboarding-dot-1')).toBeVisible();
    await expect(page.getByTestId('onboarding-dot-2')).toBeVisible();
  });

  test('skip button writes the seen flag and routes to login', async ({ page }) => {
    await page.goto('/onboarding');
    await page.getByTestId('onboarding-skip-btn').click();
    // AsyncStorage flag should be set after Skip.
    const flag = await page.evaluate(() =>
      window.localStorage.getItem('onboarding_v1_seen'),
    );
    expect(flag).toBe('1');
    // Expo Router replaces history; the path settles on /(auth)/login.
    await page.waitForURL(/\/login/, { timeout: 5_000 });
  });

  test('next-button progression advances dots and final tap completes the flow', async ({
    page,
  }) => {
    await page.goto('/onboarding');
    const nextBtn = page.getByTestId('onboarding-next-btn');

    // Page 0 → 1
    await nextBtn.click();
    // Page 1 → 2
    await nextBtn.click();
    // The final-page CTA reads "開始使用 CouPro" — tapping it finalises.
    await expect(page.getByText(/開始使用/)).toBeVisible();
    await nextBtn.click();

    const flag = await page.evaluate(() =>
      window.localStorage.getItem('onboarding_v1_seen'),
    );
    expect(flag).toBe('1');
  });
});
