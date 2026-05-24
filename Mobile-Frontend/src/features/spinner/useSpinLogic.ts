import { useState, useRef, useEffect } from 'react';
import { MULTS, MELT_MULTS, getFloor } from './constants';
import type { SpinResult } from './ResultModal';
import { drawSpinner } from '../../services/api/spinner';
import type { SpinnerDrawResult } from '../../services/api/spinner';
import { ApiRequestError } from '../../services/api/errors';
import { localizeError } from '../../services/api/errorMessages';
import { track } from '../../services/analytics/posthog';
import { getFlag } from '../../services/analytics/flags';

/** Variants for the first spinner A/B test. Wired into PostHog as a multivariate flag. */
export type SpinnerCostVariant = 'default' | 'cheap' | 'bundled';

export type SpinPhase = 'idle' | 'launch' | 'peak' | 'decel' | 'pause' | 'reveal' | 'meltdown';

interface SpinLogicOptions {
  /** Number of gems being wagered this spin (1..5). */
  gems: number;
  players: number;
  allFilled: boolean;
  /** Called after the reveal settles so the global wallet picks up the server-authoritative balances. */
  refreshWallet?: () => Promise<void> | void;
}

interface SpinLogicReturn {
  spin: number;
  spinning: boolean;
  result: SpinResult | null;
  gemShake: boolean;
  floor: number;
  phase: SpinPhase;
  nearMiss: boolean;
  pendingColor: string | null;
  gemsAtSpin: number;
  meltdownResult: SpinResult | null;
  meltdownSpin: number;
  meltdownSpinning: boolean;
  spinError: string | null;
  handleSpin: () => void;
  dismissResult: () => void;
}

interface SectorMath {
  centerDeg: number;
  color: string;
}

