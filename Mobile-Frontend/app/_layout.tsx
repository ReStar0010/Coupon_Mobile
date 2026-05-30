import React, { useEffect } from 'react';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import FontProvider from '@/src/theme/FontProvider';
import { AuthProvider } from '@/src/state/AuthContext';
import { WalletProvider } from '@/src/state/WalletContext';
import { tryApplyUpdate } from '@/src/services/updates/applyUpdates';
import UpgradePrompt from '@/src/features/upgrade/UpgradePrompt';
import { CoopProvider } from '@/src/features/spinner/coop/CoopContext';
import { OnboardingAnchorProvider } from '@/src/components/onboarding/onboardingAnchors';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { scrubBreadcrumb } from '@/src/services/sentry/scrubBreadcrumb';

// Launch-time EAS Update budget. 5s gives the typical 3-5 MB bundle a
// fair shot on healthy wifi while never trapping the user on a bad
// network. Partial downloads persist in expo-updates' cache and finish
// on the next cold start, so a 'timed-out' result still makes progress.
const UPDATE_DEADLINE_MS = 5_000;

// Sentry navigation integration is created at module scope so the
// instance referenced by Sentry.init() is the same one we register
// the navigation container against inside the component. Re-creating
// it would break Fast Refresh's screen-transition span tracking.
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// Helper: read app version from app.json so Sentry releases line up
// with what UpgradePrompt's `Constants.expoConfig?.version` reads —
// single source of truth.
function resolveRelease(): string | undefined {
  const version = Constants.expoConfig?.version;
  return version ? `coupro-mobile@${version}` : undefined;
}

// `EXPO_PUBLIC_ENV` lets ops tag environments without rebuilding the
// JS bundle for every channel switch. Falls back to NODE_ENV so a
// dev/prod split is still visible if the env var isn't set yet.
function resolveEnvironment(): string {
  return process.env.EXPO_PUBLIC_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development');
}

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  // Performance monitoring: 10% sample is the canonical starting point
  // (Sentry docs). Lower than the BE default because mobile transaction
  // volume is higher and the Sentry tier costs more per RN event.
  tracesSampleRate: 0.1,
  environment: resolveEnvironment(),
  release: resolveRelease(),
  integrations: [navigationIntegration],
  // CRITICAL — JWT tokens flow through the spinner co-op WebSocket URL
  // (`?token=…`). Without this scrub, the RN SDK captures the full URL
  // as a breadcrumb and ships the token to Sentry. Token TTL is 10 min
  // but Sentry retains breadcrumbs for weeks — defense in depth.
  beforeBreadcrumb: scrubBreadcrumb,
});

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  // Fire-and-forget update check. The deadline race inside tryApplyUpdate
  // guarantees this never blocks the UI thread; we just kick it off on
  // mount and let it either reload the app (if there's a new bundle)
  // or no-op silently. Errors are swallowed by the helper.
  //
  // Dev note: this effect fires on every Fast Refresh re-mount of the
  // root. That's harmless because `Updates.isEnabled === false` in Expo
  // Go and the dev client, so the helper short-circuits to 'disabled'
  // without touching the network. Production builds run this once at
  // launch.
  useEffect(() => {
    void tryApplyUpdate({ deadlineMs: UPDATE_DEADLINE_MS });
  }, []);

  // Register the navigation container with the Sentry integration so
  // screen transitions become performance spans. Idempotent — the SDK
  // handles repeat registrations safely on Fast Refresh.
  useEffect(() => {
    if (navigationRef?.current) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  return (
    // ErrorBoundary sits just INSIDE GestureHandlerRootView so the
    // fallback's <Pressable> reload button still has gesture-handler
    // context on Android. (Previously the boundary wrapped GHRV and the
    // reload button could be unreliable on some Android versions.) The
    // tiny coverage loss — a render throw FROM GHRV itself — has never
    // been observed in practice and is acceptable.
    <GestureHandlerRootView style={styles.flex}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <FontProvider>
            <AuthProvider>
              <WalletProvider>
              <CoopProvider>
                <OnboardingAnchorProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: 'none',
                    // Swipe-back disabled globally: navigation is button-only
                    // so an accidental horizontal drag can never pop the
                    // screen. Every pushed screen renders its own explicit
                    // back affordance (e.g. CouponDetailScreen's ← header
                    // button), so no screen can trap the user. A screen that
                    // genuinely wants edge-swipe back can opt in by setting
                    // `gestureEnabled: true` on its own <Stack.Screen>.
                    gestureEnabled: false,
                    fullScreenGestureEnabled: false,
                  }}
                />
                {/* Force/recommend upgrade prompt — overlays everything,
                    fail-open if version-info request errors so a broken
                    endpoint never traps the user. */}
                <UpgradePrompt />
                </OnboardingAnchorProvider>
              </CoopProvider>
              </WalletProvider>
            </AuthProvider>
          </FontProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default Sentry.wrap(RootLayout);
