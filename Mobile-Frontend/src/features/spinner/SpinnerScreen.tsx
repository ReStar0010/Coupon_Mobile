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
import type { SpinResult } from './ResultModal';
import MeltdownOverlay from './MeltdownOverlay';
import Coachmark from '@/src/features/onboarding/Coachmark';
import { useSpinLogic } from './useSpinLogic';
import { getCharge } from './constants';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { useCoopContext } from './coop/CoopContext';
import CoinRainReveal from './coop/CoinRainReveal';
import type { PlayerResult } from './coop/CoinRainReveal';
import { MULTS } from './constants';

interface SpinnerScreenProps {
  onNavigate: (screen: string) => void;
  gems: number;
  couPoints: number;
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
  couPoints,
  refreshWallet,
}: SpinnerScreenProps): React.JSX.Element {
  const [players, setPlayers] = useState(1);
  const [bet, setBet] = useState(1);
  const insets = useSafeAreaInsets();
  const coop = useCoopContext();

  const isMultiplayer = coop.active && coop.state.phase !== null;
  const coopPlayers = coop.state.players;
  const displayPlayers = isMultiplayer ? coopPlayers.length : players;

  const invited = isMultiplayer ? 0 : players - 1;
  const allFilled = isMultiplayer || invited === 0;
  // Stepper cap. When the wallet is empty the Stepper still needs `max >= min`
  // (the component requires min=1), so we floor the cap at 1 — `canSpin`
  // below blocks the actual spin in that state.
  const maxBet = Math.max(1, Math.min(5, gems));

  // Re-clamp the wager when the wallet shrinks (e.g. after a spin debit
  // refresh). Without this, a user who bet 5 and then dropped to 2 gems in
  // the wallet would see bet=5 lingering — visually inconsistent with the
  // (now lowered) Stepper max.
  useEffect(() => {
    setBet((b) => Math.min(Math.max(1, b), maxBet));
  }, [maxBet]);

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
    spinError,
    handleSpin,
    dismissResult,
  } = useSpinLogic({ gems: bet, players, allFilled, refreshWallet });

  const canSpin = !spinning && allFilled && gems >= 1 && bet >= 1 && bet <= gems;

  // ── Co-op slot animations ─────────────────────────────────────────────────
  const slotS0 = useSharedValue(1);
  const slotS1 = useSharedValue(1);
  const slotS2 = useSharedValue(1);
  const slotScales = [slotS0, slotS1, slotS2];
  const slot0Style = useAnimatedStyle(() => ({ transform: [{ scale: slotS0.value }] }));
  const slot1Style = useAnimatedStyle(() => ({ transform: [{ scale: slotS1.value }] }));
  const slot2Style = useAnimatedStyle(() => ({ transform: [{ scale: slotS2.value }] }));
  const slotStyles = [slot0Style, slot1Style, slot2Style];

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

  // gem-add shake — fires from useSpinLogic when the wager grows (Stepper +).
  // Amplitude/repeats scale with the wager so a +1→+5 sweep feels
  // progressively heavier.
  useEffect(() => {
    if (!gemShake) return;
    const amp = 3 + bet * 2;
    shakeX.value = withSequence(
      withTiming(-amp, { duration: 40 }),
      withRepeat(
        withSequence(withTiming(amp, { duration: 70 }), withTiming(-amp, { duration: 70 })),
        Math.ceil(bet * 1.5),
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
      // Vignette intensity scales with the WAGER (not the wallet) — a 5-gem
      // bet earns the dramatic full vignette regardless of how much else the
      // user has banked.
      const charge = getCharge(bet);
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
  // Slot 0 is the local player; any slot > 0 is an "invite this friend"
  // affordance that hands the user off to the real CoopRoomScreen. Local
  // state no longer pretends to track guest fills — that's the WS layer's
  // job once the user reaches the co-op screen.
  const meUserId = coop.state.meUserId ?? '';
  const slotType = (i: number): 'me' | 'player' | 'empty' => {
    if (isMultiplayer) {
      const p = coopPlayers[i];
      if (!p) return 'empty';
      return p.user_id === meUserId ? 'me' : 'player';
    }
    if (i === 0) return 'me';
    return 'empty';
  };

  const myCoopPlayer = isMultiplayer
    ? coopPlayers.find((p) => p.user_id === meUserId)
    : null;
  const myLocked = myCoopPlayer?.locked ?? false;
  const isHost = coop.state.hostId === meUserId;
  const wsOpen = coop.status === 'open';
  const coopEnded = isMultiplayer &&
    (coop.state.phase === 'ABORTED' || coop.state.phase === 'DISPOSED' || coop.state.phase === 'SETTLED');
  const coopDisconnected = isMultiplayer && coop.status === 'closed';

  const exitMultiplayer = () => {
    coop.leaveRoom();
    coop.deactivate();
  };

  // Auto-deactivate after 30s of closed connection
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (coopDisconnected) {
      disconnectTimerRef.current = setTimeout(() => {
        coop.deactivate();
      }, 30_000);
      return () => {
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      };
    }
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }, [coopDisconnected]);

  const handleBetChange = (v: number) => {
    setBet(v);
    if (isMultiplayer && wsOpen) coop.setStake(v);
  };

  const coopPhase = coop.state.phase;

  // Local 3-second countdown. Ignores server's absolute `started_at` timestamp
  // to avoid clock skew (server 4s ahead → countdown showed 7/6/5 instead of 3/2/1).
  const [coopCountdown, setCoopCountdown] = useState(3);
  const countdownLocalStart = useRef<number | null>(null);
  useEffect(() => {
    if (coopPhase !== 'COUNTDOWN') {
      countdownLocalStart.current = null;
      return;
    }
    countdownLocalStart.current = Date.now();
    const durationMs = coop.state.countdownDurationMs || 3000;
    setCoopCountdown(Math.ceil(durationMs / 1000));
    const update = () => {
      const elapsed = Date.now() - (countdownLocalStart.current ?? Date.now());
      const remaining = Math.max(0, durationMs - elapsed);
      setCoopCountdown(Math.ceil(remaining / 1000));
    };
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [coopPhase, coop.state.countdownDurationMs]);

  // Stuck-phase timeout: if SPINNING with an open WS but no frames for 30s.
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStuckPhase = isMultiplayer && wsOpen && coopPhase === 'SPINNING';
  const [stuckTimeout, setStuckTimeout] = useState(false);

  useEffect(() => {
    if (isStuckPhase) {
      setStuckTimeout(false);
      stuckTimerRef.current = setTimeout(() => setStuckTimeout(true), 30_000);
      return () => {
        if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
      };
    }
    setStuckTimeout(false);
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
  }, [isStuckPhase, coopPhase]);

  const spinBtnLabel = () => {
    if (isMultiplayer) {
      if (coopEnded) return '回到單人';
      if (coopDisconnected) return '重新連線';
      if (!wsOpen) return '連線中…';
      if (coopPhase === 'STAKING') {
        if (myLocked) return '等待其他人…';
        return '鎖定下注';
      }
      if (coopPhase === 'READY') {
        return isHost ? '開始！' : '等待房主開始…';
      }
      if (coopPhase === 'COUNTDOWN') return `${coopCountdown}`;
      if (coopPhase === 'SPINNING') return '轉啊轉…';
      if (coopPhase === 'REVEAL' || coopPhase === 'SETTLED') return '查看結果';
    }
    if (!allFilled) return '等待朋友加入';
    if (spinning) return '轉啊轉…';
    if (!spinning && result?.mult === 5) return 'RAGE SPIN';
    if (!spinning && result?.mult === 0) return '復仇轉！';
    return 'SPIN!';
  };

  const trySend = (action: () => boolean) => {
    if (!action()) {
      coop.clearError();
      // Surface a transient "connection lost" hint via the existing error banner.
      // The reducer will auto-clear it on the next successful frame.
    }
  };

  const handleMainButton = () => {
    if (isMultiplayer) {
      if (coopEnded) {
        exitMultiplayer();
        return;
      }
      if (coopDisconnected) {
        coop.reconnect();
        return;
      }
      if (coopPhase === 'STAKING' && !myLocked && wsOpen) {
        trySend(() => coop.lockStake());
        return;
      }
      if (coopPhase === 'READY' && isHost && wsOpen) {
        trySend(() => coop.startCountdown());
        return;
      }
      if (coopPhase === 'SETTLED') {
        trySend(() => coop.requestRematch());
        return;
      }
      return;
    }
    handleSpin();
  };


  const mainBtnDisabled = isMultiplayer
    ? (!wsOpen && !coopDisconnected && !coopEnded) ||
      (coopPhase === 'STAKING' && myLocked) ||
      (coopPhase === 'READY' && !isHost) ||
      coopPhase === 'COUNTDOWN' ||
      coopPhase === 'SPINNING'
    : !canSpin;

  const coopReveal = isMultiplayer && (coopPhase === 'REVEAL' || coopPhase === 'SETTLED')
    ? coop.state.reveal : null;
  const [coopRevealDismissed, setCoopRevealDismissed] = useState(false);
  const prevRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (coopReveal && coopReveal.roundId !== prevRoundIdRef.current) {
      prevRoundIdRef.current = coopReveal.roundId;
      setCoopRevealDismissed(false);
    }
  }, [coopReveal]);

  const coopRevealResult: SpinResult | null =
    coopReveal && !coopRevealDismissed
      ? {
          mult: coopReveal.M,
          points: coopReveal.totalPayout,
          color: MULTS.find((m) => m.v === coopReveal.M)?.color ?? '#2E2E2E',
        }
      : null;

  return (
    <View style={styles.screen}>
      {/* Environment background */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: envBgColor, opacity: envOpacity }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titleRow}>
          {isMultiplayer && (
            <Pressable
              testID="coop-exit-btn"
              onPress={exitMultiplayer}
              style={styles.exitBtn}
              accessibilityRole="button"
              accessibilityLabel="離開多人房"
            >
              <Text style={styles.exitBtnText}>←</Text>
            </Pressable>
          )}
          <Text style={styles.title}>CouSino</Text>
          {isMultiplayer && (
            <View style={[
              styles.statusPill,
              wsOpen && styles.statusPillOpen,
              coopDisconnected && styles.statusPillClosed,
            ]}>
              <Text style={styles.statusPillText}>
                {wsOpen ? '已連線' : coopDisconnected ? '已斷線' : '連線中…'}
              </Text>
            </View>
          )}
        </View>
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

      {/* Spin error banner */}
      {spinError && (
        <View style={styles.coopBanner}>
          <Text style={styles.coopBannerText}>轉盤失敗：{spinError}</Text>
        </View>
      )}

      {/* Co-op player stakes (live during STAKING) */}
      {isMultiplayer && coopPhase === 'STAKING' && (
        <View style={styles.stakingRoster}>
          {coop.state.players.map((p) => (
            <View key={p.user_id} style={[styles.stakingRow, p.locked && styles.stakingRowLocked]}>
              <Text style={styles.stakingName}>
                {p.user_id === (coop.state.meUserId ?? '') ? '我' : (p.display_name ?? '?')}
              </Text>
              <Text style={styles.stakingGems}>{p.stake} 💎</Text>
              <Text style={styles.stakingStatus}>{p.locked ? '✓' : '…'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Co-op status banners */}
      {isMultiplayer && coop.state.lastError && (
        <Pressable
          style={styles.coopBanner}
          onPress={coop.clearError}
        >
          <Text style={styles.coopBannerText}>
            ⚠ {coop.state.lastError.message}
          </Text>
        </Pressable>
      )}
      {isMultiplayer && coop.state.phase === 'ABORTED' && (
        <View style={styles.coopBanner}>
          <Text style={styles.coopBannerText}>
            房間已取消{coop.state.abortReason ? `：${coop.state.abortReason}` : ''}
          </Text>
        </View>
      )}
      {coopDisconnected && (
        <View style={[styles.coopBanner, styles.coopBannerWarn]}>
          <Text style={styles.coopBannerText}>連線中斷，點擊下方按鈕重新連線</Text>
        </View>
      )}
      {stuckTimeout && (
        <Pressable
          style={[styles.coopBanner, styles.coopBannerWarn]}
          onPress={() => { setStuckTimeout(false); coop.reconnect(); }}
        >
          <Text style={styles.coopBannerText}>連線逾時，點擊重新連線</Text>
        </Pressable>
      )}

      {/* Wheel area — zoom + shake */}
      <Reanimated.View style={[styles.wheelArea, shakeStyle]}>
        {/* Player slots */}
        <View style={styles.slots}>
          {Array.from({ length: displayPlayers }).map((_, i) => {
            const slot = slotType(i);
            const player = isMultiplayer ? coopPlayers[i] : null;
            const slotLabel = slot === 'me'
              ? '我'
              : slot === 'player'
                ? (player?.display_name?.slice(0, 2) ?? '?')
                : '+';
            return (
              <Reanimated.View key={i} style={slotStyles[i]}>
                <Pressable
                  testID="player-slot"
                  onPress={() => {
                    if (slot === 'empty' && i > 0) onNavigate('spinner-coop');
                  }}
                  style={[
                    styles.slot,
                    slot === 'me' && styles.slotMe,
                    slot === 'player' && styles.slotPlayer,
                    slot === 'empty' && styles.slotEmpty,
                  ]}
                >
                  {slot === 'empty' && i > 0 && (
                    <Reanimated.View
                      style={[StyleSheet.absoluteFill, styles.slotPulseRing, emptyRingStyle]}
                      pointerEvents="none"
                    />
                  )}
                  <Text style={styles.slotText}>{slotLabel}</Text>
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
            // Wheel rim heat (colour, width, glow) scales with the WAGER —
            // a 5-gem bet earns the purple max-rim regardless of how much
            // is left over in the wallet.
            gems={bet}
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

      {/* Co-op countdown overlay */}
      {isMultiplayer && coopPhase === 'COUNTDOWN' && (
        <View style={styles.countdownOverlay} pointerEvents="none">
          <Text style={styles.countdownNum}>{coopCountdown ?? 3}</Text>
          <Text style={styles.countdownHint}>準備好了嗎？</Text>
        </View>
      )}

      {/* Controls panel */}
      <View style={styles.controls}>
        <View testID="gem-pips-container">
          <GemPips count={5} filled={bet} />
        </View>
        <View style={styles.steppers}>
          <Stepper
            label="寶石"
            value={bet}
            min={isMultiplayer && coopPhase !== 'STAKING' ? bet : 1}
            max={isMultiplayer && coopPhase !== 'STAKING' ? bet : maxBet}
            onChange={handleBetChange}
            accent
          />
          {!isMultiplayer && (
            <>
              <View style={styles.divider} />
              <Stepper label="揪友" value={players} min={1} max={3} onChange={setPlayers} />
            </>
          )}
        </View>
        <Reanimated.View style={btnBreathStyle}>
          <Pressable
            testID="spin-button"
            onPress={handleMainButton}
            disabled={mainBtnDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: mainBtnDisabled }}
            style={[
              styles.spinBtn,
              !mainBtnDisabled ? styles.spinBtnActive : styles.spinBtnDisabled,
            ]}
          >
            <Text style={[styles.spinBtnText, mainBtnDisabled && styles.spinBtnTextDisabled]}>
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
        result={isMultiplayer ? null : result}
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

      {/* Co-op result — Phase 1: ResultModal with multiplier spring animation */}
      <ResultModal
        result={coopRevealResult}
        onDismiss={() => {
          setCoopRevealDismissed(true);
          if (coopReveal) coop.ackReveal(coopReveal.roundId);
        }}
      />

      {/* Co-op result — Phase 2: Lucky Rain per-player distribution */}
      {isMultiplayer && coopRevealDismissed && coopReveal && (coopPhase === 'REVEAL' || coopPhase === 'SETTLED') && (
        <View style={styles.coopResultOverlay}>
          <CoinRainReveal
            multiplier={coopReveal.M}
            totalPool={coopReveal.totalPayout}
            players={coopReveal.shares.map((s): PlayerResult => ({
              userId: s.user_id,
              seat: s.seat,
              displayName: `Seat ${s.seat}`,
              points: s.share,
              isMe: s.user_id === (coop.state.meUserId ?? ''),
            }))}
            onDone={() => coop.requestRematch()}
          />
        </View>
      )}

      <Coachmark screen="spinner" />
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
  slotPlayer: { backgroundColor: colors.green },
  slotEmpty: { backgroundColor: '#FFFFFF' },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exitBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#fff',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statusPillOpen: {
    backgroundColor: 'rgba(0,200,150,0.25)',
  },
  statusPillClosed: {
    backgroundColor: 'rgba(238,51,85,0.3)',
  },
  statusPillText: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: '#fff',
  },
  coopBanner: {
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(238,51,85,0.15)',
  },
  coopBannerWarn: {
    backgroundColor: 'rgba(255,173,49,0.2)',
  },
  coopBannerText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  countdownNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 96,
    color: colors.yellow,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  countdownHint: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -4,
  },
  stakingRoster: {
    marginHorizontal: 16,
    marginBottom: 4,
    gap: 4,
  },
  stakingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stakingRowLocked: {
    borderColor: colors.green,
    backgroundColor: 'rgba(0,200,150,0.08)',
  },
  stakingName: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#fff',
  },
  stakingGems: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 13,
    color: colors.purpleLight,
    marginRight: 8,
  },
  stakingStatus: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 13,
    color: colors.green,
    width: 20,
    textAlign: 'center',
  },
  coopResultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  coopResultCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2.5,
    borderColor: colors.yellow,
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    minWidth: 240,
  },
  coopResultTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: '#fff',
  },
  coopResultMult: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 48,
    color: colors.yellow,
    letterSpacing: -2,
  },
  coopResultCredit: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: colors.green,
  },
  coopResultBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
  },
  coopResultBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    color: colors.fg,
  },
});
