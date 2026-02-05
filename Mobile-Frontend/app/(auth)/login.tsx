import React, { useState } from "react";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { LoginFormContainer } from "@/app/_Login/components/LoginFormContainer";
import { fetchAPI, storeLoginData } from "@/app/utils/authAPI";
import { devLog, devError } from "@/app/utils/devLogger";
import { YStack, View, Text } from 'tamagui';
import { BackendIndicator } from "@/app/components/BackendIndicator";
import { DismissKeyboardView } from "@/app/components/DismissKeyboardView";
import { toastConfig } from '@/app/config/toastConfig';

export default function Index() {
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'forgotPassword'>('login');
  const [loginMode, setLoginMode] = useState<'phone' | 'email'>('phone'); // Default to phone

  const handleLogin = async () => {
    devLog("Login attempted", { email, phoneNumber, loginMode });
    try {
      const loginData = loginMode === 'phone'
        ? { phone_number: phoneNumber, password, client_type: 'user' }
        : { email, password, client_type: 'user' };
      
      const response = await fetchAPI('/login/', {
        method: 'POST',
        data: loginData,
      });
      devLog("Login successful");
      await storeLoginData(response.data);
      router.replace("/EasyUse");
    } catch (err: unknown) {
      devError("Login error:", err);
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      const isWrongClient =
        axiosErr?.response?.status === 403 &&
        axiosErr?.response?.data?.error === 'wrong_client_type';
      Toast.show({
        type: 'failRed',
        text1: isWrongClient
          ? '此帳號為商家帳號，請使用商家端 App 登入'
          : '登入失敗，請檢查您的帳號或密碼',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  };

  const handleRegister = async () => {
    devLog("Register attempted", { phoneNumber, password });
    try {
      // Import sendRegistrationOtp from phoneOtpAPI
      const { sendRegistrationOtp } = await import('@/app/services/phoneOtpAPI');
      const response = await sendRegistrationOtp(phoneNumber);
      devLog("Registration OTP sent", response);
      Toast.show({
        type: 'successGreen',
        text1: '驗證碼已發送',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      // Navigate to OTP verification screen with phone_number and password
      router.push({
        pathname: '/(auth)/login-components/verify',
        params: { 
          phone_number: phoneNumber, 
          password: password,
          mode: 'register'
        }
      });
    } catch (err: any) {
      devError("Registration error:", err);
      const errorMessage = err?.error || '註冊失敗，請重新註冊';
      Toast.show({
        type: 'failRed',
        text1: errorMessage,
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  };

  const handleForgotPassword = async () => {
    devLog("Forgot Password attempted", { phoneNumber });
    try {
      // Import sendPasswordResetOtp from phoneOtpAPI
      const { sendPasswordResetOtp } = await import('@/app/services/phoneOtpAPI');
      const response = await sendPasswordResetOtp(phoneNumber);
      devLog("Password reset OTP sent", response);
      Toast.show({
        type: 'successGreen',
        text1: '驗證碼已發送',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true, 
      });
      // Navigate to OTP verification screen for password reset
      router.push({
        pathname: '/(auth)/login-components/verify',
        params: { 
          phone_number: phoneNumber,
          mode: 'forgotPassword'
        }
      });
    } catch (err: any) {
      devError("Password reset error:", err);
      const errorMessage = err?.error || '重設失敗，請重新輸入您的手機號碼';
      Toast.show({
        type: 'failRed',
        text1: errorMessage,
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  };

  const handleLoginPress = () =>{
    console.log("Navigate to login");
    setMode('login');
  }
  const handleRegisterPress = () => {
    // Navigate to register screen
    console.log("Navigate to register");
    setMode('register');
  };
  const handleForgotPasswordPress = () => {
    // Navigate to forgot password screen
    console.log("Navigate to forgot password");
    setMode('forgotPassword');
  };

  return (
    <YStack flex={1} bg="#f5f5f5">
      {__DEV__ && <BackendIndicator />}
      <DismissKeyboardView>
        <YStack 
          flex={1}
          items="center" 
          style={{ justifyContent: 'center' }}
          p="$4"
        >
        <View width="100%" style={{ maxWidth: 320 }} mx="auto">
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
            onLoginPress={handleLoginPress}
            onRegisterPress={handleRegisterPress}
            onForgotPasswordPress={handleForgotPasswordPress}
            mode={mode}
            setMode={setMode}
            loginMode={loginMode}
            setLoginMode={setLoginMode}
          />
        </View>

        {/* Privacy Policy Link (UGC Compliance) */}
        <TouchableOpacity 
          onPress={() => router.push('/OptionsMenu/PrivacyPolicy')}
          style={{ marginTop: 24 }}
        >
          <Text fontSize={14} color="#007AFF" textAlign="center">
            隱私政策
          </Text>
        </TouchableOpacity>

        <Toast config={toastConfig} />
        </YStack>
      </DismissKeyboardView>
    </YStack>
  );
}
