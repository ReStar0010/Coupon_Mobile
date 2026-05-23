/**
 * Thin WebSocket wrapper for the spinner co-op protocol.
 *
 * Responsibilities:
 *   - open the WS connection at /ws/spinner/v1/?token=<jwt>
 *   - send typed commands (ClientCommand)
 *   - validate inbound payloads against per-type body guards (v3 H-2)
 *   - drop out-of-order frames (seq < lastSeen)
 *   - route OUT-OF-BAND frames (error, room.aborted, ping) past the seq dedup gate
 *   - auto-respond to ping with pong
 *   - emit typed frames to a single onFrame listener
 *   - reconnect with exponential backoff (1s → 30s) up to maxAttempts
 */

import type {
  ClientCommand,
  Phase,
  PlayerSnapshot,
  RevealPlanPhase,
  ServerFrame,
  ShareSnapshot,
} from './coopProtocol';

// ── Constants ───────────────────────────────────────────────────────────────

const WS_PATH = '/ws/spinner/v1/';
const MIN_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const DEFAULT_MAX_RECONNECT = 5;

/**
 * v3 M-1: typed against ServerFrame['type'] so a typo in the set fails the build
 * instead of silently failing to deliver in production.
 */
const OUT_OF_BAND_TYPES: ReadonlySet<ServerFrame['type']> = new Set<ServerFrame['type']>([
  'error',
  'room.aborted',
  'ping',
]);

const VALID_PHASES: ReadonlySet<Phase> = new Set<Phase>([
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
]);

// ── Types ───────────────────────────────────────────────────────────────────

export type TokenProvider = string | (() => string | Promise<string>);

/** v3 M-2: don't pretend a synthetic close is a full DOM CloseEvent. */
type CloseReason = { reason: string; code?: number };

export interface CoopClientOptions {
  baseUrl?: string;
  /** JWT access token. Either a literal string or a thunk (sync/async) so the
   * client picks up a refreshed token on reconnect without being rebuilt. */
  token: TokenProvider;
  onFrame: (frame: ServerFrame) => void;
  onOpen?: () => void;
  /** Called on permanent close. `code` is the WS close code (if known) so
   * callers can branch on auth failures (4401) vs transport errors. */
  onClose?: (reason: string, code?: number) => void;
  /** Called when a frame fails schema validation. Defaults to a no-op. */
  onMalformedFrame?: (raw: unknown) => void;
  maxReconnect?: number;
}

// Hardcoded to staging for refactor/frontend → dev push. Restore env-var read
// before promoting to prod.
const DEFAULT_BASE = 'wss://coupon-mobile-dev.onrender.com';

/**
 * Backend auth-failure close code. The Channels consumer at
 * `Backend/api/spinner_coop/consumer.py` closes with 4401 on missing /
 * invalid / expired JWT. Reusing a stale token would just loop on the
 * same close, so the client must NOT auto-reconnect on this code — the
 * caller (useCoopRoom) decides whether to refresh and try again.
 */
const AUTH_FAILED_CLOSE_CODE = 4401;

// ── Class ───────────────────────────────────────────────────────────────────

