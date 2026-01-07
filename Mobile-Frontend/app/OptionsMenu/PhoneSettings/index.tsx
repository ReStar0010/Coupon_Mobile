import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { YStack, XStack, H4, Button, Text, Card } from 'tamagui';
import { ChevronLeft, Shield, Edit2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAPI } from '../../utils/authAPI';

/**
 * PhoneSettings - Main phone settings screen
 * 
 * Modified to use OTP verification flow instead of direct phone updates.
 * Users must verify phone numbers via SMS OTP for security.
 */
export default function PhoneSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhone();
  }, []);

  // Reload phone when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadPhone();
    }, [])
  );

  const loadPhone = async () => {
    try {
      const response = await fetchAPI('/user/phone/');
      const data = response.data;
      setPhone(data.phone_number || '');
      setMaskedPhone(data.masked_phone || data.phone_number_masked);
    } catch (error) {
      console.error('Failed to load phone:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrChangePhone = () => {
    // Navigate to OTP request screen
    router.push({
      pathname: '/OptionsMenu/PhoneSettings/OTPRequestScreen',
      params: {
        currentPhone: phone || undefined,
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} px="$4" py="$6" gap="$4" style={{ paddingTop: insets.top + 10 }}>
        <XStack gap="$3" alignItems="center">
          <ChevronLeft size={24} onPress={() => router.back()} />
          <H4 fontWeight="bold">手機號碼設定</H4>
        </XStack>

        {loading ? (
          <Text>載入中...</Text>
        ) : (
          <YStack gap="$4">
            {/* Security notice */}
            <Card bordered p="$4" bg="$blue2" borderColor="$blue6">
              <XStack gap="$3" alignItems="flex-start">
                <Shield size={24} color="#3B82F6" />
                <YStack flex={1} gap="$2">
                  <Text fontWeight="600" color="$blue11">
                    手機號碼需要驗證
                  </Text>
                  <Text color="$blue11" fontSize="$3" lineHeight={20}>
                    為了保護您的帳號安全，新增或更改手機號碼時需要透過簡訊驗證碼確認。
                  </Text>
                </YStack>
              </XStack>
            </Card>

            {/* Current phone display */}
            <Card bordered p="$4">
              <YStack gap="$4">
                <YStack gap="$2">
                  <Text color="$gray10" fontSize="$3">
                    目前的手機號碼
                  </Text>
                  {maskedPhone ? (
                    <Text fontSize="$6" fontWeight="600" color="$gray11">
                      {maskedPhone}
                    </Text>
                  ) : (
                    <Text fontSize="$5" color="$gray10">
                      尚未設定
                    </Text>
                  )}
                </YStack>

                <YStack gap="$2">
                  <Text color="$gray10" fontSize="$3">
                    功能說明
                  </Text>
                  <Text color="$gray11" fontSize="$2" lineHeight={20}>
                    • 接收商家直接發送的優惠券{'\n'}
                    • 自動領取發送至您手機的待領優惠券{'\n'}
                    • 手機號碼僅用於優惠券發送，不會用於其他用途
                  </Text>
                </YStack>

                <Button
                  onPress={handleAddOrChangePhone}
                  bg="#FFAD31"
                  pressStyle={{ bg: '#FF9500' }}
                  height={48}
                  borderRadius="$3"
                  icon={maskedPhone ? <Edit2 size={18} /> : undefined}
                >
                  <Text fontSize={16} fontWeight="600" color="$gray11">
                    {maskedPhone ? '更換手機號碼' : '新增手機號碼'}
                  </Text>
                </Button>

                {maskedPhone && (
                  <YStack
                    gap="$2"
                    p="$3"
                    bg="$gray2"
                    borderRadius="$3"
                  >
                    <Text fontSize="$2" color="$gray11">
                      💡 更換手機號碼時，您原手機號碼的待領優惠券將自動轉移至您的帳號。
                    </Text>
                  </YStack>
                )}
              </YStack>
            </Card>
          </YStack>
        )}
      </YStack>
    </>
  );
}

