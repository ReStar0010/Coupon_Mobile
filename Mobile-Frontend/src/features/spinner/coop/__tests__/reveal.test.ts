import { clamp01, getRevealCue, lerp, visibleValue } from '../reveal';
import type { RevealPlanPhase } from '../coopProtocol';

const PLAN: RevealPlanPhase[] = [
  { phase: 'total', duration_ms: 600, payload: {} },
  { phase: 'floor', duration_ms: 800, payload: {} },
  { phase: 'excess', duration_ms: 1200, payload: {} },
];

describe('lerp', () => {
  it('returns endpoints at t=0,1', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it('midpoint at t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});

describe('clamp01', () => {
  it('clamps below 0 to 0', () => expect(clamp01(-1)).toBe(0));
  it('clamps above 1 to 1', () => expect(clamp01(2)).toBe(1));
  it('passes through middle values', () => expect(clamp01(0.4)).toBe(0.4));
  it('NaN → 0', () => expect(clamp01(NaN)).toBe(0));
});

describe('getRevealCue', () => {
  it('returns pre at elapsed <= 0', () => {
    const c = getRevealCue(0, PLAN);
    expect(c.phase).toBe('pre');
    expect(c.phaseProgress).toBe(0);
    expect(c.totalMs).toBe(2600);
  });

  it('inside total phase: phase=total with linear progress', () => {
    const c = getRevealCue(300, PLAN);
    expect(c.phase).toBe('total');
    expect(c.phaseProgress).toBeCloseTo(0.5, 4);
    expect(c.completed.size).toBe(0);
  });

  it('inside floor phase: total is completed', () => {
    const c = getRevealCue(600 + 400, PLAN);
    expect(c.phase).toBe('floor');
    expect(c.phaseProgress).toBeCloseTo(0.5, 4);
    expect(c.completed.has('total')).toBe(true);
    expect(c.completed.has('floor')).toBe(false);
  });

  it('inside excess phase: total + floor are completed', () => {
    const c = getRevealCue(600 + 800 + 600, PLAN);
    expect(c.phase).toBe('excess');
    expect(c.phaseProgress).toBeCloseTo(0.5, 4);
    expect(c.completed.has('total')).toBe(true);
    expect(c.completed.has('floor')).toBe(true);
  });

  it('returns done at the end', () => {
    const c = getRevealCue(2600, PLAN);
    expect(c.phase).toBe('done');
    expect(c.phaseProgress).toBe(1);
    expect(c.completed.has('total')).toBe(true);
    expect(c.completed.has('floor')).toBe(true);
    expect(c.completed.has('excess')).toBe(true);
  });

  it('returns done past the end too', () => {
    const c = getRevealCue(99_999, PLAN);
    expect(c.phase).toBe('done');
  });

  it('handles empty plan as immediate done', () => {
    const c = getRevealCue(100, []);
    // totalMs == 0 → elapsedMs >= totalMs is true → 'done'
    expect(c.phase).toBe('done');
  });
});

describe('visibleValue', () => {
  const plan = PLAN;
  it('returns 0 for a phase that has not started yet', () => {
    const c = getRevealCue(300, plan); // active phase 'total'
    expect(visibleValue(c, 'floor', 50)).toBe(0);
    expect(visibleValue(c, 'excess', 30)).toBe(0);
  });

  it('returns lerped value for the active phase', () => {
    const c = getRevealCue(300, plan); // 50% through 'total'
    expect(visibleValue(c, 'total', 100)).toBe(50);
  });

  it('returns the final value for completed phases', () => {
    const c = getRevealCue(600 + 400, plan); // active 'floor'; 'total' completed
    expect(visibleValue(c, 'total', 100)).toBe(100);
  });

  it('returns final value for every phase when done', () => {
    const c = getRevealCue(99_999, plan);
    expect(visibleValue(c, 'total', 100)).toBe(100);
    expect(visibleValue(c, 'floor', 50)).toBe(50);
    expect(visibleValue(c, 'excess', 7)).toBe(7);
  });
});
