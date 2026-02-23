import '../tamagui-web.css';

import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import Toast from 'react-native-toast-message';
import { config } from '../tamagui.config';
import ThemeProvider from './components/providers/ThemeProvider';
import AuthProvider from './components/providers/SessionProvider';
import AuthOrchestrator from './components/providers/AuthOrchestrator';
import ToastProvider from './components/providers/ToastProvider';
import DismissedStoresProvider from './components/providers/DismissedStoresProvider';
import AuthRedirectHandler from './components/AuthRedirectHandler';
import { getApiConfig } from './config/api';
import BlockedMerchantsProvider from './components/providers/BlockedMerchantsProvider';
import { toastConfig } from './config/toastConfig';
import { Spinner, Text, YStack } from 'tamagui';

export type InitStatus = 'checking' | 'downloading';

/**
 * Update Gate: 在正式環境檢查 OTA 更新，若有則下載並重載，避免使用者先看到舊版嵌入程式碼。
 * onStatus 可選，用於更新畫面上的載入訊息（例如「正在檢查更新…」「正在下載最新版本…」）。
 */
async function handleAppInitialization(onStatus?: (status: InitStatus) => void): Promise<void> {
  if (__DEV__) return;
  try {
    onStatus?.('checking');
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      onStatus?.('downloading');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (error) {
    console.error('OTA 更新檢查失敗', error);
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
  }, [router]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });
    return () => sub.remove();
  }, [router]);

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

export default function RootLayout() {
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
}
