import '../tamagui-web.css';

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import 'react-native-reanimated';

import { config } from '../tamagui.config';
import AuthProvider from './components/providers/AuthProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <PortalProvider shouldAddRootHost>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(auth)/register" />
              <Stack.Screen name="(auth)/forgot-password" />
              <Stack.Screen name="(coupons)/index" />
              <Stack.Screen name="(coupons)/[id]" />
              <Stack.Screen name="(coupons)/edit" />
              <Stack.Screen name="(profile)/index" />
              <Stack.Screen name="(profile)/edit" />
            </Stack>
            <StatusBar style="auto" />
          </AuthProvider>
        </PortalProvider>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
