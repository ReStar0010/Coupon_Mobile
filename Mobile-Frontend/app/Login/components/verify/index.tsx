import React, { useEffect, useState, useRef } from 'react';
import { View, Text, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { devDebug } from '@/app/utils/devLogger';
import { fetchAPI } from '@/app/utils/authAPI';

export default function VerifyEmailPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const token = params.token as string;
  const [message, setMessage] = useState<string>('驗證中...');
  const [error, setError] = useState<string | null>(null);
  const verifyRequestSent = useRef(false);

  useEffect(() => {
    if (!token || verifyRequestSent.current) return;

    verifyRequestSent.current = true; // 確保請求只發送一次
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
            // 取得 email 和 password 參數
            const urlEmail = params.email as string;
            const urlPassword = params.password as string;

            // 構建導航參數
            const navigationParams: any = { verified: 'true' };
            if (urlEmail) navigationParams.email = urlEmail;
            if (urlPassword) navigationParams.password = urlPassword;

            // 導航到登入頁面
            router.push({
              pathname: '/Login',
              params: navigationParams,
            });
          }, 1500); // 1.5秒後跳轉
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
  }, [token, params.email, params.password, router]);

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
