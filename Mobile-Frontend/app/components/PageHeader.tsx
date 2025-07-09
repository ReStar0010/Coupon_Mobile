import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Navbar from "./Navbar";
import SearchBar from "./SearchBar";
import InfoPopup from "./InfoPopup";

interface PageHeaderProps {
  title: string;
  infoPopupTitle?: string;
  infoPopupContent?: React.ReactNode;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  onClearSearch?: () => void;
  navbarProps?: {
    atCollection?: boolean;
    atEasyUse?: boolean;
    atStatistics?: boolean;
  };
  sourcePage: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  infoPopupTitle,
  infoPopupContent,
  showSearch = false,
  searchQuery = "",
  onSearchChange,
  onClearSearch,
  navbarProps = {},
  sourcePage,
}) => {
  const router = useRouter();

  const onMenuIconClick = useCallback(async () => {
    // Store the current page path in AsyncStorage before navigating
    try {
      await AsyncStorage.setItem("optionsMenuSource", sourcePage);
    } catch (error) {
      console.error("Error storing options menu source:", error);
    }
    router.push("/OptionsMenu");
  }, [router, sourcePage]);

  return (
    <View className="self-stretch flex flex-row items-start justify-end py-0 pl-5 pr-[17px] box-border max-w-full">
      <View className="flex-1 flex flex-col items-start justify-start gap-[25px] max-w-full">
        <View className="self-stretch flex flex-col items-start justify-start gap-[17px]">
          <View className="self-stretch flex flex-row items-start justify-between gap-5">
            <View className="flex items-center relative">
              <Text className="text-[32px] m-0 relative tracking-[-0.01em] leading-[150%] font-bold font-jost text-sec-black">
                {title}
              </Text>
              {infoPopupTitle && infoPopupContent && (
                <InfoPopup title={infoPopupTitle}>{infoPopupContent}</InfoPopup>
              )}
            </View>

            <View className="flex flex-col items-start justify-start pt-1 px-0 pb-0">
              <TouchableOpacity
                onPress={onMenuIconClick}
                activeOpacity={0.7}
                className="w-10 h-10"
              >
                <Image
                  className="w-10 h-10 relative object-cover"
                  style={{ width: 40, height: 40 }}
                  source={require("../../assets/menu.png")}
                />
              </TouchableOpacity>
            </View>
          </View>
          <Navbar {...navbarProps} />
        </View>

        {showSearch && onSearchChange && onClearSearch && (
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange} // 直接傳遞文字，不是事件物件
            onClear={onClearSearch}
          />
        )}
      </View>
    </View>
  );
};

export default PageHeader;
