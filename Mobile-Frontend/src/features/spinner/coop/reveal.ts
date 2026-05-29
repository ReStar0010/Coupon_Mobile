/**
 * Pure choreography helpers for the reveal animation.
 *
 * The server emits `room.reveal` with a `reveal_plan.phases[]` array of
 * { phase, duration_ms, payload }. The client walks that timeline locally,
 * lerping between values inside each phase. All randomness has already been
 * decided by the server — these helpers are deterministic visual easing.
 */

import type { RevealPlanPhase } from './coopProtocol';

export type RevealPhaseName = 'pre' | 'total' | 'floor' | 'excess' | 'done';

export interface RevealCue {
  /** Currently-running phase. 'pre' before the timeline starts; 'done' after end. */
  phase: RevealPhaseName;
  /** Progress within the active phase, [0..1]. 'pre'/'done' are 0/1. */
  phaseProgress: number;
  /** Indexes that have completed (so caller can render past phases at full value). */
  completed: ReadonlySet<RevealPhaseName>;
  /** Cumulative ms elapsed since reveal start. */
  elapsedMs: number;
  /** Total scheduled duration (sum of phases). */
  totalMs: number;
}

const KNOWN_PHASES: RevealPhaseName[] = ['total', 'floor', 'excess'];

/**
 * Compute which reveal phase is active at `elapsedMs` and how far through it
 * we are. Phases run in declaration order from the server's reveal_plan.
 */
export function getRevealCue(elapsedMs: number, phases: readonly RevealPlanPhase[]): RevealCue {
  const totalMs = phases.reduce((s, p) => s + p.duration_ms, 0);
  const completed = new Set<RevealPhaseName>();

  if (elapsedMs <= 0) {
    return { phase: 'pre', phaseProgress: 0, completed, elapsedMs: 0, totalMs };
  }
  if (elapsedMs >= totalMs) {
    for (const p of phases) {
      if (isKnownPhase(p.phase)) completed.add(p.phase);
    }
    return { phase: 'done', phaseProgress: 1, completed, elapsedMs: totalMs, totalMs };
  }

  let accum = 0;
  for (const p of phases) {
    if (elapsedMs < accum + p.duration_ms) {
      const phaseProgress = (elapsedMs - accum) / Math.max(1, p.duration_ms);
      return {
        phase: isKnownPhase(p.phase) ? p.phase : 'pre',
        phaseProgress: clamp01(phaseProgress),
        completed,
        elapsedMs,
        totalMs,
      };
    }
    accum += p.duration_ms;
    if (isKnownPhase(p.phase)) completed.add(p.phase);
  }
  // Shouldn't reach here given the totalMs check, but be defensive.
  return { phase: 'done', phaseProgress: 1, completed, elapsedMs: totalMs, totalMs };
}

/** Linear interpolation. Caller is responsible for clamping `t` if needed. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a value to [0, 1]. NaN becomes 0. */
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Convenience: given the cue + a "final value", return the visible value at
 * `cue` for a given phase.
 *
 *  - if the phase is in `completed`, return `finalValue`
 *  - if it IS the active phase, return lerp(0, finalValue, phaseProgress)
 *  - if it's later than the active phase, return 0
 */
export function visibleValue(
  cue: RevealCue,
  forPhase: RevealPhaseName,
  finalValue: number,
): number {
  if (cue.phase === 'done' || cue.completed.has(forPhase)) return finalValue;
  if (cue.phase === forPhase) return lerp(0, finalValue, cue.phaseProgress);
  return 0;
}

function isKnownPhase(s: string): s is RevealPhaseName {
  return (KNOWN_PHASES as string[]).includes(s);
}
