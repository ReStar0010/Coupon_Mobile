import React from 'react';
import Svg, { Path, Circle, Text as SvgText, G, Polygon } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';
import { MELT_MULTS } from './constants';
import { colors } from '../../theme/colors';

interface MeltdownWheelProps {
  size?: number;
  spin: number;
  spinning: boolean;
}

function buildRanges() {
  const weights = MELT_MULTS.map((m) => 1 / (m.v + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = -Math.PI / 2;
  return MELT_MULTS.map((m, i) => {
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

function labelPos(
  a0: number,
  a1: number,
  cx: number,
  cy: number,
  r: number,
): [number, number, number] {
  const a = (a0 + a1) / 2;
  const d = r * 0.62;
  return [cx + d * Math.cos(a), cy + d * Math.sin(a), (a * 180) / Math.PI + 90];
}

export default function MeltdownWheel({
  size = 180,
  spin,
  spinning,
}: MeltdownWheelProps): React.JSX.Element {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const ranges = buildRanges();

  const rotation = useSharedValue(0);
  React.useEffect(() => {
    if (spinning) {
      rotation.value = withTiming(spin, {
        duration: 2200,
        easing: Easing.bezier(0.12, 0, 0.04, 1),
      });
    } else {
      rotation.value = spin;
    }
  }, [spin, spinning]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // iOS clips SVG bounds; pad canvas + offset viewBox to keep decorations visible.
  const PAD = 16;
  const total = size + PAD * 2;
  const vb = `${-PAD} ${-PAD} ${total} ${total}`;

  return (
    <View style={[styles.container, { width: total, height: total }]}>
      <Svg width={total} height={total} viewBox={vb} style={styles.svg}>
        <Circle cx={cx + 5} cy={cy + 5} r={r + 10} fill="#2a0060" />
        <Circle cx={cx} cy={cy} r={r + 10} fill="#1a1a1a" stroke={colors.purple} strokeWidth={4} />
      </Svg>

      <Animated.View style={[styles.overlay, { width: total, height: total }, animStyle]}>
        <Svg width={total} height={total} viewBox={vb} style={styles.svg}>
          {ranges.map((sec, i) => {
            const [lx, ly, aDeg] = labelPos(sec.a0, sec.a1, cx, cy, r);
            return (
              <G key={i}>
                <Path
                  d={arcPath(sec.a0, sec.a1, cx, cy, r)}
                  fill={sec.color}
                  stroke="#333"
                  strokeWidth={3}
                />
                <SvgText
                  x={lx}
                  y={ly + 4}
                  textAnchor="middle"
                  rotation={aDeg}
                  originX={lx}
                  originY={ly}
                  fontFamily="JetBrainsMono_600SemiBold"
                  fontSize={13}
                  fontWeight="600"
                  fill="#fff"
                >
                  {sec.label}
                </SvgText>
              </G>
            );
          })}
          <Circle cx={cx} cy={cy} r={10} fill={colors.yellow} stroke="#333" strokeWidth={2} />
          <Circle cx={cx} cy={cy} r={5} fill="#333" />
          <Circle cx={cx} cy={cy} r={2} fill={colors.yellow} />
        </Svg>
      </Animated.View>

      <View style={[styles.overlay, { width: total, height: total }]} pointerEvents="none">
        <Svg width={total} height={total} viewBox={vb} style={styles.svg}>
          <Polygon
            points={`${cx - 9},${cy - r - 2} ${cx + 9},${cy - r - 2} ${cx},${cy - r + 9}`}
            fill={colors.yellow}
            stroke="#333"
            strokeWidth={2.5}
          />
          <Polygon
            points={`${cx - 5},${cy - r - 14} ${cx + 5},${cy - r - 14} ${cx},${cy - r - 2}`}
            fill="#fff"
            stroke="#333"
            strokeWidth={2}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  svg: { overflow: 'visible' },
  overlay: { position: 'absolute', top: 0, left: 0 },
});
