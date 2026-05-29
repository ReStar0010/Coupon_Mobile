import React, { useEffect } from 'react';
import { router } from 'expo-router';
import CoopRoomScreen from '@/src/features/spinner/coop/CoopRoomScreen';
import { useCoopContext } from '@/src/features/spinner/coop/CoopContext';
import { useWallet } from '@/src/state/WalletContext';

export default function SpinnerCoopRoute(): React.JSX.Element {
  const coop = useCoopContext();
  const { gems } = useWallet();

  useEffect(() => {
    coop.activate();
  }, []);

  return (
    <CoopRoomScreen
      coop={coop}
      gems={gems}
      onExit={() => {
        coop.deactivate();
        router.back();
      }}
      onStartStaking={() => {
        router.replace('/(tabs)/spinner' as any);
      }}
    />
  );
}
