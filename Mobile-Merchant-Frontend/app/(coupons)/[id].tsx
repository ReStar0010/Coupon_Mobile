import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { Input, Button } from '@/components/ui';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';

import { merchantAPI } from '@/utils/api';

/** 台灣手機號碼格式：09 開頭，共 10 碼 */
const TW_PHONE_REGEX = /^09\d{8}$/;

/**
 * Individual Coupon Redemption Screen
 *
 * Only 專屬優惠 (total_quantity > 0) may use this page. 隨取即用 (total_quantity === 0)
 * are redirected back to the coupon list.
 */
export default function CouponRedemptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardPassed, setGuardPassed] = useState(false);

  useEffect(() => {
    if (!id) {
      router.replace('/(coupons)/');
      return;
    }
    const templateId = parseInt(id, 10);
    if (Number.isNaN(templateId)) {
      router.replace('/(coupons)/');
      return;
    }
    let cancelled = false;
    merchantAPI
      .getTemplate(templateId)
      .then((data: unknown) => {
        if (cancelled) return;
        const template = data as { total_quantity?: number };
        const totalQty = template?.total_quantity ?? 0;
        if (totalQty === 0) {
          alert('此優惠為隨取即用，不支援生成 QR Code 或發送優惠券');
          router.replace('/(coupons)/');
          return;
        }
        setGuardPassed(true);
      })
      .catch(() => {
        if (cancelled) return;
        router.replace('/(coupons)/');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(digits);
  };

  const handleSendCoupon = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      alert('請輸入電話號碼');
      return;
    }
    if (!TW_PHONE_REGEX.test(trimmed)) {
      alert('請輸入正確的台灣手機格式（例：0912345678）');
      return;
    }

    if (!id) {
      alert('無效的優惠券 ID');
      return;
    }

    try {
      const result = await merchantAPI.consolidateCoupon(parseInt(id), trimmed);

      if (result.recipient_status === 'registered') {
        alert(`發送成功！\n優惠券已發送給 ${trimmed}\n剩餘數量：${result.remaining_quantity}`);
      } else {
        alert(
          `發送成功！\n優惠券已建立為待領取狀態\n手機號碼：${result.pending_phone}\n當用戶註冊此手機號碼時，優惠券將自動領取\n剩餘數量：${result.remaining_quantity}`,
        );
      }

      setPhoneNumber('');
    } catch (error: any) {
      console.error('Send coupon error:', error);
      alert(error?.message || '發送失敗，請稍後再試');
    }
  };

  if (loading || !guardPassed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Header onLogoPress={() => router.push('/(coupons)/')} />
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>載入中...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isPhoneValid = TW_PHONE_REGEX.test(phoneNumber.trim());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <DismissKeyboardView>
        <View style={styles.mainContainer}>
          <Header onLogoPress={() => router.push('/(coupons)/')} />

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Phone Number Input */}
            <Input
              placeholder="0912345678"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              width="100%"
              maxLength={10}
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
              disabled={!isPhoneValid}
              opacity={!isPhoneValid ? 0.6 : 1}
            >
              發送優惠券
            </Button>
          </View>
        </View>
      </DismissKeyboardView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
  },
});
