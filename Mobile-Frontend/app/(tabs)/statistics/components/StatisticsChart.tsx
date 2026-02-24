import React from 'react';
import { Image } from 'react-native';
import { YStack, Button, Text } from 'tamagui';
import CircularProgress from './CircularProgress';

interface StatisticsChartProps {
  currentAmount: number;
  targetAmount: number;
  goalName?: string;
  goalImage?: string;
  onSetGoal: () => void;
}

const StatisticsChart: React.FC<StatisticsChartProps> = ({
  currentAmount,
  targetAmount,
  goalName,
  goalImage,
  onSetGoal,
}) => {
  const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
  const hasGoal = targetAmount > 0;

  const CenterContent = () => {
    if (!hasGoal) {
      // No goal set - show placeholder image
      return (
        <YStack items="center" gap="$2">
          <YStack
            width={60}
            height={60}
            bg="#E5E5E5"
            rounded="$8"
            items="center"
            style={{ justifyContent: 'center' }}
          >
            <Text fontSize={30} color="#999">
              📊
            </Text>
          </YStack>
        </YStack>
      );
    }

    // Goal is set - show goal image and progress
    return (
      <YStack items="center" gap="$1">
        {goalImage ? (
          <Image
            source={{ uri: goalImage }}
            style={{ width: 50, height: 50, borderRadius: 25 }}
            resizeMode="cover"
          />
        ) : (
          <YStack
            width={50}
            height={50}
            bg="#FFAD31"
            rounded="$8"
            items="center"
            style={{ justifyContent: 'center' }}
          >
            <Text fontSize={18} color="white">
              🎯
            </Text>
          </YStack>
        )}
        <Text fontSize={10} color="#666" style={{ textAlign: 'center', maxWidth: 80 }}>
          {goalName || '目標'}
        </Text>
        <Text fontSize={14} fontWeight="bold" color="#333">
          ${currentAmount}
        </Text>
        <Text fontSize={10} color="#999">
          / ${targetAmount}
        </Text>
      </YStack>
    );
  };

  return (
    <YStack items="center" gap="$3" py="$4">
      {/* Circular Progress Chart */}
      <CircularProgress
        progress={progress}
        size={200}
        strokeWidth={12}
        progressColor="#FFAD31"
        backgroundColor="#E5E5E5"
        centerContent={<CenterContent />}
      />

      {/* Set Goal Button */}
      <Button
        bg="#FFAD31"
        color="white"
        fontWeight="bold"
        fontSize={14}
        px="$6"
        py="$2.5"
        rounded="$6"
        pressStyle={{ bg: '#FF9500' }}
        onPress={onSetGoal}
      >
        {hasGoal ? '更改目標' : '設定目標'}
      </Button>

      {/* Progress Text */}
      {hasGoal && (
        <YStack items="center" gap="$0.5">
          <Text fontSize={12} color="#666">
            目標進度
          </Text>
          <Text fontSize={16} fontWeight="bold" color="#333">
            {progress.toFixed(1)}%
          </Text>
        </YStack>
      )}
    </YStack>
  );
};

export default StatisticsChart;
