import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";

interface Props {
  className?: string;
}

const OptionsLinkPanel: React.FC<Props> = ({ className = "" }) => {
  const router = useRouter();

  const onOptionsGridContainerClick = useCallback(() => {
    router.push("/OptionsMenu/CouponHistory");
  }, [router]);

  const onOptionsGridContainerClick1 = useCallback(() => {
    router.push("/OptionsMenu/ContactUs");
  }, [router]);

  const onOptionsTermsClick = useCallback(() => {
    router.push("/OptionsMenu/Terms");
  }, [router]);

  return (
    <View className={`self-stretch flex flex-row items-start justify-start pt-0 pb-1.5 pl-[27px] pr-0 box-border max-w-full ${className}`}>
      <View className="flex-1 shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-col items-start justify-start py-[31px] pl-[25px] pr-[19px] box-border max-w-full" style={{ gap: 21 }}>
        
        {/* Contact Us Option */}
        <TouchableOpacity
          className="self-stretch flex flex-row items-start justify-between"
          style={{ gap: 20 }}
          onPress={onOptionsGridContainerClick1}
          activeOpacity={0.7}
        >
          <View className="flex flex-row items-start justify-start" style={{ gap: 18 }}>
            <Image
              className="h-10 w-10 relative rounded-xl object-cover"
              source={require("../../assets/phone.png")}
              style={{ width: 40, height: 40 }}
            />
            <View className="flex flex-col items-start justify-start pt-[5px] px-0 pb-0">
              <Text 
                className="text-xl text-sec-black font-jost"
                style={{ 
                  letterSpacing: -0.01,
                  lineHeight: 30,
                  minWidth: 80
                }}
              >
                聯絡我們
              </Text>
            </View>
          </View>
          <View className="flex flex-col items-start justify-start pt-2.5 px-0 pb-0">
            <Image
              className="w-5 h-5 relative object-cover"
              source={require("../../assets/forward-1.png")}
              style={{ width: 20, height: 20 }}
            />
          </View>
        </TouchableOpacity>

        {/* Separator */}
        <View className="self-stretch flex flex-row items-start justify-start py-0 px-[3px]">
          <View className="h-px flex-1 relative bg-mid" />
        </View>

        {/* Terms Option */}
        <TouchableOpacity
          className="self-stretch flex flex-row items-start justify-between"
          style={{ gap: 18 }}
          onPress={onOptionsTermsClick}
          activeOpacity={0.7}
        >
          <View className="flex flex-row items-start justify-start" style={{ gap: 18 }}>
            <Image
              className="h-10 w-10 relative rounded-xl object-cover"
              source={require("../../assets/document.png")}
              style={{ width: 40, height: 40 }}
            />
            <View className="flex flex-col items-start justify-start pt-[5px] px-0 pb-0">
              <Text 
                className="text-xl text-sec-black font-jost"
                style={{ 
                  letterSpacing: -0.01,
                  lineHeight: 30,
                  minWidth: 80
                }}
              >
                權益須知
              </Text>
            </View>
          </View>
          <View className="flex flex-col items-start justify-start pt-2.5 px-0 pb-0">
            <Image
              className="w-5 h-5 relative object-cover"
              source={require("../../assets/forward-1.png")}
              style={{ width: 20, height: 20 }}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OptionsLinkPanel;
