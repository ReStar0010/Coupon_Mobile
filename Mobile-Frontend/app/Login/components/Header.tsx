import React from 'react';
import { View, Text } from 'react-native';
import { Logo } from './Logo';

export const Header: React.FC = () => {
  return (
    <View className="flex flex-col items-center">
      <View className="mb-4 flex flex-row items-center gap-4 md:mb-7 md:gap-8">
        <Logo />
        <Text className="text-6xl font-bold leading-tight md:text-6xl">
          <Text className="text-act-yellow font-bold">Cou</Text>
          <Text className="text-sec-black font-bold">Pro</Text>
        </Text>
      </View>
      <Text className="text-md text-sec-black mb-12 text-center font-bold leading-normal md:mb-24 md:text-base md:leading-7">
        All your coupons, right here, right now.
      </Text>
    </View>
  );
};
export default Header;
