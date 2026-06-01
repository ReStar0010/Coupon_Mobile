/**
 * Co-op spin animation driver.
 *
 * Mirrors the *outputs* of `useSpinLogic` (spin / spinning / phase / result /
 * …) but is driven by server WS phase transitions instead of a local
 * `drawSpinner()` call. This lets the co-op flow reuse the exact solo
 * `WheelDial` + effect stack in `SpinnerScreen`.
 *
 * The catch it solves: at SPINNING the client doesn't yet know the result
 * multiplier (`room.spinning` carries none). So:
 *   1. SPINNING        → free-spin the wheel (constant velocity, no target).
 *   2. room.reveal (M) → decelerate-and-land on the result sector, then emit
 *      `result` so the reveal effects fire.
 *
 * Server stays authoritative: `M` is never guessed, only rendered once revealed.
 */

import { useEffect, useRef, useState } from 'react';
import { MULTS } from '../constants';
import { computeSectorMath, computeLandingSpin } from '../spinnerMath';
import type { SpinResult } from '../ResultModal';
import type { SpinPhase } from '../useSpinLogic';
import type { WheelSpinMode } from '../WheelDial';
import type { CoopState } from './coopReducer';
import type { Phase } from './coopProtocol';

/** Linear segment length for the free-spin; WheelDial's `freeChunkMs` must match. */
export const COOP_FREE_CHUNK_MS = 600;
/** Ease-out duration for the reveal landing; WheelDial's `landDurationMs` must match. */
export const COOP_LAND_DURATION_MS = 2000;

const FREE_CHUNK_DEG = 360;
const LAUNCH_TO_PEAK_MS = 500;
const PAUSE_MS = 350;
const LAND_MIN_ROTATIONS = 3;
const NEAR_MISS_CHANCE = 0.38;

/** Phases before the spin begins — entering any of these resets the wheel. */
const PRE_SPIN: ReadonlySet<Phase> = new Set<Phase>([
  'SOLO',
  'LOBBY_OPEN',
  'STAKING',
  'READY',
  'COUNTDOWN',
  'CHARGING',
]);

export interface CoopSpinAnimation {
  spin: number;
  spinning: boolean;
  phase: SpinPhase;
  result: SpinResult | null;
  pendingColor: string | null;
  nearMiss: boolean;
  gemsAtSpin: number;
  floor: number;
  spinMode: WheelSpinMode;
}

interface CoopSpinAnimationArgs {
  /** Server phase (`coop.state.phase`). */
  phase: Phase | null;
  /** Reveal payload (`coop.state.reveal`). */
  reveal: CoopState['reveal'];
  /** Round floor (`coop.state.floor`). */
  floor: number | null;
  /** This connection's user id, for picking my own share. */
  meUserId: string;
  /** My staked gems this round — drives rim heat + gem-vanish count. */
  myStake: number;
  /** False in solo mode; the hook idles and runs no timers. */
  enabled: boolean;
}

const IDLE: CoopSpinAnimation = {
  spin: 0,
  spinning: false,
  phase: 'idle',
  result: null,
  pendingColor: null,
  nearMiss: false,
  gemsAtSpin: 0,
  floor: 0,
  spinMode: 'free',
};

