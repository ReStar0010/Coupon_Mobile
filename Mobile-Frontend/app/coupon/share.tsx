import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import { goHome } from '@/src/services/navigation/goHome';
import CouponShareScreen from '@/src/features/coupon/CouponShareScreen';

export default function CouponShareRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; store?: string; detail?: string; expires?: string; amount?: string }>();
  const { gems, setGemsLocal, couPoints, setCouPointsLocal } = useWallet();

  const couponParams = {
    id: params.id,
    store: params.store,
    detail: params.detail,
    expires: params.expires,
    amount: params.amount ? Number(params.amount) : undefined,
  };

  return (
    <CouponShareScreen
      onNavigate={(screen) => {
        if (screen === 'home') goHome(router);
        else if (screen === 'coupon-detail') router.back();
        else router.back();
      }}
      params={couponParams}
      gems={gems}
      setGems={setGemsLocal}
      couPoints={couPoints}
      setCouPoints={setCouPointsLocal}
    />
  );
}