export class CoopClient {
  private socket: WebSocket | null = null;
  private lastSeenSeq = 0;
  private reconnectAttempts = 0;
  private explicitlyClosed = false;
  private readonly opts: Required<Omit<CoopClientOptions, 'token'>> & {
    token: TokenProvider;
  };
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: CoopClientOptions) {
    this.opts = {
      baseUrl: opts.baseUrl ?? DEFAULT_BASE,
      maxReconnect: opts.maxReconnect ?? DEFAULT_MAX_RECONNECT,
      onOpen: opts.onOpen ?? (() => {}),
      onClose: opts.onClose ?? (() => {}),
      onFrame: opts.onFrame,
      onMalformedFrame: opts.onMalformedFrame ?? (() => {}),
      token: opts.token,
    };
  }

  connect(): void {
    // Idempotency guards. Without the CONNECTING guard, a fast double-call
    // (e.g. a user mashing the Retry button) would construct a second
    // WebSocket and overwrite `this.socket`, leaving the first handshake's
    // onclose handler attached to an orphaned instance that can still
    // kick off a spurious backoff reconnect.
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.explicitlyClosed = false;
    void this.openWithToken();
  }

  private async openWithToken(): Promise<void> {
    let token: string;
    try {
      token = typeof this.opts.token === 'string' ? this.opts.token : await this.opts.token();
    } catch (err) {
      console.warn('[CoopClient] token thunk threw:', err);
      this.opts.onClose('token_unavailable');
      return;
    }
    if (!token) {
      console.warn('[CoopClient] token is empty/null');
      this.opts.onClose('token_empty');
      return;
    }

    // The token thunk awaited above could have resolved AFTER the caller
    // called close() — without this check the freshly-constructed socket
    // would replace `this.socket` and its onopen/onclose would fire on an
    // instance the caller has already abandoned.
    if (this.explicitlyClosed) return;

    const url = `${this.opts.baseUrl}${WS_PATH}?token=${encodeURIComponent(token)}`;
    console.info('[CoopClient] connecting →', url.replace(/token=[^&]+/, 'token=***'));
    const ws = new WebSocket(url);
    this.socket = ws;
    ws.onopen = () => {
      console.info('[CoopClient] ✓ connected');
      this.reconnectAttempts = 0;
      this.opts.onOpen();
    };
    ws.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
    ws.onerror = (err) => {
      console.warn('[CoopClient] ws.onerror', err);
    };
    ws.onclose = (e: CloseEvent) => {
      console.warn('[CoopClient] ws.onclose', { code: e.code, reason: e.reason, wasClean: e.wasClean });
      this.handleClose({ reason: e.reason, code: e.code });
    };
  }

  send(cmd: ClientCommand): boolean {
    const ws = this.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[CoopClient] send blocked — socket not open, readyState:', ws?.readyState);
      return false;
    }
    try {
      console.info('[CoopClient] → send', cmd.type);
      ws.send(JSON.stringify(cmd));
      return true;
    } catch {
      return false;
    }
  }

  close(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.socket;
    this.socket = null;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      try {
        ws.close(1000, 'client_close');
      } catch {
        /* ignore */
      }
    }
  }

  /** For tests + diagnostics. */
  get state(): 'connecting' | 'open' | 'closing' | 'closed' {
    const ws = this.socket;
    if (!ws) return 'closed';
    switch (ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      default:
        return 'closed';
    }
  }

  // ── private ──────────────────────────────────────────────────────────────

  private handleMessage(raw: unknown): void {
    let parsed: unknown;
    try {
      parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    } catch {
      this.opts.onMalformedFrame(raw);
      return;
    }
    if (!isServerFrame(parsed)) {
      console.warn('[CoopClient] malformed frame:', JSON.stringify(parsed).slice(0, 200));
      this.opts.onMalformedFrame(raw);
      return;
    }
    const frame: ServerFrame = parsed;
    console.info('[CoopClient] ← frame', frame.type);

    if (frame.type === 'ping') {
      this.send({ type: 'pong', body: { id: frame.body.id } });
      return;
    }

    // Out-of-band delivery: error frames + system aborts always pass through.
    if (OUT_OF_BAND_TYPES.has(frame.type)) {
      this.opts.onFrame(frame);
      return;
    }

    if (!hasSeq(frame)) return;
    if (frame.seq <= this.lastSeenSeq) return;
    this.lastSeenSeq = frame.seq;
    this.opts.onFrame(frame);
  }

  private handleClose(e: CloseReason): void {
    if (this.explicitlyClosed) {
      this.opts.onClose(`closed: ${e.reason || 'client'}`, e.code);
      return;
    }
    // Auth failure: the server told us this token is no good. Don't loop
    // by retrying with the same token — the caller must refresh the JWT
    // and call connect() again from scratch.
    if (e.code === AUTH_FAILED_CLOSE_CODE) {
      this.opts.onClose(`auth_failed: ${e.reason || 'jwt_rejected'}`, e.code);
      return;
    }
    if (this.reconnectAttempts >= this.opts.maxReconnect) {
      this.opts.onClose('max_reconnect_exceeded', e.code);
      return;
    }
    this.reconnectAttempts += 1;
    const delayMs = Math.min(
      MAX_RECONNECT_DELAY_MS,
      MIN_RECONNECT_DELAY_MS * 2 ** (this.reconnectAttempts - 1),
    );
    this.reconnectTimer = setTimeout(() => this.connect(), delayMs);
  }
}

// ── Schema guards (v3 H-2: per-type body validation) ───────────────────────

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function hasSeq(frame: ServerFrame): frame is Extract<ServerFrame, { seq: number }> {
  return 'seq' in frame && typeof (frame as { seq?: unknown }).seq === 'number';
}

function isPhase(x: unknown): x is Phase {
  return typeof x === 'string' && VALID_PHASES.has(x as Phase);
}

function isPlayerSnapshot(x: unknown): x is PlayerSnapshot {
  if (!isRecord(x)) return false;
  return (
    typeof x.user_id === 'string' &&
    typeof x.seat === 'number' &&
    typeof x.display_name === 'string' &&
    (x.avatar_url === null || typeof x.avatar_url === 'string') &&
    typeof x.stake === 'number' &&
    typeof x.locked === 'boolean' &&
    typeof x.progress === 'number' &&
    typeof x.is_charging === 'boolean' &&
    typeof x.connected === 'boolean'
  );
}

function isShareSnapshot(x: unknown): x is ShareSnapshot {
  if (!isRecord(x)) return false;
  return (
    typeof x.user_id === 'string' &&
    typeof x.seat === 'number' &&
    typeof x.stake === 'number' &&
    typeof x.floor === 'number' &&
    typeof x.excess === 'number' &&
    typeof x.share === 'number'
  );
}

