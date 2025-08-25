import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'react-native';
import { StatisticsData } from '../hooks/useStatisticsData';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
}
interface StatisticsContentProps {
  stats: StatisticsData;
  onSetGoal: () => void;
}


interface GoalCardProps {
  goal: Goal | null;
  onSetGoal: () => void;
}

const GoalCard: React.FC<StatisticsContentProps> = ({ stats, onSetGoal }) => {
  if (stats.savingsGoalAmount === 0) {
    // Empty state - show placeholder with set goal button
    return (
      <View className="rounded-[10px] border border-white bg-login-bg p-[18px] shadow-md">
        {/* Progress Bar Background */}
        <View className="mb-3 h-4 w-full rounded-full bg-login-light-gray" />

        {/* Empty state content with image placeholder */}
        <View className="items-center">
          <View className="mb-4 h-[100px] w-[100px] items-center justify-center rounded-[13px] border border-white bg-white">
            <View className="h-12 w-12 items-center justify-center rounded bg-[#8F8F8F]">
              <Image
                source={require('../../../assets/battery.svg')}
                className="h-6 w-6"
                style={{ tintColor: '#FFFFFF' }}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={onSetGoal}
            className="rounded-full bg-login-orange px-3 py-[6.5px]"
            activeOpacity={0.8}
          >
            <Text className="text-[13px] font-normal leading-normal text-login-gray">
              設定目標
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Calculate progress percentage
  const progressPercentage = Math.min((stats.monthlySavings / stats.savingsGoalAmount) * 100, 100);
  const isCompleted = stats.monthlySavings >= stats.savingsGoalAmount;
  const remaining = Math.max(stats.savingsGoalAmount- stats.monthlySavings, 0);


  return (
    <View className="rounded-[10px] border border-bar-gray bg-login-bg p-[18px]">
      {/* Progress Bar */}
      <View className="mb-3">
        <View className="h-4 w-full rounded-full bg-bar-gray">
          <View
            className={`h-4 rounded-full bg-login-orange`}
            style={{
              width: `${progressPercentage}%`,
              borderTopLeftRadius: 999,
              borderBottomLeftRadius: 999,
              borderTopRightRadius: progressPercentage === 100 ? 999 : 0,
              borderBottomRightRadius: progressPercentage === 100 ? 999 : 0,
            }}
          />
        </View>
      </View>

      {/* Goal Info */}
      <View className="items-center">
        <View className="mb-1">
          <Text className="text-center text-[14px] font-bold leading-[17.5px] text-login-gray">
            {isCompleted ? '目標達成！' : `剩下 ${remaining} 塊，加油！`}
          </Text>
        </View>
        <Text className="text-[10px] font-normal leading-normal text-login-light-gray">
          {stats.savingsGoalName}
        </Text>
      </View>
    </View>
  );
};

export default GoalCard;
