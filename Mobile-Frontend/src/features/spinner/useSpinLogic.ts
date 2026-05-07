import { useState, useRef, useEffect } from 'react';
import { MULTS, MELT_MULTS, getFloor } from './constants';
import type { SpinResult } from './ResultModal';

export type SpinPhase = 'idle' | 'launch' | 'peak' | 'decel' | 'pause' | 'reveal' | 'meltdown';

interface SpinLogicOptions {
  gems: number;
  setGems: (fn: (prev: number) => number) => void;
  setCouPoints: (fn: (prev: number) => number) => void;
  players: number;
  allFilled: boolean;
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
  handleSpin: () => void;
  dismissResult: () => void;
}

export function useSpinLogic({
  gems,
  setGems,
  setCouPoints,
  players,
  allFilled,
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

  const prevGemsRef = useRef(gems);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const floor = getFloor(gems, players);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const push = (fn: () => void, ms: number) => {
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

  const handleSpin = () => {
    if (spinning || !allFilled || gems < 1) return;

    clearTimers();
    setSpinning(true);
    setResult(null);
    setMeltdownResult(null);
    setNearMiss(false);
    setPhase('launch');

    const gemsUsed = gems;
    setGemsAtSpin(gemsUsed);
    setGems((prev) => prev - 1);

    const available = MULTS.filter((m) => m.v >= floor);
    const weights = available.map((m) => 1 / (m.v + 1));
    const total = weights.reduce((a, b) => a + b, 0);

    let pick = Math.random() * total;
    let chosen = available[0];
    for (let i = 0; i < available.length; i++) {
      pick -= weights[i];
      if (pick <= 0) {
        chosen = available[i];
        break;
      }
    }

    setPendingColor(chosen.color);

    let acc = 0;
    let centerDeg = 0;
    for (let i = 0; i < available.length; i++) {
      const w = (weights[i] / total) * 360;
      if (available[i].v === chosen.v) {
        centerDeg = acc + w / 2;
        break;
      }
      acc += w;
    }

    setSpin((s) => {
      const currentMod = ((s % 360) + 360) % 360;
      const sectorPos = (centerDeg + currentMod) % 360;
      const adjustment = sectorPos === 0 ? 360 : 360 - sectorPos;
      return s + 360 * 7 + adjustment + (Math.random() * 4 - 2);
    });

    push(() => setPhase('peak'), 500);
    push(() => setPhase('decel'), 2000);
    push(() => setPhase('pause'), 4200);
    push(() => {
      setSpinning(false);
      const earnedPts = gemsUsed * chosen.v;
      const miss = chosen.v <= 1 && Math.random() < 0.38;
      setNearMiss(miss);
      setResult({ mult: chosen.v, points: earnedPts, color: chosen.color });
      setCouPoints((p) => p + earnedPts);
      setPhase('reveal');
      setPendingColor(null);

      if (chosen.v === 5) {
        timers.current.push(
          setTimeout(() => {
            const rnd = Math.random();
            let cumProb = 0;
            let meltChosen = MELT_MULTS[0];
            for (const m of MELT_MULTS) {
              cumProb += m.prob;
              if (rnd <= cumProb) {
                meltChosen = m;
                break;
              }
            }

            const mWeights = MELT_MULTS.map((m) => 1 / (m.v + 1));
            const mTotal = mWeights.reduce((a, b) => a + b, 0);
            let mAcc = 0;
            let mCenterDeg = 0;
            for (let i = 0; i < MELT_MULTS.length; i++) {
              const w = (mWeights[i] / mTotal) * 360;
              if (MELT_MULTS[i].v === meltChosen.v) {
                mCenterDeg = mAcc + w / 2;
                break;
              }
              mAcc += w;
            }

            setMeltdownSpinning(true);
            setMeltdownSpin((prev) => {
              const mod = ((prev % 360) + 360) % 360;
              const pos = (mCenterDeg + mod) % 360;
              const adj = pos === 0 ? 360 : 360 - pos;
              return prev + 360 * 5 + adj + (Math.random() * 4 - 2);
            });
            setPhase('meltdown');

            timers.current.push(
              setTimeout(() => {
                setMeltdownSpinning(false);
                const bonus = earnedPts * (meltChosen.v - 1);
                setMeltdownResult({
                  mult: meltChosen.v,
                  points: earnedPts * meltChosen.v,
                  color: meltChosen.color,
                });
                setCouPoints((p) => p + bonus);
              }, 2200),
            );
          }, 2500),
        );
      }
    }, 4700);
  };

  const dismissResult = () => {
    setResult(null);
    setMeltdownResult(null);
    setNearMiss(false);
    setPhase('idle');
    setGemsAtSpin(0);
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
    handleSpin,
    dismissResult,
  };
}
