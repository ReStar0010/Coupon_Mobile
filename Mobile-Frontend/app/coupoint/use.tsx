import React from 'react';
import { useRouter } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import CouPointUseScreen from '@/src/features/coupoint/CouPointUseScreen';

export default function CouPointUseRoute() {
  const router = useRouter();
  const { couPoints, setCouPointsLocal } = useWallet();

  return (
    <CouPointUseScreen
      couPoints={couPoints}
      setCouPoints={setCouPointsLocal}
      onNavigate={(screen) => {
        if (screen === 'home') router.push('/(tabs)/home');
        else router.back();
      }}
    />
  );
}
