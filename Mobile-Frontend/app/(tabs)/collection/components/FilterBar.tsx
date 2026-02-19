import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '@/app/constants/theme';
import { FilterButton } from './FilterButton';

interface FilterBarProps {
  tagFilterLabel: string | null;
  expiryFilterLabel: string | null;
  merchantFilterLabel: string | null;
  onTagPress: () => void;
  onExpiryPress: () => void;
  onMerchantPress: () => void;
}

export function FilterBar({
  tagFilterLabel,
  expiryFilterLabel,
  merchantFilterLabel,
  onTagPress,
  onExpiryPress,
  onMerchantPress,
}: FilterBarProps) {
  return (
    <View style={styles.bar}>
      <FilterButton
        label="分類"
        selectedValue={tagFilterLabel}
        onPress={onTagPress}
      />
      <FilterButton
        label="有效期"
        selectedValue={expiryFilterLabel}
        onPress={onExpiryPress}
      />
      <FilterButton
        label="商家"
        selectedValue={merchantFilterLabel}
        onPress={onMerchantPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
});
