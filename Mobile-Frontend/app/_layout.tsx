import '../tamagui-web.css';

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
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

async function onFetchUpdateAsync() {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (e) {
    console.warn('OTA 更新檢查失敗:', e);
  }
}

/** Parse token from coupro:// custom scheme deep link. Returns { type, token } or null. */
function parseCustomSchemeUrl(url: string | null): { type: 'claim' | 'collection'; token: string } | null {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim();
  const claimMatch = /^coupro:\/\/claim\?(?:.*&)?token=([^&]+)/i.exec(s);
  if (claimMatch) return { type: 'claim', token: claimMatch[1] };
  const collectionMatch = /^coupro:\/\/collection\?(?:.*&)?token=([^&]+)/i.exec(s);
  if (collectionMatch) return { type: 'collection', token: collectionMatch[1] };
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
 * Handles coupro:// custom scheme deep links only.
 * Universal Links (https://api.coupro.pro/...) are handled by file-based routing
 * via app/collection/[token].tsx and app/claim/[token].tsx.
 */
function DeepLinkHandler() {
  const router = useRouter();
  const initialUrlHandled = useRef(false);

  const handleUrl = (url: string | null) => {
    const parsed = parseCustomSchemeUrl(url);
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

export default function RootLayout() {
  useEffect(() => {
    onFetchUpdateAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
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
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
