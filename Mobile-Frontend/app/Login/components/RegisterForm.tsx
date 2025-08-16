import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';

interface RegisterFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  email,
  setEmail,
  password,
  setPassword,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationLink, setVerificationLink] = useState<string | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  // Check if redirected with registered=true parameter
  useEffect(() => {
    const registered = params.registered as string;
    if (registered === 'true') {
      setSuccessMessage('註冊成功！請登入您的帳號。');
    }
  }, [params]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setVerificationLink(null);

    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/register/`,
        { email, password },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );

      // 顯示驗證訊息，通知用戶檢查電子郵件，並提醒可能需要等待
      setSuccessMessage(
        '註冊成功！請檢查您的電子郵件，我們已發送驗證連結至您的信箱。若未收到郵件，請稍候幾分鐘，並檢查垃圾郵件資料夾。'
      );
      // 不再設定驗證連結，因為已經通過電子郵件發送
      setVerificationLink(null);
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
            setError('Registration failed. Please try again.');
          }
        } else {
          setError('Unable to connect to the server. Please try again later.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex w-[80%] max-w-[400px] flex-col gap-5 max-sm:max-w-full">
      {successMessage && (
        <View className="rounded-md bg-green-100 p-3">
          <Text className="text-sm font-medium text-green-600">{successMessage}</Text>
        </View>
      )}

      <View className="bg-bg-white flex h-[71px] items-center rounded-3xl px-8 py-5">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="輸入 Email"
          className="bg-bg-white text-sec-black w-full text-base"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      </View>

      <View className="bg-bg-white flex h-[71px] items-center rounded-3xl px-8 py-5">
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="設定密碼"
          className="bg-bg-white text-sec-black w-full text-base"
          secureTextEntry
          autoComplete="new-password"
        />
      </View>

      {error && (
        <View className="rounded-md bg-red-100 p-3">
          <Text className="text-sm font-medium text-red-600">{error}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isLoading}
        className={`bg-act-yellow h-[71px] items-center justify-center rounded-3xl ${
          isLoading ? 'opacity-70' : ''
        }`}>
        <Text className="text-sec-black text-base font-bold">
          {isLoading ? '註冊中...' : '註冊'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
export default RegisterForm;
