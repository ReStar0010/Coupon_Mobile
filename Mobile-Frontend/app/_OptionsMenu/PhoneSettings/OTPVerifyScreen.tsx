import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { YStack, XStack, H4, Text, Card, Button } from 'tamagui';
import { ChevronLeft, Clock, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OTPInput from '@/app/components/OTPInput';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import {
  verifyOtp,
  sendOtp,
  maskPhoneNumber,
  ErrorResponse,
} from '@/app/services/phoneOtpAPI';

interface RouteParams {
  phone: string;
  cooldownSeconds: string;
  expiresInSeconds: string;
  devMode?: string;
  devOtpCode?: string;
}

/**
 * OTPVerifyScreen
 * 
 * Second step of OTP verification flow:
 * - User enters 6-digit OTP code
 * - Shows countdown timer for expiration
 * - Shows resend button with cooldown
 * - Displays remaining attempts on error
 * - Auto-submits when 6 digits entered
 */
export default function OTPVerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<RouteParams>();

  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  
  // Timer states
  const [expiresIn, setExpiresIn] = useState(parseInt(params.expiresInSeconds || '600'));
  const [cooldownRemaining, setCooldownRemaining] = useState(
    parseInt(params.cooldownSeconds || '60')
  );
  const [resending, setResending] = useState(false);

  // Countdown timer for expiration
  useEffect(() => {
    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Check if OTP expired
  const isExpired = expiresIn <= 0;

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerifyOTP = async (code: string) => {
    if (isExpired) {
      Alert.alert('驗證碼已過期', '請重新發送驗證碼');
      return;
    }

    setVerifying(true);
    setError(null);
    setAttemptsRemaining(null);

    try {
      const response = await verifyOtp(params.phone, code);

      // Success!
      let successMessage = '手機號碼驗證成功！';
      
      if (response.pending_coupons_claimed > 0) {
        successMessage += `\n\n已自動領取 ${response.pending_coupons_claimed} 張優惠券`;
      }
      
      if (response.old_phone_coupons_transferred) {
        successMessage += `\n已轉移 ${response.old_phone_coupons_transferred} 張待領優惠券`;
      }

      Alert.alert('驗證成功', successMessage, [
        {
          text: '確定',
          onPress: () => {
            // Navigate back to phone settings or main screen
            router.replace('/OptionsMenu/PhoneSettings');
          },
        },
      ]);
    } catch (err: any) {
      const error = err as ErrorResponse;
      
      setError(error.error || '驗證失敗，請重試');
      
      // Display remaining attempts if provided
      if (error.attempts_remaining !== undefined) {
        setAttemptsRemaining(error.attempts_remaining);
        
        if (error.attempts_remaining === 0) {
          Alert.alert(
            '驗證失敗',
            '驗證碼輸入錯誤次數過多，請重新發送驗證碼',
            [
              {
                text: '確定',
                onPress: () => router.back(),
              },
            ]
          );
        }
      }
      
      // Clear the OTP input for retry
      setOtpCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldownRemaining > 0) {
      Alert.alert('請稍候', `請等待 ${cooldownRemaining} 秒後再重新發送`);
      return;
    }

    setResending(true);
    setError(null);
    setAttemptsRemaining(null);

    try {
      const response = await sendOtp(params.phone);

      // Reset timers
      setExpiresIn(response.expires_in_seconds);
      setCooldownRemaining(response.cooldown_seconds);

      // Show dev mode OTP if available
      let message = '驗證碼已重新發送';
      if (response.dev_mode && response.otp_code) {
        message += `\n\n開發模式：驗證碼為 ${response.otp_code}`;
      }

      Alert.alert('成功', message);
    } catch (err: any) {
      const error = err as ErrorResponse;
      let errorMessage = error.error || '發送失敗，請稍後再試';
      
      if (error.retry_after_seconds) {
        const minutes = Math.ceil(error.retry_after_seconds / 60);
        errorMessage += `\n\n請在 ${minutes} 分鐘後再試`;
      }
      
      Alert.alert('錯誤', errorMessage);
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DismissKeyboardView>
        <YStack flex={1} px="$4" py="$6" gap="$4" style={{ paddingTop: insets.top + 10 }}>
        <XStack gap="$3" alignItems="center">
          <ChevronLeft size={24} onPress={() => router.back()} />
          <H4 fontWeight="bold">輸入驗證碼</H4>
        </XStack>

        <Card bordered p="$4">
          <YStack gap="$4">
            <Text color="$gray10" lineHeight={22}>
              我們已發送驗證碼至
            </Text>
            <Text fontSize="$5" fontWeight="600" color="$gray11" textAlign="center">
              {maskPhoneNumber(params.phone)}
            </Text>

            {/* Dev mode indicator */}
            {params.devMode === 'true' && params.devOtpCode && (
              <YStack bg="$yellow2" p="$3" borderRadius="$3" borderWidth={1} borderColor="$yellow6">
                <Text color="$yellow11" fontSize="$3" textAlign="center">
                  🔧 開發模式：驗證碼為 <Text fontWeight="bold">{params.devOtpCode}</Text>
                </Text>
              </YStack>
            )}

            {/* OTP Input */}
            <YStack gap="$3" alignItems="center" py="$4">
              <OTPInput
                onComplete={handleVerifyOTP}
                onChange={setOtpCode}
                disabled={verifying || isExpired}
                error={!!error}
              />
              
              {verifying && (
                <Text color="$gray10" fontSize="$3">
                  驗證中...
                </Text>
              )}
            </YStack>

            {/* Error message with attempts remaining */}
            {error && (
              <YStack
                bg="$red2"
                p="$3"
                borderRadius="$3"
                borderWidth={1}
                borderColor="$red6"
                gap="$2"
              >
                <XStack gap="$2" alignItems="center">
                  <AlertCircle size={16} color="$red11" />
                  <Text color="$red11" fontSize="$3" flex={1}>
                    {error}
                  </Text>
                </XStack>
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <Text color="$red11" fontSize="$2">
                    剩餘嘗試次數：{attemptsRemaining}
                  </Text>
                )}
              </YStack>
            )}

            {/* Expiration timer */}
            <XStack
              gap="$2"
              alignItems="center"
              justifyContent="center"
              p="$3"
              bg={isExpired ? '$red2' : '$blue2'}
              borderRadius="$3"
            >
              <Clock size={16} color={isExpired ? '#EF4444' : '#3B82F6'} />
              <Text color={isExpired ? '$red11' : '$blue11'} fontSize="$3">
                {isExpired ? '驗證碼已過期' : `驗證碼將於 ${formatTime(expiresIn)} 後過期`}
              </Text>
            </XStack>

            {/* Resend button with cooldown */}
            <Button
              onPress={handleResendOTP}
              disabled={resending || cooldownRemaining > 0}
              variant="outlined"
              borderColor="$gray8"
              color="$gray12"
              height={48}
              borderRadius="$3"
              icon={<RefreshCw size={18} />}
            >
              <Text fontSize={15} color={cooldownRemaining > 0 ? '$gray10' : '$gray11'}>
                {resending
                  ? '發送中...'
                  : cooldownRemaining > 0
                  ? `重新發送 (${cooldownRemaining}s)`
                  : '重新發送驗證碼'}
              </Text>
            </Button>

            {/* Instructions */}
            <YStack gap="$2" p="$3" bg="$gray2" borderRadius="$3">
              <Text fontSize="$2" color="$gray11">
                📱 沒有收到驗證碼？請檢查：
              </Text>
              <Text fontSize="$2" color="$gray11">
                • 手機號碼是否正確
              </Text>
              <Text fontSize="$2" color="$gray11">
                • 手機訊號是否正常
              </Text>
              <Text fontSize="$2" color="$gray11">
                • 簡訊是否被攔截
              </Text>
            </YStack>
          </YStack>
        </Card>
        </YStack>
      </DismissKeyboardView>
    </>
  );
}

