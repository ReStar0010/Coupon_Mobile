import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface NeoCardProps {
  children: React.ReactNode;
  shadowOffset?: number;
  style?: ViewStyle;
  backgroundColor?: string;
  borderRadius?: number;
}

export default function NeoCard({
  children,
  shadowOffset = 4,
  style,
  backgroundColor = colors.card,
  borderRadius = 8,
}: NeoCardProps): React.JSX.Element {
  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.shadowBacking,
          {
            top: shadowOffset,
            left: shadowOffset,
            borderRadius,
            backgroundColor: colors.border,
          },
        ]}
      />
      <View
        style={[
          styles.card,
          {
            backgroundColor,
            borderRadius,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadowBacking: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  card: {
    borderWidth: 3,
    borderColor: colors.border,
  },
});
