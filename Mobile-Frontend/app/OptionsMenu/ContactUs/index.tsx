import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import UserInfoElement from '../../components/UserInfoElement';

const ContactUsPage: React.FC = () => {
  const router = useRouter();

  const onGoBackContainerClick = useCallback(() => {
    router.push('/OptionsMenu');
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="bg-bg-grey flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 35,
            paddingBottom: 28,
            paddingLeft: 4,
            paddingRight: 0,
            gap: 71,
            minHeight: '100%',
          }}>
          <View
            className="box-border flex max-w-full flex-col items-end justify-start self-stretch py-0 pl-0 pr-[31px]"
            style={{ gap: 35 }}>
            <View
              className="flex flex-col items-start justify-start self-stretch pb-[5px] pl-[27px] pr-0 pt-0"
              style={{ gap: 22 }}>
              {/* Back Button */}
              <TouchableOpacity
                className="flex flex-row items-start justify-start"
                style={{ gap: 9 }}
                onPress={onGoBackContainerClick}
                activeOpacity={0.7}>
                <View className="flex flex-col items-start justify-start pt-[4.5px]">
                  <Image
                    className="relative h-[15px] w-[15px] object-contain"
                    source={require('../../../assets/forward.png')}
                    style={{ width: 15, height: 15 }}
                  />
                </View>
                <Text
                  className="text-sec-black font-jost text-base"
                  style={{
                    letterSpacing: -0.01,
                    lineHeight: 24,
                    minWidth: 32,
                  }}>
                  返回
                </Text>
              </TouchableOpacity>

              {/* Title */}
              <View
                className="flex flex-col items-start justify-start self-stretch"
                style={{ gap: 29 }}>
                <Text
                  className="text-sec-black font-jost text-left text-[32px] font-bold"
                  style={{
                    letterSpacing: -0.01,
                    lineHeight: 48,
                    minWidth: 64,
                  }}>
                  聯絡我們
                </Text>
              </View>
            </View>

            {/* Contact Information Panel */}
            <View className="bg-bg-white ml-[27px] box-border flex max-w-full flex-row items-start justify-start self-stretch rounded-xl pb-[29px] pl-[30px] pr-[29px] pt-[31px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)]">
              <View className="flex flex-1 flex-col items-start justify-start" style={{ gap: 16 }}>
                <UserInfoElement title="Gmail" content="coupro707@gmail.com" className="" />

                {/* Additional contact methods can be added here */}
                <View className="self-stretch border-t border-gray-200 pt-4">
                  <Text
                    className="font-jost text-center text-sm text-gray-600"
                    style={{
                      lineHeight: 20,
                    }}>
                    我們會盡快回覆您的訊息
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default ContactUsPage;
