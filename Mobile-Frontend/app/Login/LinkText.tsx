import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface LinkTextProps {
  normalText: string;
  linkText: string;
  onLinkPress?: () => void;
}

export const LinkText: React.FC<LinkTextProps> = ({
  normalText,
  linkText,
  onLinkPress,
}) => {
  return (
    <View className="flex justify-center items-center gap-[10px]">
      <View className="w-[146px]">
        <Text 
          className="text-center text-sm font-normal leading-normal"
          style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
        >
          <Text className="text-login-gray">
            {normalText}
          </Text>
          <Text 
            className="text-login-orange"
            onPress={onLinkPress}
            style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
          >
            {linkText}
          </Text>
        </Text>
      </View>
    </View>
  );
};
