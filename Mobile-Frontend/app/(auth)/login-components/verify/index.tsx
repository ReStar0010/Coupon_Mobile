import React, { useEffect, useState, useRef } from 'react';
import { View, Text, SafeAreaView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { devDebug, devLog, devError } from '@/app/utils/devLogger';
import { fetchAPI, storeLoginData } from '@/app/utils/authAPI';
import { YStack, Button } from 'tamagui';
import Toast from 'react-native-toast-message';
import { verifyRegistrationOtp, verifyPasswordResetOtp } from '@/app/services/phoneOtpAPI';

export default function VerifyOTPPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const phoneNumber = params.phone_number as string;
  const password = params.password as string;
  const mode = params.mode as 'register' | 'forgotPassword' | 'emailVerify';
  const token = params.token as string; // For email verification
  
  const [otpCode, setOtpCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const verifyRequestSent = useRef(false);

  // Handle email verification (legacy flow)
  useEffect(() => {
    if (mode === 'emailVerify' && token && !verifyRequestSent.current) {
      verifyRequestSent.current = true;
      setMessage('驗證中...');
      setError(null);

      fetchAPI(`/verify-email/?token=${token}`, { method: 'GET' })
        .then((response) => {
          const data = response.data;
          devDebug('verify-email API 回傳:', data);
          if (response.status >= 200 && response.status < 300) {
            setMessage(
              data.message
                ? data.message
                    .replace('Email verified successfully', '驗證成功！即將返回登入頁面。')
                    .replace('Email already verified', '此信箱已驗證過，請直接登入。')
                : '驗證成功！'
            );
            setError(null);
            setTimeout(() => {
              const urlEmail = params.email as string;
              const urlPassword = params.password as string;

              const navigationParams: any = { verified: 'true' };
              if (urlEmail) navigationParams.email = urlEmail;
              if (urlPassword) navigationParams.password = urlPassword;

              router.push({
                pathname: '/Login',
                params: navigationParams,
              });
            }, 1500);
          } else {
            setError(
              data.error
                ? data.error
                    .replace('Invalid or expired token', '驗證碼無效或已過期，請重新註冊。')
                    .replace('Missing token', '驗證連結錯誤，缺少驗證碼。')
                : '驗證失敗，請確認連結是否正確。'
            );
            setMessage('');
          }
        })
        .catch(() => {
          setError('伺服器連線失敗，請稍後再試。');
          setMessage('');
        });
    }
  }, [mode, token, params.email, params.password, router]);

  // Handle OTP verification for registration
  const handleVerifyRegistrationOTP = async () => {
    if (otpCode.length !== 6) {
      Toast.show({
        type: 'failRed',
        text1: '請輸入 6 位數驗證碼',
        position: 'bottom',
        visibilityTime: 2000,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await verifyRegistrationOtp(phoneNumber, otpCode, password);
      devLog('Registration OTP verified', response);
      
      // Store JWT tokens and redirect to main app
      await storeLoginData({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      });
      
      Toast.show({
        type: 'successGreen',
        text1: '註冊成功！',
        position: 'bottom',
        visibilityTime: 2000,
      });
      
      router.replace('/EasyUse');
    } catch (err: any) {
      devError('Registration OTP verification error:', err);
      const errorMessage = err?.error || '驗證失敗，請重試';
      Toast.show({
        type: 'failRed',
        text1: errorMessage,
        position: 'bottom',
        visibilityTime: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification for password reset
  const handleVerifyPasswordResetOTP = async () => {
    if (otpCode.length !== 6) {
      Toast.show({
        type: 'failRed',
        text1: '請輸入 6 位數驗證碼',
        position: 'bottom',
        visibilityTime: 2000,
      });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      Toast.show({
        type: 'failRed',
        text1: '請輸入至少 6 個字元的新密碼',
        position: 'bottom',
        visibilityTime: 2000,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await verifyPasswordResetOtp(phoneNumber, otpCode, newPassword);
      devLog('Password reset OTP verified', response);
      
      Toast.show({
        type: 'successGreen',
        text1: '密碼已重設成功',
        position: 'bottom',
        visibilityTime: 2000,
      });
      
      // Redirect to login
      router.replace('/(auth)/login');
    } catch (err: any) {
      devError('Password reset OTP verification error:', err);
      const errorMessage = err?.error || '驗證失敗，請重試';
      Toast.show({
        type: 'failRed',
        text1: errorMessage,
        position: 'bottom',
        visibilityTime: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render email verification UI (legacy)
  if (mode === 'emailVerify') {
    return (
      <SafeAreaView className="flex-1 bg-stone-50">
        <View className="min-h-screen flex-1 items-center px-8 py-24 max-md:px-6 max-md:py-16 max-sm:px-4 max-sm:py-10">
          <View className="mt-8 min-h-[200px] w-full max-w-[330px] flex-1 items-center justify-center rounded-3xl bg-white p-8 shadow-md">
            <View className="w-full flex-1 items-center justify-center">
              {!token ? (
                <Text className="text-center text-base font-medium text-red-600">
                  驗證連結錯誤，缺少驗證碼。
                </Text>
              ) : error ? (
                <Text className="text-center text-base font-medium text-red-600">{error}</Text>
              ) : message ? (
                <View className="items-center">
                  <ActivityIndicator size="large" color="#22c55e" className="mb-4" />
                  <Text className="text-center text-base font-medium text-green-700">{message}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render OTP verification UI (for registration and password reset)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <YStack flex={1} padding="$4" justifyContent="center" alignItems="center">
        <YStack 
          width="100%" 
          maxWidth={400} 
          backgroundColor="white" 
          padding="$6" 
          borderRadius="$4"
          gap="$4"
        >
          <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>
            {mode === 'register' ? '驗證手機號碼' : '重設密碼'}
          </Text>

          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 8 }}>
            驗證碼已發送至 {phoneNumber}
          </Text>

          <YStack gap="$3">
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
              }}
              placeholder="輸入 6 位數驗證碼"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
            />

            {mode === 'forgotPassword' && (
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                }}
                placeholder="輸入新密碼"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            )}

            <Button
              backgroundColor="#007AFF"
              color="white"
              onPress={mode === 'register' ? handleVerifyRegistrationOTP : handleVerifyPasswordResetOTP}
              disabled={isLoading}
              opacity={isLoading ? 0.5 : 1}
            >
              {isLoading ? '驗證中...' : '驗證'}
            </Button>
          </YStack>
        </YStack>
      </YStack>
      <Toast />
    </SafeAreaView>
  );
}
