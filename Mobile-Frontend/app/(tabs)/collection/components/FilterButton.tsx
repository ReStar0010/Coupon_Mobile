import React from 'react';
import { XStack, Text } from 'tamagui';
import { TouchableOpacity } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/app/constants/theme';

interface FilterButtonProps {
  label: string;
  selectedValue?: string | null;
  onPress: () => void;
}

export function FilterButton({ label, selectedValue, onPress }: FilterButtonProps) {
  const displayText = selectedValue || label;
  const isSelected = !!selectedValue;
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <XStack
        backgroundColor={isSelected ? COLORS.primary : COLORS.white}
        borderWidth={1}
        borderColor={isSelected ? COLORS.primary : COLORS.border}
        borderRadius={12}
        paddingHorizontal={12}
        paddingVertical={10}
        alignItems="center"
        gap={8}
        minWidth={80}
      >
        <Text 
          fontSize={14} 
          color={isSelected ? COLORS.white : COLORS.text.primary} 
          fontWeight="500"
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <ChevronDown 
          size={16} 
          color={isSelected ? COLORS.white : COLORS.text.secondary} 
        />
      </XStack>
    </TouchableOpacity>
  );
}
