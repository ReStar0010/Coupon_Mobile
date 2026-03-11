import React, { useState, useEffect } from 'react';
import { SafeAreaView, View as RNView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { fetchAPI } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';
import { devLog, devError } from '@/app/utils/devLogger';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { ResetFormContainer, AUTH_COLORS } from './_components';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_COLORS.background,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  formWrapper: {
    width: '100%',
    maxWidth: 320,
  },
});

export default function ResetPasswordPage() {
  const { getErrorMessage } = useApiError();
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const searchParams = useLocalSearchParams();
  const token = searchParams?.token as string;
  const email = searchParams?.email as string;
  const router = useRouter();

  useEffect(() => {
    if (!token || !email) {
      devError('無效的密碼重設連結。請重新嘗試忘記密碼流程。');
    }
  }, [token, email]);

  const handleResetPassword = async () => {
    if (password !== verifyPassword) {
      devError('兩次輸入的密碼不一致');
      Toast.show({
        type: 'failRed',
        text1: '兩次輸入的密碼不一致',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      return;
    }

    if (password.length < 8) {
      devError('密碼長度至少需要8個字元');
      Toast.show({
        type: 'failRed',
        text1: '密碼長度至少需要8個字元',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      return;
    }

    try {
      const response = await fetchAPI('/reset-password/', {
        method: 'POST',
        data: {
          email,
          token,
          new_password: password,
        },
      });

      devLog('密碼重設成功', response.data);
      Toast.show({
        type: 'successGreen',
        text1: '密碼重設成功',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      router.replace(`/(auth)/login?email=${encodeURIComponent(email || '')}`);
    } catch (err) {
      devError('密碼重設失敗:', err);
      Toast.show({
        type: 'failRed',
        text1: getErrorMessage(err),
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      router.replace('/(auth)/login');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <DismissKeyboardView>
        <RNView style={styles.contentContainer}>
          <RNView style={styles.formWrapper}>
            <ResetFormContainer
              password={password}
              setPassword={setPassword}
              verifyPassword={verifyPassword}
              setVerifyPassword={setVerifyPassword}
              handleReset={handleResetPassword}
            />
          </RNView>
        </RNView>
      </DismissKeyboardView>
    </SafeAreaView>
  );
}
