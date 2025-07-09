import React from "react";
import { View, Text, ScrollView, ActivityIndicator, SafeAreaView } from "react-native";
import PageHeader from "../components/PageHeader";
import { useRequireAuth } from "../utils/authAPI";
import { useStatisticsData } from "./hooks/useStatisticsData";
import { useAuthCheck } from "./hooks/useAuthCheck";
import { useNavigateToOptionsMenu } from "./utils/navigation";
import StatisticsContent from "./components/StatisticsContent";

const Statistics: React.FC = () => {
  // Authentication hooks
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  useAuthCheck(isAuthenticated, authLoading);

  // Navigation hook
  const navigateToOptionsMenu = useNavigateToOptionsMenu();

  // Statistics data hook
  const { stats, completedGoals, isLoading, error, setSavingsGoal, resetGoal } = useStatisticsData(isAuthenticated);

  // Show loading indicator while authentication is in progress
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-bg-grey">
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text className="text-lg text-gray-500 mt-4">載入中...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-grey">
      <View className="flex-1 pt-[35px] px-[11px] gap-[10px]">
        <PageHeader
          title="成就列表"
          navbarProps={{ atStatistics: true }}
          infoPopupTitle="成就列表｜讓每一次省錢都更有意義"
          infoPopupContent={
            <View>
              <Text className="text-xs mb-2 text-gray-700">
                你知道嗎？每天省下一點點，累積起來也是一筆可觀的金額！{"\n"}因此我們設計了一個<Text className="font-bold">成就系統</Text>，讓你可以設定目標，看見自己「默默存下來的驚喜」。
              </Text>
              
              <Text className="text-xs mb-2 font-bold text-gray-700">
                如何使用？
              </Text>
              
              <View className="mb-2">
                <Text className="text-xs text-gray-700 mb-1">
                  1. <Text className="font-bold">在「成就列表」中，輸入一個你想存下的目標金額</Text>
                </Text>
                <Text className="text-xs text-gray-700 mb-1 ml-3">
                  • 例如：Netflix 訂閱費，每月 92 元
                </Text>
                <Text className="text-xs text-gray-700 mb-1 ml-3">
                  • (範例名稱僅供參考，與該品牌無直接合作關係。)
                </Text>
                
                <Text className="text-xs text-gray-700 mb-1">
                  2. <Text className="font-bold">上傳一張圖片，代表這個目標</Text>
                </Text>
                
                <Text className="text-xs text-gray-700 mb-1">
                  3. <Text className="font-bold">每次你在 CouPro 上成功使用一張優惠，我們都會幫你紀錄你省下的金額</Text>
                </Text>
                
                <Text className="text-xs text-gray-700 mb-1">
                  4. <Text className="font-bold">當累積省下的金額達到你的目標時，畫面會跳出通知 🎉：</Text>
                </Text>
                <Text className="text-xs text-gray-700 mb-1 ml-3 font-bold">
                  「恭喜你！你已經靠每次的優惠省下了 Netflix ！」
                </Text>
              </View>
              
              <Text className="text-xs mb-2 font-bold text-gray-700">
                設計理念
              </Text>
              
              <Text className="text-xs mb-2 text-gray-700">
                「這不僅是省錢，是存一個 Netflix、存一杯拿鐵、存一場小旅行。」{"\n\n"}每一塊錢都有價值，這個成就系統不是為了比誰省得多，而是讓你<Text className="font-bold">重新看見自己在日常中的小努力</Text>。{"\n\n"}你也可以設定很多種目標：
              </Text>
              
              <View className="ml-3">
                <Text className="text-xs text-gray-700 mb-1">• Netflix 每個月的訂閱費 92元</Text>
                <Text className="text-xs text-gray-700 mb-1">• 假日下午的一杯咖啡 150 元</Text>
                <Text className="text-xs text-gray-700 mb-1">• 一場電影票 280 元</Text>
                <Text className="text-xs text-gray-700 mb-1">• 下一次出遊的車票錢！</Text>
              </View>
            </View>
          }
          sourcePage="/Statistics"
        />
        
        <ScrollView 
          className="flex-1 pt-[23px] px-[19px] pb-[13px]"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 25 }}
        >
          <StatisticsContent
            stats={stats}
            completedGoals={completedGoals}
            isLoading={isLoading}
            error={error}
            onGoalSave={setSavingsGoal}
            onGoalReset={resetGoal}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default Statistics;
