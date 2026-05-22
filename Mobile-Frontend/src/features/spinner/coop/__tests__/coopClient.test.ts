/**
 * CoopClient — covers the v2/v3 fixes:
 *   - URL contains ?token= (C-1)
 *   - malformed frames go to onMalformedFrame, not onFrame (H-2)
 *   - out-of-band frames (error, room.aborted) bypass the seq dedup gate (C-2)
 *   - shape-invalid bodies are rejected (H-2 per-type guards)
 */

import { CoopClient } from '../coopClient';
import type { ServerFrame } from '../coopProtocol';

// ── Minimal WebSocket mock ──────────────────────────────────────────────────

class MockWebSocket {
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSING = 2 as const;
  static CLOSED = 3 as const;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((e?: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  onclose: ((e: { reason: string; code?: number }) => void) | null = null;
  sent: string[] = [];

  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(_code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ reason: reason ?? 'mock_close' });
  }
  /** Test helper to fake an inbound frame. */
  recv(raw: string | object) {
    this.onmessage?.({ data: typeof raw === 'string' ? raw : JSON.stringify(raw) });
  }
  /** Test helper to fire onopen. */
  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  // @ts-expect-error — replacing the global WebSocket with our mock
  globalThis.WebSocket = MockWebSocket;
});

afterEach(() => {
  // @ts-expect-error — best-effort restore
  delete globalThis.WebSocket;
});

const flushMicro = () => new Promise((r) => setTimeout(r, 0));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CoopClient — URL contains ?token=', () => {
  it('builds /ws/spinner/v1/?token=<encoded>', async () => {
    const client = new CoopClient({
      token: 'abc.def.ghi',
      baseUrl: 'wss://example.test',
      onFrame: () => {},
    });
    client.connect();
    await flushMicro();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      'wss://example.test/ws/spinner/v1/?token=abc.def.ghi',
    );
    client.close();
  });

  it('resolves a token thunk on each connect', async () => {
    const tokenFn = jest.fn(async () => 'fresh-token');
    const client = new CoopClient({
      token: tokenFn,
      baseUrl: 'wss://example.test',
      onFrame: () => {},
    });
    client.connect();
    await flushMicro();
    expect(tokenFn).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances[0].url).toContain('?token=fresh-token');
    client.close();
  });

  it('URL-encodes special characters in the token', async () => {
    const client = new CoopClient({
      token: 'a/b+c=d',
      baseUrl: 'wss://e.test',
      onFrame: () => {},
    });
    client.connect();
    await flushMicro();
    expect(MockWebSocket.instances[0].url).toContain('token=a%2Fb%2Bc%3Dd');
    client.close();
  });
});

describe('CoopClient — malformed frame handling', () => {
  it('routes invalid JSON to onMalformedFrame, not onFrame', async () => {
    const onFrame = jest.fn();
    const onMalformedFrame = jest.fn();
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://e.test',
      onFrame,
      onMalformedFrame,
    });
    client.connect();
    await flushMicro();
    MockWebSocket.instances[0].open();
    MockWebSocket.instances[0].recv('not-json{');
    expect(onFrame).not.toHaveBeenCalled();
    expect(onMalformedFrame).toHaveBeenCalled();
    client.close();
  });

  it('routes shape-invalid envelope to onMalformedFrame', async () => {
    const onFrame = jest.fn();
    const onMalformedFrame = jest.fn();
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://e.test',
      onFrame,
      onMalformedFrame,
    });
    client.connect();
    await flushMicro();
    MockWebSocket.instances[0].open();
    // Missing `body`, missing `seq`, etc.
    MockWebSocket.instances[0].recv({ v: 1, type: 'room.created', ts: 0 });
    expect(onFrame).not.toHaveBeenCalled();
    expect(onMalformedFrame).toHaveBeenCalled();
    client.close();
  });

  it('rejects body with invalid shares array (per-type body guard)', async () => {
    const onFrame = jest.fn();
    const onMalformedFrame = jest.fn();
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://e.test',
      onFrame,
      onMalformedFrame,
    });
    client.connect();
    await flushMicro();
    MockWebSocket.instances[0].open();
    MockWebSocket.instances[0].recv({
      v: 1,
      type: 'room.reveal',
      ts: 0,
      seq: 5,
      room_id: 'r',
      body: {
        round_id: 'rnd',
        M: 4,
        G_total: 3,
        f: 1,
        total_payout: 12,
        shares: 'oops', // <- not an array of ShareSnapshot
        reveal_plan: { phases: [] },
        state: 'REVEAL',
      },
    });
    expect(onFrame).not.toHaveBeenCalled();
    expect(onMalformedFrame).toHaveBeenCalled();
    client.close();
  });
});

