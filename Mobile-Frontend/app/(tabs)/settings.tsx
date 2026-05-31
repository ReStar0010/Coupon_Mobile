import React from 'react';
import { useRouter } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import SettingsScreen from '@/src/features/settings/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  const { gems, couPoints } = useWallet();

  return (
    <SettingsScreen
      onNavigate={(screen) => {
        // The launch tutorial lives at the root-level `/onboarding` route,
        // not under the tab group — route it explicitly.
        if (screen === 'onboarding') router.push('/onboarding');
        else router.push(`/(tabs)/${screen}` as any);
      }}
      gems={gems}
      couPoints={couPoints}
    />
  );
}
