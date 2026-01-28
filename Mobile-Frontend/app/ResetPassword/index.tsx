import React, { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { View, ScrollView, SafeAreaView } from "react-native";
import { ResetFormContainer } from "./components/ResetFormContainer";
import { fetchAPI } from "@/app/utils/authAPI";
import { devLog, devError } from "@/app/utils/devLogger";
import { toastConfig } from "@/app/config/toastConfig";

export default function Index() {
  const [password, setPassword] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const searchParams = useLocalSearchParams()
  const token = searchParams?.token as string;
  const email = searchParams?.email as string;  
  const router = useRouter();

  useEffect(() => {
    if (!token || !email) {
      devError("無效的密碼重設連結。請重新嘗試忘記密碼流程。");
    }
  }, [token, email]);

  const handleResetPassword = async () => {
    if (password !== verifyPassword) {
      devError("兩次輸入的密碼不一致");
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
      devError("密碼長度至少需要8個字元");
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
      devLog("密碼重設成功", response.data);
      Toast.show({
        type: 'successGreen',
        text1: '密碼重設成功',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      router.replace(`/Login?email=${encodeURIComponent(email || "")}`);
    } catch (err) {
      // Handle axios errors
      devError("密碼重設失敗:", err);
      Toast.show({
        type: 'failRed',
        text1: '密碼重設失敗，請稍後再試',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      router.replace("/Login");
    }
  };

  return (
    <SafeAreaView className="min-h-screen bg-login-bg">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-[320px] mx-auto">
            <ResetFormContainer
              password={password}
              setPassword={setPassword}
              verifyPassword={verifyPassword}
              setVerifyPassword={setVerifyPassword}
              handleReset={handleResetPassword}
            />
          </View>
          <Toast config={toastConfig} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}