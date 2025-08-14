import "../global.css"
import { useEffect, useState } from 'react';
import { Text, View } from "react-native";
import { useRouter } from 'expo-router';
import { isUserLoggedIn } from './utils/authAPI';
import axios from 'axios';

export default function App() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check login status using the centralized auth function
    const checkLoginStatus = async () => {
      try {
        const loggedIn = await isUserLoggedIn();
        
        if (loggedIn) {
          router.replace('/EasyUse');
        } else {
          router.replace('/Login');
        }
      } catch (error) {
        console.error('Error checking login status:', error);
        // If there's an error, default to login page
        router.replace('/Login');
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  // 顯示載入畫面
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-xl font-bold text-blue-500 mb-4">
          載入中...
        </Text>
        <View className="w-8 h-8 bg-blue-500 rounded-full animate-pulse" />
      </View>
    );
  }

  // 這個 return 通常不會被執行，因為會先跳轉
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold text-red-500">
        路由跳轉中...
      </Text>
    </View>
  );
}