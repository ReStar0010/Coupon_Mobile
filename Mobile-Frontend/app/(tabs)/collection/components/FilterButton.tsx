import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/app/constants/theme';

interface FilterButtonProps {
  label: string;
  selectedValue?: string | null;
  onPress: () => void;
}

export function FilterButton({ label, selectedValue, onPress }: FilterButtonProps) {
  const displayText = selectedValue ?? label;
  const isSelected = !!selectedValue;

  const containerStyle: ViewStyle[] = [
    styles.container,
    isSelected ? styles.containerSelected : styles.containerDefault,
  ];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={containerStyle}>
        <Text
          style={[styles.label, isSelected ? styles.labelSelected : styles.labelDefault]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <ChevronDown size={16} color={isSelected ? COLORS.white : COLORS.text.secondary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 80,
  },
  containerDefault: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  containerSelected: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  labelDefault: {
    color: COLORS.text.primary,
  },
  labelSelected: {
    color: COLORS.white,
  },
});
