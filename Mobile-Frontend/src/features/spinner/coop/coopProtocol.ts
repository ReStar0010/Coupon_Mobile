/**
 * Spinner co-op WebSocket protocol — typed mirror of
 * specs/spinner-coop/state-machine-and-events.md §3.
 *
 * Server is the single source of truth for state; the client renders snapshots
 * and dispatches commands. No client may mutate state speculatively.
 */

export const PROTOCOL_VERSION = 1;

// ── Phases (mirror Backend/api/spinner_coop/states.py Phase enum) ───────────
export type Phase =
  | 'SOLO'
  | 'LOBBY_OPEN'
  | 'STAKING'
  | 'READY'
  | 'COUNTDOWN'
  | 'CHARGING'
  | 'SPINNING'
  | 'REVEAL'
  | 'SETTLED'
  | 'ABORTED'
  | 'DISPOSED';

// ── Error codes (mirror Backend ErrorCode enum) ─────────────────────────────
export type ErrorCode =
  | 'INVALID_STATE'
  | 'FORBIDDEN'
  | 'ROOM_FULL'
  | 'ROOM_EXPIRED'
  | 'ROOM_NOT_FOUND'
  | 'STAKE_OUT_OF_RANGE'
  | 'INSUFFICIENT_GEMS'
  | 'RATE_LIMIT'
  | 'SESSION_EXPIRED'
  | 'ALREADY_IN_ROOM'
  | 'INTERNAL';

// ── Per-player snapshot (mirrors Player.to_dict()) ──────────────────────────
export interface PlayerSnapshot {
  user_id: string;
  seat: number;
  display_name: string;
  avatar_url: string | null;
  stake: number;
  locked: boolean;
  /** [0..1]; server-broadcast at 10Hz during CHARGING. */
  progress: number;
  is_charging: boolean;
  connected: boolean;
}

// ── Per-player share (inside room.reveal) ──────────────────────────────────
export interface ShareSnapshot {
  user_id: string;
  seat: number;
  stake: number;
  floor: number;
  excess: number;
  share: number;
}

// ── Reveal animation plan ──────────────────────────────────────────────────
export interface RevealPlanPhase {
  phase: 'total' | 'floor' | 'excess';
  duration_ms: number;
  payload: Record<string, unknown>;
}

export interface RevealPlan {
  phases: RevealPlanPhase[];
}

// ── Server → client event bodies ────────────────────────────────────────────
export interface RoomCreatedBody {
  room_id: string;
  code: string;
  host_id: string;
  max_players: number;
  expires_at: number; // ms epoch
  state: Phase;
  players: PlayerSnapshot[];
}

export interface RoomJoinedBody {
  player: PlayerSnapshot;
  players: PlayerSnapshot[];
  state: Phase;
}

export interface RoomLeftBody {
  player_id: string;
  reason: string;
  host_changed_to: string | null;
  players: PlayerSnapshot[];
  state: Phase;
}

export interface RoomHostChangedBody {
  previous_host_id: string;
  new_host_id: string;
  players: PlayerSnapshot[];
}

export interface RoomStakedBody {
  players: PlayerSnapshot[];
  G_total: number;
  P: number;
  f_preview: number;
  all_locked: boolean;
  state: Phase;
}

export interface RoomReadyBody {
  players: PlayerSnapshot[];
  G_total: number;
  P: number;
  f: number;
  auto_countdown_in_ms: number;
  state: Phase;
}

export interface RoomCountdownBody {
  tick: 3 | 2 | 1;
  started_at: number;
  duration_ms: number;
  state: Phase;
}

export interface RoomChargingBody {
  players: PlayerSnapshot[];
  started_at: number | null;
  duration_ms: number;
  state: Phase;
}

export interface RoomSpinningBody {
  round_id: string;
  spin_duration_ms: number;
  debited: Record<string, number>;
  state: Phase;
}

export interface RoomRevealBody {
  round_id: string;
  M: number;
  G_total: number;
  f: number;
  total_payout: number;
  shares: ShareSnapshot[];
  reveal_plan: RevealPlan;
  state: Phase;
}

export interface RoomSettledBody {
  round_id: string;
  credited: Record<string, number>;
  state: Phase;
}

export interface RoomAbortedBody {
  round_id: string | null;
  reason: string;
  refunded: Record<string, number>;
  state: Phase;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  command: string | null;
}

// ── Per-recipient envelope fields ─────────────────────────────────────────
/**
 * v3 H-1 / v4 H1: every envelope the server fans out is shallow-cloned per
 * recipient and stamped with the connection's authenticated user_id under
 * `you_are`. The reducer hoists it onto `state.meUserId` so consumers don't
 * have to guess identity from `host_id`.
 *
 * Optional because:
 *   - reconnect/replay paths and synthetic `room.aborted` envelopes (built
 *     outside the per-recipient fan-out) may omit it,
 *   - the `error` and `ping` frame variants are not group broadcasts,
 *   - older clients should tolerate older servers (forward compat).
 */
export interface PerRecipientFields {
  you_are?: string;
}

// ── Discriminated union of all server-emitted frames ───────────────────────
export type ServerFrame =
  | (PerRecipientFields & {
      v: number;
      type: 'room.created';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomCreatedBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.joined';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomJoinedBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.left';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomLeftBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.host_changed';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomHostChangedBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.staked';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomStakedBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.ready';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomReadyBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.countdown';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomCountdownBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.charging';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomChargingBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.spinning';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomSpinningBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.reveal';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomRevealBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.settled';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomSettledBody;
    })
  | (PerRecipientFields & {
      v: number;
      type: 'room.aborted';
      ts: number;
      seq: number;
      room_id: string;
      body: RoomAbortedBody;
    })
  | { v: number; type: 'error'; ts: number; body: ErrorBody }
  | { v: number; type: 'ping'; ts: number; body: { id: string } };

// ── Client → server commands ───────────────────────────────────────────────
export type ClientCommand =
  | { type: 'room.create'; body: { solo: boolean } }
  | { type: 'room.join'; body: { code?: string; room_id?: string } }
  | { type: 'room.leave'; body: Record<string, never> }
  | { type: 'stake.set'; body: { gems: number } }
  | { type: 'stake.lock'; body: Record<string, never> }
  | { type: 'stake.unlock'; body: Record<string, never> }
  | { type: 'countdown.start'; body: Record<string, never> }
  | { type: 'charge.press_in'; body: { at: number } }
  | { type: 'charge.press_out'; body: { at: number } }
  | { type: 'reveal.ack'; body: { round_id: string } }
  | { type: 'rematch.request'; body: Record<string, never> }
  | { type: 'pong'; body: { id: string } };
