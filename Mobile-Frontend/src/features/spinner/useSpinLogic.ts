import { useState, useRef, useEffect } from 'react';
import { MULTS, getFloor } from './constants';
import type { SpinResult } from './ResultModal';

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
  const prevGemsRef = useRef(gems);
  const floor = getFloor(gems, players);

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

    setSpinning(true);
    setResult(null);
    const gemsUsed = gems;
    setGems((prev) => prev - 1);

    const available = MULTS.filter((m) => m.v >= floor);
    const weights = available.map((m) => 1 / (m.v + 1));
    const total = weights.reduce((a, b) => a + b, 0);

    let pick = Math.random() * total;
    let chosen = available[0];
    for (let i = 0; i < available.length; i++) {
      pick -= weights[i];
      if (pick <= 0) { chosen = available[i]; break; }
    }

    let acc = 0;
    let centerDeg = 0;
    for (let i = 0; i < available.length; i++) {
      const w = (weights[i] / total) * 360;
      if (available[i].v === chosen.v) { centerDeg = acc + w / 2; break; }
      acc += w;
    }

    const target = 360 * 8 - centerDeg + (Math.random() * 8 - 4);
    setSpin((s) => s + target);

    const t = setTimeout(() => {
      setSpinning(false);
      setTimeout(() => {
        const earnedPts = gemsUsed * chosen.v;
        setResult({ mult: chosen.v, points: earnedPts, color: chosen.color });
        setCouPoints((p) => p + earnedPts);
      }, 350);
    }, 4800);

    return () => clearTimeout(t);
  };

  const dismissResult = () => setResult(null);

  return { spin, spinning, result, gemShake, floor, handleSpin, dismissResult };
}
