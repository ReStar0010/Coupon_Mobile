import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface ToggleSwitchProps {
  value: boolean;
  onToggle: (newValue: boolean) => void;
}

export default function ToggleSwitch({
  value,
  onToggle,
}: ToggleSwitchProps): React.JSX.Element {
  return (
    <Pressable
      testID="toggle-switch"
      onPress={() => onToggle(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[
        styles.track,
        {
          backgroundColor: value ? colors.yellow : colors.subtle,
        },
      ]}
    >
      <View
        style={[
          styles.thumb,
          value ? styles.thumbOn : styles.thumbOff,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
    flexShrink: 0,
  },
  thumb: {
    position: 'absolute',
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.fg,
  },
  thumbOn: {
    left: 18,
  },
  thumbOff: {
    left: 2,
  },
});
