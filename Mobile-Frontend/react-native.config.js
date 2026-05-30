// React Native CLI autolinking config.
//
// On the "development" app variant we exclude @react-native-firebase from the
// native build entirely. Its config plugins + GoogleService-Info.plist /
// google-services.json are already dropped for this variant in app.config.js,
// and on iOS the still-autolinked Firebase pod would otherwise crash at launch
// ([FIRApp configure] with no plist). Excluding it here keeps the Dev build
// buildable and crash-free without any Firebase config.
//
// Selected by APP_VARIANT, which EAS sets per build profile (eas.json) and is
// present during prebuild/autolinking. Production and local dev (no APP_VARIANT)
// are unaffected — Firebase autolinks normally.

const IS_DEV = process.env.APP_VARIANT === 'development';

// All @react-native-firebase native modules must be excluded together: the
// analytics/perf pods depend on RNFBApp, so dropping one without the others
// breaks pod resolution.
const FIREBASE_PACKAGES = [
  '@react-native-firebase/app',
  '@react-native-firebase/analytics',
  '@react-native-firebase/perf',
];

const disableAutolink = { platforms: { ios: null, android: null } };

module.exports = IS_DEV
  ? {
      dependencies: Object.fromEntries(
        FIREBASE_PACKAGES.map((name) => [name, disableAutolink]),
      ),
    }
  : {};
