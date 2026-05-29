import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface NeoButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<
  ButtonVariant,
  { bg: string; textColor: string; hasShadow: boolean }
> = {
  primary: { bg: colors.yellow, textColor: colors.fg, hasShadow: true },
  secondary: { bg: colors.card, textColor: colors.fg, hasShadow: true },
  danger: { bg: colors.red, textColor: '#FFFFFF', hasShadow: true },
  ghost: { bg: 'transparent', textColor: colors.fg, hasShadow: false },
};

export default function NeoButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  fullWidth = false,
}: NeoButtonProps): React.JSX.Element {
  const [pressed, setPressed] = useState(false);
  const { bg, textColor, hasShadow } = VARIANT_STYLES[variant];
  const offset = hasShadow && !pressed && !disabled ? 4 : 0;

  return (
    <View
      style={[
        styles.wrapper,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {hasShadow && (
        <View
          style={[
            styles.shadowBacking,
            {
              top: offset,
              left: offset,
              backgroundColor: disabled ? colors.muted : colors.border,
            },
          ]}
        />
      )}
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={() => !disabled && setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        // Propagate disabled to a11y. Without this, react-native-web emits
        // a `<button>` with no `aria-disabled`, so screen readers and
        // Playwright's `toBeDisabled()` matcher both incorrectly treat
        // the button as enabled. The on-press no-op above prevents
        // actual activation, but the surface signal needs to match.
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[
          styles.button,
          {
            backgroundColor: disabled ? colors.subtle : bg,
            borderColor: disabled ? colors.muted : colors.border,
            borderStyle: variant === 'ghost' ? 'solid' : 'solid',
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: disabled ? colors.muted : textColor,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  shadowBacking: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 2.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
