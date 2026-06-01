/**
 * useCoopSpinAnimation — co-op wheel animation driver.
 *
 * The driver turns server WS phase transitions into the same outputs
 * `useSpinLogic` produces, so co-op can reuse the solo wheel + effect stack.
 * Behaviours under test:
 *   - idle when disabled (solo mode)
 *   - SPINNING → free-spin (launch→peak, spinMode 'free', spin advances)
 *   - REVEAL after a spin → land (decel→pause→reveal) emitting my own share
 *   - REVEAL without a prior spin (reconnect) → immediate result, no spin
 *   - new round resets the wheel to idle
 */

import { renderHook, act } from '@testing-library/react-native';
import {
  useCoopSpinAnimation,
  COOP_FREE_CHUNK_MS,
  COOP_LAND_DURATION_MS,
} from '../useCoopSpinAnimation';
import type { CoopState } from '../coopReducer';
import type { Phase } from '../coopProtocol';

type Reveal = NonNullable<CoopState['reveal']>;

const ME = 'me';

function makeReveal(over: Partial<Reveal> = {}): Reveal {
  return {
    roundId: 'r1',
    M: 3,
    gTotal: 3,
    f: 0,
    totalPayout: 9,
    shares: [
      { user_id: ME, seat: 1, stake: 1, floor: 3, excess: 2, share: 5 },
      { user_id: 'p2', seat: 2, stake: 2, floor: 6, excess: 1, share: 7 },
    ],
    plan: { phases: [] },
    ...over,
  };
}

interface Props {
  phase: Phase | null;
  reveal: CoopState['reveal'];
  floor: number | null;
  meUserId: string;
  myStake: number;
  enabled: boolean;
}

const base: Props = {
  phase: 'STAKING',
  reveal: null,
  floor: 0,
  meUserId: ME,
  myStake: 2,
  enabled: true,
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  (Math.random as jest.Mock).mockRestore?.();
});

describe('useCoopSpinAnimation', () => {
  it('is idle when disabled (solo mode)', () => {
    const { result } = renderHook((p: Props) => useCoopSpinAnimation(p), {
      initialProps: { ...base, enabled: false, phase: 'SPINNING' },
    });
    expect(result.current.spinning).toBe(false);
    expect(result.current.phase).toBe('idle');
    expect(result.current.result).toBeNull();
  });

  it('free-spins on SPINNING: launch→peak, mode free, spin advances', () => {
    const { result, rerender } = renderHook((p: Props) => useCoopSpinAnimation(p), {
      initialProps: base,
    });

    act(() => rerender({ ...base, phase: 'SPINNING' }));
    expect(result.current.spinning).toBe(true);
    expect(result.current.phase).toBe('launch');
    expect(result.current.spinMode).toBe('free');
    expect(result.current.gemsAtSpin).toBe(2); // myStake

    act(() => jest.advanceTimersByTime(500));
    expect(result.current.phase).toBe('peak');

    const before = result.current.spin;
    act(() => jest.advanceTimersByTime(COOP_FREE_CHUNK_MS));
    expect(result.current.spin).toBeGreaterThan(before);
  });

  it('lands on reveal: decel→pause→reveal, emits my share', () => {
    const { result, rerender } = renderHook((p: Props) => useCoopSpinAnimation(p), {
      initialProps: base,
    });
    act(() => rerender({ ...base, phase: 'SPINNING' }));
    act(() => jest.advanceTimersByTime(COOP_FREE_CHUNK_MS));

    const reveal = makeReveal();
    act(() => rerender({ ...base, phase: 'REVEAL', reveal }));
    expect(result.current.spinMode).toBe('land');
    expect(result.current.phase).toBe('decel');
    expect(result.current.spinning).toBe(true);
    expect(result.current.result).toBeNull(); // not until the wheel lands

    act(() => jest.advanceTimersByTime(COOP_LAND_DURATION_MS));
    expect(result.current.phase).toBe('pause');

    act(() => jest.advanceTimersByTime(400));
    expect(result.current.phase).toBe('reveal');
    expect(result.current.spinning).toBe(false);
    // my share = floor(3) + excess(2) = 5
    expect(result.current.result).toEqual({ mult: 3, points: 5, color: expect.any(String) });
  });

  it('reconnect mid-REVEAL (no prior spin) shows result immediately', () => {
    const { result, rerender } = renderHook((p: Props) => useCoopSpinAnimation(p), {
      initialProps: { ...base, phase: 'READY' },
    });
    const reveal = makeReveal();
    act(() => rerender({ ...base, phase: 'REVEAL', reveal }));

    expect(result.current.phase).toBe('reveal');
    expect(result.current.spinning).toBe(false);
    expect(result.current.result?.points).toBe(5);
  });

  it('resets to idle when a new round begins', () => {
    const { result, rerender } = renderHook((p: Props) => useCoopSpinAnimation(p), {
      initialProps: base,
    });
    // Run a full round.
    act(() => rerender({ ...base, phase: 'SPINNING' }));
    act(() => rerender({ ...base, phase: 'REVEAL', reveal: makeReveal() }));
    act(() => jest.advanceTimersByTime(COOP_LAND_DURATION_MS + 400));
    expect(result.current.result).not.toBeNull();

    // Rematch → STAKING resets the wheel.
    act(() => rerender({ ...base, phase: 'STAKING' }));
    expect(result.current.phase).toBe('idle');
    expect(result.current.spinning).toBe(false);
    expect(result.current.result).toBeNull();

    // A fresh round's reveal (new roundId) is handled again.
    act(() => rerender({ ...base, phase: 'SPINNING' }));
    act(() => rerender({ ...base, phase: 'REVEAL', reveal: makeReveal({ roundId: 'r2', M: 5 }) }));
    act(() => jest.advanceTimersByTime(COOP_LAND_DURATION_MS + 400));
    expect(result.current.result?.mult).toBe(5);
  });

  it('passes through the round floor', () => {
    const { result } = renderHook((p: Props) => useCoopSpinAnimation(p), {
      initialProps: { ...base, floor: 2 },
    });
    expect(result.current.floor).toBe(2);
  });
});
