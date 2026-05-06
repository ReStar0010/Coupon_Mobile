import React from 'react';
import { useRouter } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import MapScreen from '@/src/features/map/MapScreen';

export default function MapRoute() {
  const router = useRouter();
  const { gems, couPoints } = useWallet();

  return (
    <MapScreen
      onNavigate={(screen, params) => {
        if (screen === 'coupon-detail') router.push({ pathname: '/coupon/[id]', params: { id: (params as Record<string, string> | undefined)?.store ?? 'detail', ...params } } as any);
        else router.push(`/(tabs)/${screen}` as any);
      }}
      gems={gems}
      couPoints={couPoints}
    />
  );
}
