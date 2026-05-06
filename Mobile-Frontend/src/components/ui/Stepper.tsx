import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (newValue: number) => void;
  label?: string;
  accent?: boolean;
}

export default function Stepper({
  value,
  min = 1,
  max = 5,
  onChange,
  label,
  accent = false,
}: StepperProps): React.JSX.Element {
  const canDecrement = value > min;
  const canIncrement = value < max;

  const handleDecrement = () => {
    if (canDecrement) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (canIncrement) {
      onChange(value + 1);
    }
  };

  return (
    <View style={styles.container}>
      {label !== undefined && (
        <Text style={styles.label}>{label}</Text>
      )}
      <View style={styles.row}>
        <View style={styles.btnWrapper}>
          {canDecrement && (
            <View
              style={[
                styles.btnShadow,
                styles.btnShadowActive,
              ]}
            />
          )}
          <Pressable
            testID="stepper-decrement"
            onPress={handleDecrement}
            disabled={!canDecrement}
            accessibilityRole="button"
            accessibilityLabel="Decrease"
            style={[
              styles.btn,
              canDecrement ? styles.btnActive : styles.btnDisabled,
            ]}
          >
            <Text
              style={[
                styles.btnText,
                { color: canDecrement ? colors.fg : colors.muted },
              ]}
            >
              −
            </Text>
          </Pressable>
        </View>

        <Text style={styles.value}>{value}</Text>

        <View style={styles.btnWrapper}>
          {canIncrement && (
            <View
              style={[
                styles.btnShadow,
                accent ? styles.btnShadowAccent : styles.btnShadowActive,
              ]}
            />
          )}
          <Pressable
            testID="stepper-increment"
            onPress={handleIncrement}
            disabled={!canIncrement}
            accessibilityRole="button"
            accessibilityLabel="Increase"
            style={[
              styles.btn,
              canIncrement
                ? accent
                  ? styles.btnAccent
                  : styles.btnPrimary
                : styles.btnDisabled,
            ]}
          >
            <Text
              style={[
                styles.btnText,
                {
                  color: canIncrement
                    ? accent
                      ? '#FFFFFF'
                      : colors.fg
                    : colors.muted,
                },
              ]}
            >
              +
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontFamily: fontFamilies.monoRegular,
    letterSpacing: 1.5,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
    fontFamily: fontFamilies.monoSemiBold,
    color: colors.fg,
  },
  btnWrapper: {
    position: 'relative',
  },
  btnShadow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 4,
    top: 2,
    left: 2,
  },
  btnShadowActive: {
    backgroundColor: colors.border,
  },
  btnShadowAccent: {
    backgroundColor: colors.purple,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  btnPrimary: {
    backgroundColor: colors.yellow,
    borderColor: colors.border,
  },
  btnAccent: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  btnDisabled: {
    backgroundColor: 'transparent',
    borderColor: colors.subtle,
  },
  btnText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
});
