import { test, expect } from '@playwright/test';

/**
 * UpgradePrompt — three modes, all driven by the BE version-info
 * response.
 *
 * We intercept the API call with `page.route()` so the spec doesn't
 * depend on staging's actual `APP_VERSION_INFO` env value or the
 * placeholder defaults shipped in the view.
 *
 * `Application.nativeApplicationVersion` on web reads from
 * Constants.expoConfig.version (which mirrors app.json's "1.0.3").
 * That makes "force-update" the trickiest mode to exercise without
 * stubbing both the API AND the native version — we only exercise
 * the "recommend" + "up-to-date" branches in this spec, since
 * those are reachable purely by mocking the API. Force-update is
 * covered exhaustively in the Jest unit suite.
 */

test.describe('UpgradePrompt', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.setItem('onboarding_v1_seen', '1'));
  });

  test('renders the recommend banner when latestVersion > current', async ({ page }) => {
    await page.route('**/api/app/version-info/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          platform: 'ios',
          minVersion: '0.0.1',
          latestVersion: '99.0.0', // far in the future — always recommends
          storeUrl: 'https://apps.apple.com/app/id12345',
        }),
      });
    });

    await page.goto('/login');
    await expect(page.getByTestId('upgrade-recommend-banner')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('renders nothing when latestVersion <= current', async ({ page }) => {
    await page.route('**/api/app/version-info/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          platform: 'ios',
          minVersion: '0.0.1',
          latestVersion: '0.0.1', // already at or above this
          storeUrl: 'https://apps.apple.com/app/id12345',
        }),
      });
    });

    await page.goto('/login');
    // Settle: wait for the API call to have been intercepted.
    await page.waitForResponse((r) => r.url().includes('/api/app/version-info/'));
    await expect(page.getByTestId('upgrade-recommend-banner')).toHaveCount(0);
    await expect(page.getByTestId('upgrade-force-modal')).toHaveCount(0);
  });

  test('renders nothing when the API call fails (fail-open)', async ({ page }) => {
    await page.route('**/api/app/version-info/**', async (route) => {
      await route.fulfill({ status: 500, body: 'oops' });
    });
    await page.goto('/login');
    await page.waitForTimeout(1000); // give the FE time to settle
    await expect(page.getByTestId('upgrade-recommend-banner')).toHaveCount(0);
    await expect(page.getByTestId('upgrade-force-modal')).toHaveCount(0);
  });
});
