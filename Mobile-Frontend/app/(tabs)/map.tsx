import React from 'react';
import { useRouter } from 'expo-router';
import MapScreen from '@/src/features/map/MapScreen';

export default function MapRoute() {
  const router = useRouter();

  return (
    <MapScreen
      onNavigate={(screen, params) => {
        if (screen === 'coupon-detail') router.push({ pathname: '/coupon/[id]', params: { id: (params as Record<string, string> | undefined)?.store ?? 'detail', ...params } } as any);
        else if (screen === 'coupon-receive') router.push('/coupon/receive');
        else router.push(`/(tabs)/${screen}` as any);
      }}
    />
  );
}
