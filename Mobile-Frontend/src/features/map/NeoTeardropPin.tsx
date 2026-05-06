import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

export interface NeoTeardropPinProps {
  coordinate: { latitude: number; longitude: number };
  count?: number;
  active?: boolean;
  big?: boolean;
  onPress?: () => void;
}

export default function NeoTeardropPin({
  coordinate,
  count,
  active = false,
  big = false,
  onPress,
}: NeoTeardropPinProps): React.JSX.Element {
  const sz = big ? 44 : 34;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (!active) return;
    scale.value = withRepeat(
      withSequence(withTiming(1.4, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.05, { duration: 900 }), withTiming(0.4, { duration: 900 })),
      -1,
      false,
    );
  }, [active, scale, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const ringSize = sz + 14;

  return (
    <Marker coordinate={coordinate} onPress={onPress} anchor={{ x: 0.5, y: 1 }}>
      <Pressable onPress={onPress}>
        <View style={styles.pinContainer}>
          {active && (
            <Animated.View
              style={[
                styles.pulseRing,
                { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.yellow },
                pulseStyle,
              ]}
            />
          )}
          <Svg width={sz} height={sz + 12} viewBox="0 0 36 48">
            <Path
              d="M18 46 Q7 30 7 16 A11 11 0 1 1 29 16 Q29 30 18 46 Z"
              fill={active ? colors.yellow : '#FFFFFF'}
              stroke={colors.border}
              strokeWidth={active ? 2.5 : 2}
            />
            {active && count != null && (
              <SvgText
                x="18"
                y="21"
                textAnchor="middle"
                fontFamily="JetBrainsMono_400Regular"
                fontSize="12"
                fontWeight="700"
                fill={colors.fg}
              >
                {count}
              </SvgText>
            )}
            {active && <Circle cx="18" cy="16" r="4" fill="rgba(255,255,255,0.35)" />}
          </Svg>
        </View>
      </Pressable>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
});
