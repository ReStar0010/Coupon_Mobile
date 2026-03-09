import '../utils/i18n'; // 必須在所有其他 import 之前
import '../tamagui-web.css';

import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider, Spinner, Text, YStack } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import Toast from 'react-native-toast-message';
import { config } from '../tamagui.config';
import ThemeProvider from './components/providers/ThemeProvider';
import AuthProvider from './components/providers/SessionProvider';
import AuthOrchestrator from './components/providers/AuthOrchestrator';
import ToastProvider from './components/providers/ToastProvider';
import DismissedStoresProvider from './components/providers/DismissedStoresProvider';
import { getApiConfig } from './config/api';
import BlockedMerchantsProvider from './components/providers/BlockedMerchantsProvider';
import { toastConfig } from './config/toastConfig';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://7e7d75e22f890cd1cb1f5c826402c1b7@o4510952144961536.ingest.us.sentry.io/4510952321843200',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Disable SDK debug output in console so app logs stay clear (Sentry still captures/sends everything)
  debug: false,

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

/**
 * Parse deep link URL. Handles all formats:
 * - Query:  coupro://collection?token=<t>  (from share sheet)
 * - Path:   coupro://collection/<t>         (Smart App Banner, 2nd tap)
 * - Path:   coupro:///collection/<t>        (Smart App Banner, 1st tap — empty authority)
 * - HTTPS:  https://api.coupro.pro/collection/<t>  (Universal Link)
 */
function parseDeepLinkUrl(
  url: string | null,
): { type: 'claim' | 'collection'; token: string } | null {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim();
  // Query-style: coupro://claim?token=<t> or coupro://collection?token=<t>
  const claimQuery = /^coupro:\/\/claim\?(?:.*&)?token=([^&]+)/i.exec(s);
  if (claimQuery) return { type: 'claim', token: claimQuery[1] };
  const collectionQuery = /^coupro:\/\/collection\?(?:.*&)?token=([^&]+)/i.exec(s);
  if (collectionQuery) return { type: 'collection', token: collectionQuery[1] };
  // Path-style: covers coupro://, coupro:///, and https:// Universal Links
  const claimPath = /\/claim\/([^/?]+)/i.exec(s);
  if (claimPath) return { type: 'claim', token: claimPath[1] };
  const collectionPath = /\/collection\/([^/?]+)/i.exec(s);
  if (collectionPath) return { type: 'collection', token: collectionPath[1] };
  return null;
}

// 在應用啟動時顯示後端配置
if (__DEV__) {
  const apiConfig = getApiConfig();
  console.log('\n' + '='.repeat(50));
  console.log('📱 應用啟動 - 後端配置');
  console.log('='.repeat(50));
  console.log(`模式: ${apiConfig.mode}`);
  console.log(`Base URL: ${apiConfig.baseUrl}`);
  console.log(`API URL: ${apiConfig.apiUrl}`);
  console.log('='.repeat(50) + '\n');
}

/**
 * Handles all deep link formats: coupro:// custom scheme, Smart App Banner
 * path-style URLs, and https:// Universal Links.
 */
function DeepLinkHandler() {
  const router = useRouter();
  const initialUrlHandled = useRef(false);

  const handleUrl = (url: string | null) => {
    const parsed = parseDeepLinkUrl(url);
    if (!parsed) return false;
    if (parsed.type === 'claim') {
      router.replace(`/(tabs)/easyuse/qr-claim?token=${encodeURIComponent(parsed.token)}`);
    } else {
      router.replace(`/(tabs)/collection?token=${encodeURIComponent(parsed.token)}`);
    }
    return true;
  };

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (initialUrlHandled.current) return;
      if (handleUrl(url)) {
        initialUrlHandled.current = true;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleUrl is stable, only run on mount
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleUrl is stable, listener only on mount
  }, []);

  return null;
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
            <ThemeProvider>
              <DismissedStoresProvider>
                <BlockedMerchantsProvider>
                  <AuthProvider>
                    <AuthOrchestrator>
                      <ToastProvider>
                        <DeepLinkHandler />
                        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
                          <Stack.Screen name="index" />
                          <Stack.Screen name="(auth)" />
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen name="options-menu" />
                        </Stack>
                        <StatusBar style="auto" />
                        <Toast config={toastConfig} />
                      </ToastProvider>
                    </AuthOrchestrator>
                  </AuthProvider>
                </BlockedMerchantsProvider>
              </DismissedStoresProvider>
            </ThemeProvider>
          </PortalProvider>
        )}
      </TamaguiProvider>
    </SafeAreaProvider>
  );
});
