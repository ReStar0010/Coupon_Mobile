import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface LoginButtonProps {
  title: string;
  onPress?: () => void;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ title, onPress }) => {
  return (
    <TouchableOpacity
      className="bg-blue-500 rounded-lg py-4 px-6 mb-6"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text className="text-white text-center text-base font-normal">
        {title}
      </Text>
    </TouchableOpacity>
  );
};
