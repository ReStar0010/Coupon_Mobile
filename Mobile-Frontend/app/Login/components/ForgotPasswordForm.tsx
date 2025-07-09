import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import axios from "axios";
import { devLog } from "../../utils/devLogger";

interface ForgotPasswordFormProps {
  email: string;
  setEmail: (email: string) => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  email,
  setEmail,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

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

      // Handle successful request
      devLog("Password reset request successful", response.data);
      setSuccess(true);
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
            setError("密碼重設請求失敗。請稍後再試。");
          }
        } else {
          setError("密碼重設請求失敗。請稍後再試。");
        }
      } else {
        setError(err instanceof Error ? err.message : "發生錯誤");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex flex-col items-center gap-5 w-[80%] max-w-[400px] max-sm:max-w-full">
      <Text className="text-xl text-sec-black mb-2">重設密碼</Text>

      {success ? (
        <View className="text-green-600 bg-green-100 p-4 rounded-md text-sm font-medium mb-4 w-full">
          <Text className="text-green-600 text-sm font-medium">
            重設密碼連結已發送到您的電子郵件。請檢查您的收件箱。
          </Text>
        </View>
      ) : (
        <View className="flex flex-col gap-5 w-full">
          <View className="px-8 py-5 bg-bg-white rounded-3xl h-[71px] flex items-center justify-center">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="輸入您的 Email"
              className="w-full bg-bg-white text-base text-sec-black"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {error && (
            <View className="bg-red-100 p-3 rounded-md">
              <Text className="text-red-600 text-sm font-medium">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            className={`bg-act-yellow rounded-3xl h-[71px] justify-center items-center ${
              isLoading ? "opacity-70" : ""
            }`}
          >
            <Text className="text-base font-bold text-sec-black">
              {isLoading ? "處理中..." : "發送重設密碼連結"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
export default ForgotPasswordForm;