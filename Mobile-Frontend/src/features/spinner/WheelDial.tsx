import React from 'react';
import Svg, { Path, Circle, Line, Text as SvgText, G, Polygon, Rect } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';
import { MULTS } from './constants';
import { colors } from '../../theme/colors';

interface WheelDialProps {
  size?: number;
  floor?: number;
  spin: number;
  spinning: boolean;
  gems: number;
}

function buildRanges(floor: number) {
  const available = MULTS.filter((m) => m.v >= floor);
  const weights = available.map((m) => 1 / (m.v + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = -Math.PI / 2;
  return available.map((m, i) => {
    const w = (weights[i] / total) * Math.PI * 2;
    const a0 = acc;
    acc += w;
    return { a0, a1: acc, ...m };
  });
}

function arcPath(a0: number, a1: number, cx: number, cy: number, r: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}Z`;
}

function labelPos(a0: number, a1: number, cx: number, cy: number, r: number): [number, number, number] {
  const a = (a0 + a1) / 2;
  const d = r * 0.63;
  return [cx + d * Math.cos(a), cy + d * Math.sin(a), (a * 180) / Math.PI + 90];
}

function rimColor(gems: number): string {
  if (gems >= 5) return colors.purple;
  if (gems >= 4) return '#FF6135';
  if (gems >= 3) return '#CC8800';
  if (gems >= 2) return colors.yellow;
  return '#444444';
}

export default function WheelDial({
  size = 260,
  floor = 0,
  spin,
  spinning,
  gems,
}: WheelDialProps): React.JSX.Element {
  const r = size / 2 - 18;
  const cx = size / 2;
  const cy = size / 2;
  const ranges = buildRanges(floor);
  const rc = rimColor(gems);
  const rimW = gems >= 4 ? 6 : gems >= 2 ? 4 : 3;

  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (spinning) {
      rotation.value = withTiming(spin, {
        duration: 4200,
        easing: Easing.bezier(0.12, 0, 0.04, 1),
      });
    } else {
      rotation.value = spin;
    }
  }, [spin, spinning]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const notches = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const notchR = r + 8;
    const notchL = i % 4 === 0 ? 10 : 5;
    return {
      x0: cx + notchR * Math.cos(a),
      y0: cy + notchR * Math.sin(a),
      x1: cx + (notchR - notchL) * Math.cos(a),
      y1: cy + (notchR - notchL) * Math.sin(a),
      major: i % 4 === 0,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={styles.svg}>
        {/* Hard offset shadow backing circle */}
        <Circle cx={cx + 8} cy={cy + 8} r={r + 14} fill="#333" />
        {/* Outer rim */}
        <Circle cx={cx} cy={cy} r={r + 14} fill="#1a1a1a" stroke={rc} strokeWidth={rimW} />
        {/* Rim notch marks */}
        {notches.map((n, i) => (
          <Line
            key={i}
            x1={n.x0} y1={n.y0} x2={n.x1} y2={n.y1}
            stroke={n.major ? colors.yellow : 'rgba(255,255,255,0.25)'}
            strokeWidth={n.major ? 2.5 : 1}
          />
        ))}
        {/* Needle — bold arrow at top, static */}
        <Polygon
          points={`${cx - 12},${cy - r - 3} ${cx + 12},${cy - r - 3} ${cx},${cy - r + 12}`}
          fill={colors.yellow} stroke="#333" strokeWidth={3.5}
        />
        <Polygon
          points={`${cx - 7},${cy - r - 20} ${cx + 7},${cy - r - 20} ${cx},${cy - r - 4}`}
          fill="#fff" stroke="#333" strokeWidth={2.5}
        />
      </Svg>
      {/* Spinning sectors overlay */}
      <Animated.View style={[styles.overlay, { width: size, height: size }, animStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={styles.svg}>
          {ranges.map((sec, i) => {
            const [lx, ly, aDeg] = labelPos(sec.a0, sec.a1, cx, cy, r);
            return (
              <G key={i} testID="wheel-sector">
                <Path d={arcPath(sec.a0, sec.a1, cx, cy, r)} fill={sec.color} stroke="#333" strokeWidth={4} />
                <Line x1={cx} y1={cy} x2={cx + (r + 14) * Math.cos(sec.a0)} y2={cy + (r + 14) * Math.sin(sec.a0)} stroke="#333" strokeWidth={4} />
                <SvgText
                  x={lx} y={ly + 5} textAnchor="middle"
                  rotation={aDeg} originX={lx} originY={ly}
                  fontFamily="JetBrainsMono_600SemiBold" fontSize={15} fontWeight="900"
                  fill="#fff" stroke="#333" strokeWidth={3}
                >
                  {sec.label}
                </SvgText>
              </G>
            );
          })}
          {/* Hub */}
          <Rect x={cx - 15} y={cy - 15} width={30} height={30} fill={colors.yellow} stroke="#333" strokeWidth={3} rx={2} />
          <Rect x={cx - 9} y={cy - 9} width={18} height={18} fill="#333" />
          <Rect x={cx - 5} y={cy - 5} width={10} height={10} fill={colors.yellow} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  svg: {
    overflow: 'visible',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
