import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing as RNEasing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import GemPips from '../../components/ui/GemPips';
import Stepper from '../../components/ui/Stepper';
import AnimNum from '../../components/ui/AnimNum';
import GemIcon from '../../components/icons/GemIcon';
import CoinIcon from '../../components/icons/CoinIcon';
import WheelDial from './WheelDial';
import ResultModal from './ResultModal';
import MeltdownOverlay from './MeltdownOverlay';
import CoopQRModal from './CoopQRModal';
import { useSpinLogic } from './useSpinLogic';
import { getCharge } from './constants';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface SpinnerScreenProps {
  onNavigate: (screen: string) => void;
  gems: number;
  setGems: (fn: (prev: number) => number) => void;
  couPoints: number;
  setCouPoints: (fn: (prev: number) => number) => void;
  /** Called after a server-authoritative spin settles so global wallet state syncs. */
  refreshWallet?: () => Promise<void> | void;
}

// Background environment per result tier
const ENV_BG: Record<number, string> = {
  0: '#040404',
  1: '#030C18',
  2: '#030C04',
  3: '#110D00',
  4: '#120500',
  5: '#08021A',
};
const ENV_OPACITY: Record<number, number> = {
  0: 0.88,
  1: 0.55,
  2: 0.55,
  3: 0.62,
  4: 0.68,
  5: 0.9,
};

const NUM_PARTICLES = 14;
const NUM_FLIGHT_TOKENS = 8;
const NUM_GEM_VANISH = 5;

