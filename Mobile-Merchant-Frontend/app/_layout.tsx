import '../tamagui-web.css';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider, Spinner, Text, YStack } from 'tamagui';
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

export type InitStatus = 'checking' | 'downloading';

/** JS 端更新檢查逾時（毫秒）。fallbackToCacheTimeout 僅處理 native 啟動，此處避免殭屍 Wi-Fi 導致 checkForUpdateAsync 永久掛起。 */
const UPDATE_CHECK_TIMEOUT_MS = 3000;

function timeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('UPDATE_CHECK_TIMEOUT')), ms);
  });
}

/**
 * Update Gate: 在正式環境檢查 OTA 更新，若有則下載並重載，避免使用者先看到舊版嵌入程式碼。
 * 以 Promise.race 加上 JS 逾時，避免殭屍 Wi-Fi 時 await 永久掛起卡在載入畫面。
 * onStatus 可選，用於更新畫面上的載入訊息（例如「正在檢查更新…」「正在下載最新版本…」）。
 */
async function handleAppInitialization(onStatus?: (status: InitStatus) => void): Promise<void> {
  if (__DEV__) return;
  try {
    onStatus?.('checking');
    const update = await Promise.race([
      Updates.checkForUpdateAsync(),
      timeoutReject(UPDATE_CHECK_TIMEOUT_MS),
    ]);
    if (update.isAvailable) {
      onStatus?.('downloading');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'UPDATE_CHECK_TIMEOUT') {
      console.warn('OTA 更新檢查逾時，略過並繼續啟動');
    } else {
      console.error('OTA 更新檢查失敗', error);
      Sentry.captureException(error, { data: { context: 'OTA update non-timeout failure' } });
    }
  }
}

const INIT_MESSAGES: Record<InitStatus, string> = {
  checking: '正在檢查更新…',
  downloading: '正在下載最新版本…',
};

function InitializationLoadingScreen({ message }: { message: string }) {
  return (
    <YStack
      flex={1}
      bg="$background"
      style={{ justifyContent: 'center', alignItems: 'center', padding: 16 }}
    >
      <YStack gap="$4" style={{ alignItems: 'center', maxWidth: 280 }}>
        <Spinner size="large" color="#FFAD31" />
        <Text fontSize={16} color="$gray11" style={{ textAlign: 'center' }}>
          {message}
        </Text>
      </YStack>
    </YStack>
  );
}

export default Sentry.wrap(function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(__DEV__);
  const [loadingMessage, setLoadingMessage] = useState<string>(INIT_MESSAGES.checking);

  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;

    (async () => {
      await SplashScreen.preventAutoHideAsync();
      await SplashScreen.hideAsync();

      try {
        await handleAppInitialization((status) => {
          if (!cancelled) setLoadingMessage(INIT_MESSAGES[status]);
        });
      } finally {
        if (!cancelled) {
          setIsAppReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        {!isAppReady ? (
          <InitializationLoadingScreen message={loadingMessage} />
        ) : (
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
        )}
      </TamaguiProvider>
    </SafeAreaProvider>
  );
});
