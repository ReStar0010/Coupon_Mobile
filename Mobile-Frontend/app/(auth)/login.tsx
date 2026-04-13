import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View as RNView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from 'tamagui';
import Toast from 'react-native-toast-message';
import { isAxiosError } from 'axios';
import { fetchAPI, storeLoginData } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';
import { devLog, devError } from '@/app/utils/devLogger';
import { BackendIndicator } from '@/app/components/BackendIndicator';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import {
  LoginFormContainer,
  AUTH_COLORS,
  type AuthStep,
} from './_components/LoginFormContainer';
import { isValidPhoneNumber } from '@/app/services/phoneOtpAPI';

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
  const { getErrorMessage } = useApiError();
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
  const [authStep, setAuthStep] = useState<AuthStep>('phone');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Pre-fill phone/email/password when returning from verification / deep links
  useEffect(() => {
    const phone = typeof params.phone_number === 'string' ? params.phone_number : undefined;
    const emailParam = typeof params.email === 'string' ? params.email : undefined;
    const passwordParam = typeof params.password === 'string' ? params.password : undefined;

    if (phone) {
      setPhoneNumber(phone);
      setLoginMode('phone');
      setMode('login');
      setAuthStep('loginPassword');
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

  const handlePhoneContinue = async () => {
    if (!isValidPhoneNumber(phoneNumber)) {
      Toast.show({
        type: 'failRed',
        text1: '請輸入有效的台灣手機號碼',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      return;
    }

    setIsCheckingPhone(true);
    try {
      const { checkRegistrationPhone } = await import('@/app/services/phoneOtpAPI');
      const { registered } = await checkRegistrationPhone(phoneNumber);
      devLog('check-phone result', { registered });
      if (registered) {
        setMode('login');
        setAuthStep('loginPassword');
      } else {
        setMode('register');
        setAuthStep('registerPassword');
      }
    } catch (err: unknown) {
      devError('check-phone error:', err);
      if (isAxiosError(err) && err.response?.status === 429) {
        Toast.show({
          type: 'failRed',
          text1: '查詢次數已達上限，請稍後再試',
          position: 'bottom',
          visibilityTime: 2000,
          autoHide: true,
        });
        return;
      }
      Toast.show({
        type: 'failRed',
        text1: getErrorMessage(err),
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleChangePhoneNumber = () => {
    setAuthStep('phone');
    setPassword('');
    setMode('login');
  };

  const handleForgotPasswordBack = () => {
    setMode('login');
    setAuthStep('loginPassword');
  };

  const handleSwitchToPhoneLogin = () => {
    setLoginMode('phone');
    setAuthStep('phone');
    setPassword('');
    setMode('login');
  };

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
      Toast.show({
        type: 'failRed',
        text1: getErrorMessage(err),
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
      Toast.show({
        type: 'failRed',
        text1: getErrorMessage(err),
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
      Toast.show({
        type: 'failRed',
        text1: getErrorMessage(err),
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
              onForgotPasswordPress={() => setMode('forgotPassword')}
              onForgotPasswordBack={handleForgotPasswordBack}
              mode={mode}
              loginMode={loginMode}
              setLoginMode={setLoginMode}
              authStep={authStep}
              onPhoneContinue={handlePhoneContinue}
              isCheckingPhone={isCheckingPhone}
              onChangePhoneNumber={handleChangePhoneNumber}
              onSwitchToPhoneLogin={handleSwitchToPhoneLogin}
            />
          </RNView>

          <TouchableOpacity
            onPress={() => router.push('/options-menu/privacy-policy')}
            style={styles.privacyLink}
          >
            <Text fontSize={14} color={AUTH_COLORS.primary} style={{ textAlign: 'center' }}>
              隱私政策
            </Text>
          </TouchableOpacity>
        </RNView>
      </DismissKeyboardView>
    </RNView>
  );
}
