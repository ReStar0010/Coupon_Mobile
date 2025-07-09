import React, { useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import SmallWidget from "./SmallWidget";
import LargeWidget from "./LargeWidget";
import CouponHistoryList from "./CouponHistoryList";
import SavingsGoalModal from "./SavingsGoalModal";
import { StatisticsData, CompletedGoal } from "../hooks/useStatisticsData";

interface StatisticsContentProps {
  stats: StatisticsData;
  completedGoals: CompletedGoal[];
  isLoading: boolean;
  error: string | null;
  onGoalSave: (goalName: string, goalAmount: number, goalImage: string) => void;
  onGoalReset: () => void;
}

const StatisticsContent: React.FC<StatisticsContentProps> = ({
  stats,
  completedGoals,
  isLoading,
  error,
  onGoalSave,
  onGoalReset,
}) => {
  // Modal state
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Function to open goal setting modal
  const handleOpenGoalModal = () => {
    setShowGoalModal(true);
  };

  // Function to save goal from modal
  const handleSaveGoal = (
    goalName: string,
    goalAmount: number,
    goalImage: string
  ) => {
    onGoalSave(goalName, goalAmount, goalImage);
    setShowGoalModal(false);
  };

  if (isLoading) {
    return (
      <View className="w-full flex justify-center py-8">
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text className="text-lg text-gray-500 mt-2 text-center">載入中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="w-full flex justify-center py-8">
        <Text className="text-red-500 text-center">{error}</Text>
      </View>
    );
  }

  return (
    <View className="flex flex-col gap-6">
      <LargeWidget
        usage={stats.monthlySavings}
        total={stats.savingsGoalAmount}
        metric="元"
        logoUrl={stats.savingsGoalImage}
        label={stats.savingsGoalName}
        onGoalClick={handleOpenGoalModal}
        goalAchieved={stats.goalAchieved}
        onGoalReset={onGoalReset}
        completedGoals={completedGoals}
      />

      <CouponHistoryList />

      <View className="w-full flex flex-row justify-between gap-[15px]">
        <SmallWidget
          description="已使用"
          usage={stats.couponsUsedCount}
          metric="張優惠券"
        />
        <SmallWidget
          description="總共省下"
          usage={stats.totalSavings}
          metric="元"
        />
      </View>

      {/* Savings Goal Modal */}
      <SavingsGoalModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onSave={handleSaveGoal}
        currentGoalName={stats.savingsGoalName}
        currentGoalAmount={stats.savingsGoalAmount}
        currentGoalImage={stats.savingsGoalImage}
      />
    </View>
  );
};

export default StatisticsContent;
