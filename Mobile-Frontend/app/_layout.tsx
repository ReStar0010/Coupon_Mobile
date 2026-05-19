import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import FontProvider from '@/src/theme/FontProvider';
import { AuthProvider } from '@/src/state/AuthContext';
import { WalletProvider } from '@/src/state/WalletContext';
import { tryApplyUpdate } from '@/src/services/updates/applyUpdates';
import UpgradePrompt from '@/src/features/upgrade/UpgradePrompt';
import ErrorBoundary from '@/src/components/ErrorBoundary';

// Launch-time EAS Update budget. 5s gives the typical 3-5 MB bundle a
// fair shot on healthy wifi while never trapping the user on a bad
// network. Partial downloads persist in expo-updates' cache and finish
// on the next cold start, so a 'timed-out' result still makes progress.
const UPDATE_DEADLINE_MS = 5_000;

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
});

SplashScreen.preventAutoHideAsync();

function RootLayout() {
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
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: 'none',
                    // Enable swipe-back globally so a user can never get
                    // stuck on a screen whose own back affordance is hidden
                    // or unresponsive. Individual screens with mid-transaction
                    // state (e.g. CouponUseQRScreen during the scan→success
                    // window) can opt out by setting `gestureEnabled: false`
                    // on their own <Stack.Screen> options.
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                  }}
                />
                {/* Force/recommend upgrade prompt — overlays everything,
                    fail-open if version-info request errors so a broken
                    endpoint never traps the user. */}
                <UpgradePrompt />
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
