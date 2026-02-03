import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, H4, Input } from 'tamagui';
import { AlignJustify, Search, X } from 'lucide-react-native';
import LogoIcon from './LogoIcon';
import { SHADOWS } from '../../constants/theme';

interface AppHeaderProps {
  title: string;
  showSearch?: boolean;
  searchQuery?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onSearchClear?: () => void;
  topInset: number;
}

const AppHeader: React.FC<AppHeaderProps> = React.memo(
  ({
    title,
    showSearch = false,
    searchQuery = '',
    searchPlaceholder = '搜尋優惠券...',
    onSearchChange,
    onSearchClear,
    topInset,
  }) => {
    const router = useRouter();

    const handleMenuPress = useCallback(() => {
      router.push('/options-menu');
    }, [router]);

    const handleSearchChange = useCallback(
      (value: string) => {
        onSearchChange?.(value);
      },
      [onSearchChange]
    );

    const handleClearSearch = useCallback(() => {
      onSearchClear?.();
    }, [onSearchClear]);

    return (
      <YStack
        gap={15}
        style={{
          backgroundColor: 'white',
          paddingHorizontal: 15,
          paddingTop: topInset + 10,
          paddingBottom: 10,
          ...SHADOWS.large,
        }}
      >
        <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <XStack gap={13} style={{ alignItems: 'center' }}>
            <LogoIcon />
            <H4 color="#000000" fontSize={24} fontWeight="bold">
              {title}
            </H4>
          </XStack>

          <TouchableOpacity onPress={handleMenuPress} activeOpacity={0.7}>
            <AlignJustify color="black" />
          </TouchableOpacity>
        </XStack>

        {showSearch && (
          <XStack
            gap={12}
            style={{
              backgroundColor: 'white',
              borderColor: '#a8a8a8',
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              alignItems: 'center',
            }}
          >
            <Search color="#a8a8a8" />
            <Input
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder={searchPlaceholder}
              style={{ flex: 1 }}
              unstyled
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} activeOpacity={0.7}>
                <X color="#a8a8a8" />
              </TouchableOpacity>
            )}
          </XStack>
        )}
      </YStack>
    );
  }
);

AppHeader.displayName = 'AppHeader';

export default AppHeader;
