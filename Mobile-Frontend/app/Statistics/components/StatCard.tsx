import React from 'react';
import { YStack, Text, Card } from 'tamagui';

interface StatCardProps {
  title: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <Card
      flex={1}
      padding="$5"
      backgroundColor="white"
      borderRadius="$6"
      borderWidth={1}
      borderColor="#e5e5e5"
      shadowColor="black"
      shadowRadius={8}
      shadowOffset={{ width: 0, height: 2 }}
      shadowOpacity={0.08}
      elevation={3}
      height={140}
    >
      <YStack flex={1} style={{ justifyContent: 'space-between' }}>
        {/* Title */}
        <Text 
          fontSize={16} 
          fontWeight="500" 
          color="#666666"
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={2}
        >
          {title}
        </Text>

        {/* Value */}
        <YStack style={{ justifyContent: 'center', alignItems: 'flex-start' }}>
          <Text 
            fontSize={32} 
            fontWeight="800" 
            color="#1a1a1a"
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            numberOfLines={1}
          >
            {value}
          </Text>
        </YStack>
      </YStack>
    </Card>
  );
};

export default StatCard;
