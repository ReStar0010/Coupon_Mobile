// Dynamic Expo config — variant layer over the static app.json.
//
// app.json stays the single source of truth for all shared config. This file
// only rewrites the few fields that must differ for each side-by-side variant,
// so Dev / Prev builds install alongside prod on one device.
//
// Selected by the APP_VARIANT env var (set per build profile in eas.json):
//   APP_VARIANT=development → "CouPro Dev"  (com.cokayne.MobileFrontend.dev)     → prod backend
//   APP_VARIANT=preview     → "CouPro Prev" (com.cokayne.MobileFrontend.preview) → dev backend
//   anything else (default) → "CouPro"      (com.cokayne.MobileFrontend)         → prod backend
//
// The backend URL is NOT set here — it is baked into the JS bundle from
// EXPO_PUBLIC_API_URL at build/update time (see eas.json + client.ts).
//
// See: https://docs.expo.dev/tutorial/eas/multiple-app-variants/

const BASE_ID = 'com.cokayne.MobileFrontend';

// Each non-prod variant gets a distinct identity so iOS/Android treat it as a
// separate, co-installable app. Keep the suffix/scheme stable once shipped —
// changing a bundle id orphans the installed app.
const VARIANTS = {
  development: { name: 'CouPro Dev', idSuffix: '.dev', scheme: 'coupro-dev' },
  preview: { name: 'CouPro Prev', idSuffix: '.preview', scheme: 'coupro-preview' },
};

/** True for the @react-native-firebase/* config plugins (bundle-id coupled). */
function isFirebasePlugin(plugin) {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  return typeof name === 'string' && name.startsWith('@react-native-firebase/');
}

module.exports = ({ config }) => {
  const variant = VARIANTS[process.env.APP_VARIANT];

  // Production (and any unknown variant) build: app.json verbatim.
  if (!variant) {
    return config;
  }

  // ── Non-prod variant (Dev / Prev) ──────────────────────────────────────────
  // Distinct identity so iOS/Android treat it as a separate, co-installable app.
  const variantId = `${BASE_ID}${variant.idSuffix}`;
  config.name = variant.name;
  config.scheme = [variant.scheme];
  config.ios = { ...config.ios, bundleIdentifier: variantId };
  config.android = { ...config.android, package: variantId };

  // Don't let the variant claim prod's universal links (avoids the OS opening
  // the wrong app for app.coupro.pro / api.coupro.pro deep links). The variant
  // still has its own coupro-dev:// / coupro-preview:// scheme.
  if (config.ios) delete config.ios.associatedDomains;
  if (config.android) delete config.android.intentFilters;

  // Firebase + Google Maps keys are registered to the prod bundle id, so they
  // can't work under a variant bundle id. Per the chosen tradeoff, disable them
  // on non-prod variants (no Firebase perf; Android map tiles may be blank).
  // Analytics is PostHog (not Firebase) and keeps working.
  config.plugins = (config.plugins ?? []).filter((p) => !isFirebasePlugin(p));
  if (config.ios) delete config.ios.googleServicesFile;
  if (config.android) {
    delete config.android.googleServicesFile;
    if (config.android.config) delete config.android.config.googleMaps;
  }

  return config;
};
