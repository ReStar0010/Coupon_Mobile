/**
 * Reusable charge meter — used for both the local user's hold button and the
 * peer mini-meters. Renders a smooth animated fill that snaps to server values
 * on each broadcast.
 *
 * No business logic here: pure presentation. Smoothing math lives in `charge.ts`.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { colors } from '../../../theme/colors';
import { fontFamilies } from '../../../theme/typography';

export interface ChargeMeterProps {
  /** Progress value [0..1]. */
  progress: number;
  /** Cosmetic label (e.g. peer name). Hidden if omitted. */
  label?: string;
  /** Track height in px. Default 10. */
  height?: number;
  /** Fill color. Default purple. */
  color?: string;
  /** Show the percentage as overlaid text. Default false. */
  showPercent?: boolean;
  /** When true, smoothing animation is shorter so the bar tracks the user's press more tightly. */
  prioritizeImmediate?: boolean;
  /** Optional testID for the outer view. */
  testID?: string;
}

const SMOOTH_DURATION_MS = 120; // matches MAX_DEAD_RECKON_MS + a tick of slack
const IMMEDIATE_DURATION_MS = 60;

export default function ChargeMeter({
  progress,
  label,
  height = 10,
  color = colors.purple,
  showPercent = false,
  prioritizeImmediate = false,
  testID,
}: ChargeMeterProps): React.JSX.Element {
  const v = useSharedValue(clamp01(progress));

  useEffect(() => {
    v.value = withTiming(clamp01(progress), {
      duration: prioritizeImmediate ? IMMEDIATE_DURATION_MS : SMOOTH_DURATION_MS,
      easing: Easing.linear,
    });
  }, [progress, prioritizeImmediate, v]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${v.value * 100}%`,
  }));

  return (
    <View testID={testID} style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.track, { height }]}>
        <Reanimated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: color }, fillStyle]}
        />
        {showPercent && <Text style={styles.percent}>{Math.round(clamp01(progress) * 100)}%</Text>}
      </View>
    </View>
  );
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const styles = StyleSheet.create({
  wrapper: { gap: 4, marginVertical: 4 },
  label: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#F5F5F0',
  },
  track: {
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  percent: {
    position: 'absolute',
    alignSelf: 'center',
    top: -2,
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 10,
    color: '#fff',
  },
});
