import React, { useState, useMemo } from 'react';
import { Modal, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { X } from 'lucide-react-native';
import { COLORS, BORDER_RADIUS } from '@/app/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tag } from '@/app/_Collection/hooks/useTags';

interface TagFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  selectedTags: string[];
  onSelectTags: (tags: string[]) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function TagFilterSheet({
  isOpen,
  onClose,
  tags,
  selectedTags,
  onSelectTags,
}: TagFilterSheetProps) {
  const insets = useSafeAreaInsets();

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onSelectTags(selectedTags.filter((t) => t !== tagName));
    } else {
      onSelectTags([...selectedTags, tagName]);
    }
  };

  const handleClearAll = () => {
    onSelectTags([]);
  };

  const handleConfirm = () => {
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
        activeOpacity={1}
        onPress={onClose}
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
                選擇分類標籤
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <X size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </XStack>

            {/* Selected count */}
            {selectedTags.length > 0 && (
              <XStack
                alignItems="center"
                justifyContent="space-between"
                paddingVertical={8}
              >
                <Text fontSize={14} color={COLORS.text.secondary}>
                  已選擇 {selectedTags.length} 個標籤
                </Text>
                <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
                  <Text
                    fontSize={14}
                    color={COLORS.primary}
                    fontWeight="600"
                  >
                    清除全部
                  </Text>
                </TouchableOpacity>
              </XStack>
            )}

            {/* Tag List */}
            <FlatList
              data={tags}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedTags.includes(item.name);
                return (
                  <TouchableOpacity
                    onPress={() => toggleTag(item.name)}
                    activeOpacity={0.7}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      backgroundColor: isSelected
                        ? COLORS.tag.background
                        : 'transparent',
                      borderRadius: BORDER_RADIUS.md,
                      marginBottom: 4,
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: COLORS.primary,
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
                        {item.display_name}
                      </Text>
                      {isSelected && (
                        <Text
                          fontSize={18}
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
                    目前沒有標籤
                  </Text>
                </YStack>
              }
              style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
              showsVerticalScrollIndicator={false}
            />

            {/* Confirm Button */}
            <TouchableOpacity
              onPress={handleConfirm}
              activeOpacity={0.8}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: BORDER_RADIUS.md,
                paddingVertical: 14,
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Text
                fontSize={16}
                color={COLORS.white}
                fontWeight="600"
              >
                完成
              </Text>
            </TouchableOpacity>
          </YStack>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
