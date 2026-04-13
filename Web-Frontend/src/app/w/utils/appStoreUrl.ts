/** Default Android applicationId; keep in sync with Backend COUPRO_PLAY_STORE_ID. */
const DEFAULT_PLAY_PACKAGE = 'com.cokayne.MobileFrontend';

function iosAppStoreUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_STORE_URL?.trim();
  if (explicit) return explicit;
  const id = process.env.NEXT_PUBLIC_COUPRO_APP_STORE_ID?.trim();
  if (id) return `https://apps.apple.com/app/id${id}`;
  return '#';
}

function androidPlayStoreUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim();
  if (explicit) return explicit;
  const pkg = process.env.NEXT_PUBLIC_COUPRO_PLAY_STORE_ID?.trim() || DEFAULT_PLAY_PACKAGE;
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`;
}

/**
 * App Store (iOS / default) or Play Store (Android) URL for "download CouPro" CTAs.
 * Prefer NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_STORE_URL, or build from
 * NEXT_PUBLIC_COUPRO_APP_STORE_ID / NEXT_PUBLIC_COUPRO_PLAY_STORE_ID.
 */
export function getAppStoreUrl(): string {
  if (typeof navigator === 'undefined') {
    return iosAppStoreUrl();
  }
  if (/Android/i.test(navigator.userAgent)) {
    return androidPlayStoreUrl();
  }
  return iosAppStoreUrl();
}
