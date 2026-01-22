import React, { useState } from 'react';
import { YStack } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { merchantAPI } from '@/utils/api';

/**
 * Individual Coupon Redemption Screen
 * 
 * NOTE: QR code generation and redemption code display have been deprecated
 * in favor of the unified redemption flow. This page now only supports
 * phone number-based redemption and coupon sending functionality.
 * 
 * For QR code redemption, merchants should use the unified redemption button
 * on the coupon list page (/(coupons)/index.tsx).
 */
export default function CouponRedemptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleSendCoupon = async () => {
    if (!phoneNumber.trim()) {
      alert('請輸入電話號碼');
      return;
    }
    
    if (!id) {
      alert('無效的優惠券 ID');
      return;
    }

    try {
      const result = await merchantAPI.consolidateCoupon(parseInt(id), phoneNumber);
      
      if (result.recipient_status === 'registered') {
        alert(`發送成功！\n優惠券已發送給 ${phoneNumber}\n剩餘數量：${result.remaining_quantity}`);
      } else {
        alert(`發送成功！\n優惠券已建立為待領取狀態\n手機號碼：${result.pending_phone}\n當用戶註冊此手機號碼時，優惠券將自動領取\n剩餘數量：${result.remaining_quantity}`);
      }
      
      setPhoneNumber('');
    } catch (error: any) {
      console.error('Send coupon error:', error);
      alert(error?.message || '發送失敗，請稍後再試');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.white}>
        <Header onLogoPress={() => router.push('/(coupons)/')} />
        
        {/* Main Content */}
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$4" gap="$6">
          {/* Phone Number Input */}
          <Input
            placeholder="輸入電話號碼"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            width="100%"
            maxLength={15}
          />

          {/* Generate QR Code Button */}
          <Button
            variant="secondary"
            width="100%"
            onPress={() => router.push(`/(coupons)/${id}/qr-code`)}
          >
            生成 QR Code
          </Button>

          {/* Send Coupon Button */}
          <Button
            variant="secondary"
            width="100%"
            onPress={handleSendCoupon}
            disabled={!phoneNumber.trim()}
            opacity={!phoneNumber.trim() ? 0.6 : 1}
          >
            發送優惠券
          </Button>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}

