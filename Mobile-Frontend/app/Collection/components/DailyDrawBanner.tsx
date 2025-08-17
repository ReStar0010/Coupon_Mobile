import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface DailyDrawBannerProps {
  onClick: () => void;
}

const DailyDrawBanner: React.FC<DailyDrawBannerProps> = ({ onClick }) => {
  return (
    <View className="mb-4 w-full">
      <TouchableOpacity
        className="bg-act-yellow w-full items-center justify-center rounded-xl p-4 shadow-md"
        onPress={onClick}
        activeOpacity={0.7}>
        <Text className="mb-2 text-center text-xl font-bold">每日抽獎</Text>
        <Text className="text-center text-sm">點擊這裡抽取今日專屬優惠！</Text>
      </TouchableOpacity>
    </View>
  );
};

export default DailyDrawBanner;
