import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { Header } from '../Login/components/Header';
import axios from 'axios';

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const token = searchParams?.token as string;
  const email = searchParams?.email as string;

  useEffect(() => {
    if (!token || !email) {
      setError('無效的密碼重設連結。請重新嘗試忘記密碼流程。');
    }
  }, [token, email]);

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    if (password.length < 8) {
      setError('密碼長度至少需要8個字元');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reset-password/`,
        {
          email,
          token,
          new_password: password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );

      // Handle successful reset
      setSuccess(true);

      // Show success alert and redirect after user confirms
      Alert.alert('密碼重設成功', '您的密碼已成功重設，現在可以使用新密碼登入。', [
        {
          text: '前往登入',
          onPress: () => {
            router.replace(`/Login?email=${encodeURIComponent(email || '')}`);
          },
        },
      ]);
    } catch (err) {
      // Handle axios errors
      if (axios.isAxiosError(err)) {
        if (err.response?.data) {
          const errorData = err.response.data;
          if (errorData.error) {
            setError(errorData.error);
          } else if (errorData.message) {
            setError(errorData.message);
          } else {
            setError('密碼重設失敗。請稍後再試。');
          }
        } else {
          setError('無法連接到伺服器，請稍後再試。');
        }
      } else {
        setError(err instanceof Error ? err.message : '發生錯誤');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/Login');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="bg-bg-grey flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1">
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 40,
              paddingVertical: 20,
            }}>
            <Header />

            <View className="flex w-full max-w-[400px] flex-col items-center" style={{ gap: 20 }}>
              <Text className="text-sec-black mb-2 text-center text-xl font-bold">
                重設您的密碼
              </Text>

              {success ? (
                <View className="w-full rounded-md bg-green-100 p-4">
                  <Text className="text-center text-sm font-medium text-green-600">
                    密碼已成功重設！請點擊確認按鈕前往登入頁面。
                  </Text>
                </View>
              ) : error && (!token || !email) ? (
                <View className="w-full rounded-md bg-red-100 p-4">
                  <Text className="mb-4 text-center text-sm font-medium text-red-600">{error}</Text>
                  <TouchableOpacity
                    onPress={handleBackToLogin}
                    className="w-full"
                    activeOpacity={0.7}>
                    <View className="bg-act-yellow h-[54px] items-center justify-center rounded-3xl">
                      <Text className="text-sec-black text-base font-bold">返回登入頁面</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View className="w-full">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="輸入新密碼"
                      secureTextEntry
                      className="bg-bg-white text-sec-black h-[54px] rounded-3xl border-[none] px-4 text-base"
                      autoCapitalize="none"
                      returnKeyType="next"
                      onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>

                  <View className="w-full">
                    <TextInput
                      ref={confirmPasswordInputRef}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="確認新密碼"
                      secureTextEntry
                      className="bg-bg-white text-sec-black h-[54px] rounded-3xl border-[none] px-4 text-base"
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>

                  {error && (
                    <View className="w-full rounded-md bg-red-100 p-3">
                      <Text className="text-center text-sm font-medium text-red-600">{error}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isLoading || !token || !email}
                    className={`h-[54px] w-full items-center justify-center rounded-3xl ${
                      isLoading || !token || !email ? 'bg-act-yellow opacity-70' : 'bg-act-yellow'
                    }`}
                    activeOpacity={0.7}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text className="text-sec-black text-base font-bold">重設密碼</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

export default ResetPasswordPage;
