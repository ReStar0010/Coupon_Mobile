import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, H4, Input } from 'tamagui';
import { AlignJustify, Search, X } from 'lucide-react-native';
import LogoIcon from './LogoIcon';

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
      [onSearchChange],
    );

    const handleClearSearch = useCallback(() => {
      onSearchClear?.();
    }, [onSearchClear]);

    return (
      <YStack
        gap={10}
        style={{
          backgroundColor: 'white',
          paddingHorizontal: 15,
          paddingTop: topInset + 10,
          paddingBottom: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
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
              backgroundColor: '#f5f5f5',
              borderColor: '#e0e0e0',
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Search color="#a8a8a8" size={20} />
            <Input
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder={searchPlaceholder}
              style={{ flex: 1, fontSize: 16 }}
              unstyled
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} activeOpacity={0.7}>
                <X color="#a8a8a8" size={20} />
              </TouchableOpacity>
            )}
          </XStack>
        )}
      </YStack>
    );
  },
);

AppHeader.displayName = 'AppHeader';

export default AppHeader;
