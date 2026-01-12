import '../tamagui-web.css';

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import { config } from '../tamagui.config';
import ThemeProvider from './components/providers/ThemeProvider';
import AuthProvider from './components/providers/SessionProvider';
import ToastProvider from './components/providers/ToastProvider';
import AuthRedirectHandler from './components/AuthRedirectHandler';
import { getApiConfig } from './config/api';

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


export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <PortalProvider shouldAddRootHost>
          <ThemeProvider>
            <AuthProvider>
              <AuthRedirectHandler />
              <ToastProvider> 
                <Stack screenOptions={{ headerShown: false }}>
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
            </AuthProvider>
          </ThemeProvider>
        </PortalProvider>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
