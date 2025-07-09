import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, Image, SafeAreaView, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import TextPanel from "./TextPanel";

const Terms: React.FC = () => {
  const router = useRouter();

  const onClickBack = useCallback(() => {
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
            paddingHorizontal: 31,
            paddingBottom: 44,
            gap: 29,
            minHeight: '100%'
          }}
        >
          <View className="flex flex-col items-start justify-start" style={{ gap: 22 }}>
            {/* Back Button */}
            <TouchableOpacity
              className="flex flex-row items-start justify-start"
              style={{ gap: 9 }}
              onPress={onClickBack}
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

            {/* Title */}
            <Text 
              className="text-[32px] font-bold text-sec-black font-jost text-left"
              style={{ 
                letterSpacing: -0.01,
                lineHeight: 48,
                minWidth: 127
              }}
            >
              權益須知
            </Text>
          </View>

          {/* Content Panel */}
          <TextPanel />
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default Terms;