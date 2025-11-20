import React, { useState, useCallback } from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { QRCode } from './components/QRCode';
import { merchantAPI } from '@/utils/api';

export default function CouponRedemptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [redemptionCode, setRedemptionCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // 生成高隨機性的六位數字核銷碼
  const generateRandomCode = (): string => {
    // 使用時間戳和隨機數組合增加隨機性
    const timestamp = Date.now();
    const random1 = Math.random();
    const random2 = Math.random();
    const random3 = Math.random();
    // 結合多個隨機源
    const combined = (timestamp * random1 * random2 * random3) % 900000;
    const code = String(100000 + Math.floor(combined));
    return code;
  };

  // 每次頁面獲得焦點時生成新的核銷碼
  useFocusEffect(
    useCallback(() => {
      const loadOrGenerateRedeemCode = async () => {
        if (!id) return;
        
        try {
          setIsLoading(true);
          // 生成新的隨機核銷碼
          const newCode = generateRandomCode();
          
          // 更新後端的核銷碼
          await merchantAPI.refreshRedeemCode(parseInt(id), newCode);
          
          // 設置顯示的核銷碼
          setRedemptionCode(newCode);
        } catch (error) {
          console.error('Failed to generate redeem code:', error);
          // 如果更新失敗，使用備用方案生成一個臨時碼
          setRedemptionCode(generateRandomCode());
        } finally {
          setIsLoading(false);
        }
      };
      
      loadOrGenerateRedeemCode();
    }, [id])
  );
  
  // QR code data
  const qrData = redemptionCode;

  const handleConfirm = async () => {
    if (!phoneNumber.trim()) {
      alert('請輸入電話號碼');
      return;
    }
    
    if (!id) {
      alert('無效的優惠券 ID');
      return;
    }

    try {
      await merchantAPI.redeem(parseInt(id), phoneNumber);
      alert('核銷成功！');
      setPhoneNumber('');
      // 核銷成功後，生成新的核銷碼
      const newCode = generateRandomCode();
      try {
        await merchantAPI.refreshRedeemCode(parseInt(id), newCode);
        setRedemptionCode(newCode);
      } catch (refreshError) {
        console.error('Failed to refresh redeem code after redemption:', refreshError);
      }
    } catch (error: any) {
      console.error('Redemption error:', error);
      alert(error?.message || '核銷失敗，請稍後再試');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.white}>
        <Header onLogoPress={() => router.push('/(coupons)/')} />
        
        {/* Main Content */}
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$4" gap="$6">
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              {/* QR Code */}
              <View style={styles.qrCodeContainer}>
                <QRCode value={qrData} size={280} />
              </View>

              {/* Numerical Code */}
              <Text fontSize={24} fontWeight="600" color={colors.textPrimary} letterSpacing={2}>
                {redemptionCode}
              </Text>
            </>
          )}

          {/* Phone Number Input */}
          <Input
            placeholder="輸入電話號碼"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            width="100%"
            maxLength={15}
          />

          {/* Confirm Button */}
          <Button
            variant="primary"
            fullWidth
            onPress={handleConfirm}
            disabled={!phoneNumber.trim()}
            opacity={!phoneNumber.trim() ? 0.6 : 1}
          >
            確認
          </Button>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  qrCodeContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

