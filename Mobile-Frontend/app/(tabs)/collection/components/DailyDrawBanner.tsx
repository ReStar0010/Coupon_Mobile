import React from 'react';
import { YStack, Text, Card } from 'tamagui';

interface DailyDrawBannerProps {
  onClick: () => void;
}

const DailyDrawBanner: React.FC<DailyDrawBannerProps> = ({ onClick }) => {
  return (
    <YStack width="100%">
      <Card
        elevate
        bordered
        borderRadius="$5"
        padding="$4"
        onPress={onClick}
        pressStyle={{ opacity: 0.9 }}
        borderColor="#f8f8f8"
        borderWidth={1}
        backgroundColor="#FFAD31"
      >
        <YStack alignItems="center" justifyContent="center" gap={8}>
          <Text 
            textAlign="center" 
            fontSize={24} 
            fontWeight="700"
            color="#000000"
          >
            每日抽獎
          </Text>
          <Text 
            textAlign="center" 
            color="#000000"
          >
            點擊這裡抽取今日專屬優惠！
          </Text>
        </YStack>
      </Card>
    </YStack>
  );
};

export default DailyDrawBanner;
