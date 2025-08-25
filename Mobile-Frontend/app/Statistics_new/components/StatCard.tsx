import React from 'react';
import { View, Text } from 'react-native';

interface StatCardProps {
  title: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <View className="h-[104px] flex-1 rounded-[10px] border border-bar-gray bg-login-bg p-[18px]">
      <View className="flex-1 justify-between">
        {/* Header */}
        <View className="gap-[5px]">
          <Text className="text-left text-[14px] font-normal leading-normal text-login-light-gray">
            {title}
          </Text>
        </View>

        {/* Value */}
        <View className="items-start justify-center" style={{ paddingRight: 35 }}>
          <Text className="text-[23px] font-bold leading-[35px] text-login-gray">
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default StatCard;
