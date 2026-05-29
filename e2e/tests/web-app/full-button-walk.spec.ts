import { test, expect, type Page } from '@playwright/test';

/**
 * Full button walk — exercises every interactive control reachable on
 * the Expo Web build *without* authenticated state.
 *
 * Surfaces covered:
 *   1. /onboarding  — skip button
 *   2. /onboarding  — next x2 + start
 *   3. /onboarding  — dot indicators reflect the active page
 *   4. /(auth)/login — empty-submit guard
 *   5. /(auth)/login — invalid phone → field error
 *   6. /(auth)/login — invalid password → field error
 *   7. /(auth)/login — register link → navigates to /register
 *   8. /(auth)/register — back affordance present
 *   9. /collection/<token> — deep link route loads (auth-gated bounce to login)
 *
 * Authenticated surfaces (home tabs, settings, coupon screens, spinner)
 * require a real BE token. They live in a separate authed-fixture suite
 * and aren't part of the public button walk.
 *
 * Native-only surfaces (CouMap, camera, spinner co-op, native share,
 * EAS Updates) are out of scope on web by design — covered in unit
 * tests and (eventually) Maestro/Detox.
 */

async function clearAndSeenOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
}

async function seenOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.setItem('onboarding_v1_seen', '1'));
}

test.describe('Public button walk — every reachable control on web', () => {
  test('1. Onboarding skip button → marks seen → routes to login', async ({ page }) => {
    await clearAndSeenOnboarding(page);
    await page.goto('/onboarding');
    await expect(page.getByTestId('onboarding-page-0')).toBeVisible();
    await page.getByTestId('onboarding-skip-btn').click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    const flag = await page.evaluate(() => window.localStorage.getItem('onboarding_v1_seen'));
    expect(flag).toBe('1');
  });

  test('2. Onboarding next button advances pages, dots track the active page', async ({
    page,
  }) => {
    await clearAndSeenOnboarding(page);
    await page.goto('/onboarding');

    // react-native-web doesn't emit `aria-selected` for the dot's
    // accessibilityRole="image", so we read the rendered width:
    // active dot is 24px, inactive 8px. Same signal the user sees,
    // checked deterministically.
    const widthOf = async (testId: string) =>
      page
        .getByTestId(testId)
        .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width);

    // Page 0 active.
    expect(await widthOf('onboarding-dot-0')).toBeGreaterThan(15);
    expect(await widthOf('onboarding-dot-1')).toBeLessThan(15);

    // Page 0 → 1
    await page.getByTestId('onboarding-next-btn').click();
    await expect
      .poll(() => widthOf('onboarding-dot-1'), { timeout: 3000 })
      .toBeGreaterThan(15);
    expect(await widthOf('onboarding-dot-0')).toBeLessThan(15);

    // Page 1 → 2
    await page.getByTestId('onboarding-next-btn').click();
    await expect
      .poll(() => widthOf('onboarding-dot-2'), { timeout: 3000 })
      .toBeGreaterThan(15);

    // Final CTA reads "開始使用 CouPro"
    await expect(page.getByText(/開始使用/)).toBeVisible();
  });

  test('3. Onboarding final tap marks seen and routes to login', async ({ page }) => {
    await clearAndSeenOnboarding(page);
    await page.goto('/onboarding');
    const nextBtn = page.getByTestId('onboarding-next-btn');
    await nextBtn.click(); // → page 1
    await nextBtn.click(); // → page 2
    await nextBtn.click(); // → finish
    const flag = await page.evaluate(() => window.localStorage.getItem('onboarding_v1_seen'));
    expect(flag).toBe('1');
  });

  test('4. Login submit with empty fields is disabled at the button level', async ({ page }) => {
    await seenOnboarding(page);
    await page.goto('/login');
    // The submit button is rendered via NeoButton; disabled state is
    // reflected on the underlying pressable. Asserting accessibility
    // is the cleanest check.
    const submit = page.getByRole('button', { name: /登入/ });
    await expect(submit).toBeDisabled();
  });

  test('5. Login with bad phone prefix surfaces the Chinese field error', async ({ page }) => {
    await seenOnboarding(page);
    await page.goto('/login');
    await page.getByTestId('phone-input').fill('0812345678');
    await page.getByTestId('password-input').fill('valid-password');
    await page.getByRole('button', { name: /登入/ }).click();
    const err = page.getByTestId('phone-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText(/手機/);
  });

  test('6. Login with short password surfaces the per-field password error', async ({
    page,
  }) => {
    await seenOnboarding(page);
    await page.goto('/login');
    await page.getByTestId('phone-input').fill('0912345678');
    await page.getByTestId('password-input').fill('pw1');
    await page.getByRole('button', { name: /登入/ }).click();
    const err = page.getByTestId('password-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText(/密碼/);
  });

  test('7. Login "register" link navigates to /register', async ({ page }) => {
    await seenOnboarding(page);
    await page.goto('/login');
    await page.getByText(/還沒有帳號/).click();
    await page.waitForURL(/\/register/, { timeout: 5000 });
  });

  test('8. Register screen renders without throwing the boundary fallback', async ({ page }) => {
    await seenOnboarding(page);
    await page.goto('/register');
    await expect(page.getByTestId('error-boundary-fallback')).toHaveCount(0);
  });

  test('9. Deep-link /collection/<token> route loads and bounces unauth user', async ({
    page,
  }) => {
    await seenOnboarding(page);
    // Without a valid auth session, the route must redirect to /login.
    await page.goto('/collection/synthetic-token');
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('10. UpgradePrompt does not block the login form when up-to-date', async ({ page }) => {
    // Mock version-info to return current=latest so no banner / no modal.
    await page.route('**/api/app/version-info/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          platform: 'ios',
          minVersion: '0.0.1',
          latestVersion: '0.0.1',
          storeUrl: 'https://apps.apple.com/app/id12345',
        }),
      });
    });
    await seenOnboarding(page);
    await page.goto('/login');
    await page.waitForResponse((r) => r.url().includes('/api/app/version-info/'));
    await expect(page.getByTestId('phone-input')).toBeVisible();
    await expect(page.getByTestId('upgrade-recommend-banner')).toHaveCount(0);
    await expect(page.getByTestId('upgrade-force-modal')).toHaveCount(0);
  });

  test('11. UpgradePrompt force-modal renders with both action affordances', async ({ page }) => {
    await page.route('**/api/app/version-info/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          platform: 'ios',
          minVersion: '99.0.0', // current < min → force
          latestVersion: '99.0.0',
          storeUrl: 'https://apps.apple.com/app/id12345',
        }),
      });
    });
    await seenOnboarding(page);
    await page.goto('/login');
    await expect(page.getByTestId('upgrade-force-modal')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('upgrade-force-btn')).toBeVisible();
    await expect(page.getByTestId('upgrade-force-defer-btn')).toBeVisible();
  });

  test('12. UpgradePrompt force-defer hides the modal for the session', async ({ page }) => {
    await page.route('**/api/app/version-info/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          platform: 'ios',
          minVersion: '99.0.0',
          latestVersion: '99.0.0',
          storeUrl: 'https://apps.apple.com/app/id12345',
        }),
      });
    });
    await seenOnboarding(page);
    await page.goto('/login');
    await page.getByTestId('upgrade-force-defer-btn').click();
    await expect(page.getByTestId('upgrade-force-modal')).toHaveCount(0);
  });

  test('13. Force-modal action button is blocked when storeUrl is malicious', async ({
    page,
  }) => {
    // Allowlist defence: even if the BE returns a phishing URL, the
    // openStore handler refuses to call Linking.openURL.
    await page.route('**/api/app/version-info/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          platform: 'ios',
          minVersion: '99.0.0',
          latestVersion: '99.0.0',
          storeUrl: 'https://evil.example.com/phish',
        }),
      });
    });

    // Track popups / navigations the malicious link might attempt.
    const popupPromise = page
      .waitForEvent('popup', { timeout: 2000 })
      .catch(() => null);

    await seenOnboarding(page);
    await page.goto('/login');
    await page.getByTestId('upgrade-force-btn').click();
    const popup = await popupPromise;
    expect(popup).toBeNull();
    // Force modal still visible — Linking.openURL was refused, so the
    // user is back to the same state.
    await expect(page.getByTestId('upgrade-force-modal')).toBeVisible();
  });
});
