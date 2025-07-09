import React, { useCallback, useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  SafeAreaView, 
  ScrollView, 
  Alert,
  Linking
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout } from "../utils/authAPI";
import OptionsLinkPanel from "./OptionsLinkPanel";

const OptionsMenu: React.FC = () => {
  const router = useRouter();
  const [sourcePage, setSourcePage] = useState<string>("/EasyUse");

  // Detect the source page when the component mounts
  useEffect(() => {
    const getSourcePage = async () => {
      try {
        const storedSourcePage = await AsyncStorage.getItem("optionsMenuSource");
        if (storedSourcePage) {
          setSourcePage(storedSourcePage);
        } else {
          setSourcePage("/EasyUse");
        }
      } catch (error) {
        console.error("Error getting source page:", error);
        setSourcePage("/EasyUse");
      }
    };

    getSourcePage();
  }, []);

  const onUserDataContainerClick = useCallback(() => {
    router.push("/OptionsMenu/UserData");
  }, [router]);

  const onClickBack = useCallback(() => {
    router.push(sourcePage);
  }, [router, sourcePage]);

  // 登出功能 - 使用 AsyncStorage 方式
  const handleLogout = async () => {
    Alert.alert(
      "確認登出",
      "您確定要登出嗎？",
      [
        {
          text: "取消",
          style: "cancel"
        },
        {
          text: "登出",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error("登出失敗:", error);
              // 即使 API 請求失敗，也清除前端狀態並重定向
              try {
                await AsyncStorage.multiRemove([
                  "auth_token",
                  "user_id", 
                  "is_logged_in",
                  "user_info"
                ]);
              } catch (storageError) {
                console.error("清除儲存失敗:", storageError);
              }
              router.replace("/Login");
            }
          }
        }
      ]
    );
  };

  const handleIconsLinkPress = useCallback(async () => {
    try {
      await Linking.openURL("https://icons8.com/");
    } catch (error) {
      console.error("無法開啟連結:", error);
    }
  }, []);

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
            paddingHorizontal: 4,
            justifyContent: 'space-between',
            minHeight: '100%'
          }}
        >
          <View className="flex-1">
            <View className="flex flex-col items-end justify-start pr-[31px]" style={{ gap: 35 }}>
              <View className="self-stretch flex flex-col items-start justify-start pb-[5px] pl-[27px]" style={{ gap: 22 }}>
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
                      source={require("../../assets/forward.png")}
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

                {/* Title and User Data Section */}
                <View className="self-stretch flex flex-col items-start justify-start" style={{ gap: 29 }}>
                  <Text 
                    className="text-[32px] font-bold text-sec-black font-jost"
                    style={{ 
                      letterSpacing: -0.01,
                      lineHeight: 48,
                      minWidth: 64
                    }}
                  >
                    選單
                  </Text>
                  
                  {/* User Data Container */}
                  <TouchableOpacity
                    className="self-stretch shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-col items-end justify-center py-7 pl-[25px] pr-4"
                    onPress={onUserDataContainerClick}
                    activeOpacity={0.7}
                  >
                    <View className="self-stretch flex flex-row items-center justify-between pr-[3px]" style={{ gap: 20 }}>
                      <View className="flex flex-row items-center justify-start" style={{ gap: 18 }}>
                        <Image
                          className="h-10 w-10 relative object-cover"
                          source={require("../../assets/user.png")}
                          style={{ width: 40, height: 40 }}
                        />
                        <Text 
                          className="text-xl text-sec-black font-jost"
                          style={{ 
                            letterSpacing: -0.01,
                            lineHeight: 30,
                            minWidth: 80
                          }}
                        >
                          用戶資料
                        </Text>
                      </View>
                      <Image
                        className="h-5 w-5 relative object-cover"
                        source={require("../../assets/forward-1.png")}
                        style={{ width: 20, height: 20 }}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Options Link Panel */}
              <OptionsLinkPanel />

              {/* Logout Button */}
              <TouchableOpacity
                className="self-stretch ml-[27px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-start justify-start py-[15px] px-[25px] box-border max-w-full"
                style={{ gap: 43 }}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Image
                  className="h-10 w-10 relative object-cover"
                  source={require("../../assets/logout.png")}
                  style={{ width: 40, height: 40 }}
                />
                <View className="flex flex-col items-start justify-start pt-[5px]">
                  <Text 
                    className="text-xl text-tomato font-jost"
                    style={{ 
                      letterSpacing: -0.01,
                      lineHeight: 30,
                      minWidth: 40
                    }}
                  >
                    登出
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View className="self-stretch flex flex-row items-start justify-center py-0 pl-5 pr-[23px]">
            <View className="w-[134px] flex flex-col items-center">
              <Text 
                className="text-xs text-sec-black font-jost text-center"
                style={{ 
                  letterSpacing: -0.01,
                  lineHeight: 18
                }}
              >
                Version 1.0.0
              </Text>
              <View className="flex flex-row items-center">
                <Text 
                  className="text-xs text-sec-black font-jost"
                  style={{ 
                    letterSpacing: -0.01,
                    lineHeight: 18
                  }}
                >
                  Icons by{' '}
                </Text>
                <TouchableOpacity onPress={handleIconsLinkPress}>
                  <Text 
                    className="text-xs text-sec-black font-jost underline"
                    style={{ 
                      letterSpacing: -0.01,
                      lineHeight: 18
                    }}
                  >
                    icons8
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default OptionsMenu;
