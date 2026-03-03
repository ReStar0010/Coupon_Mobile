import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import Navbar from './Navbar';
import SearchBar from './SearchBar';
import InfoPopup from './InfoPopup';

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
  searchQuery = '',
  onSearchChange,
  onClearSearch,
  navbarProps = {},
  sourcePage,
}) => {
  const router = useRouter();

  const onMenuIconClick = useCallback(async () => {
    // Store the current page path in AsyncStorage before navigating
    try {
      await AsyncStorage.setItem('optionsMenuSource', sourcePage);
    } catch (error) {
      console.error('Error storing options menu source:', error);
      Sentry.captureException(error, { data: { context: 'PageHeader.saveOptionsMenuSource' } });
    }
    router.push('/OptionsMenu');
  }, [router, sourcePage]);

  return (
    <View className="box-border flex max-w-full flex-row items-start justify-end self-stretch py-0 pl-5 pr-[17px]">
      <View className="flex max-w-full flex-1 flex-col items-start justify-start gap-[25px]">
        <View className="flex flex-col items-start justify-start gap-[17px] self-stretch">
          <View className="flex flex-row items-start justify-between gap-5 self-stretch">
            <View className="relative flex items-center">
              <Text className="font-jost text-sec-black relative m-0 text-[32px] font-bold leading-[150%] tracking-[-0.01em]">
                {title}
              </Text>
              {infoPopupTitle && infoPopupContent && (
                <InfoPopup title={infoPopupTitle}>{infoPopupContent}</InfoPopup>
              )}
            </View>

            <View className="flex flex-col items-start justify-start px-0 pb-0 pt-1">
              <TouchableOpacity onPress={onMenuIconClick} activeOpacity={0.7} className="h-10 w-10">
                <Image
                  className="relative h-10 w-10 object-cover"
                  style={{ width: 40, height: 40 }}
                  source={require('../../assets/menu.png')}
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
