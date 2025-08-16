import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import UserDataPanel from './UserDataPanel';

const UserData: React.FC = () => {
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

              {/* Title Section */}
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
                  用戶資料
                </Text>
              </View>
            </View>

            {/* User Data Panel */}
            <UserDataPanel />
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default UserData;
