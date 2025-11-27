import React from 'react';
import { XStack, Text, YStack } from 'tamagui';
import { colors } from '@/constants/colors';
import { TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface FilterButtonProps {
  label: string;
  selectedValue?: string | null;
  onPress: () => void;
}

export function FilterButton({ label, selectedValue, onPress }: FilterButtonProps) {
  const displayText = selectedValue || label;
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <XStack
        backgroundColor={selectedValue ? colors.primary : colors.background}
        borderWidth={1}
        borderColor={selectedValue ? colors.primary : colors.border}
        borderRadius="$4"
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        alignItems="center"
        gap="$2"
        minWidth={80}
      >
        <Text 
          fontSize="$md" 
          color={selectedValue ? colors.white : colors.textPrimary} 
          fontWeight="500"
        >
          {displayText}
        </Text>
        <MaterialIcons 
          name="keyboard-arrow-down" 
          size={16} 
          color={selectedValue ? colors.white : colors.textSecondary} 
        />
      </XStack>
    </TouchableOpacity>
  );
}

