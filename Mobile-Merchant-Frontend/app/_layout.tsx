import '../tamagui-web.css';

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import 'react-native-reanimated';

import { config } from '../tamagui.config';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <PortalProvider shouldAddRootHost>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)/login" />
            <Stack.Screen name="(coupons)/index" />
            <Stack.Screen name="(coupons)/[id]" />
            <Stack.Screen name="(coupons)/edit" />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </PortalProvider>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
