import React, { useState, useMemo } from 'react';
import { Modal, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { YStack, XStack, Text, Input } from 'tamagui';
import { Search, X } from 'lucide-react-native';
import { COLORS, BORDER_RADIUS } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MerchantFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  merchants: string[];
  selectedMerchant: string | null;
  onSelectMerchant: (merchant: string | null) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function MerchantFilterSheet({
  isOpen,
  onClose,
  merchants,
  selectedMerchant,
  onSelectMerchant,
}: MerchantFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMerchants = useMemo(() => {
    if (!searchQuery.trim()) {
      return merchants;
    }
    const query = searchQuery.toLowerCase().trim();
    return merchants.filter((merchant) =>
      merchant.toLowerCase().includes(query)
    );
  }, [merchants, searchQuery]);

  const handleSelectMerchant = (merchant: string) => {
    if (selectedMerchant === merchant) {
      // 如果点击已选中的商家，则取消选择
      onSelectMerchant(null);
    } else {
      onSelectMerchant(merchant);
    }
    onClose();
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: BORDER_RADIUS.xl,
            borderTopRightRadius: BORDER_RADIUS.xl,
            maxHeight: SCREEN_HEIGHT * 0.8,
            paddingBottom: insets.bottom,
          }}
        >
          <YStack gap={16} padding={16}>
            {/* Header */}
            <XStack
              alignItems="center"
              justifyContent="space-between"
              paddingBottom={8}
            >
              <Text fontSize={20} fontWeight="bold" color={COLORS.text.primary}>
                選擇商家
              </Text>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
                <X size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </XStack>

            {/* Search Bar */}
            <XStack
              gap={12}
              style={{
                backgroundColor: COLORS.background,
                borderColor: COLORS.border,
                borderWidth: 1,
                borderRadius: BORDER_RADIUS.md,
                paddingHorizontal: 12,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Search color={COLORS.text.secondary} size={20} />
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="搜尋商家名稱..."
                style={{ flex: 1 }}
                unstyled
                fontSize={14}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
                  <X color={COLORS.text.secondary} size={18} />
                </TouchableOpacity>
              )}
            </XStack>

            {/* Merchant List */}
            <FlatList
              data={filteredMerchants}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = selectedMerchant === item;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelectMerchant(item)}
                    activeOpacity={0.7}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      backgroundColor: isSelected
                        ? COLORS.tag.background
                        : 'transparent',
                      borderRadius: BORDER_RADIUS.md,
                      marginBottom: 4,
                    }}
                  >
                    <XStack
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text
                        fontSize={16}
                        color={
                          isSelected
                            ? COLORS.primary
                            : COLORS.text.primary
                        }
                        fontWeight={isSelected ? '600' : '400'}
                      >
                        {item}
                      </Text>
                      {isSelected && (
                        <Text
                          fontSize={14}
                          color={COLORS.primary}
                          fontWeight="600"
                        >
                          ✓
                        </Text>
                      )}
                    </XStack>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <YStack
                  paddingVertical={40}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontSize={14}
                    color={COLORS.text.secondary}
                    textAlign="center"
                  >
                    {searchQuery
                      ? '找不到匹配的商家'
                      : '目前沒有商家'}
                  </Text>
                </YStack>
              }
              style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
              showsVerticalScrollIndicator={false}
            />
          </YStack>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
