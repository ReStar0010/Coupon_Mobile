import React from 'react';
import { useRouter } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import SpinnerScreen from '@/src/features/spinner/SpinnerScreen';

export default function SpinnerRoute() {
  const router = useRouter();
  const { gems, couPoints, refreshWallet } = useWallet();

  return (
    <SpinnerScreen
      onNavigate={(screen) => {
        // The co-op invite flow lives at the root-level `/spinner-coop`
        // route (not a tab). Other names map to sibling tabs as before.
        if (screen === 'spinner-coop') {
          router.push('/spinner-coop' as any);
        } else {
          router.push(`/(tabs)/${screen}` as any);
        }
      }}
      gems={gems}
      couPoints={couPoints}
      refreshWallet={refreshWallet}
    />
  );
}
