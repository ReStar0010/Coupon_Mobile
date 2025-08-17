import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import PageHeader from '../components/PageHeader';
import { useRequireAuth } from '../utils/authAPI';
import { useStatisticsData } from './hooks/useStatisticsData';
import { useAuthCheck } from './hooks/useAuthCheck';
import { useNavigateToOptionsMenu } from './utils/navigation';
import StatisticsContent from './components/StatisticsContent';

const Statistics: React.FC = () => {
  // Authentication hooks
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  useAuthCheck(isAuthenticated, authLoading);

  // Navigation hook
  const navigateToOptionsMenu = useNavigateToOptionsMenu();

  // Statistics data hook
  const { stats, completedGoals, isLoading, error, setSavingsGoal, resetGoal } =
    useStatisticsData(isAuthenticated);

  // Show loading indicator while authentication is in progress
  if (authLoading) {
    return (
      <SafeAreaView className="bg-bg-grey flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text className="mt-4 text-lg text-gray-500">載入中...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-bg-grey flex-1">
      <View className="flex-1 gap-[10px] px-[11px] pt-[35px]">
        <PageHeader
          title="成就列表"
          navbarProps={{ atStatistics: true }}
          infoPopupTitle="成就列表｜讓每一次省錢都更有意義"
          infoPopupContent={
            <View>
              <Text className="mb-2 text-xs text-gray-700">
                你知道嗎？每天省下一點點，累積起來也是一筆可觀的金額！{'\n'}因此我們設計了一個
                <Text className="font-bold">成就系統</Text>
                ，讓你可以設定目標，看見自己「默默存下來的驚喜」。
              </Text>

              <Text className="mb-2 text-xs font-bold text-gray-700">如何使用？</Text>

              <View className="mb-2">
                <Text className="mb-1 text-xs text-gray-700">
                  1. <Text className="font-bold">在「成就列表」中，輸入一個你想存下的目標金額</Text>
                </Text>
                <Text className="mb-1 ml-3 text-xs text-gray-700">
                  • 例如：Netflix 訂閱費，每月 92 元
                </Text>
                <Text className="mb-1 ml-3 text-xs text-gray-700">
                  • (範例名稱僅供參考，與該品牌無直接合作關係。)
                </Text>

                <Text className="mb-1 text-xs text-gray-700">
                  2. <Text className="font-bold">上傳一張圖片，代表這個目標</Text>
                </Text>

                <Text className="mb-1 text-xs text-gray-700">
                  3.{' '}
                  <Text className="font-bold">
                    每次你在 CouPro 上成功使用一張優惠，我們都會幫你紀錄你省下的金額
                  </Text>
                </Text>

                <Text className="mb-1 text-xs text-gray-700">
                  4.{' '}
                  <Text className="font-bold">
                    當累積省下的金額達到你的目標時，畫面會跳出通知 🎉：
                  </Text>
                </Text>
                <Text className="mb-1 ml-3 text-xs font-bold text-gray-700">
                  「恭喜你！你已經靠每次的優惠省下了 Netflix ！」
                </Text>
              </View>

              <Text className="mb-2 text-xs font-bold text-gray-700">設計理念</Text>

              <Text className="mb-2 text-xs text-gray-700">
                「這不僅是省錢，是存一個 Netflix、存一杯拿鐵、存一場小旅行。」{'\n\n'}
                每一塊錢都有價值，這個成就系統不是為了比誰省得多，而是讓你
                <Text className="font-bold">重新看見自己在日常中的小努力</Text>。{'\n\n'}
                你也可以設定很多種目標：
              </Text>

              <View className="ml-3">
                <Text className="mb-1 text-xs text-gray-700">• Netflix 每個月的訂閱費 92元</Text>
                <Text className="mb-1 text-xs text-gray-700">• 假日下午的一杯咖啡 150 元</Text>
                <Text className="mb-1 text-xs text-gray-700">• 一場電影票 280 元</Text>
                <Text className="mb-1 text-xs text-gray-700">• 下一次出遊的車票錢！</Text>
              </View>
            </View>
          }
          sourcePage="/Statistics"
        />

        <ScrollView
          className="flex-1 px-[19px] pb-[13px] pt-[23px]"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 25 }}>
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
