import React, { useState } from "react";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { LoginFormContainer } from "./components/LoginFormContainer";
import { fetchAPI, storeLoginData } from "@/app/utils/authAPI";
import { devLog, devError } from "@/app/utils/devLogger";
import { YStack, View, Text } from 'tamagui';
import { BackendIndicator } from '../components/BackendIndicator';
import { DismissKeyboardView } from '../components/DismissKeyboardView';
import { toastConfig } from '@/app/config/toastConfig';

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'forgotPassword'>('login');

  const handleLogin = async () => {
    devLog("Login attempted", { email });
    try {
      const response = await fetchAPI('/login/', {
        method: 'POST',
        data: { email, password, client_type: 'user' },
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
    devLog("Register attempted", { email, password });
    try {
      const response = await fetchAPI('/register/', {
        method: 'POST',
        data: { email, password },
      });
      devLog("Registration successful", response.data);
      Toast.show({
        type: 'successGreen',
        text1: '信件寄送成功',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      router.replace("/Login");
    } catch (err) {
      devError("Registration error:", err);
      Toast.show({
        type: 'failRed',
        text1: '註冊失敗，請重新註冊',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  };

  const handleForgotPassword = async () => {
    devLog("Forgot Password attempted", { email });
    try {
      const response = await fetchAPI('/forgot-password/', {
        method: 'POST',
        data: { email },
      });
      devLog("Password reset request successful", response.data);
      Toast.show({
        type: 'successGreen',
        text1: '信件寄送成功',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      router.replace("/Login");
    } catch (err) {
      devError("Password reset error:", err);
      Toast.show({
        type: 'failRed',
        text1: '重設失敗，請重新輸入您的 Email',
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
            password={password}
            setPassword={setPassword}
            handleLogin={handleLogin}
            handleForgotPassword={handleForgotPassword}
            handleRegister={handleRegister}
            onLoginPress={handleLoginPress}
            onRegisterPress={handleRegisterPress}
            onForgotPasswordPress={handleForgotPasswordPress}
            mode = {mode}
            setMode={setMode}
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
