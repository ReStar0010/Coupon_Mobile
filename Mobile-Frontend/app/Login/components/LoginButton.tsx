import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface LoginButtonProps {
  title: string;
  onPress?: () => void;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ title, onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex h-[41px] px-[9px] justify-center items-center bg-login-orange rounded-[9px] active:opacity-90"
      activeOpacity={0.9}
    >
      <Text 
        className="text-base font-normal text-login-gray text-center"
        style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};