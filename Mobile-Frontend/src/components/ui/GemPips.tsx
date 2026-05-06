import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface GemPipsProps {
  count: number;
  filled: number;
}

const PIP_COLORS = ['#555555', '#555555', colors.yellow, '#CC8800', '#FF6135', colors.purple];

export default function GemPips({ count, filled }: GemPipsProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>CHARGE</Text>
      <View style={styles.pips}>
        {Array.from({ length: count }).map((_, i) => {
          const isActive = i < filled;
          const pipColor = PIP_COLORS[Math.min(i + 1, PIP_COLORS.length - 1)];
          return (
            <View
              key={i}
              testID={isActive ? 'gem-pip-filled' : 'gem-pip-empty'}
              style={[
                styles.pip,
                isActive
                  ? { backgroundColor: pipColor, borderColor: pipColor }
                  : styles.pipEmpty,
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.levelText, filled >= count && styles.levelMax]}>
        {filled >= count ? 'MAX' : `LV${filled}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    flexShrink: 0,
  },
  pips: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
    justifyContent: 'center',
  },
  pip: {
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
    borderWidth: 2,
  },
  pipEmpty: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  levelText: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  levelMax: {
    color: colors.yellow,
  },
});
