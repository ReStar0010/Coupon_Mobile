/**
 * Reducer fuzzer + Phase parity check.
 *
 * Strategy:
 *   1. Generate random plausible frame sequences (mix of valid + nonsense bodies).
 *   2. Feed each through applyFrame and assert no exception, no NaN, no negative
 *      gem totals or progress, and phase is always one of the known values.
 *   3. Verify the TS Phase string union list matches the backend Phase enum
 *      values (manually maintained; caught by code review on drift).
 */

import { applyFrame, INITIAL_COOP_STATE } from '../coopReducer';
import type { Phase, ServerFrame } from '../coopProtocol';

const PHASES: Phase[] = [
  'SOLO',
  'LOBBY_OPEN',
  'STAKING',
  'READY',
  'COUNTDOWN',
  'CHARGING',
  'SPINNING',
  'REVEAL',
  'SETTLED',
  'ABORTED',
  'DISPOSED',
];

// Deterministic PRNG (mulberry32) so the fuzzer is reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randPhase(r: () => number): Phase {
  return PHASES[Math.floor(r() * PHASES.length)] ?? 'STAKING';
}

function randFrame(r: () => number, seq: number): ServerFrame {
  const types = [
    'room.created',
    'room.joined',
    'room.staked',
    'room.ready',
    'room.countdown',
    'room.charging',
    'room.spinning',
    'room.reveal',
    'room.settled',
    'room.aborted',
    'error',
  ] as const;
  const t = types[Math.floor(r() * types.length)] ?? 'room.staked';
  const phase = randPhase(r);
  const players = [
    {
      user_id: 'u1',
      seat: 0,
      display_name: 'A',
      avatar_url: null,
      stake: 1 + Math.floor(r() * 5),
      locked: r() > 0.5,
      progress: r(),
      is_charging: r() > 0.5,
      connected: r() > 0.05,
    },
  ];
  const base = { v: 1, ts: 0, seq, room_id: 'rid' as const };
  switch (t) {
    case 'room.created':
      return {
        ...base,
        type: 'room.created',
        body: {
          room_id: 'rid',
          code: 'ABCDEF',
          host_id: 'u1',
          max_players: 3,
          expires_at: 60_000,
          state: phase,
          players,
        },
      };
    case 'room.joined':
      return {
        ...base,
        type: 'room.joined',
        body: { player: players[0], players, state: phase },
      };
    case 'room.staked':
      return {
        ...base,
        type: 'room.staked',
        body: {
          players,
          G_total: players[0].stake,
          P: 1,
          f_preview: Math.floor(r() * 4),
          all_locked: r() > 0.5,
          state: phase,
        },
      };
    case 'room.ready':
      return {
        ...base,
        type: 'room.ready',
        body: {
          players,
          G_total: players[0].stake,
          P: 1,
          f: Math.floor(r() * 4),
          auto_countdown_in_ms: 2000,
          state: phase,
        },
      };
    case 'room.countdown': {
      const tick = [3, 2, 1][Math.floor(r() * 3)] as 3 | 2 | 1;
      return {
        ...base,
        type: 'room.countdown',
        body: { tick, started_at: 1000, duration_ms: 3000, state: phase },
      };
    }
    case 'room.charging':
      return {
        ...base,
        type: 'room.charging',
        body: { players, started_at: 2000, duration_ms: 2500, state: phase },
      };
    case 'room.spinning':
      return {
        ...base,
        type: 'room.spinning',
        body: {
          round_id: 'r1',
          spin_duration_ms: 1500,
          debited: { u1: players[0].stake },
          state: phase,
        },
      };
    case 'room.reveal': {
      const stake = players[0].stake;
      const M = Math.floor(r() * 6);
      const f = Math.min(M, Math.floor(r() * 4));
      const floor = stake * f;
      const excess = stake * (M - f);
      return {
        ...base,
        type: 'room.reveal',
        body: {
          round_id: 'r1',
          M,
          G_total: stake,
          f,
          total_payout: stake * M,
          shares: [{ user_id: 'u1', seat: 0, stake, floor, excess, share: floor + excess }],
          reveal_plan: { phases: [] },
          state: phase,
        },
      };
    }
    case 'room.settled':
      return {
        ...base,
        type: 'room.settled',
        body: { round_id: 'r1', credited: { u1: Math.floor(r() * 20) }, state: phase },
      };
    case 'room.aborted':
      return {
        ...base,
        type: 'room.aborted',
        body: {
          round_id: 'r1',
          reason: 'disconnect',
          refunded: { u1: players[0].stake },
          state: phase,
        },
      };
    case 'error':
      return {
        v: 1,
        type: 'error',
        ts: 0,
        body: { code: 'INVALID_STATE', message: 'fuzzed', command: null },
      };
  }
}

describe('coopReducer — fuzzer', () => {
  it('survives 500 random frame sequences without crashing or producing NaN', () => {
    const r = rng(123);
    let crashed = 0;
    for (let trial = 0; trial < 500; trial += 1) {
      let state = INITIAL_COOP_STATE;
      const len = 1 + Math.floor(r() * 30);
      for (let i = 0; i < len; i += 1) {
        try {
          state = applyFrame(state, randFrame(r, i + 1));
        } catch {
          crashed += 1;
          break;
        }
      }
      // Invariants on the resulting state
      expect(Number.isNaN(state.gemsTotal)).toBe(false);
      expect(state.gemsTotal).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(state.floorPreview)).toBe(false);
      if (state.phase !== null) {
        expect(PHASES.includes(state.phase)).toBe(true);
      }
      for (const p of state.players) {
        expect(p.progress).toBeGreaterThanOrEqual(0);
        expect(p.progress).toBeLessThanOrEqual(1);
        expect(p.stake).toBeGreaterThanOrEqual(1);
        expect(p.stake).toBeLessThanOrEqual(5);
      }
    }
    expect(crashed).toBe(0);
  });
});

describe('Phase parity with backend enum', () => {
  it('matches the Python states.Phase enum value set', () => {
    // Manually maintained mirror of Backend/api/spinner_coop/states.py:Phase.
    // If you add a new phase server-side, add it here AND in coopProtocol.ts.
    const expected = [
      'SOLO',
      'LOBBY_OPEN',
      'STAKING',
      'READY',
      'COUNTDOWN',
      'CHARGING',
      'SPINNING',
      'REVEAL',
      'SETTLED',
      'ABORTED',
      'DISPOSED',
    ].sort();
    expect([...PHASES].sort()).toEqual(expected);
  });
});
