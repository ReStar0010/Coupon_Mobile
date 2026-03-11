import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { YStack, XStack, H4, Text, Card, Button } from 'tamagui';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { FormInput } from '@/app/components/forms/FormInput';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { useApiError } from '@/app/hooks/useApiError';
import { sendOtp, isValidPhoneNumber, normalizePhoneNumber } from '@/app/services/phoneOtpAPI';

/**
 * OTPRequestScreen
 *
 * First step of OTP verification flow:
 * - User enters phone number
 * - System sends OTP via SMS (or logs to console in dev mode)
 * - Navigates to OTPVerifyScreen on success
 */
export default function OTPRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ currentPhone?: string }>();
  const { t } = useTranslation();
  const { getErrorMessage } = useApiError();

  const [phone, setPhone] = useState(params.currentPhone || '');
  const [sending, setSending] = useState(false);

  const handleSendOTP = async () => {
    const normalized = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(normalized)) {
      Alert.alert('格式錯誤', t('errors.PHONE_FORMAT_INVALID'));
      return;
    }

    setSending(true);
    try {
      const response = await sendOtp(normalized);

      // Show success message
      let message = response.message;
      if (response.dev_mode && response.otp_code) {
        message += `\n\n開發模式：驗證碼為 ${response.otp_code}`;
      }

      Alert.alert('驗證碼已發送', message, [
        {
          text: '確定',
          onPress: () => {
            // Navigate to verify screen with phone number and timing info
            router.push({
              pathname: '/options-menu/phone-settings/PhoneSettings/OTPVerifyScreen',
              params: {
                phone: normalized,
                cooldownSeconds: response.cooldown_seconds.toString(),
                expiresInSeconds: response.expires_in_seconds.toString(),
                devMode: response.dev_mode ? 'true' : 'false',
                devOtpCode: response.otp_code || '',
              },
            });
          },
        },
      ]);
    } catch (error) {
      Alert.alert('錯誤', getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DismissKeyboardView>
        <YStack flex={1} px="$4" py="$6" gap="$4" style={{ paddingTop: insets.top + 10 }}>
          <XStack gap="$3" alignItems="center">
            <ChevronLeft size={24} onPress={() => router.back()} />
            <H4 fontWeight="bold">驗證手機號碼</H4>
          </XStack>

          <Card bordered p="$4">
            <YStack gap="$4">
              <Text color="$gray10" lineHeight={22}>
                為了確保手機號碼屬於您本人，我們將發送一組 6 位數驗證碼至您的手機。
              </Text>

              <YStack gap="$2">
                <Text fontWeight="600" color="$gray11">
                  手機號碼
                </Text>
                <FormInput
                  placeholder="0912345678"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!sending}
                />
                <Text color="$gray10" fontSize="$2">
                  請輸入台灣手機號碼（09開頭，共10碼）
                </Text>
              </YStack>

              {params.currentPhone && (
                <YStack bg="$blue2" p="$3" borderRadius="$3" borderWidth={1} borderColor="$blue6">
                  <Text color="$blue11" fontSize="$3">
                    💡
                    您正在更換手機號碼。驗證成功後，您原手機號碼的待領優惠券將自動轉移至您的帳號。
                  </Text>
                </YStack>
              )}

              <Button
                onPress={handleSendOTP}
                disabled={sending || !phone}
                bg={sending || !phone ? '$gray5' : '#FFAD31'}
                pressStyle={{ bg: '#FF9500' }}
                height={48}
                borderRadius="$3"
              >
                <Text
                  fontSize={16}
                  fontWeight="600"
                  color={sending || !phone ? '$gray10' : '$gray11'}
                >
                  {sending ? '發送中...' : '發送驗證碼'}
                </Text>
              </Button>

              <YStack gap="$2" p="$3" bg="$gray2" borderRadius="$3">
                <Text fontSize="$2" color="$gray11" fontWeight="600">
                  注意事項：
                </Text>
                <Text fontSize="$2" color="$gray11">
                  • 驗證碼將在 10 分鐘後過期
                </Text>
                <Text fontSize="$2" color="$gray11">
                  • 每個號碼每小時最多發送 3 次驗證碼
                </Text>
                <Text fontSize="$2" color="$gray11">
                  • 兩次發送需間隔至少 60 秒
                </Text>
              </YStack>
            </YStack>
          </Card>
        </YStack>
      </DismissKeyboardView>
    </>
  );
}
