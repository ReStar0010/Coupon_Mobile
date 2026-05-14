import React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import FontProvider from '@/src/theme/FontProvider';
import { AuthProvider } from '@/src/state/AuthContext';
import { WalletProvider } from '@/src/state/WalletContext';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
});

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
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
            </WalletProvider>
          </AuthProvider>
        </FontProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default Sentry.wrap(RootLayout);
