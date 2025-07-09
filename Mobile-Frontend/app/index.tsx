import "../global.css"
import { useEffect, useState } from 'react';
import { Text, View } from "react-native";
import { useRouter } from 'expo-router';

export default function App() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 模擬檢查登入狀態
    const checkLoginStatus = () => {
      // 這裡用簡單的條件判斷，你可以改成任何邏輯
      const isLoggedIn = true; // 改成 true 測試不同路由
      
      setTimeout(() => {
        if (isLoggedIn) {
          router.replace('/EasyUse'); 
        } else {
          router.replace('/Login');
        }
        setIsLoading(false);
      }, 1000); // 1秒後執行路由跳轉
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