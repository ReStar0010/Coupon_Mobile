import React from 'react';
import Svg, { Path, Circle, Line, Text as SvgText, G, Polygon, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  useAnimatedProps,
  Easing,
  withRepeat,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { View, StyleSheet } from 'react-native';
import { MULTS } from './constants';
import { colors } from '../../theme/colors';
import type { SpinPhase } from './useSpinLogic';

/**
 * How the wheel eases toward `spin` while `spinning`:
 *   - 'land' (default): ease-out over `landDurationMs` — the solo behaviour and
 *     the co-op settle. Lands the target sector under the needle.
 *   - 'free': constant-velocity linear segment over `freeChunkMs` — the co-op
 *     pre-reveal spin where the target isn't known yet. The driver bumps `spin`
 *     by a fixed angle each `freeChunkMs` so back-to-back linear segments read
 *     as one continuous spin.
 */
export type WheelSpinMode = 'land' | 'free';

interface WheelDialProps {
  size?: number;
  floor?: number;
  spin: number;
  spinning: boolean;
  gems: number;
  phase?: SpinPhase;
  upcomingColor?: string | null;
  spinMode?: WheelSpinMode;
  /** Ease-out duration for 'land' mode. Default 4200 (matches solo timeline). */
  landDurationMs?: number;
  /** Linear segment duration for 'free' mode; should equal the driver's bump interval. */
  freeChunkMs?: number;
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

function labelPos(
  a0: number,
  a1: number,
  cx: number,
  cy: number,
  r: number,
): [number, number, number] {
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
  phase,
  upcomingColor,
  spinMode = 'land',
  landDurationMs = 4200,
  freeChunkMs = 600,
}: WheelDialProps): React.JSX.Element {
  const r = size / 2 - 18;
  const cx = size / 2;
  const cy = size / 2;
  const ranges = buildRanges(floor);
  const rc = rimColor(gems);
  const rimW = gems >= 4 ? 6 : gems >= 2 ? 4 : 3;

  // Sector spin rotation
  const rotation = useSharedValue(0);
  React.useEffect(() => {
    if (!spinning) {
      rotation.value = spin;
      return;
    }
    if (spinMode === 'free') {
      // Constant velocity: each fixed-angle bump animates linearly over the
      // driver's interval, so consecutive segments chain into one smooth spin.
      rotation.value = withTiming(spin, { duration: freeChunkMs, easing: Easing.linear });
    } else {
      // Ease-out landing — eases from wherever the rotation currently is
      // (rest for solo, mid-free-spin for co-op) onto the target.
      rotation.value = withTiming(spin, {
        duration: landDurationMs,
        easing: Easing.bezier(0.12, 0, 0.04, 1),
      });
    }
  }, [spin, spinning, spinMode, freeChunkMs, landDurationMs]);

  // Idle decoration rotation (outer rim notches)
  const idleDecor = useSharedValue(0);
  React.useEffect(() => {
    if (!spinning) {
      const start = idleDecor.value;
      idleDecor.value = withRepeat(
        withTiming(start + 360, { duration: 8000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(idleDecor);
    }
  }, [spinning]);

  // Glow ring pulse — intensity scales with gem count
  const glowOpacity = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(glowOpacity);
    if (gems >= 1) {
      const peak = Math.min(0.35 + gems * 0.13, 0.95);
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(peak, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.08, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [gems]);

  // Needle glow when upcoming result is known (pre-reveal hint)
  const needleGlowOp = useSharedValue(0);
  React.useEffect(() => {
    if (upcomingColor) {
      needleGlowOp.value = withRepeat(
        withSequence(
          withTiming(0.75, { duration: 200, easing: Easing.out(Easing.sin) }),
          withTiming(0.25, { duration: 320, easing: Easing.in(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(needleGlowOp);
      needleGlowOp.value = withTiming(0, { duration: 150 });
    }
  }, [upcomingColor]);

  const needleGlowProps = useAnimatedProps(() => ({ opacity: needleGlowOp.value }));

  // Needle wobble during pre-reveal pause
  const needleWobble = useSharedValue(0);
  React.useEffect(() => {
    if (phase === 'pause') {
      needleWobble.value = withSequence(
        withTiming(-4, { duration: 80 }),
        withRepeat(
          withSequence(withTiming(4, { duration: 90 }), withTiming(-4, { duration: 90 })),
          3,
          false,
        ),
        withTiming(0, { duration: 80 }),
      );
    }
  }, [phase]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const idleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${idleDecor.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: needleWobble.value }],
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

  // iOS SVGs clip their drawable area to width/height; shadow/glow/needle
  // decorations extend past `size`, so without extra headroom they get cut into
  // a square. Pad the canvas + offset the viewBox to keep wheel content centered.
  const PAD = 20;
  const total = size + PAD * 2;
  const vb = `${-PAD} ${-PAD} ${total} ${total}`;

  return (
    <View style={[styles.container, { width: total, height: total }]}>
      {/* Layer 1: Static background — shadow + solid rim */}
      <Svg width={total} height={total} viewBox={vb} style={styles.svg}>
        <Circle cx={cx + 8} cy={cy + 8} r={r + 14} fill="#333" />
        <Circle cx={cx} cy={cy} r={r + 14} fill="#1a1a1a" stroke={rc} strokeWidth={rimW} />
      </Svg>

      {/* Layer 2: Pulsing glow ring */}
      <Animated.View
        style={[styles.overlay, { width: total, height: total }, glowStyle]}
        pointerEvents="none"
      >
        <Svg width={total} height={total} viewBox={vb} style={styles.svg}>
          <Circle cx={cx} cy={cy} r={r + 18} fill="none" stroke={rc} strokeWidth={16} />
        </Svg>
      </Animated.View>

      {/* Layer 3: Idle-rotating notch marks */}
      <Animated.View
        style={[styles.overlay, { width: total, height: total }, idleStyle]}
        pointerEvents="none"
      >
        <Svg width={total} height={total} viewBox={vb} style={styles.svg}>
          {notches.map((n, i) => (
            <Line
              key={i}
              x1={n.x0}
              y1={n.y0}
              x2={n.x1}
              y2={n.y1}
              stroke={n.major ? colors.yellow : 'rgba(255,255,255,0.25)'}
              strokeWidth={n.major ? 2.5 : 1}
            />
          ))}
        </Svg>
      </Animated.View>

      {/* Layer 4: Spinning sectors + hub */}
      <Animated.View style={[styles.overlay, { width: total, height: total }, animStyle]}>
        <Svg width={total} height={total} viewBox={vb} style={styles.svg}>
          {ranges.map((sec, i) => {
            const [lx, ly, aDeg] = labelPos(sec.a0, sec.a1, cx, cy, r);
            return (
              <G key={i} testID="wheel-sector">
                <Path
                  d={arcPath(sec.a0, sec.a1, cx, cy, r)}
                  fill={sec.color}
                  stroke="#333"
                  strokeWidth={4}
                />
                <Line
                  x1={cx}
                  y1={cy}
                  x2={cx + (r + 14) * Math.cos(sec.a0)}
                  y2={cy + (r + 14) * Math.sin(sec.a0)}
                  stroke="#333"
                  strokeWidth={4}
                />
                <SvgText
                  x={lx}
                  y={ly + 5}
                  textAnchor="middle"
                  rotation={aDeg}
                  originX={lx}
                  originY={ly}
                  fontFamily="JetBrainsMono_600SemiBold"
                  fontSize={14}
                  fontWeight="600"
                  fill="#fff"
                  stroke="none"
                >
                  {sec.label}
                </SvgText>
              </G>
            );
          })}
          <Rect
            x={cx - 15}
            y={cy - 15}
            width={30}
            height={30}
            fill={colors.yellow}
            stroke="#333"
            strokeWidth={3}
            rx={2}
          />
          <Rect x={cx - 9} y={cy - 9} width={18} height={18} fill="#333" />
          <Rect x={cx - 5} y={cy - 5} width={10} height={10} fill={colors.yellow} />
        </Svg>
      </Animated.View>

      {/* Layer 5: Static needle — topmost, wobbles on pause */}
      <Animated.View
        style={[styles.overlay, { width: total, height: total }, needleStyle]}
        pointerEvents="none"
      >
        <Svg width={total} height={total} viewBox={vb} style={styles.svg}>
          {/* Pre-reveal glow halo on needle tip */}
          <AnimatedCircle
            cx={cx}
            cy={cy - r - 12}
            r={22}
            fill={upcomingColor ?? 'transparent'}
            animatedProps={needleGlowProps}
          />
          <Polygon
            points={`${cx - 12},${cy - r - 3} ${cx + 12},${cy - r - 3} ${cx},${cy - r + 12}`}
            fill={colors.yellow}
            stroke="#333"
            strokeWidth={3.5}
          />
          <Polygon
            points={`${cx - 7},${cy - r - 20} ${cx + 7},${cy - r - 20} ${cx},${cy - r - 4}`}
            fill="#fff"
            stroke="#333"
            strokeWidth={2.5}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
  },
  svg: {
    overflow: 'visible',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },
});
