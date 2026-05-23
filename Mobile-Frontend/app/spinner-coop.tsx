import React, { useEffect } from 'react';
import { router } from 'expo-router';
import CoopRoomScreen from '@/src/features/spinner/coop/CoopRoomScreen';
import { useCoopContext } from '@/src/features/spinner/coop/CoopContext';

export default function SpinnerCoopRoute(): React.JSX.Element {
  const coop = useCoopContext();

  useEffect(() => {
    coop.activate();
  }, []);

  return (
    <CoopRoomScreen
      coop={coop}
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
