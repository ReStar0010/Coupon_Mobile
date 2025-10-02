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


export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <PortalProvider shouldAddRootHost>
          <ThemeProvider>
            <AuthProvider>
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
