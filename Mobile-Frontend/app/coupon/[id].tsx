import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import { goHome } from '@/src/services/navigation/goHome';
import CouponDetailScreen from '@/src/features/coupon/CouponDetailScreen';

export default function CouponDetailRoute() {
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
    <CouponDetailScreen
      onNavigate={(screen, p) => {
        if (screen === 'home') goHome(router);
        else if (screen === 'coupon-qr') router.push({ pathname: '/coupon/qr', params: p } as any);
        else if (screen === 'coupon-share') router.push({ pathname: '/coupon/share', params: p } as any);
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
