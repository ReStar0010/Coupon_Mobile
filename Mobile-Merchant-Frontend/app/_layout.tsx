import '../tamagui-web.css';

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import 'react-native-reanimated';

import { config } from '../tamagui.config';
import AuthProvider from './components/providers/AuthProvider';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://289a8c5d0c8fe707227482098456d654@o4510952144961536.ingest.us.sentry.io/4510952332591104',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function RootLayout() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <PortalProvider shouldAddRootHost>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(auth)/register" />
              <Stack.Screen name="(auth)/forgot-password" />
              <Stack.Screen name="(coupons)/index" />
              <Stack.Screen name="(coupons)/[id]" />
              <Stack.Screen name="(coupons)/edit" />
              <Stack.Screen name="(profile)/index" />
              <Stack.Screen name="(profile)/edit" />
              <Stack.Screen name="OptionsMenu/ContentGuidelines" />
            </Stack>
            <StatusBar style="auto" />
          </AuthProvider>
        </PortalProvider>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
});