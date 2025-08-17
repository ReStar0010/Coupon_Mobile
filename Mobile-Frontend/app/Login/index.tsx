import React, { useState } from "react";
import axios from "axios";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { View, ScrollView, SafeAreaView, Text } from "react-native";
import { LoginFormContainer } from "./components/LoginFormContainer";
import { storeLoginData } from "app/utils/authAPI";
import { devDebug, devLog, devError } from "app/utils/devLogger";

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'forgotPassword'>('login');
  const toastConfig = {
    successGreen: ({ text1 }: any) => (
      <View className="absolute self-center bottom-[20%] px-7 h-14 rounded-full bg-toast-green justify-center shadow-lg">
        <Text className="text-white font-bold text-base">{text1}</Text>
      </View> ),
    failRed: ({ text1 }: any) => (
      <View className="absolute self-center bottom-[20%] px-7 h-14 rounded-full bg-toast-red justify-center shadow-lg">
        <Text className="text-white font-bold text-base">{text1}</Text>
      </View>
    )
};

  const handleLogin = async () => {
    // Login logic would go here
    devLog("Login attempted", { email, password });
    try{
      const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/login/`,
         {email, password},
        {
            headers: {
              "Content-Type": "application/json",
            },
            withCredentials: true, // This ensures cookies are sent with the request
        });
      devLog("Login successful", response.data);
      await storeLoginData(response.data);
      devLog("Store login data successfully");
      router.replace("/EasyUse");
    }catch (err) {
      devError("Login error:", err);
      Toast.show({
        type: 'failRed',
        text1: '登入失敗，請檢查您的帳號或密碼',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  };

  const handleRegister = async () => {
    devLog("Register attempted", {email, password});
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/register/`,
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );
      devLog("Registration successful", response.data);
      Toast.show({
        type: 'successGreen',
        text1: '信件寄送成功',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    } catch (err) {
      // Handle axios errors
      devError("Registration error:", err);
      Toast.show({
        type: 'failRed',
        text1: '註冊失敗，請重新註冊',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
    router.replace("/Login");
  }

  const handleForgotPassword = async () => {
    devLog("Forgot Password attempted", {email});
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/forgot-password/`,
        { email },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );
      devLog("Password reset request successful", response.data);
      Toast.show({
        type: 'successGreen',
        text1: '信件寄送成功',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    } catch (err) {
      // Handle axios errors
      devError("Password reset error:", err);
      Toast.show({
        type: 'failRed',
        text1: '重設失敗，請重新輸入您的 Email',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
    }
  }

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
    <SafeAreaView className="min-h-screen bg-login-bg">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-[320px] mx-auto">
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
          <Toast config={toastConfig} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}