import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface LinkTextProps {
  normalText: string;
  linkText: string;
  onLinkPress?: () => void;
  normalTextColor?: string;
}

export const LinkText: React.FC<LinkTextProps> = ({
  normalText,
  linkText,
  onLinkPress,
  normalTextColor = 'text-gray-700',
}) => {
  return (
    <View className="mb-4">
      <TouchableOpacity onPress={onLinkPress} activeOpacity={0.7}>
        <Text className={`text-base ${normalTextColor}`}>
          {normalText}{' '}
          <Text style={{ color: 'rgba(255,173,49,1)' }}>
            {linkText}
          </Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};
