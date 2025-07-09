import React from "react";
import { View, Text } from "react-native";
import { Logo } from "./Logo";

export const Header: React.FC = () => {
  return (
    <View className="flex flex-col items-center">
      <View className="flex flex-row gap-4 md:gap-8 items-center mb-4 md:mb-7">
        <Logo />
        <Text className="text-6xl md:text-6xl font-bold leading-tight">
          <Text className="text-act-yellow font-bold">Cou</Text>
          <Text className="text-sec-black font-bold">Pro</Text>
        </Text>
      </View>
      <Text className="mb-12 md:mb-24 text-md md:text-base font-bold leading-normal md:leading-7 text-center text-sec-black">
        All your coupons, right here, right now.
      </Text>
    </View>
  );
};
export default Header;