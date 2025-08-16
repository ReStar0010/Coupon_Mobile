import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

interface Props {
  className?: string;
}

const OptionsLinkPanel: React.FC<Props> = ({ className = '' }) => {
  const router = useRouter();

  const onOptionsGridContainerClick = useCallback(() => {
    router.push('/OptionsMenu/CouponHistory');
  }, [router]);

  const onOptionsGridContainerClick1 = useCallback(() => {
    router.push('/OptionsMenu/ContactUs');
  }, [router]);

  const onOptionsTermsClick = useCallback(() => {
    router.push('/OptionsMenu/Terms');
  }, [router]);

  return (
    <View
      className={`box-border flex max-w-full flex-row items-start justify-start self-stretch pb-1.5 pl-[27px] pr-0 pt-0 ${className}`}>
      <View
        className="bg-bg-white box-border flex max-w-full flex-1 flex-col items-start justify-start rounded-xl py-[31px] pl-[25px] pr-[19px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]"
        style={{ gap: 21 }}>
        {/* Contact Us Option */}
        <TouchableOpacity
          className="flex flex-row items-start justify-between self-stretch"
          style={{ gap: 20 }}
          onPress={onOptionsGridContainerClick1}
          activeOpacity={0.7}>
          <View className="flex flex-row items-start justify-start" style={{ gap: 18 }}>
            <Image
              className="relative h-10 w-10 rounded-xl object-cover"
              source={require('../../assets/phone.png')}
              style={{ width: 40, height: 40 }}
            />
            <View className="flex flex-col items-start justify-start px-0 pb-0 pt-[5px]">
              <Text
                className="text-sec-black font-jost text-xl"
                style={{
                  letterSpacing: -0.01,
                  lineHeight: 30,
                  minWidth: 80,
                }}>
                聯絡我們
              </Text>
            </View>
          </View>
          <View className="flex flex-col items-start justify-start px-0 pb-0 pt-2.5">
            <Image
              className="relative h-5 w-5 object-cover"
              source={require('../../assets/forward-1.png')}
              style={{ width: 20, height: 20 }}
            />
          </View>
        </TouchableOpacity>

        {/* Separator */}
        <View className="flex flex-row items-start justify-start self-stretch px-[3px] py-0">
          <View className="bg-mid relative h-px flex-1" />
        </View>

        {/* Terms Option */}
        <TouchableOpacity
          className="flex flex-row items-start justify-between self-stretch"
          style={{ gap: 18 }}
          onPress={onOptionsTermsClick}
          activeOpacity={0.7}>
          <View className="flex flex-row items-start justify-start" style={{ gap: 18 }}>
            <Image
              className="relative h-10 w-10 rounded-xl object-cover"
              source={require('../../assets/document.png')}
              style={{ width: 40, height: 40 }}
            />
            <View className="flex flex-col items-start justify-start px-0 pb-0 pt-[5px]">
              <Text
                className="text-sec-black font-jost text-xl"
                style={{
                  letterSpacing: -0.01,
                  lineHeight: 30,
                  minWidth: 80,
                }}>
                權益須知
              </Text>
            </View>
          </View>
          <View className="flex flex-col items-start justify-start px-0 pb-0 pt-2.5">
            <Image
              className="relative h-5 w-5 object-cover"
              source={require('../../assets/forward-1.png')}
              style={{ width: 20, height: 20 }}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OptionsLinkPanel;
