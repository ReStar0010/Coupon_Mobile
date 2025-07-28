import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
import { devDebug, devLog, devError } from "../../utils/devLogger";
import { storeLoginData } from "../../utils/authAPI";

interface LoginFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  setEmail,
  password,
  setPassword,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  // Get returnUrl from URL params if available
  const returnUrl = params.returnUrl as string;

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/login/`,
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true, // This ensures cookies are sent with the request
        }
      );

      // Handle successful login
      devDebug("Login successful", response.data);

      // 🔥 NEW: Store login data in AsyncStorage
      await storeLoginData(response.data);
      devLog("✅ Login data stored successfully");

      // Add a longer delay to ensure storage is complete and auth state updates
      setTimeout(() => {
        // If returnUrl is set, redirect there, otherwise go to EasyUse
        if (returnUrl) {
          devLog("Redirecting to:", returnUrl);
          router.push(returnUrl as any);
        } else {
          devLog("Redirecting to: /EasyUse");
          router.replace("/EasyUse");
        }
      }, 500); // Increased delay to 500ms

    } catch (err) {
      // Handle axios errors
      devError("❌ Login error:", err);
      
      if (axios.isAxiosError(err)) {
        if (err.response?.data) {
          const errorData = err.response.data;
          if (errorData.error) {
            setError(errorData.error);
          } else if (errorData.message) {
            setError(errorData.message);
          } else {
            setError("Login failed. Please check your credentials.");
          }
        } else {
          setError("Unable to connect to the server. Please try again later.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex flex-col gap-5 w-[80%] max-w-[400px] max-sm:max-w-full">
      <View className="px-8 py-5 bg-bg-white rounded-3xl h-[71px] flex items-center">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="輸入 Email"
          className="w-full bg-bg-white text-base text-sec-black"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      </View>

      <View className="px-8 py-5 bg-bg-white rounded-3xl h-[71px] flex items-center">
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="輸入密碼"
          className="w-full bg-bg-white text-base text-sec-black"
          secureTextEntry
          autoComplete="password"
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
          {isLoading ? "登入中..." : "登入"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
export default LoginForm;