function computeSectorMath(
  table: ReadonlyArray<{ v: number; color: string }>,
  multiplier: number,
): SectorMath {
  const weights = table.map((m) => 1 / (m.v + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  // WheelDial draws sectors starting at -90° (top). Accumulate from -90°
  // so the target degree matches the visual position under the top needle.
  let acc = -90;
  for (let i = 0; i < table.length; i++) {
    const w = (weights[i] / total) * 360;
    if (table[i].v === multiplier) {
      return { centerDeg: ((acc + w / 2) % 360 + 360) % 360, color: table[i].color };
    }
    acc += w;
  }
  return { centerDeg: 0, color: table[0]?.color ?? '#2E2E2E' };
}

export function useSpinLogic({
  gems,
  players,
  allFilled,
  refreshWallet,
}: SpinLogicOptions): SpinLogicReturn {
  const [spin, setSpin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [gemShake, setGemShake] = useState(false);
  const [phase, setPhase] = useState<SpinPhase>('idle');
  const [nearMiss, setNearMiss] = useState(false);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [gemsAtSpin, setGemsAtSpin] = useState(0);
  const [meltdownResult, setMeltdownResult] = useState<SpinResult | null>(null);
  const [meltdownSpin, setMeltdownSpin] = useState(0);
  const [meltdownSpinning, setMeltdownSpinning] = useState(false);
  const [serverFloor, setServerFloor] = useState<number | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);

  const prevGemsRef = useRef(gems);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const localFloor = getFloor(gems, players);
  const floor = serverFloor ?? localFloor;

  const clearTimers = (): void => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const push = (fn: () => void, ms: number): void => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (gems > prevGemsRef.current) {
      const dur = 200 + gems * 60;
      setGemShake(true);
      const t = setTimeout(() => setGemShake(false), dur);
      return () => clearTimeout(t);
    }
    prevGemsRef.current = gems;
    return undefined;
  }, [gems]);

  const startAnimation = (draw: SpinnerDrawResult): void => {
    const { multiplier, meltdownMultiplier, gemsUsed, pointsEarned } = draw;

    setGemsAtSpin(gemsUsed);
    setServerFloor(draw.floor);

    const filteredMults = MULTS.filter((m) => m.v >= draw.floor);
    const sector = computeSectorMath(filteredMults, multiplier);
    setPendingColor(sector.color);

    setSpin((s) => {
      const currentMod = ((s % 360) + 360) % 360;
      const sectorPos = (sector.centerDeg + currentMod) % 360;
      const adjustment = sectorPos === 0 ? 360 : 360 - sectorPos;
      // Keep the same 4.7s feel: 7 full rotations + sector-targeted offset + jitter.
      return s + 360 * 7 + adjustment + (Math.random() * 4 - 2);
    });

    push(() => setPhase('peak'), 500);
    push(() => setPhase('decel'), 2000);
    push(() => setPhase('pause'), 4200);
    push(() => {
      setSpinning(false);
      const miss = multiplier <= 1 && Math.random() < 0.38;
      setNearMiss(miss);
      // For x5 + meltdown the points should reveal the meltdown total only after
      // the meltdown wheel settles. The base reveal shows the wheel-stop tier.
      const baseRevealPoints =
        meltdownMultiplier !== null && meltdownMultiplier !== undefined
          ? gemsUsed * multiplier
          : pointsEarned;
      setResult({ mult: multiplier, points: baseRevealPoints, color: sector.color });
      setPhase('reveal');
      setPendingColor(null);

      if (multiplier === 5 && meltdownMultiplier !== null && meltdownMultiplier !== undefined) {
        push(() => {
          const mSector = computeSectorMath(MELT_MULTS, meltdownMultiplier);

          setMeltdownSpinning(true);
          setMeltdownSpin((prev) => {
            const mod = ((prev % 360) + 360) % 360;
            const pos = (mSector.centerDeg + mod) % 360;
            const adj = pos === 0 ? 360 : 360 - pos;
            return prev + 360 * 5 + adj + (Math.random() * 4 - 2);
          });
          setPhase('meltdown');

          push(() => {
            setMeltdownSpinning(false);
            setMeltdownResult({
              mult: meltdownMultiplier,
              points: pointsEarned,
              color: mSector.color,
            });
            if (refreshWallet) {
              void Promise.resolve(refreshWallet()).catch(() => undefined);
            }
          }, 2200);
        }, 2500);
      } else if (refreshWallet) {
        void Promise.resolve(refreshWallet()).catch(() => undefined);
      }
    }, 4700);
  };

  const handleSpin = (): void => {
    if (spinning || !allFilled || gems < 1) return;

    clearTimers();
    setSpinning(true);
    setResult(null);
    setMeltdownResult(null);
    setNearMiss(false);
    setSpinError(null);
    setPhase('launch');

    const betSnapshot = gems;
    const costVariant = getFlag<SpinnerCostVariant>('spinner_cost_variant', 'default');
    track('spinner.draw_started', { gems: betSnapshot, players, costVariant });

    void drawSpinner(betSnapshot)
      .then((draw) => {
        // Fire on EVERY completed draw, win or lose. `won` is a property
        // so funnel queries filter on it; do NOT branch the event name,
        // otherwise every experiment query needs to OR two event names
        // together. (Convention also applies to coupon.redeem_succeeded
        // which is a one-shot success-only event; this one is the
        // outcome-bearing completion event.)
        track('spinner.draw_completed', {
          gems: betSnapshot,
          players,
          multiplier: draw.multiplier,
          won: draw.multiplier > 0,
          costVariant,
        });
        startAnimation(draw);
      })
      .catch((err: unknown) => {
        clearTimers();
        setSpinning(false);
        setPhase('idle');
        setPendingColor(null);
        setSpinError(localizeError(err));
        if (refreshWallet) {
          void Promise.resolve(refreshWallet()).catch(() => undefined);
        }
      });
  };

  const dismissResult = (): void => {
    clearTimers();
    setResult(null);
    setMeltdownResult(null);
    setNearMiss(false);
    setPhase('idle');
    setGemsAtSpin(0);
    setServerFloor(null);
  };

  return {
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
  };
}
