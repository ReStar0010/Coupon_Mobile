import React from 'react';
import { XStack, Text } from 'tamagui';
import { colors } from '@/constants/colors';
import { TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface AddButtonProps {
  onPress: () => void;
}

export function AddButton({ onPress }: AddButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <XStack
        backgroundColor={colors.primary}
        borderRadius="$4"
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        alignItems="center"
        gap="$1.5"
      >
        <Text fontSize="$md" color={colors.white} fontWeight="600">
          新增
        </Text>
        <MaterialIcons name="add" size={18} color={colors.white} />
      </XStack>
    </TouchableOpacity>
  );
}
