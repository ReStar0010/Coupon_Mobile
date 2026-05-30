// Dynamic Expo config — variant layer over the static app.json.
//
// app.json stays the single source of truth for all shared config. This file
// only rewrites the few fields that must differ for the side-by-side
// "development" variant, so a Dev build installs alongside prod on one device.
//
// Selected by the APP_VARIANT env var (set per build profile in eas.json):
//   APP_VARIANT=development → "CouPro Dev"  (com.cokayne.MobileFrontend.dev)
//   anything else (default) → "CouPro"      (com.cokayne.MobileFrontend)
//
// See: https://docs.expo.dev/tutorial/eas/multiple-app-variants/

const IS_DEV = process.env.APP_VARIANT === 'development';

const BASE_ID = 'com.cokayne.MobileFrontend';
const DEV_ID = `${BASE_ID}.dev`;

/** True for the @react-native-firebase/* config plugins (bundle-id coupled). */
function isFirebasePlugin(plugin) {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  return typeof name === 'string' && name.startsWith('@react-native-firebase/');
}

module.exports = ({ config }) => {
  // Production (and any non-dev) build: app.json verbatim.
  if (!IS_DEV) {
    return config;
  }

  // ── Development variant ────────────────────────────────────────────────────
  // Distinct identity so iOS/Android treat it as a separate, co-installable app.
  config.name = 'CouPro Dev';
  config.scheme = ['coupro-dev'];
  config.ios = { ...config.ios, bundleIdentifier: DEV_ID };
  config.android = { ...config.android, package: DEV_ID };

  // Don't let the Dev app claim prod's universal links (avoids the OS opening
  // the wrong app for app.coupro.pro / api.coupro.pro deep links). The Dev app
  // still has its own coupro-dev:// scheme.
  if (config.ios) delete config.ios.associatedDomains;
  if (config.android) delete config.android.intentFilters;

  // Firebase + Google Maps keys are registered to the prod bundle id, so they
  // can't work under com.cokayne.MobileFrontend.dev. Per the chosen tradeoff,
  // disable them on Dev (no Firebase perf; Android map tiles may be blank).
  // Analytics is PostHog (not Firebase) and keeps working.
  config.plugins = (config.plugins ?? []).filter((p) => !isFirebasePlugin(p));
  if (config.ios) delete config.ios.googleServicesFile;
  if (config.android) {
    delete config.android.googleServicesFile;
    if (config.android.config) delete config.android.config.googleMaps;
  }

  return config;
};
