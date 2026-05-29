import { test, expect } from '@playwright/test';

/**
 * Backend HTML landing pages — the fallback web pages a recipient
 * sees when they tap a share link on a device without the CouPro
 * app installed (Universal Link miss).
 *
 * These exercise:
 *   - /collection/<token>/  (shared coupon claim)
 *   - /claim/<token>/       (QR-session claim)
 *   - /voucher/<token>/     (platform voucher)
 *
 * The pages render the same default copy whether or not the token
 * resolves to a real DB row, so we use synthetic tokens and assert
 * the page structure (title, store links, app-install guidance).
 */

const TOKEN = 'e2e-synthetic-token';

test.describe('share-link landing pages', () => {
  test('collection landing renders with App Store + Play Store links', async ({ page }) => {
    const response = await page.goto(`/collection/${TOKEN}/`);
    expect(response?.status()).toBe(200);

    // Title should mention CouPro.
    await expect(page).toHaveTitle(/CouPro/);

    // Body must contain at least one of the two store links so users
    // can install the app to claim. We don't pin the literal URL —
    // App Store IDs may be env-overridden — but the host must match.
    const html = await page.content();
    expect(html).toMatch(/apps\.apple\.com|itms-apps/);
    expect(html).toMatch(/play\.google\.com/);
  });

  test('claim landing renders default copy with a synthetic token', async ({ page }) => {
    const response = await page.goto(`/claim/${TOKEN}/`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/CouPro/);
    // The view's default description mentions QR Code.
    const html = await page.content();
    expect(html).toContain('QR Code');
  });

  test('voucher landing renders with store links', async ({ page }) => {
    const response = await page.goto(`/voucher/${TOKEN}/`);
    expect(response?.status()).toBe(200);
    const html = await page.content();
    expect(html).toMatch(/apps\.apple\.com|play\.google\.com/);
  });

  test('apple-app-site-association is served as JSON for Universal Link verification', async ({
    request,
  }) => {
    const res = await request.get('/apple-app-site-association');
    expect(res.status()).toBe(200);
    // Apple requires application/json (or octet-stream) — we accept either.
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json|octet-stream/);
    const body = await res.json();
    expect(body).toHaveProperty('applinks');
  });

  test('assetlinks.json is served for Android Universal Link verification', async ({
    request,
  }) => {
    const res = await request.get('/.well-known/assetlinks.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Must be a JSON array of statements.
    expect(Array.isArray(body)).toBe(true);
  });
});
