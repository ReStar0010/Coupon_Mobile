import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View as RNView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from 'tamagui';
import Toast from 'react-native-toast-message';
import { fetchAPI, storeLoginData } from '@/app/utils/authAPI';
import { devLog, devError } from '@/app/utils/devLogger';
import { BackendIndicator } from '@/app/components/BackendIndicator';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { LoginFormContainer, AUTH_COLORS } from './_components';

type FormMode = 'login' | 'register' | 'forgotPassword';
type LoginMode = 'phone' | 'email';

const styles = StyleSheet.create({
  container: {
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
  privacyLink: {
    marginTop: 24,
  },
});

export default function LoginPage() {
  const params = useLocalSearchParams<{
    phone_number?: string;
    email?: string;
    password?: string;
    verified?: string;
  }>();

  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<FormMode>('login');
  const [loginMode, setLoginMode] = useState<LoginMode>('phone');

  // Pre-fill phone/email/password when returning from verification
  useEffect(() => {
    const phone = typeof params.phone_number === 'string' ? params.phone_number : undefined;
    const emailParam = typeof params.email === 'string' ? params.email : undefined;
    const passwordParam = typeof params.password === 'string' ? params.password : undefined;

    if (phone) {
      setPhoneNumber(phone);
      setLoginMode('phone');
      setMode('login');
    }
    if (emailParam) {
      setEmail(emailParam);
      setLoginMode('email');
      setMode('login');
    }
    if (passwordParam) {
      setPassword(passwordParam);
    }
  }, [params.phone_number, params.email, params.password]);

  const handleLogin = async () => {
    devLog('Login attempted', { email, phoneNumber, loginMode });
    try {
      const loginData =
        loginMode === 'phone'
          ? { phone_number: phoneNumber, password, client_type: 'user' }
          : { email, password, client_type: 'user' };

      const response = await fetchAPI('/login/', {
        method: 'POST',
        data: loginData,
      });

      devLog('Login successful');
      await storeLoginData(response.data);
      router.replace('/(tabs)/easyuse');
    } catch (err: unknown) {
      devError('Login error:', err);
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: { error?: string; message?: string };
        };
      };
      const data = axiosErr?.response?.data;
      const serverMessage =
        typeof data?.message === 'string'
          ? data.message
          : typeof data?.error === 'string'
            ? data.error
            : null;

      Toast.show({
        type: 'failRed',
        text1: serverMessage ?? '登入失敗，請檢查您的帳號或密碼',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  };

  const handleRegister = async () => {
    devLog('Register attempted', { phoneNumber, password });
    try {
      const { sendRegistrationOtp } = await import('@/app/services/phoneOtpAPI');
      const response = await sendRegistrationOtp(phoneNumber);
      devLog('Registration OTP sent', response);

      Toast.show({
        type: 'successGreen',
        text1: '驗證碼已發送',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });

      router.push({
        pathname: '/(auth)/verify',
        params: {
          phone_number: phoneNumber,
          password: password,
          mode: 'register',
        },
      });
    } catch (err: unknown) {
      devError('Registration error:', err);
      const errorObj = err as { error?: string };
      Toast.show({
        type: 'failRed',
        text1: errorObj?.error || '註冊失敗，請重新註冊',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  };

  const handleForgotPassword = async () => {
    devLog('Forgot Password attempted', { phoneNumber });
    try {
      const { sendPasswordResetOtp } = await import('@/app/services/phoneOtpAPI');
      const response = await sendPasswordResetOtp(phoneNumber);
      devLog('Password reset OTP sent', response);

      Toast.show({
        type: 'successGreen',
        text1: '驗證碼已發送',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });

      router.push({
        pathname: '/(auth)/verify',
        params: {
          phone_number: phoneNumber,
          mode: 'forgotPassword',
        },
      });
    } catch (err: unknown) {
      devError('Password reset error:', err);
      const errorObj = err as { error?: string };
      Toast.show({
        type: 'failRed',
        text1: errorObj?.error || '重設失敗，請重新輸入您的手機號碼',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  };

  return (
    <RNView style={styles.container}>
      {__DEV__ && <BackendIndicator />}
      <DismissKeyboardView>
        <RNView style={styles.contentContainer}>
          <RNView style={styles.formWrapper}>
            <LoginFormContainer
              email={email}
              setEmail={setEmail}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              password={password}
              setPassword={setPassword}
              handleLogin={handleLogin}
              handleForgotPassword={handleForgotPassword}
              handleRegister={handleRegister}
              onLoginPress={() => setMode('login')}
              onRegisterPress={() => setMode('register')}
              onForgotPasswordPress={() => setMode('forgotPassword')}
              mode={mode}
              setMode={setMode}
              loginMode={loginMode}
              setLoginMode={setLoginMode}
            />
          </RNView>

          {/* Privacy Policy Link (UGC Compliance) */}
          <TouchableOpacity
            onPress={() => router.push('/options-menu/privacy-policy')}
            style={styles.privacyLink}>
            <Text fontSize={14} color={AUTH_COLORS.primary} style={{ textAlign: 'center' }}>
              隱私政策
            </Text>
          </TouchableOpacity>
        </RNView>
      </DismissKeyboardView>
    </RNView>
  );
}
