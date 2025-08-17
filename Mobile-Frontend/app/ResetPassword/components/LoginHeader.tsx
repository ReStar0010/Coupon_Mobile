import React from 'react';
import { View, Text } from 'react-native';

type props = {
  title?: string;
};


export const LoginHeader: React.FC<props> = ({title}) => {
  return (
    <View className="flex justify-between items-center">
      <Text 
        className="text-[30px] font-extrabold text-login-gray leading-[125%]"
        style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
      >
        {title}
      </Text>
    </View>
  );
};

export default LoginHeader;
