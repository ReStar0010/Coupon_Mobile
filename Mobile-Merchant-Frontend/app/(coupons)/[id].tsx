import React, { useState } from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { StyleSheet, View } from 'react-native';
import { QRCode } from './components/QRCode';

export default function CouponRedemptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Generate a 6-digit code (in real app, this would come from the backend)
  const redemptionCode = id ? id.padStart(6, '0').slice(-6) : '134981';
  
  // QR code data (could be the redemption code or a URL)
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
      const { merchantAPI } = await import('@/utils/api');
      await merchantAPI.redeem(parseInt(id), phoneNumber);
      alert('核銷成功！');
      setPhoneNumber('');
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
          {/* QR Code */}
          <View style={styles.qrCodeContainer}>
            <QRCode value={qrData} size={280} />
          </View>

          {/* Numerical Code */}
          <Text fontSize={24} fontWeight="600" color={colors.textPrimary} letterSpacing={2}>
            {redemptionCode}
          </Text>

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

