import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import TabBar from '@/src/components/chrome/TabBar';
import { colors } from '@/src/theme/colors';

type Tab = 'home' | 'map' | 'spinner';

const PATH_TO_TAB: Record<string, Tab> = {
  '/(tabs)/home': 'home',
  '/(tabs)/map': 'map',
  '/(tabs)/spinner': 'spinner',
  '/home': 'home',
  '/map': 'map',
  '/spinner': 'spinner',
};

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeTab: Tab = PATH_TO_TAB[pathname] ?? 'home';

  const handleTabPress = (tab: Tab) => {
    router.push(`/(tabs)/${tab}` as any);
  };

  // Map and Spinner are full-bleed under the notch (their own backgrounds need
  // to extend behind the status bar). Each renders its own chrome with insets.
  const padTop = activeTab !== 'map' && activeTab !== 'spinner';

  return (
    // BottomSheetModalProvider lets @gorhom/bottom-sheet portal its
    // sheets above the tab bar. Scoped to (tabs) so it doesn't leak
    // into the auth flow and so other modals keep using the existing
    // custom BottomSheet wrapper.
    <BottomSheetModalProvider>
      <View style={[styles.root, padTop && { paddingTop: insets.top }]}>
        <Slot />
        <TabBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
          bottomInset={insets.bottom}
        />
      </View>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
