import '../tamagui-web.css';

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import { config } from '../tamagui.config';
import ThemeProvider from './components/providers/ThemeProvider';
import AuthProvider from './components/providers/SessionProvider';
import AuthOrchestrator from './components/providers/AuthOrchestrator';
import ToastProvider from './components/providers/ToastProvider';
import DismissedStoresProvider from './components/providers/DismissedStoresProvider';
import AuthRedirectHandler from './components/AuthRedirectHandler';
import { getApiConfig } from './config/api';
import BlockedMerchantsProvider from './components/providers/BlockedMerchantsProvider';

/** Parse claim token from claim deep link URL (web or app scheme). Returns null if not a claim URL. */
function parseClaimTokenFromUrl(url: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim();
  // App scheme: coupro://claim?token=<token>
  const appSchemeMatch = /^coupro:\/\/claim\?(?:.*&)?token=([^&]+)/i.exec(s) || /^coupro:\/\/claim\?token=([^&]+)/i.exec(s);
  if (appSchemeMatch) return appSchemeMatch[1];
  // Web: https://.../claim/<token>/ or /cl/<token>/
  const webClaimMatch = /\/claim\/([^/?]+)/i.exec(s) || /\/cl\/([^/?]+)/i.exec(s);
  if (webClaimMatch) return webClaimMatch[1];
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


function DeepLinkHandler() {
  const router = useRouter();
  const initialUrlHandled = useRef(false);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (initialUrlHandled.current) return;
      const token = parseClaimTokenFromUrl(url);
      if (token) {
        initialUrlHandled.current = true;
        router.replace(`/EasyUse/qr-claim?token=${encodeURIComponent(token)}`);
      }
    });
  }, [router]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const token = parseClaimTokenFromUrl(url);
      if (token) {
        router.replace(`/EasyUse/qr-claim?token=${encodeURIComponent(token)}`);
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
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
                    <Stack.Screen name="Login" />
                    <Stack.Screen name="EasyUse" />
                    <Stack.Screen name="Collection" />
                    <Stack.Screen name="Statistics" />
                    <Stack.Screen name="OptionsMenu" />
                    <Stack.Screen name="ResetPassword" />
                  </Stack>
                  <StatusBar style="auto" />
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
