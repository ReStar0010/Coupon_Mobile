import React from 'react';
import { Image } from 'react-native';
import { StatisticsData } from '../hooks/useStatisticsData';
import { YStack, XStack, Button, Text } from 'tamagui';

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
      <YStack
        rounded="$3"
        style={{ borderWidth: 1, borderColor: 'white' }}
        bg="#f5f5f5"
        p="$4"
        elevation="$1">
        {/* Progress Bar Background */}
        <YStack mb="$3" height={16} width="100%" rounded="$6" bg="#e0e0e0" />

        {/* Empty state content with image placeholder */}
        <YStack items="center">
          <YStack
            mb="$4"
            height={100}
            width={100}
            items="center"
            rounded="$3"
            style={{ borderWidth: 1, borderColor: 'white', justifyContent: 'center' }}
            bg="white">
            <YStack
              height={48}
              width={48}
              items="center"
              style={{ justifyContent: 'center' }}
              rounded="$2"
              bg="#8F8F8F">
              <Image
                source={require('@/assets/battery.svg')}
                style={{ height: 24, width: 24, tintColor: '#FFFFFF' }}
              />
            </YStack>
          </YStack>

          <Button
            onPress={onSetGoal}
            rounded="$6"
            bg="#FFAD31"
            px="$3"
            py="$2"
            pressStyle={{ opacity: 0.8 }}>
            <Text fontSize={13} fontWeight="normal" color="#333333">
              設定目標
            </Text>
          </Button>
        </YStack>
      </YStack>
    );
  }

  // Calculate progress percentage
  const progressPercentage = Math.min((stats.monthlySavings / stats.savingsGoalAmount) * 100, 100);
  const isCompleted = stats.monthlySavings >= stats.savingsGoalAmount;
  const remaining = Math.max(stats.savingsGoalAmount - stats.monthlySavings, 0);

  return (
    <YStack rounded="$3" style={{ borderWidth: 1, borderColor: '#e0e0e0' }} bg="#f5f5f5" p="$4">
      {/* Progress Bar */}
      <YStack mb="$3">
        <YStack height={16} width="100%" rounded="$6" bg="#e0e0e0">
          <YStack
            height={16}
            rounded="$6"
            bg="#FFAD31"
            style={{
              width: `${progressPercentage}%`,
              borderTopLeftRadius: 999,
              borderBottomLeftRadius: 999,
              borderTopRightRadius: progressPercentage === 100 ? 999 : 0,
              borderBottomRightRadius: progressPercentage === 100 ? 999 : 0,
            }}
          />
        </YStack>
      </YStack>

      {/* Goal Info */}
      <YStack items="center">
        <YStack mb="$1">
          <Text
            style={{ textAlign: 'center' }}
            fontSize={14}
            fontWeight="bold"
            lineHeight={17.5}
            color="#333333">
            {isCompleted ? '目標達成！' : `剩下 ${remaining} 塊，加油！`}
          </Text>
        </YStack>
        <Text fontSize={10} fontWeight="normal" color="#707070">
          {stats.savingsGoalName}
        </Text>
      </YStack>
    </YStack>
  );
};

export default GoalCard;
