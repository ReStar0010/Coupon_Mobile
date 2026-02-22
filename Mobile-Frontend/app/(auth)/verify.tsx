import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaView, View as RNView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { devDebug, devLog, devError } from '@/app/utils/devLogger';
import { fetchAPI, storeLoginData } from '@/app/utils/authAPI';
import { verifyRegistrationOtp, verifyPasswordResetOtp } from '@/app/services/phoneOtpAPI';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { VerifyFormContainer, EmailVerifyContainer, AUTH_COLORS } from './_components';

type VerifyMode = 'register' | 'forgotPassword' | 'emailVerify';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});

export default function VerifyPage() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const phoneNumber = params.phone_number as string;
  const password = params.password as string;
  const mode = params.mode as VerifyMode;
  const token = params.token as string;

  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

              const navigationParams: Record<string, string> = { verified: 'true' };
              if (urlEmail) navigationParams.email = urlEmail;
              if (urlPassword) navigationParams.password = urlPassword;

              router.push({
                pathname: '/(auth)/login',
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

      router.replace('/(tabs)/easyuse');
    } catch (err: unknown) {
      devError('Registration OTP verification error:', err);
      const errorObj = err as { error?: string };
      const errorMessage = errorObj?.error || '驗證失敗，請重試';
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

      router.replace({
        pathname: '/(auth)/login',
        params: { phone_number: phoneNumber },
      });
    } catch (err: unknown) {
      devError('Password reset OTP verification error:', err);
      const errorObj = err as { error?: string };
      const errorMessage = errorObj?.error || '驗證失敗，請重試';
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
      <SafeAreaView style={styles.safeArea}>
        <EmailVerifyContainer token={token} message={message} error={error} />
      </SafeAreaView>
    );
  }

  // Render OTP verification UI
  const handleVerify =
    mode === 'register' ? handleVerifyRegistrationOTP : handleVerifyPasswordResetOTP;

  return (
    <SafeAreaView style={styles.safeArea}>
      <DismissKeyboardView>
        <RNView style={styles.contentContainer}>
          <VerifyFormContainer
            mode={mode as 'register' | 'forgotPassword'}
            phoneNumber={phoneNumber}
            otpCode={otpCode}
            setOtpCode={setOtpCode}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            onVerify={handleVerify}
            isLoading={isLoading}
          />
        </RNView>
      </DismissKeyboardView>
    </SafeAreaView>
  );
}