export default function SpinnerScreen({
  onNavigate,
  gems,
  setGems,
  couPoints,
  setCouPoints,
  refreshWallet,
}: SpinnerScreenProps): React.JSX.Element {
  const [players, setPlayers] = useState(1);
  const [filledGuests, setFilledGuests] = useState(0);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

  const invited = players - 1;
  const allFilled = filledGuests >= invited;

  useEffect(() => {
    setFilledGuests(0);
  }, [players]);

  const {
    spin,
    spinning,
    result,
    gemShake,
    floor,
    phase,
    nearMiss,
    pendingColor,
    gemsAtSpin,
    meltdownResult,
    meltdownSpin,
    meltdownSpinning,
    handleSpin,
    dismissResult,
  } = useSpinLogic({ gems, setGems, setCouPoints, players, allFilled, refreshWallet });

  const canSpin = !spinning && allFilled && gems >= 1;

  // ── Co-op slot animations ─────────────────────────────────────────────────
  const slotS0 = useSharedValue(1);
  const slotS1 = useSharedValue(1);
  const slotS2 = useSharedValue(1);
  const slotScales = [slotS0, slotS1, slotS2];
  const slot0Style = useAnimatedStyle(() => ({ transform: [{ scale: slotS0.value }] }));
  const slot1Style = useAnimatedStyle(() => ({ transform: [{ scale: slotS1.value }] }));
  const slot2Style = useAnimatedStyle(() => ({ transform: [{ scale: slotS2.value }] }));
  const slotStyles = [slot0Style, slot1Style, slot2Style];

  const prevFilledRef = useRef(filledGuests);
  useEffect(() => {
    if (filledGuests > prevFilledRef.current) {
      const idx = filledGuests;
      if (idx < slotScales.length) {
        slotScales[idx].value = withSequence(
          withTiming(1.5, { duration: 90 }),
          withTiming(0.75, { duration: 70 }),
          withTiming(1.1, { duration: 110 }),
          withTiming(1.0, { duration: 80 }),
        );
      }
    }
    prevFilledRef.current = filledGuests;
  }, [filledGuests]);

  const emptyRingOp = useSharedValue(0.4);
  useEffect(() => {
    if (players > 1) {
      emptyRingOp.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(emptyRingOp);
      emptyRingOp.value = 0.4;
    }
  }, [players]);

  const emptyRingStyle = useAnimatedStyle(() => ({ opacity: emptyRingOp.value }));

  // ── Shake ──────────────────────────────────────────────────────────────────
  const shakeX = useSharedValue(0);

  // 6px launch shake
  useEffect(() => {
    if (phase === 'launch') {
      shakeX.value = withSequence(
        withTiming(-6, { duration: 30 }),
        withRepeat(
          withSequence(withTiming(6, { duration: 55 }), withTiming(-6, { duration: 55 })),
          5,
          false,
        ),
        withTiming(0, { duration: 30 }),
      );
    }
  }, [phase]);

  // gem-add shake
  useEffect(() => {
    if (!gemShake) return;
    const amp = 3 + gems * 2;
    shakeX.value = withSequence(
      withTiming(-amp, { duration: 40 }),
      withRepeat(
        withSequence(withTiming(amp, { duration: 70 }), withTiming(-amp, { duration: 70 })),
        Math.ceil(gems * 1.5),
        false,
      ),
      withTiming(0, { duration: 40 }),
    );
  }, [gemShake]);

  // result shake — amplitude by tier
  useEffect(() => {
    if (!result) return;
    const amp = result.mult === 5 ? 18 : result.mult >= 4 ? 12 : result.mult * 4;
    if (amp === 0) return;
    shakeX.value = withSequence(
      withTiming(-amp, { duration: 35 }),
      withRepeat(
        withSequence(withTiming(amp, { duration: 55 }), withTiming(-amp, { duration: 55 })),
        result.mult + 1,
        false,
      ),
      withTiming(0, { duration: 35 }),
    );
  }, [result]);

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  const wheelZoom = useSharedValue(1);
  useEffect(() => {
    if (phase === 'launch') {
      wheelZoom.value = withTiming(1.0, { duration: 200 });
    } else if (phase === 'peak') {
      wheelZoom.value = withTiming(1.05, { duration: 1500 });
    } else if (phase === 'decel') {
      wheelZoom.value = withTiming(1.13, { duration: 1800 });
    } else if (phase === 'pause') {
      wheelZoom.value = withTiming(1.1, { duration: 350 });
    } else if (phase === 'idle') {
      wheelZoom.value = withTiming(1.0, { duration: 800 });
    }
  }, [phase]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wheelZoom.value }, { translateX: shakeX.value }],
  }));

  // ── Button breathing ───────────────────────────────────────────────────────
  const btnBreath = useSharedValue(1);
  useEffect(() => {
    if (canSpin) {
      btnBreath.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(btnBreath);
      btnBreath.value = withTiming(1.0, { duration: 200 });
    }
  }, [canSpin]);

  const btnBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnBreath.value }],
  }));

  // ── Vignette ──────────────────────────────────────────────────────────────
  const vigOpacity = useSharedValue(0);
  useEffect(() => {
    if (spinning) {
      const charge = getCharge(gems);
      // Cap at 0.5 so the wheel stays clearly visible even on max-charge (5-gem) spins.
      vigOpacity.value = withTiming(Math.min(charge.vignette * 0.55 + 0.05, 0.5), {
        duration: 550,
      });
    } else {
      vigOpacity.value = withTiming(0, { duration: 550 });
    }
  }, [spinning]);

  const vigStyle = useAnimatedStyle(() => ({ opacity: vigOpacity.value }));

  // ── Background environment overlay ────────────────────────────────────────
  const [envBgColor, setEnvBgColor] = useState('#111');
  const envOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'reveal' && result) {
      setEnvBgColor(ENV_BG[result.mult] ?? '#111');
      Animated.timing(envOpacity, {
        toValue: ENV_OPACITY[result.mult] ?? 0.6,
        duration: 700,
        useNativeDriver: true,
      }).start();
    } else if (phase === 'idle') {
      Animated.timing(envOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();
    }
  }, [phase, result]);

  // ── Particles ─────────────────────────────────────────────────────────────
  const particleConfigs = useRef(
    Array.from({ length: NUM_PARTICLES }, (_, i) => ({
      angle: (i / NUM_PARTICLES) * Math.PI * 2 + (Math.random() * 0.5 - 0.25),
      dist: 55 + Math.random() * 95,
      color: Math.random() > 0.45 ? '#F5A820' : '#fff',
    })),
  ).current;

  const particleAnims = useRef(
    Array.from({ length: NUM_PARTICLES }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    if (phase !== 'launch') return;
    particleAnims.forEach((p, i) => {
      const cfg = particleConfigs[i];
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      const dur = 700 + i * 35;
      Animated.parallel([
        Animated.timing(p.x, {
          toValue: Math.cos(cfg.angle) * cfg.dist,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(p.y, {
          toValue: Math.sin(cfg.angle) * cfg.dist,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: dur - 150,
            delay: 120,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, [phase]);

  // ── Gem vanish (launch) ───────────────────────────────────────────────────
  const gemVanishAnims = useRef(
    Array.from({ length: NUM_GEM_VANISH }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
    })),
  ).current;

  useEffect(() => {
    if (phase !== 'launch' || gemsAtSpin === 0) return;
    const count = Math.min(gemsAtSpin, NUM_GEM_VANISH);
    gemVanishAnims.forEach((p, i) => {
      if (i >= count) return;
      const startX = (i - (count - 1) / 2) * 22;
      p.x.setValue(startX);
      p.y.setValue(240);
      p.opacity.setValue(0);
      p.scale.setValue(1);
      Animated.sequence([
        Animated.delay(i * 55),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(p.y, {
            toValue: 0,
            duration: 380,
            easing: RNEasing.out(RNEasing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: 0,
            duration: 380,
            easing: RNEasing.out(RNEasing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(p.scale, { toValue: 1.4, duration: 140, useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(160),
            Animated.timing(p.opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });
  }, [phase]);

  // ── CouPoint flight tokens ─────────────────────────────────────────────────
  const flightAnims = useRef(
    Array.from({ length: NUM_FLIGHT_TOKENS }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  const hudPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phase !== 'reveal' || !result || result.points <= 0) return;
    const count = Math.min(result.points, NUM_FLIGHT_TOKENS);
    Animated.sequence([
      Animated.timing(hudPulse, { toValue: 1.28, duration: 140, useNativeDriver: true }),
      Animated.timing(hudPulse, { toValue: 1.0, duration: 200, useNativeDriver: true }),
    ]).start();
    flightAnims.forEach((p, i) => {
      if (i >= count) return;
      const targetX = 60 + Math.random() * 50;
      const targetY = -(300 + Math.random() * 50);
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      Animated.sequence([
        Animated.delay(i * 80),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(p.x, {
            toValue: targetX,
            duration: 460,
            easing: RNEasing.out(RNEasing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: targetY,
            duration: 460,
            easing: RNEasing.out(RNEasing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(260),
            Animated.timing(p.opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });
  }, [phase, result]);

  // ── Near-miss effects ─────────────────────────────────────────────────────
  const nmFlash = useRef(new Animated.Value(0)).current;
  const nmToastOp = useSharedValue(0);

  useEffect(() => {
    if (!nearMiss) return;
    nmFlash.setValue(0);
    Animated.sequence([
      Animated.timing(nmFlash, { toValue: 0.55, duration: 100, useNativeDriver: true }),
      Animated.timing(nmFlash, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
    nmToastOp.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 1000 }),
      withTiming(0, { duration: 400 }),
    );
  }, [nearMiss]);

  const nmToastStyle = useAnimatedStyle(() => ({ opacity: nmToastOp.value }));

  // ── Slot helpers ──────────────────────────────────────────────────────────
  const slotType = (i: number) => {
    if (i === 0) return 'me';
    if (i <= filledGuests) return 'guest';
    if (i === pendingSlot) return 'pending';
    return 'empty';
  };

  const spinBtnLabel = () => {
    if (!allFilled) return '等待朋友加入';
    if (spinning) return '轉啊轉…';
    if (!spinning && result?.mult === 5) return 'RAGE SPIN';
    if (!spinning && result?.mult === 0) return '復仇轉！';
    return 'SPIN!';
  };

  return (
    <View style={styles.screen}>
      {/* Environment background */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: envBgColor, opacity: envOpacity }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Spinner</Text>
        <View style={styles.badges}>
          <Animated.View
            testID="coupoints-badge"
            style={[styles.badge, { transform: [{ scale: hudPulse }] }]}
          >
            <CoinIcon size={14} />
            <AnimNum value={couPoints} color="#F5F5F0" fontSize={14} />
          </Animated.View>
          <View testID="gems-badge" style={styles.badge}>
            <GemIcon size={14} color={colors.purpleLight} />
            <AnimNum value={gems} color="#F5F5F0" fontSize={14} />
          </View>
        </View>
      </View>

      {/* Wheel area — zoom + shake */}
      <Reanimated.View style={[styles.wheelArea, shakeStyle]}>
        {/* Player slots */}
        <View style={styles.slots}>
          {Array.from({ length: players }).map((_, i) => {
            const slot = slotType(i);
            return (
              <Reanimated.View key={i} style={slotStyles[i]}>
                <Pressable
                  testID="player-slot"
                  onPress={() => {
                    if (slot === 'empty' && i > 0) setPendingSlot(i);
                    else if (slot === 'pending') setPendingSlot(null);
                  }}
                  style={[
                    styles.slot,
                    slot === 'me' && styles.slotMe,
                    slot === 'guest' && styles.slotGuest,
                    (slot === 'empty' || slot === 'pending') && styles.slotEmpty,
                    slot === 'pending' && styles.slotPending,
                  ]}
                >
                  {/* Pulsing orange ring for invited empty slots */}
                  {slot === 'empty' && i > 0 && (
                    <Reanimated.View
                      style={[StyleSheet.absoluteFill, styles.slotPulseRing, emptyRingStyle]}
                      pointerEvents="none"
                    />
                  )}
                  <Text style={styles.slotText}>
                    {slot === 'me'
                      ? '我'
                      : slot === 'guest'
                        ? '友'
                        : slot === 'pending'
                          ? '…'
                          : '+'}
                  </Text>
                </Pressable>
              </Reanimated.View>
            );
          })}
        </View>

        {/* Wheel */}
        <View style={styles.wheelWrapper}>
          <WheelDial
            size={260}
            floor={floor}
            spin={spin}
            spinning={spinning}
            gems={gems}
            phase={phase}
            upcomingColor={phase === 'pause' ? pendingColor : null}
          />
        </View>

        {/* Particles — burst from wheel center */}
        <View style={[StyleSheet.absoluteFill, styles.particleContainer]} pointerEvents="none">
          {particleAnims.map((p, i) => (
            <Animated.View
              key={i}
              style={[
                styles.particle,
                { backgroundColor: particleConfigs[i].color },
                { transform: [{ translateX: p.x }, { translateY: p.y }], opacity: p.opacity },
              ]}
            />
          ))}
          {/* Gem vanish — fly from tray to wheel center on launch */}
          {gemVanishAnims.map((p, i) => (
            <Animated.View
              key={`gv${i}`}
              style={[
                styles.gemVanish,
                {
                  transform: [
                    { translateX: p.x },
                    { translateY: p.y },
                    { scale: p.scale },
                    { rotate: '45deg' },
                  ],
                  opacity: p.opacity,
                },
              ]}
            />
          ))}
          {/* CouPoint flight tokens — fly from center toward HUD badge */}
          {flightAnims.map((p, i) => (
            <Animated.View
              key={`ft${i}`}
              style={[
                styles.flightToken,
                {
                  transform: [{ translateX: p.x }, { translateY: p.y }],
                  opacity: p.opacity,
                },
              ]}
            />
          ))}
        </View>
      </Reanimated.View>

      {/* Controls panel */}
      <View style={styles.controls}>
        <View testID="gem-pips-container">
          <GemPips count={5} filled={gems} />
        </View>
        <View style={styles.steppers}>
          <Stepper
            label="寶石"
            value={gems}
            min={1}
            max={5}
            onChange={(v) => setGems(() => v)}
            accent
          />
          <View style={styles.divider} />
          <Stepper label="揪友" value={players} min={1} max={3} onChange={setPlayers} />
        </View>
        <Reanimated.View style={btnBreathStyle}>
          <Pressable
            testID="spin-button"
            onPress={handleSpin}
            disabled={!canSpin}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSpin }}
            style={[styles.spinBtn, canSpin ? styles.spinBtnActive : styles.spinBtnDisabled]}
          >
            <Text style={[styles.spinBtnText, !canSpin && styles.spinBtnTextDisabled]}>
              {spinBtnLabel()}
            </Text>
          </Pressable>
        </Reanimated.View>
      </View>

      {/* Vignette overlay */}
      <Reanimated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.vignette, vigStyle]}
      />

      {/* Near-miss: purple flash */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.nmFlash, { opacity: nmFlash }]}
      />

      {/* Near-miss: toast */}
      <Reanimated.View pointerEvents="none" style={[styles.nmToast, nmToastStyle]}>
        <Text style={styles.nmToastText}>差一點！</Text>
      </Reanimated.View>

      <ResultModal
        result={result}
        onDismiss={dismissResult}
        canDismiss={phase === 'reveal' && result?.mult !== 5}
      />

      <MeltdownOverlay
        active={phase === 'meltdown'}
        meltdownResult={meltdownResult}
        meltdownSpin={meltdownSpin}
        meltdownSpinning={meltdownSpinning}
        originalResult={result}
        onDismiss={dismissResult}
      />

      <CoopQRModal
        visible={pendingSlot !== null}
        slotIndex={pendingSlot ?? 1}
        onCancel={() => setPendingSlot(null)}
        onSimulateJoin={() => {
          setFilledGuests((g) => g + 1);
          setPendingSlot(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#2A2A2A',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 4,
  },
  wheelArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  slots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  slot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotMe: { backgroundColor: colors.purple },
  slotGuest: { backgroundColor: colors.green },
  slotEmpty: { backgroundColor: '#FFFFFF' },
  slotPending: { backgroundColor: 'rgba(255,97,53,0.15)', borderColor: '#FF6135' },
  slotPulseRing: {
    borderRadius: 21,
    borderWidth: 3,
    borderColor: '#FF6135',
  },
  slotText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.fg,
  },
  wheelWrapper: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  particleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemVanish: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: colors.purple,
    borderRadius: 1,
  },
  flightToken: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.yellow,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: '#111',
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  steppers: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    borderLeftWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
  },
  spinBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 6,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinBtnActive: {
    backgroundColor: colors.yellow,
    borderColor: colors.border,
    shadowOffset: { width: 6, height: 6 },
    shadowColor: colors.border,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  spinBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  spinBtnText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.fg,
  },
  spinBtnTextDisabled: {
    color: 'rgba(255,255,255,0.25)',
  },
  vignette: {
    backgroundColor: '#000',
  },
  nmFlash: {
    backgroundColor: colors.purple,
  },
  nmToast: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    backgroundColor: 'rgba(107,79,255,0.88)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.purple,
  },
  nmToastText: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: -0.2,
  },
});
