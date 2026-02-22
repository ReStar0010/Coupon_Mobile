import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { YStack, Text } from 'tamagui';

interface CircularProgressProps {
  progress: number; // Progress value from 0 to 100
  size?: number;
  strokeWidth?: number;
  progressColor?: string;
  backgroundColor?: string;
  centerContent?: React.ReactNode;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress = 0,
  size = 200,
  strokeWidth = 12,
  progressColor = '#FFAD31',
  backgroundColor = '#E5E5E5',
  centerContent,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <YStack items="center" style={{ position: 'relative' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <G>
          {/* Background Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Center Content */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        {centerContent}
      </View>
    </YStack>
  );
};

export default CircularProgress;
