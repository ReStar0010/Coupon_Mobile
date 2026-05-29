import { test, expect } from '@playwright/test';

/**
 * ErrorBoundary smoke — the boundary renders its fallback when any
 * child below it throws on render. We can't easily induce a thrown
 * render from the outside in production code, so this spec is a
 * lighter assertion: navigate to a known-good route and verify no
 * fallback is present (i.e. the boundary's existence doesn't leak a
 * fallback into the happy path).
 *
 * The hard "fallback renders on throw" assertion already lives in the
 * Jest suite (src/components/__tests__/ErrorBoundary.test.tsx); this
 * spec just guards against accidentally wiring the boundary into a
 * permanent error state on real navigation.
 */

test.describe('ErrorBoundary on happy paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.setItem('onboarding_v1_seen', '1'));
  });

  test('login route does not render the boundary fallback', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('error-boundary-fallback')).toHaveCount(0);
    // Sanity: the login form actually mounted.
    await expect(page.getByTestId('phone-input')).toBeVisible();
  });

  test('onboarding route does not render the boundary fallback', async ({ page }) => {
    await page.evaluate(() => window.localStorage.removeItem('onboarding_v1_seen'));
    await page.goto('/onboarding');
    await expect(page.getByTestId('error-boundary-fallback')).toHaveCount(0);
    await expect(page.getByTestId('onboarding-page-0')).toBeVisible();
  });
});
