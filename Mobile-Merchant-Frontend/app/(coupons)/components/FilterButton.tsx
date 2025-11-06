import React from 'react';
import { XStack, Text, YStack } from 'tamagui';
import { colors } from '@/constants/colors';
import { TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface FilterButtonProps {
  label: string;
  onPress: () => void;
}

export function FilterButton({ label, onPress }: FilterButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <XStack
        backgroundColor={colors.background}
        borderWidth={1}
        borderColor={colors.border}
        borderRadius="$4"
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        alignItems="center"
        gap="$2"
        minWidth={80}
      >
        <Text fontSize="$md" color={colors.textPrimary} fontWeight="500">
          {label}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.textSecondary} />
      </XStack>
    </TouchableOpacity>
  );
}

