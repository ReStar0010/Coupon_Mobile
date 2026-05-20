import { test, expect } from '@playwright/test';

/**
 * Login Zod validation — per-field errors fire from the schema, not the
 * server. We deliberately exercise the FE-side validation only and
 * don't submit a real credential pair; specs that need the BE belong
 * in a separate authenticated flow with seeded fixtures.
 */

test.describe('Login Zod validation', () => {
  test.beforeEach(async ({ page }) => {
    // Skip onboarding so we land on /login directly.
    await page.goto('/');
    await page.evaluate(() => window.localStorage.setItem('onboarding_v1_seen', '1'));
    await page.goto('/login');
  });

  test('rejects a phone with the wrong prefix and shows the Chinese error', async ({ page }) => {
    await page.getByTestId('phone-input').fill('0812345678');
    await page.getByTestId('password-input').fill('a-valid-password');
    // The submit button label is in Chinese; targeting by role + an
    // accessible-name regex is more resilient than literal text.
    await page.getByRole('button', { name: /登入/ }).click();
    await expect(page.getByTestId('phone-error')).toBeVisible();
    await expect(page.getByTestId('phone-error')).toContainText(/手機/);
  });

  test('rejects a too-short password and shows the per-field error', async ({ page }) => {
    await page.getByTestId('phone-input').fill('0912345678');
    await page.getByTestId('password-input').fill('pw1');
    await page.getByRole('button', { name: /登入/ }).click();
    await expect(page.getByTestId('password-error')).toBeVisible();
    await expect(page.getByTestId('password-error')).toContainText(/密碼/);
  });

  test('strips dashes from a typed phone and clears the field error on next keystroke', async ({
    page,
  }) => {
    // First trigger an error.
    await page.getByTestId('phone-input').fill('0812345678');
    await page.getByTestId('password-input').fill('pw123456');
    await page.getByRole('button', { name: /登入/ }).click();
    await expect(page.getByTestId('phone-error')).toBeVisible();

    // Typing a valid phone clears the error before resubmit.
    await page.getByTestId('phone-input').fill('0912-345-678');
    await expect(page.getByTestId('phone-error')).toHaveCount(0);
  });
});
