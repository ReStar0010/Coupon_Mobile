import React from 'react';
import { View, Text } from 'react-native';

export const LoginHeader: React.FC = () => {
  return (
    <View className="flex justify-between items-center">
      <Text 
        className="text-[30px] font-extrabold text-login-gray leading-[125%]"
        style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
      >
        登入
      </Text>
    </View>
  );
};

export default LoginHeader;
