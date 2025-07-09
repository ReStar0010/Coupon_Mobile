import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface DailyDrawBannerProps {
  onClick: () => void;
}

const DailyDrawBanner: React.FC<DailyDrawBannerProps> = ({ onClick }) => {
  return (
    <View className="w-full mb-4">
      <TouchableOpacity
        className="w-full bg-act-yellow rounded-xl p-4 shadow-md items-center justify-center"
        onPress={onClick}
        activeOpacity={0.7}
      >
        <Text className="text-xl font-bold mb-2 text-center">每日抽獎</Text>
        <Text className="text-sm text-center">點擊這裡抽取今日專屬優惠！</Text>
      </TouchableOpacity>
    </View>
  );
};

export default DailyDrawBanner;
