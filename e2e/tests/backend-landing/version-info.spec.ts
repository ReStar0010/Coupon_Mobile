import { test, expect } from '@playwright/test';

/**
 * App-version metadata endpoint — `/api/app/version-info/?platform=…`.
 *
 * Public (AllowAny), rate-limited (10/min per IP), cached as no-store.
 * Verifies the contract the FE UpgradePrompt relies on.
 */

test.describe('version-info endpoint', () => {
  for (const platform of ['ios', 'android'] as const) {
    test(`returns minVersion + latestVersion + storeUrl for ${platform}`, async ({
      request,
    }) => {
      const res = await request.get(`/api/app/version-info/?platform=${platform}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.platform).toBe(platform);
      expect(typeof body.minVersion).toBe('string');
      expect(typeof body.latestVersion).toBe('string');
      expect(typeof body.storeUrl).toBe('string');
      // Cache-Control must include no-store so a CDN can't defeat
      // a force-upgrade bump.
      const cc = res.headers()['cache-control'] ?? '';
      expect(cc).toMatch(/no-store|no-cache/);
    });
  }

  test('rejects an invalid platform with 400 and a stable error code', async ({ request }) => {
    const res = await request.get('/api/app/version-info/?platform=symbian');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('code', 'APP_VERSION_PLATFORM_INVALID');
  });

  test('rejects a missing platform query param with 400', async ({ request }) => {
    const res = await request.get('/api/app/version-info/');
    expect(res.status()).toBe(400);
  });
});
