import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWallet } from '@/src/state/WalletContext';
import CouponUseQRScreen from '@/src/features/coupon/CouponUseQRScreen';

export default function CouponQRRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ store?: string; detail?: string; expires?: string; amount?: string }>();
  const { setCouPointsLocal } = useWallet();

  const couponParams = {
    store: params.store,
    detail: params.detail,
    expires: params.expires,
    amount: params.amount ? Number(params.amount) : undefined,
  };

  return (
    <CouponUseQRScreen
      onNavigate={(screen, p) => {
        if (screen === 'home') router.push('/(tabs)/home');
        else if (screen === 'coupon-detail') router.back();
        else router.back();
      }}
      params={couponParams}
      couPoints={0}
      setCouPoints={setCouPointsLocal}
    />
  );
}
