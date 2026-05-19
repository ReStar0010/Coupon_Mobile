import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme/colors';

export interface NeoTeardropPinProps {
  coordinate: { latitude: number; longitude: number };
  count?: number;
  active?: boolean;
  /** Orange when this merchant has shared coupons available, white otherwise. */
  hasShared?: boolean;
  /** @deprecated kept for backward compatibility; ignored. */
  big?: boolean;
  onPress?: () => void;
}

const INACTIVE_SIZE = 14;
const ACTIVE_SIZE = 32;
const STROKE = 2;
const ORANGE = colors.yellow; // theme "yellow" is #FFAD31

export default function NeoTeardropPin({
  coordinate,
  count,
  active = false,
  hasShared = false,
  onPress,
}: NeoTeardropPinProps): React.JSX.Element {
  if (!active) {
    const r = (INACTIVE_SIZE - STROKE) / 2;
    const c = INACTIVE_SIZE / 2;
    return (
      <Marker coordinate={coordinate} onPress={onPress} anchor={{ x: 0.5, y: 0.5 }}>
        <Pressable onPress={onPress}>
          <View style={styles.pin}>
            <Svg width={INACTIVE_SIZE} height={INACTIVE_SIZE}>
              <Circle
                cx={c}
                cy={c}
                r={r}
                fill="#FFFFFF"
                stroke={colors.border}
                strokeWidth={STROKE}
              />
            </Svg>
          </View>
        </Pressable>
      </Marker>
    );
  }

  const fill = hasShared ? ORANGE : '#FFFFFF';
  const r = (ACTIVE_SIZE - STROKE) / 2;
  const c = ACTIVE_SIZE / 2;
  const displayCount = count ?? 0;

  return (
    <Marker coordinate={coordinate} onPress={onPress} anchor={{ x: 0.5, y: 0.5 }}>
      <Pressable onPress={onPress}>
        <View style={styles.pin}>
          <Svg width={ACTIVE_SIZE} height={ACTIVE_SIZE}>
            <Circle cx={c} cy={c} r={r} fill={fill} stroke={colors.border} strokeWidth={STROKE} />
            <SvgText
              x={c}
              y={c + 5}
              textAnchor="middle"
              fontFamily="JetBrainsMono_700Bold"
              fontSize={14}
              fontWeight="700"
              fill={colors.fg}
            >
              {displayCount}
            </SvgText>
          </Svg>
        </View>
      </Pressable>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
