import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Slot />
      <TabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
