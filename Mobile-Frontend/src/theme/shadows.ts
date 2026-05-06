import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from './colors';

export interface NeoShadowProps {
  children: React.ReactNode;
  offset?: number;
  color?: string;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Returns the top/left offset values for the brutalist shadow backing view.
 * The shadow is a solid offset View — no blur, no opacity.
 */
export function brutalOffset(n: number): { top: number; left: number } {
  return { top: n, left: n };
}

/**
 * Neo-Brutalism shadow wrapper.
 * Renders a solid backing View offset by `offset` pts, then the children on top.
 */
export function NeoShadow({
  children,
  offset = 4,
  color = colors.border,
  borderRadius = 6,
  style,
}: NeoShadowProps): React.JSX.Element {
  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.shadow,
          {
            top: offset,
            left: offset,
            borderRadius,
            backgroundColor: color,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});
