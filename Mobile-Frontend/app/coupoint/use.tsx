import React from 'react';
import { useRouter } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import { goHome } from '@/src/services/navigation/goHome';
import CouPointUseScreen from '@/src/features/coupoint/CouPointUseScreen';

export default function CouPointUseRoute() {
  const router = useRouter();
  const { couPoints, setCouPointsLocal } = useWallet();

  return (
    <CouPointUseScreen
      couPoints={couPoints}
      setCouPoints={setCouPointsLocal}
      onNavigate={(screen) => {
        if (screen === 'home') goHome(router);
        else router.back();
      }}
    />
  );
}
