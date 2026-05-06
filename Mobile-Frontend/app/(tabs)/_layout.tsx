import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import TabBar from '@/src/components/chrome/TabBar';
import { colors } from '@/src/theme/colors';
import { useWallet } from '@/src/state/WalletContext';

type Tab = 'home' | 'map' | 'spinner' | 'settings';

const PATH_TO_TAB: Record<string, Tab> = {
  '/(tabs)/home': 'home',
  '/(tabs)/map': 'map',
  '/(tabs)/spinner': 'spinner',
  '/(tabs)/settings': 'settings',
};

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { gems, couPoints } = useWallet();

  const activeTab: Tab = PATH_TO_TAB[pathname] ?? 'home';

  const handleTabPress = (tab: Tab) => {
    router.push(`/(tabs)/${tab}` as any);
  };

  return (
    <View style={styles.root}>
      <Slot />
      <TabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        gems={gems}
        couPoints={couPoints}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
