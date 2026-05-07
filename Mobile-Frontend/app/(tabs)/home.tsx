import React from 'react';
import { useRouter } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import HomeScreen from '@/src/features/home/HomeScreen';

export default function HomeRoute() {
  const router = useRouter();
  const { gems, setGemsLocal, couPoints, setCouPointsLocal } = useWallet();

  return (
    <HomeScreen
      onNavigate={(screen, params) => {
        if (screen === 'settings') router.push('/(tabs)/settings');
        else if (screen === 'map') router.push('/(tabs)/map');
        else if (screen === 'spinner') router.push('/(tabs)/spinner');
        else if (screen === 'coupon-detail') router.push({ pathname: '/coupon/[id]', params: { id: params?.store ?? 'detail', ...params } } as any);
        else if (screen === 'coupon-share') router.push({ pathname: '/coupon/share', params } as any);
        else if (screen === 'coupoint-use') router.push('/coupoint/use' as any);
        else if (screen === 'coupoint-history') router.push('/coupoint/history' as any);
        else router.push(`/(tabs)/${screen}` as any);
      }}
      gems={gems}
      setGems={setGemsLocal}
      couPoints={couPoints}
      setCouPoints={setCouPointsLocal}
    />
  );
}
