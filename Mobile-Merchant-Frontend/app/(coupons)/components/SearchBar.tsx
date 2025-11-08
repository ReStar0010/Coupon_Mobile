import React from 'react';
import { XStack } from 'tamagui';
import { colors } from '@/constants/colors';
import { TextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = '搜尋...' }: SearchBarProps) {
  return (
    <XStack
      alignItems="center"
      backgroundColor={colors.background}
      borderWidth={1}
      borderColor={colors.border}
      borderRadius="$4"
      paddingHorizontal="$3"
      height={44}
      gap="$2"
    >
      <MaterialIcons name="search" size={20} color={colors.textSecondary} />
      <TextInput
        style={{
          flex: 1,
          fontSize: 16,
          color: colors.textPrimary,
          padding: 0,
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
      />
    </XStack>
  );
}

