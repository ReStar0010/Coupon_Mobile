import React, { useEffect, useState, useRef } from "react";
import { View, Text, SafeAreaView, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Header } from "../Header";
import { devDebug } from "../../../utils/devLogger";

export default function VerifyEmailPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const token = params.token as string;
  const [message, setMessage] = useState<string>("驗證中...");
  const [error, setError] = useState<string | null>(null);
  const verifyRequestSent = useRef(false);

  useEffect(() => {
    if (!token || verifyRequestSent.current) return;

    verifyRequestSent.current = true; // 確保請求只發送一次
    setMessage("驗證中...");
    setError(null);

    fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/verify-email/?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        devDebug("verify-email API 回傳:", data);
        if (res.ok) {
          setMessage(
            data.message
              ? data.message
                  .replace(
                    "Email verified successfully",
                    "驗證成功！即將返回登入頁面。"
                  )
                  .replace(
                    "Email already verified",
                    "此信箱已驗證過，請直接登入。"
                  )
              : "驗證成功！"
          );
          setError(null);
          setTimeout(() => {
            // 取得 email 和 password 參數
            const urlEmail = params.email as string;
            const urlPassword = params.password as string;
            
            // 構建導航參數
            const navigationParams: any = { verified: "true" };
            if (urlEmail) navigationParams.email = urlEmail;
            if (urlPassword) navigationParams.password = urlPassword;
            
            // 導航到登入頁面
            router.push({
              pathname: "/Login",
              params: navigationParams,
            });
          }, 1500); // 1.5秒後跳轉
        } else {
          setError(
            data.error
              ? data.error
                  .replace(
                    "Invalid or expired token",
                    "驗證碼無效或已過期，請重新註冊。"
                  )
                  .replace("Missing token", "驗證連結錯誤，缺少驗證碼。")
              : "驗證失敗，請確認連結是否正確。"
          );
          setMessage("");
        }
      })
      .catch(() => {
        setError("伺服器連線失敗，請稍後再試。");
        setMessage("");
      });
  }, [token, params.email, params.password, router]);

  return (
    <SafeAreaView className="flex-1 bg-stone-50">
      <View className="flex-1 items-center px-8 py-24 min-h-screen max-md:px-6 max-md:py-16 max-sm:px-4 max-sm:py-10">
        <Header />
        <View className="flex-1 items-center justify-center w-full max-w-[330px] bg-white rounded-3xl shadow-md p-8 mt-8 min-h-[200px]">
          <View className="flex-1 items-center justify-center w-full">
            {!token ? (
              <Text className="text-red-600 text-base font-medium text-center">
                驗證連結錯誤，缺少驗證碼。
              </Text>
            ) : error ? (
              <Text className="text-red-600 text-base font-medium text-center">
                {error}
              </Text>
            ) : message ? (
              <View className="items-center">
                <ActivityIndicator 
                  size="large" 
                  color="#22c55e" 
                  className="mb-4" 
                />
                <Text className="text-green-700 text-base font-medium text-center">
                  {message}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}