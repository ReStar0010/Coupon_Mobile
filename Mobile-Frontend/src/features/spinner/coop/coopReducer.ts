/**
 * Pure reducer that mirrors server state from incoming frames.
 *
 * Single source of truth: never mutate phase or player data locally — only
 * update from a server frame. Local-only animations (charge interpolation,
 * countdown ticking visual) read off the snapshot's durations.
 */

import type { Phase, PlayerSnapshot, RevealPlan, ServerFrame, ShareSnapshot } from './coopProtocol';

export interface CoopState {
  /** null until room.created or room.joined arrives. */
  roomId: string | null;
  code: string | null;
  hostId: string | null;
  /** Authenticated user id for this connection — server stamps it on every
   * envelope as `you_are`. Used by the UI to highlight "me" rows regardless
   * of whether the user is host or joiner. (v3 H-1) */
  meUserId: string | null;
  phase: Phase | null;
  players: PlayerSnapshot[];
  /** Lobby TTL — used by the UI to render an expiry countdown. */
  expiresAt: number | null;
  /** Σ G_i, mirrors server. */
  gemsTotal: number;
  /** Floor multiplier preview (live during STAKING). */
  floorPreview: number;
  /** Final floor at READY. */
  floor: number | null;
  /** Countdown phase. */
  countdownTick: 3 | 2 | 1 | null;
  countdownStartedAt: number | null;
  countdownDurationMs: number;
  /** Charging phase. */
  chargingStartedAt: number | null;
  chargingDurationMs: number;
  /** Reveal payload. */
  reveal: {
    roundId: string;
    M: number;
    gTotal: number;
    f: number;
    totalPayout: number;
    shares: ShareSnapshot[];
    plan: RevealPlan;
  } | null;
  /** Final credited amounts at SETTLED. */
  credited: Record<string, number> | null;
  /** Last error from the server (cleared on next applyFrame). */
  lastError: { code: string; message: string; command: string | null } | null;
  /** Aborted reason (set when phase becomes ABORTED/DISPOSED). */
  abortReason: string | null;
}

export const INITIAL_COOP_STATE: CoopState = {
  roomId: null,
  code: null,
  hostId: null,
  meUserId: null,
  phase: null,
  players: [],
  expiresAt: null,
  gemsTotal: 0,
  floorPreview: 0,
  floor: null,
  countdownTick: null,
  countdownStartedAt: null,
  countdownDurationMs: 3000,
  chargingStartedAt: null,
  chargingDurationMs: 2500,
  reveal: null,
  credited: null,
  lastError: null,
  abortReason: null,
};

/**
 * Apply a single server frame to state. Pure: returns a new CoopState.
 *
 * v3 H-1: every envelope carries an optional `you_are` field stamped per
 * recipient. The reducer extracts it once into `state.meUserId` so consumers
 * never have to guess identity from `hostId`.
 */
export function applyFrame(state: CoopState, frame: ServerFrame): CoopState {
  // v4 H1: `you_are` is declared on PerRecipientFields and intersected into
  // every group-broadcast variant of ServerFrame. The `error` and `ping`
  // variants intentionally don't carry it, so guard the property access.
  const youAre = 'you_are' in frame && typeof frame.you_are === 'string' ? frame.you_are : null;
  const cleared = frame.type !== 'error' && state.lastError !== null;
  const baseState = {
    ...state,
    ...(youAre && state.meUserId !== youAre ? { meUserId: youAre } : undefined),
    ...(cleared ? { lastError: null } : undefined),
  };

  switch (frame.type) {
    case 'room.created':
      // INITIAL_COOP_STATE wipes meUserId — re-stamp from envelope.
      return {
        ...INITIAL_COOP_STATE,
        meUserId: youAre ?? state.meUserId,
        roomId: frame.body.room_id,
        code: frame.body.code,
        hostId: frame.body.host_id,
        phase: frame.body.state,
        players: frame.body.players,
        expiresAt: frame.body.expires_at,
        gemsTotal: frame.body.players.reduce((s, p) => s + p.stake, 0),
      };

    case 'room.joined':
      return {
        ...baseState,
        roomId: baseState.roomId ?? frame.room_id,
        phase: frame.body.state,
        players: frame.body.players,
        gemsTotal: frame.body.players.reduce((s, p) => s + p.stake, 0),
      };

    case 'room.left':
      return {
        ...baseState,
        phase: frame.body.state,
        players: frame.body.players,
        hostId: frame.body.host_changed_to ?? baseState.hostId,
      };

    case 'room.host_changed':
      return {
        ...baseState,
        hostId: frame.body.new_host_id,
        players: frame.body.players,
      };

    case 'room.staked':
      return {
        ...baseState,
        phase: frame.body.state,
        players: frame.body.players,
        gemsTotal: frame.body.G_total,
        floorPreview: frame.body.f_preview,
      };

    case 'room.ready':
      return {
        ...baseState,
        phase: frame.body.state,
        players: frame.body.players,
        gemsTotal: frame.body.G_total,
        floor: frame.body.f,
      };

    case 'room.countdown':
      return {
        ...baseState,
        phase: frame.body.state,
        countdownTick: frame.body.tick,
        countdownStartedAt: frame.body.started_at,
        countdownDurationMs: frame.body.duration_ms,
      };

    case 'room.charging':
      return {
        ...baseState,
        phase: frame.body.state,
        players: frame.body.players,
        chargingStartedAt: frame.body.started_at,
        chargingDurationMs: frame.body.duration_ms,
      };

    case 'room.spinning':
      return {
        ...baseState,
        phase: frame.body.state,
      };

    case 'room.reveal':
      return {
        ...baseState,
        phase: frame.body.state,
        reveal: {
          roundId: frame.body.round_id,
          M: frame.body.M,
          gTotal: frame.body.G_total,
          f: frame.body.f,
          totalPayout: frame.body.total_payout,
          shares: frame.body.shares,
          plan: frame.body.reveal_plan,
        },
      };

    case 'room.settled':
      return {
        ...baseState,
        phase: frame.body.state,
        credited: frame.body.credited,
      };

    case 'room.aborted':
      return {
        ...baseState,
        phase: 'ABORTED',
        abortReason: frame.body.reason,
      };

    case 'error':
      return { ...baseState, lastError: frame.body };

    default:
      return baseState;
  }
}

/**
 * Helper for the UI: returns state with `lastError` cleared. Callers should
 * dispatch this after surfacing the error to the user (e.g. on dismiss / on the
 * next user action) so stale errors don't haunt the UI. — M-4.
 */
export function clearLastError(state: CoopState): CoopState {
  if (state.lastError === null) return state;
  return { ...state, lastError: null };
}