describe('CoopClient — out-of-band frames bypass seq dedup', () => {
  it('delivers room.aborted with seq <= lastSeen (defense in depth)', async () => {
    const onFrame = jest.fn();
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://e.test',
      onFrame,
    });
    client.connect();
    await flushMicro();
    const ws = MockWebSocket.instances[0];
    ws.open();
    // First push lastSeenSeq up to 10 with a normal frame
    ws.recv({
      v: 1,
      type: 'room.staked',
      ts: 0,
      seq: 10,
      room_id: 'r',
      body: {
        players: [],
        G_total: 0,
        P: 0,
        f_preview: 0,
        all_locked: false,
        state: 'STAKING',
      },
    });
    onFrame.mockClear();
    // Now an abort with seq=-1 (or anything <= 10) — must still arrive.
    ws.recv({
      v: 1,
      type: 'room.aborted',
      ts: 0,
      seq: -1,
      room_id: 'r',
      body: { round_id: null, reason: 'system_error', refunded: {}, state: 'DISPOSED' },
    });
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame.mock.calls[0][0].type).toBe('room.aborted');
    client.close();
  });

  it('drops a normal frame with seq <= lastSeen', async () => {
    const onFrame = jest.fn();
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://e.test',
      onFrame,
    });
    client.connect();
    await flushMicro();
    const ws = MockWebSocket.instances[0];
    ws.open();
    ws.recv({
      v: 1,
      type: 'room.staked',
      ts: 0,
      seq: 10,
      room_id: 'r',
      body: {
        players: [],
        G_total: 0,
        P: 0,
        f_preview: 0,
        all_locked: false,
        state: 'STAKING',
      },
    });
    onFrame.mockClear();
    // Replay seq=10 — should be deduped.
    ws.recv({
      v: 1,
      type: 'room.staked',
      ts: 0,
      seq: 10,
      room_id: 'r',
      body: {
        players: [],
        G_total: 0,
        P: 0,
        f_preview: 0,
        all_locked: false,
        state: 'STAKING',
      },
    });
    expect(onFrame).not.toHaveBeenCalled();
    client.close();
  });
});

describe('CoopClient — close code propagation (4401 auth failure)', () => {
  it('passes the WS close code through onClose', async () => {
    const onClose = jest.fn();
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://e.test',
      onFrame: () => {},
      onClose,
      maxReconnect: 0, // disable retries so the close surfaces immediately
    });
    client.connect();
    await flushMicro();
    const ws = MockWebSocket.instances[0];
    ws.readyState = MockWebSocket.CLOSED;
    ws.onclose?.({ reason: 'auth_failed', code: 4401 });
    expect(onClose).toHaveBeenCalledTimes(1);
    const [, code] = onClose.mock.calls[0];
    expect(code).toBe(4401);
  });

  it('does NOT auto-reconnect after a 4401 (token is stale, retry would be a loop)', async () => {
    const onClose = jest.fn();
    const client = new CoopClient({
      token: 'stale-jwt',
      baseUrl: 'wss://e.test',
      onFrame: () => {},
      onClose,
      maxReconnect: 5,
    });
    client.connect();
    await flushMicro();
    const ws = MockWebSocket.instances[0];
    ws.readyState = MockWebSocket.CLOSED;
    ws.onclose?.({ reason: '', code: 4401 });
    // Allow the (would-be) backoff timer a generous window to fire.
    await new Promise((r) => setTimeout(r, 1500));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    const [reason] = onClose.mock.calls[0];
    expect(reason).toMatch(/auth/i);
    client.close();
  });

  it('still auto-reconnects after a non-auth close (1006, etc.)', async () => {
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://e.test',
      onFrame: () => {},
      maxReconnect: 5,
    });
    client.connect();
    await flushMicro();
    const ws = MockWebSocket.instances[0];
    ws.readyState = MockWebSocket.CLOSED;
    ws.onclose?.({ reason: 'transport', code: 1006 });
    // First backoff is 1s; wait a little past that.
    await new Promise((r) => setTimeout(r, 1200));
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
    client.close();
  });
});

describe('CoopClient — connect() is idempotent during CONNECTING', () => {
  it('a second connect() call while the socket is still CONNECTING is a no-op', async () => {
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://example.test',
      onFrame: () => {},
    });
    client.connect();
    await flushMicro();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.CONNECTING);
    // Fast double-tap: caller invokes connect() again before onopen fires.
    // Without the CONNECTING guard this would construct a second socket
    // and orphan the first handshake — feeding the backoff loop on close.
    client.connect();
    await flushMicro();
    expect(MockWebSocket.instances).toHaveLength(1);
    client.close();
  });

  it('connect() called after close() while a previous token thunk is still pending does not race', async () => {
    let resolveToken: (t: string) => void = () => {};
    const tokenFn = () => new Promise<string>((r) => { resolveToken = r; });
    const client = new CoopClient({
      token: tokenFn,
      baseUrl: 'wss://example.test',
      onFrame: () => {},
    });
    client.connect();
    // Token thunk is pending — no socket yet.
    await flushMicro();
    expect(MockWebSocket.instances).toHaveLength(0);
    // Caller bails out before the thunk resolves.
    client.close();
    // Thunk now resolves; the post-await explicitlyClosed guard should
    // stop the orphan socket from being constructed.
    resolveToken('late-token');
    await new Promise((r) => setTimeout(r, 20));
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});

describe('CoopClient — auto-pong', () => {
  it('responds to ping with pong without surfacing the ping', async () => {
    const onFrame = jest.fn();
    const client = new CoopClient({
      token: 't',
      baseUrl: 'wss://e.test',
      onFrame,
    });
    client.connect();
    await flushMicro();
    const ws = MockWebSocket.instances[0];
    ws.open();
    ws.recv({ v: 1, type: 'ping', ts: 0, body: { id: 'p1' } });
    expect(onFrame).not.toHaveBeenCalled();
    expect(ws.sent).toHaveLength(1);
    const sent = JSON.parse(ws.sent[0]);
    expect(sent).toEqual({ type: 'pong', body: { id: 'p1' } });
    client.close();
  });
});
