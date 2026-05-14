import React from 'react';
import { useRouter } from 'expo-router';
import CouponReceiveQRScreen from '@/src/features/coupon/CouponReceiveQRScreen';

export default function CouponReceiveRoute() {
  const router = useRouter();

  return (
    <CouponReceiveQRScreen
      onBack={() => router.back()}
      onDone={() => router.back()}
    />
  );
}
