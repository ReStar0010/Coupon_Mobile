import React from 'react';
import { YStack, Text, Card } from 'tamagui';

interface StatCardProps {
  title: string;
  value: string;
  /** 為 true 時強制 value 單行顯示不換行（如日期） */
  valueSingleLine?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, valueSingleLine = false }) => {
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
          fontSize={15} 
          fontWeight="500" 
          color="#666666"
          lineHeight={22}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={2}
        >
          {title}
        </Text>

        {/* Value */}
        <YStack style={{ justifyContent: 'center', alignItems: 'flex-start' }} flex={1}>
          <Text 
            fontSize={valueSingleLine ? 22 : 26} 
            fontWeight="700" 
            color="#1a1a1a"
            lineHeight={valueSingleLine ? 28 : 34}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            numberOfLines={valueSingleLine ? 1 : 2}
          >
            {value}
          </Text>
        </YStack>
      </YStack>
    </Card>
  );
};

export default StatCard;
