# Spinner Co-op — Code Review v2 (TypeScript-focused) + Security Scan

**Scope of this pass:** the TS layer of the spinner co-op feature plus any backend regressions introduced by the v1 fix batch. Read every file in `Mobile-Frontend/src/features/spinner/coop/` line-by-line and audited against `~/.claude/rules/typescript/{coding-style,patterns,security}.md`.

**Verdict:** **BLOCK** — two new CRITICAL issues introduced by the v1 fixes (the client wasn't updated when the server's auth contract changed; the synthetic abort emitted by `_emit_system_abort` is silently dropped by the client). Plus a handful of HIGH issues that violate the typescript rules (`any`-shaped casts on untrusted input, status-from-ref-not-state, sticky errors, props-from-caller instead of auth context).

---

## CRITICAL — newly broken by the v1 fixes

### C-1 Client builds the wrong WebSocket URL (auth broken end-to-end)
**File:** `Mobile-Frontend/src/features/spinner/coop/coopClient.ts:18-33,61-65`

The backend `consumer.connect()` now requires `?token=<jwt>`. The client still builds:

```ts
const url = `${this.opts.baseUrl}/ws/spinner/v1/?user=${encodeURIComponent(this.opts.userId)}&name=${encodeURIComponent(this.opts.displayName)}`;
```

There is no `token` query parameter, and the server has no fallback path. **Every production connection will close with code 4401.** The integration tests pass only because they construct their own URL bypassing this code path.

**Fix:** drop `userId` + `displayName` from `CoopClientOptions` and require a `token` (string or a thunk so it can be refreshed):

```ts
export interface CoopClientOptions {
  baseUrl?: string;
  /** Either a current JWT string, or a function returning a fresh one (called per connect). */
  token: string | (() => string | Promise<string>);
  onFrame: (frame: ServerFrame) => void;
  onOpen?: () => void;
  onClose?: (reason: string) => void;
  maxReconnect?: number;
}

connect(): void {
  if (this.socket?.readyState === WebSocket.OPEN) return;
  this.explicitlyClosed = false;
  void this.openWithToken();
}

private async openWithToken(): Promise<void> {
  const token =
    typeof this.opts.token === 'string'
      ? this.opts.token
      : await this.opts.token();
  const url = `${this.opts.baseUrl}/ws/spinner/v1/?token=${encodeURIComponent(token)}`;
  ...
}
```

Then `useCoopRoom` reads the JWT from `useAuth()` (via `tokenStore.getAccessToken()`) and passes a thunk so reconnects pick up a fresh token after refresh.

---

### C-2 Synthetic `room.aborted` is dropped by the client's seq dedup
**Files:**
- `Backend/api/spinner_coop/consumer.py:_emit_system_abort` (the seq=-1 abort)
- `Mobile-Frontend/src/features/spinner/coop/coopClient.ts:142-144`

My v1 fix for M-1/C-2 emits a synthetic `room.aborted` envelope with `seq: -1` to bypass normal sequencing. But the client's dedup gate is:

```ts
const f = frame as Extract<ServerFrame, { seq: number }>;
if (typeof f.seq !== 'number' || f.seq <= this.lastSeenSeq) return;
```

`-1 <= lastSeenSeq` is true whenever `lastSeenSeq >= -1`, which is always. **The user-facing abort frame is silently swallowed** and the UI never learns the round failed.

**Fix (server side):** assign a real sequence number to synthetic aborts — read the next seq from the room's existing counter, OR mark synthetic frames with a separate sentinel that the client treats as out-of-band. Cleanest path:

```py
# consumer.py:_emit_system_abort
room = _ROOM_STORE.get(room_id)
seq = (room.seq if room else 0) + 1
envelope = {
    "v": PROTOCOL_VERSION,
    "type": "room.aborted",
    "ts": _now_ms(),
    "seq": seq,
    ...
}
```

**Fix (client side, defense in depth):** error-class frames and abort-class frames should bypass dedup. Restructure `handleMessage`:

```ts
private handleMessage(raw: unknown): void {
  const frame = this.parseFrame(raw);
  if (!frame) return;

  if (frame.type === 'ping') {
    this.send({ type: 'pong', body: { id: frame.body.id } });
    return;
  }

  // Out-of-band frames — always delivered.
  if (frame.type === 'error' || frame.type === 'room.aborted') {
    this.opts.onFrame(frame);
    return;
  }

  // Seq-ordered frames — drop duplicates / late arrivals.
  if (!('seq' in frame) || typeof frame.seq !== 'number') return;
  if (frame.seq <= this.lastSeenSeq) return;
  this.lastSeenSeq = frame.seq;
  this.opts.onFrame(frame);
}
```

