import React from 'react';
import { useRouter } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import SpinnerScreen from '@/src/features/spinner/SpinnerScreen';

export default function SpinnerRoute() {
  const router = useRouter();
  const { gems, setGemsLocal, couPoints, setCouPointsLocal, refreshWallet } = useWallet();

  return (
    <SpinnerScreen
      onNavigate={(screen) => router.push(`/(tabs)/${screen}` as any)}
      gems={gems}
      setGems={setGemsLocal}
      couPoints={couPoints}
      setCouPoints={setCouPointsLocal}
      refreshWallet={refreshWallet}
    />
  );
}