function isRevealPlanPhase(x: unknown): x is RevealPlanPhase {
  if (!isRecord(x)) return false;
  return (
    (x.phase === 'total' || x.phase === 'floor' || x.phase === 'excess') &&
    typeof x.duration_ms === 'number' &&
    isRecord(x.payload)
  );
}

function isStringNumberMap(x: unknown): x is Record<string, number> {
  if (!isRecord(x)) return false;
  return Object.values(x).every((v) => typeof v === 'number');
}

function isPlayerArray(x: unknown): x is PlayerSnapshot[] {
  return Array.isArray(x) && x.every(isPlayerSnapshot);
}

/**
 * Top-level guard. Validates the envelope, then dispatches to a per-type body
 * guard. Returning `false` routes the frame to onMalformedFrame; the reducer
 * never sees a shape-invalid frame.
 */
function isServerFrame(x: unknown): x is ServerFrame {
  if (!isRecord(x)) return false;
  if (typeof x.v !== 'number') return false;
  if (typeof x.type !== 'string') return false;
  if (typeof x.ts !== 'number') return false;
  if (!isRecord(x.body)) return false;

  const type = x.type;
  if (!OUT_OF_BAND_TYPES.has(type as ServerFrame['type'])) {
    if (typeof x.seq !== 'number') return false;
    if (typeof x.room_id !== 'string') return false;
  }

  return validateBody(type, x.body);
}

function validateBody(type: string, body: Record<string, unknown>): boolean {
  switch (type) {
    case 'room.created':
      return (
        typeof body.room_id === 'string' &&
        typeof body.code === 'string' &&
        typeof body.host_id === 'string' &&
        typeof body.max_players === 'number' &&
        typeof body.expires_at === 'number' &&
        isPhase(body.state) &&
        isPlayerArray(body.players)
      );
    case 'room.joined':
      return isPlayerSnapshot(body.player) && isPlayerArray(body.players) && isPhase(body.state);
    case 'room.left':
      return (
        typeof body.player_id === 'string' &&
        typeof body.reason === 'string' &&
        (body.host_changed_to === null || typeof body.host_changed_to === 'string') &&
        isPlayerArray(body.players) &&
        isPhase(body.state)
      );
    case 'room.host_changed':
      return (
        typeof body.previous_host_id === 'string' &&
        typeof body.new_host_id === 'string' &&
        isPlayerArray(body.players)
      );
    case 'room.staked':
      return (
        isPlayerArray(body.players) &&
        typeof body.G_total === 'number' &&
        typeof body.P === 'number' &&
        typeof body.f_preview === 'number' &&
        typeof body.all_locked === 'boolean' &&
        isPhase(body.state)
      );
    case 'room.ready':
      return (
        isPlayerArray(body.players) &&
        typeof body.G_total === 'number' &&
        typeof body.P === 'number' &&
        typeof body.f === 'number' &&
        typeof body.auto_countdown_in_ms === 'number' &&
        isPhase(body.state)
      );
    case 'room.countdown':
      return (
        (body.tick === 1 || body.tick === 2 || body.tick === 3) &&
        typeof body.started_at === 'number' &&
        typeof body.duration_ms === 'number' &&
        isPhase(body.state)
      );
    case 'room.charging':
      return (
        isPlayerArray(body.players) &&
        (body.started_at === null || typeof body.started_at === 'number') &&
        typeof body.duration_ms === 'number' &&
        isPhase(body.state)
      );
    case 'room.spinning':
      return (
        typeof body.round_id === 'string' &&
        typeof body.spin_duration_ms === 'number' &&
        isStringNumberMap(body.debited) &&
        isPhase(body.state)
      );
    case 'room.reveal':
      return (
        typeof body.round_id === 'string' &&
        typeof body.M === 'number' &&
        typeof body.G_total === 'number' &&
        typeof body.f === 'number' &&
        typeof body.total_payout === 'number' &&
        Array.isArray(body.shares) &&
        body.shares.every(isShareSnapshot) &&
        isRecord(body.reveal_plan) &&
        Array.isArray((body.reveal_plan as Record<string, unknown>).phases) &&
        ((body.reveal_plan as Record<string, unknown>).phases as unknown[]).every(
          isRevealPlanPhase,
        ) &&
        isPhase(body.state)
      );
    case 'room.settled':
      return (
        typeof body.round_id === 'string' && isStringNumberMap(body.credited) && isPhase(body.state)
      );
    case 'room.aborted':
      return (
        (body.round_id === null || typeof body.round_id === 'string') &&
        typeof body.reason === 'string' &&
        isStringNumberMap(body.refunded) &&
        isPhase(body.state)
      );
    case 'error':
      return (
        typeof body.code === 'string' &&
        typeof body.message === 'string' &&
        (body.command === null || typeof body.command === 'string')
      );
    case 'ping':
      return typeof body.id === 'string';
    default:
      return false; // unknown type — reject
  }
}
