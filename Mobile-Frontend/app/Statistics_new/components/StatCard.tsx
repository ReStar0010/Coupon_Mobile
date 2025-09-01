import React from 'react';
import { YStack, Text } from 'tamagui';

interface StatCardProps {
  title: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <YStack 
      height={104} 
      flex={1} 
      rounded="$3" 
      style={{ borderWidth: 1, borderColor: '#e0e0e0' }} 
      bg="#f5f5f5" 
      p="$4"
    >
      <YStack flex={1} style={{ justifyContent: 'space-between' }}>
        {/* Header */}
        <YStack gap="$1">
          <Text 
            style={{ textAlign: 'left' }} 
            fontSize={14} 
            fontWeight="normal" 
            color="#707070"
          >
            {title}
          </Text>
        </YStack>

        {/* Value */}
        <YStack items="flex-start" style={{ justifyContent: 'center', paddingRight: 35 }}>
          <Text fontSize={23} fontWeight="bold" lineHeight={35} color="#333333">
            {value}
          </Text>
        </YStack>
      </YStack>
    </YStack>
  );
};

export default StatCard;