The defense-in-depth change also means future synthetic aborts can't silently break the UI.

---

## HIGH — should fix before merge

### H-1 Connection status reads from a `ref`, so React never re-renders on state change
**File:** `Mobile-Frontend/src/features/spinner/coop/useCoopRoom.ts:50-69,101-105`

```ts
const statusRef = useRef<'closed' | 'connecting' | 'open' | 'closing'>('closed');
...
onOpen: () => { statusRef.current = 'open'; },
onClose: () => { statusRef.current = 'closed'; },
...
return {
  state,
  status: clientRef.current ? clientRef.current.state : statusRef.current,
  ...
};
```

`statusRef` mutation never schedules a re-render. The returned `status` is whatever value `clientRef.current.state` happens to read on each render — which only happens when something *else* triggers one (typically a frame arriving). On open, the UI shows `connecting` until the first frame arrives; if no frame ever arrives (e.g. the room is empty), the user sits at `connecting` forever even though the socket opened.

**Fix:** use `useState` for status (it's part of the visible state, not a side-effect handle):

```ts
const [status, setStatus] = useState<'closed' | 'connecting' | 'open' | 'closing'>('closed');
...
useEffect(() => {
  ...
  const client = new CoopClient({
    ...
    onOpen: () => setStatus('open'),
    onClose: () => setStatus('closed'),
  });
  setStatus('connecting');
  client.connect();
  ...
}, [enabled, userId, displayName, baseUrl]);
```

---

### H-2 No runtime validation on inbound frames (rule: "use `unknown` and Zod for external input")
**File:** `Mobile-Frontend/src/features/spinner/coop/coopClient.ts:124-145`

```ts
private handleMessage(raw: unknown): void {
  let frame: ServerFrame;
  try {
    frame = typeof raw === 'string' ? JSON.parse(raw) : (raw as ServerFrame);
  } catch { return; }
```

The result of `JSON.parse` is `any`; the assignment to `frame: ServerFrame` is an implicit, unchecked cast. From `~/.claude/rules/typescript/coding-style.md`:
> Use `unknown` for external or untrusted input, then narrow it safely.
> Use Zod for schema-based validation.

A malformed frame — `{ type: "room.reveal", body: { shares: "oops" } }` — crashes the reducer the next time `.shares.map(...)` runs in `RevealAnimation`. A buggy or compromised server can fault the UI of every connected client.

**Fix:** install `zod` (already in the dependency graph in many similar projects; if not, define a hand-written guard) and validate at the boundary:

```ts
import { z } from 'zod';

const PlayerSnapshotSchema = z.object({
  user_id: z.string(),
  seat: z.number().int().min(0).max(2),
  display_name: z.string().max(80),
  avatar_url: z.string().nullable(),
  stake: z.number().int().min(1).max(5),
  locked: z.boolean(),
  progress: z.number().min(0).max(1),
  is_charging: z.boolean(),
  connected: z.boolean(),
});

const ServerFrameSchema = z.discriminatedUnion('type', [
  z.object({ v: z.number(), type: z.literal('room.created'), ts: z.number(), seq: z.number(), room_id: z.string(), body: RoomCreatedBodySchema }),
  ...
]);

private handleMessage(raw: unknown): void {
  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return; }
  const result = ServerFrameSchema.safeParse(parsed);
  if (!result.success) {
    log.warn('coopClient: malformed frame', result.error.format());
    return;
  }
  this.processFrame(result.data);
}
```

If you'd rather avoid zod for bundle-size reasons, a minimal hand-rolled guard catches the common cases:

```ts
function isServerFrame(x: unknown): x is ServerFrame {
  return typeof x === 'object' && x !== null
      && typeof (x as any).type === 'string'
      && typeof (x as any).v === 'number'
      && typeof (x as any).ts === 'number';
}
```

…but Zod is the project convention per the style rule.

---

### H-3 `useCoopRoom` takes `userId` + `displayName` as user-controlled props
**File:** `Mobile-Frontend/src/features/spinner/coop/useCoopRoom.ts:12-18` + `CoopRoomScreen.tsx:20-24`

```ts
interface UseCoopRoomOptions {
  userId: string;
  displayName: string;
  ...
}
```

The screen's caller (whatever route mounts it) decides who you are. Combined with C-1 fix (the client should send a JWT), the identity should come from the auth layer, not the consumer:

**Fix:**

```ts
// useCoopRoom.ts
import { getAccessToken } from '@/src/services/auth/tokenStore';

interface UseCoopRoomOptions {
  baseUrl?: string;
  enabled?: boolean;
}

export function useCoopRoom(options: UseCoopRoomOptions = {}): UseCoopRoomResult {
  ...
  useEffect(() => {
    if (!enabled) return;
    const client = new CoopClient({
      baseUrl,
      token: getAccessToken,  // thunk that returns the latest token
      onFrame: ...,
      ...
    });
    ...
  }, [enabled, baseUrl]);
}
```

Then `CoopRoomScreen` drops its `userId` / `displayName` props (the screen learns its own identity from the auth context once the first `room.created` / `room.joined` frame arrives, since that frame carries `host_id` / players).

---

### H-4 `_ROOM_CREATE_HISTORY` grows without bound (server-side memory leak)
**File:** `Backend/api/spinner_coop/consumer.py:53-55`

```py
_ROOM_CREATE_HISTORY: dict[int, list[float]] = {}
```

Every distinct `user_id` who ever calls `room.create` gets a permanent entry. Even after the entries' timestamps fall out of the 60s window, the dict keeps the empty list. Over a month, this leaks one entry per active user.

**Fix:** evict empty entries after the per-user window trim:

```py
history[:] = [t for t in history if now_s - t < _ROOM_CREATE_WINDOW_S]
if not history:
    _ROOM_CREATE_HISTORY.pop(self.user_id, None)
```

Better long-term: replace the dict with `cachetools.TTLCache(maxsize=10_000, ttl=60)` so entries self-expire.

---

### H-5 `state.lastError` is sticky — UI shows the error forever
**File:** `Mobile-Frontend/src/features/spinner/coop/CoopRoomScreen.tsx:49-55`

```tsx
{state.lastError && (
  <View style={styles.errorBanner}>
    <Text style={styles.errorText}>
      ⚠ {state.lastError.code}: {state.lastError.message}
    </Text>
  </View>
)}
```

`clearLastError` exists in the reducer module (M-4 fix) but is never called. Once a `RATE_LIMIT` or `INVALID_STATE` fires, the banner stays until the user navigates away.

**Fix:** auto-dismiss after a few seconds or on the next user action. Simplest pattern — a timer keyed off the error reference:

```tsx
useEffect(() => {
  if (!state.lastError) return;
  const id = setTimeout(() => coop.clearError(), 4000);
  return () => clearTimeout(id);
}, [state.lastError]);
```

This requires exposing a `clearError()` action via the hook (1-line addition).

---

## MEDIUM — fix when convenient

### M-1 `handleMessage` uses `as Extract<…>` cast instead of a type guard
**File:** `coopClient.ts:142`

```ts
const f = frame as Extract<ServerFrame, { seq: number }>;
if (typeof f.seq !== 'number' || f.seq <= this.lastSeenSeq) return;
```

The cast bypasses TS narrowing. Replace with a proper guard:

```ts
if (!('seq' in frame) || typeof frame.seq !== 'number') return;
if (frame.seq <= this.lastSeenSeq) return;
this.lastSeenSeq = frame.seq;
```

After this, the cast disappears and TS narrows `frame` correctly inside the `if`.

### M-2 `ChargingView` is 70 lines — over the 50-line guideline
**File:** `CoopRoomScreen.tsx:222-292`

Three concerns rolled into one component: press tracking (`pressedAtRef`), 30Hz interpolation ticking (`force` rerender), and presentation. Extract a hook:

```ts
function useLocalChargeProgress(opts: {
  serverProgress: number;
  isCharging: boolean;
  durationMs: number;
}): { progress: number; onPressIn: () => void; onPressOut: () => void } {
  ...
}
```

Then `ChargingView` becomes ~25 lines of pure JSX.

### M-3 Lazy imports inside `connect()` slow first connection
**File:** `Backend/api/spinner_coop/consumer.py:71-78`

`from channels.db import ...`, `from rest_framework_simplejwt...` are imported inside `connect()`. Each new WS connection re-pays the import resolution. Move them to top-of-file.

### M-4 `_emit_system_abort` doesn't release the per-room lock
**File:** `consumer.py:_emit_system_abort`

Cleans up `_ROOM_STORE` and `_ROOM_LOCKS.pop(room_id, None)` — but `_apply` calls it from within an `async with _lock_for(room_id):` block held by `_run_locked`. Popping the lock while it's held is benign but means any subsequent `_lock_for(room_id)` call gets a *different* lock object. If a stale timer fires for the now-aborted room, it'll acquire a fresh lock and re-enter the now-empty store. Currently safe (every transition then bails on "room not found"), but fragile.

**Fix:** don't pop the lock in `_emit_system_abort`; let `_apply`'s normal disposal path handle it once we exit the `with` block.

### M-5 `now()` is `Date.now()` everywhere in the client
**File:** `useCoopRoom.ts:83`, `CoopRoomScreen.tsx:235,250,251,263`, `RevealAnimation.tsx:48,62`

All client-side timestamps go to the server as `body.at: Date.now()` (charge press_in/out). The server overwrites with its receive timestamp (spec §5 Q5), so this is "hint only" and harmless. But it means if the user's clock is wrong, the local interpolation math (`interpolateLocalCharge`) drifts. Worth a comment in `charge.ts` and/or using `performance.now()` for relative timing within a single press.

### M-6 `coopProtocol.ts` ServerFrame union has duplicated envelope shape
**File:** `coopProtocol.ts:175-228`

Each variant repeats `v, type, ts, seq, room_id, body`. Refactor with a generic:

```ts
type SeqEnvelope<T extends string, B> = {
  v: number;
  type: T;
  ts: number;
  seq: number;
  room_id: string;
  body: B;
};

type OutOfBandEnvelope<T extends string, B> = {
  v: number;
  type: T;
  ts: number;
  body: B;
};

export type ServerFrame =
  | SeqEnvelope<'room.created', RoomCreatedBody>
  | SeqEnvelope<'room.joined', RoomJoinedBody>
  | ...
  | OutOfBandEnvelope<'error', ErrorBody>
  | OutOfBandEnvelope<'ping', PingBody>;
```

Halves the file and makes the seq-vs-out-of-band distinction (relevant to C-2) explicit at the type level.

---

## LOW — notes

- **L-1** `coopClient.ts:37` `typeof process !== 'undefined'` chain is defensive but unnecessary in Expo/RN where `process` is always defined. Trim.
- **L-2** `coopReducer.ts` stores `frame.body.shares` directly in `state.reveal.shares`. Reducer is "pure" only as long as no caller mutates the array. Add a `[...frame.body.shares]` shallow copy at the reducer boundary.
- **L-3** Internal sub-components in `CoopRoomScreen.tsx` (`PhaseView`, `ConnectView`, `LobbyView`, ...) don't declare explicit `: React.JSX.Element` return types. Public exports do; internal helpers should match for consistency.
- **L-4** `coopClient.ts:127` `JSON.parse(raw)` doesn't use `unknown` — see H-2 fix.
- **L-5** `Mobile-Frontend/src/features/spinner/coop/useCoopRoom.ts:78-99` `useMemo` with empty deps — fine here since helpers close only over `clientRef.current` (a ref), but is the kind of thing that bites future maintainers. A `// helpers are stable because clientRef is a ref` comment helps.
- **L-6** `applyFrame` handles `error` frame and `ping` frame is never seen there (coopClient short-circuits ping). The reducer's `default: return state;` swallows anything else. OK but worth tagging `// ping/pong handled in client — never reaches the reducer`.
- **L-7** `CoopRoomScreen.tsx:229` `useState(0)` rerender hack — standard pattern but could be wrapped as `useForceUpdate()` for readability.

---

## Security scan (TS layer + Python regressions)

| OWASP | Finding | Severity |
|---|---|---|
| **A01 Broken access control** | C-1 the client doesn't actually send the JWT it should → backend rejects every connection. Functional, not exploitable, but blocks the auth model from working at all. | CRITICAL |
| **A02 Cryptographic failures** | JWT is conveyed in the query string. Acceptable for WS (no `Authorization` header on WS open), but the token IS exposed in URL access logs by default. Recommend logging filter for `?token=`. | MEDIUM |
| **A03 Injection** | No `eval`, no `dangerouslySetInnerHTML`, no `Function()`. JSON parse without schema (H-2) lets a malformed frame crash the reducer but doesn't inject. | LOW |
| **A04 Insecure design** | C-2 synthetic abort dropped by client → users left in zombie SPINNING state when wallet fails. Functional severity = HIGH; security impact = trust violation. | HIGH |
| **A05 Security misconfiguration** | H-4 unbounded `_ROOM_CREATE_HISTORY` growth (memory exhaustion vector if 100K+ users connect). H-1 makes the status-stuck UI feel "frozen" — operationally an availability concern (users back out, retry, churn). | MEDIUM |
| **A06 Vulnerable components** | No new deps in this fix batch. Existing channels==4.1.0, daphne==4.1.2, simplejwt — current. ✓ | OK |
| **A07 Auth & session failures** | After C-1 client fix, JWT auth works. Token refresh on long sessions is not yet wired (TODO: pass thunk, refresh on 4401). | MEDIUM |
| **A08 Software/data integrity** | H-2 (frames trusted without schema validation) is the primary remaining gap. Compromise of the WS bus (e.g. malicious channel-layer worker) could ship arbitrary state to clients. | HIGH |
| **A09 Logging & monitoring** | `wallet_service.py` logs every debit/refund/credit at INFO. No metrics yet on abort rate / rate-limit hits / seq dedup drops. Add when shipping. | LOW |
| **A10 SSRF** | N/A. No outbound network from this code. | OK |

---

## Style audit — `~/.claude/rules/typescript/{coding-style,patterns}.md`

| Rule | Status | Notes |
|---|---|---|
| Explicit types on public APIs | ✓ | Every exported function has return + arg types. |
| `interface` for object shapes | ✓ | `CoopState`, `ChargeMeterProps`, `RevealCue`, etc. |
| `type` for unions/intersections | ✓ | `ServerFrame`, `ClientCommand`, `Phase`, `ErrorCode`. |
| No `any` | ⚠ | `coopClient.ts:127,142` uses `as` casts on parsed JSON. See M-1 / H-2. |
| `unknown` for external input | ✗ | Same site — `frame` is typed as `ServerFrame` after a bare cast. Fix via H-2. |
| Zod for schema validation | ✗ | Convention says "use Zod for schema-based validation"; H-2 fix should adopt it. |
| Named `interface` for React props | ✓ | `CoopRoomScreenProps`, `ChargeMeterProps`, `RevealAnimationProps`. |
| No `React.FC` | ✓ | None used. |
| Async/await with try/catch | ✓ | `coopClient.send` wraps in try/catch; `connect` doesn't throw (Hello, WebSocket API). |
| Immutability (spread) | ✓ | Reducer always returns fresh objects via spread. |
| No `console.log` | ✓ | Zero occurrences. Reducer fuzzer + tests use `console.log` only as fallback; not in production code. |
| File size <800 lines | ✓ | `CoopRoomScreen.tsx` is the largest at ~580 lines. |
| Function size <50 lines | ⚠ | `ChargingView` is 70 lines (M-2). |
| Nesting <4 | ✓ | Max depth = 3 in the reducer switch. |
| Magic numbers | ⚠ | `coopClient.ts:158` has `30_000` and `1000`. Hoist to `MAX_RECONNECT_DELAY_MS = 30_000` constant. |
| No silent failures | ⚠ | `coopClient.send`'s catch returns `false` and swallows the error — should at least pass it to an `onError` callback so the UI can act. |

---

## Test surface

- Backend pytest: **414 / 414** — passes after v1 fixes.
- Frontend jest: **432 / 432** — passes, but every test that exercises `CoopClient`/`useCoopRoom` does so against a mock that hand-builds frames; no test would catch C-1 (wrong URL) or C-2 (dropped abort). After the fixes here, add:
  - A test that asserts `?token=` is present in the URL passed to `WebSocket()` (mock global WebSocket).
  - A test that emits a server frame with `seq: -1` and asserts `onFrame` is still called for `error` and `room.aborted` types.
  - A backend integration test that forces a `DEBIT_GEMS` failure and asserts the client receives a `room.aborted` (not just that the server emits one).

---

## Priority order to fix

1. **C-1 (5 min):** swap the client URL builder to use `?token=`. Update `useCoopRoom` to pull from `tokenStore.getAccessToken`. Remove `userId` / `displayName` from props.
2. **C-2 (10 min):** assign a real `seq` to synthetic aborts on the server; on the client, route `error` + `room.aborted` past the dedup gate (defense in depth).
3. **H-1 (5 min):** `status` → `useState`.
4. **H-2 (45 min):** install Zod (or add a hand-rolled guard for the union), validate every inbound frame at `coopClient.handleMessage`.
5. **H-3 (10 min):** drop `userId`/`displayName` from `useCoopRoom`/`CoopRoomScreen` props; pull from auth.
6. **H-4 (3 min):** evict empty lists from `_ROOM_CREATE_HISTORY`.
7. **H-5 (5 min):** auto-dismiss `state.lastError` after a timeout via the existing `clearLastError` helper.
8. **M-1 / M-2 / M-3 / M-5 / M-6** — clean up while pages are open; none block merge.

Approve once C-1 and C-2 are fixed; the rest can ship in the same PR.
