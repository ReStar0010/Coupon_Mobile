import React from 'react';
import { useRouter } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import SettingsScreen from '@/src/features/settings/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  const { gems, couPoints } = useWallet();

  return (
    <SettingsScreen
      onNavigate={(screen) => router.push(`/(tabs)/${screen}` as any)}
      gems={gems}
      couPoints={couPoints}
    />
  );
}