export function useCoopSpinAnimation({
  phase,
  reveal,
  floor,
  meUserId,
  myStake,
  enabled,
}: CoopSpinAnimationArgs): CoopSpinAnimation {
  const [spin, setSpin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinPhase, setSpinPhase] = useState<SpinPhase>('idle');
  const [result, setResult] = useState<SpinResult | null>(null);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [nearMiss, setNearMiss] = useState(false);
  const [gemsAtSpin, setGemsAtSpin] = useState(0);
  const [spinMode, setSpinMode] = useState<WheelSpinMode>('free');

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const freeIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sawSpinningRef = useRef(false);
  const handledRoundRef = useRef<string | null>(null);

  const clearTimers = (): void => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const stopFreeSpin = (): void => {
    if (freeIvRef.current) {
      clearInterval(freeIvRef.current);
      freeIvRef.current = null;
    }
  };

  // Reset on a fresh round (pre-spin phases) or terminal phases. SETTLED/REVEAL
  // are intentionally excluded so the landed result persists through the reveal.
  useEffect(() => {
    if (!enabled) return;
    const isPreSpin = phase === null || PRE_SPIN.has(phase);
    const isEnded = phase === 'ABORTED' || phase === 'DISPOSED';
    if (!isPreSpin && !isEnded) return;
    clearTimers();
    stopFreeSpin();
    sawSpinningRef.current = false;
    setSpinning(false);
    setSpinMode('free');
    setSpinPhase('idle');
    setResult(null);
    setNearMiss(false);
    setGemsAtSpin(0);
    setPendingColor(null);
  }, [enabled, phase]);

  // SPINNING → free-spin (target unknown yet).
  useEffect(() => {
    if (!enabled || phase !== 'SPINNING') return;
    sawSpinningRef.current = true;
    setResult(null);
    setNearMiss(false);
    setPendingColor(null);
    setGemsAtSpin(myStake);
    setSpinMode('free');
    setSpinning(true);
    setSpinPhase('launch');
    const peak = setTimeout(() => setSpinPhase('peak'), LAUNCH_TO_PEAK_MS);
    timers.current.push(peak);
    freeIvRef.current = setInterval(() => {
      setSpin((s) => s + FREE_CHUNK_DEG);
    }, COOP_FREE_CHUNK_MS);
    return stopFreeSpin;
  }, [enabled, phase, myStake]);

  // room.reveal → land on the result sector, then emit the result.
  useEffect(() => {
    if (!enabled || phase !== 'REVEAL' || !reveal) return;
    if (handledRoundRef.current === reveal.roundId) return;
    handledRoundRef.current = reveal.roundId;
    stopFreeSpin();

    const table = MULTS.filter((m) => m.v >= reveal.f);
    const sector = computeSectorMath(table, reveal.M);
    setPendingColor(sector.color);

    const myShare = reveal.shares.find((s) => s.user_id === meUserId);
    const myPoints = myShare ? myShare.floor + myShare.excess : 0;
    const res: SpinResult = {
      mult: reveal.M,
      points: myPoints,
      color: MULTS.find((m) => m.v === reveal.M)?.color ?? sector.color,
    };

    // Mounted straight into REVEAL (reconnect) — no spin in flight to
    // decelerate, so settle on the sector instantly and show the result.
    if (!sawSpinningRef.current) {
      setSpinMode('land');
      setSpinning(false);
      setSpin((s) => computeLandingSpin(s, sector.centerDeg, 0));
      setGemsAtSpin(myStake);
      setSpinPhase('reveal');
      setNearMiss(false);
      setResult(res);
      return;
    }

    setSpinMode('land');
    setSpinning(true);
    setSpinPhase('decel');
    setSpin((s) => computeLandingSpin(s, sector.centerDeg, LAND_MIN_ROTATIONS));

    const pause = setTimeout(() => setSpinPhase('pause'), COOP_LAND_DURATION_MS);
    const revealEffects = setTimeout(() => {
      setSpinning(false);
      setSpinPhase('reveal');
      setNearMiss(reveal.M <= 1 && Math.random() < NEAR_MISS_CHANCE);
      setResult(res);
    }, COOP_LAND_DURATION_MS + PAUSE_MS);
    timers.current.push(pause, revealEffects);
  }, [enabled, phase, reveal, meUserId, myStake]);

  // Idle + cleanup when disabled (solo mode) and on unmount.
  useEffect(() => {
    if (enabled) return;
    clearTimers();
    stopFreeSpin();
    handledRoundRef.current = null;
    sawSpinningRef.current = false;
  }, [enabled]);

  useEffect(
    () => () => {
      clearTimers();
      stopFreeSpin();
    },
    [],
  );

  if (!enabled) return IDLE;

  return {
    spin,
    spinning,
    phase: spinPhase,
    result,
    pendingColor,
    nearMiss,
    gemsAtSpin,
    floor: floor ?? reveal?.f ?? 0,
    spinMode,
  };
}
