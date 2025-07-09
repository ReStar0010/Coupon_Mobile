import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, Image, SafeAreaView, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import UserDataPanel from "./UserDataPanel";

const UserData: React.FC = () => {
  const router = useRouter();

  const onGoBackContainerClick = useCallback(() => {
    router.push("/OptionsMenu");
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-bg-grey">
        <ScrollView 
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingTop: 35,
            paddingBottom: 28,
            paddingLeft: 4,
            paddingRight: 0,
            gap: 71,
            minHeight: '100%'
          }}
        >
          <View className="self-stretch flex flex-col items-end justify-start py-0 pl-0 pr-[31px] box-border max-w-full" style={{ gap: 35 }}>
            <View className="self-stretch flex flex-col items-start justify-start pt-0 pb-[5px] pl-[27px] pr-0" style={{ gap: 22 }}>
              {/* Back Button */}
              <TouchableOpacity
                className="flex flex-row items-start justify-start"
                style={{ gap: 9 }}
                onPress={onGoBackContainerClick}
                activeOpacity={0.7}
              >
                <View className="flex flex-col items-start justify-start pt-[4.5px]">
                  <Image
                    className="w-[15px] h-[15px] relative object-contain"
                    source={require("../../../assets/forward.png")}
                    style={{ width: 15, height: 15 }}
                  />
                </View>
                <Text 
                  className="text-base text-sec-black font-jost"
                  style={{ 
                    letterSpacing: -0.01,
                    lineHeight: 24,
                    minWidth: 32
                  }}
                >
                  返回
                </Text>
              </TouchableOpacity>

              {/* Title Section */}
              <View className="self-stretch flex flex-col items-start justify-start" style={{ gap: 29 }}>
                <Text 
                  className="text-[32px] font-bold text-sec-black font-jost text-left"
                  style={{ 
                    letterSpacing: -0.01,
                    lineHeight: 48,
                    minWidth: 64
                  }}
                >
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