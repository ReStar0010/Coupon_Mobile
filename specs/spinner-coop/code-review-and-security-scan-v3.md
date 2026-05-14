# Spinner Co-op — Code Review v3

**Scope:** what slipped through v2's fix pass. Focused review of the v2-touched files (`useCoopRoom.ts`, `coopClient.ts`, `CoopRoomScreen.tsx`, `consumer.py`) plus a fresh look at test coverage of the new code paths.

**Verdict:** **BLOCK** until C-1 is fixed (every call to `useCoopRoom` triggers a reconnect storm) and H-1 is decided (the hook now misidentifies "self" for joiners in multi-player rooms — regression vs the previous version).

---

## CRITICAL

### C-1 `useCoopRoom`'s `useEffect` reconnects on every render
**File:** `Mobile-Frontend/src/features/spinner/coop/useCoopRoom.ts:67-88`

```ts
useEffect(() => {
  ...
  const client = new CoopClient({ token, baseUrl, ... });
  ...
  return () => { client.close(); ... };
}, [enabled, token, baseUrl]);
```

`token` is typed as `TokenProvider = string | (() => string | Promise<string>)`. Real callers pass a thunk:

```tsx
<CoopRoomScreen token={getAccessToken} ... />
// or
<CoopRoomScreen token={() => getAccessToken()} ... />
```

The first form has stable identity (one module-level function). The second — and any inline `() => fetchToken()` — produces a *new function object on every parent render*. The effect's dep array compares by reference, so:

1. parent re-renders →
2. new `token` function identity →
3. effect cleanup runs → `client.close()` → backend gets a 1000 close →
4. effect body runs → new `CoopClient` → `connect()` → backend handshake → token fetch → JWT validation → ... →
5. … until the next parent render.

On a screen with any other state (countdown ticking, charge progress) this **disconnects and reconnects multiple times per second**. Server-side: rate limiter trips quickly; user sees `RATE_LIMIT` errors and a flapping connection.

**Fix:** stash the latest `token` provider in a ref so the effect deps don't include it:

```ts
const tokenRef = useRef<TokenProvider>(options.token);
useEffect(() => { tokenRef.current = options.token; }, [options.token]);

useEffect(() => {
  if (!enabled) { setStatus('closed'); return; }
  const client = new CoopClient({
    token: () => {
      const t = tokenRef.current;
      return typeof t === 'string' ? t : t();
    },
    baseUrl,
    ...
  });
  ...
}, [enabled, baseUrl]); // <-- token NOT in deps
```

Now the client is constructed once per `enabled`/`baseUrl` change; token refreshes happen lazily via the ref on each `openWithToken()`.

Add a regression test with a counter-incrementing parent that asserts `WebSocket` constructor is called exactly once.

---

## HIGH

### H-1 `deriveSelfUserId` returns `hostId` — wrong identity for joiners
**File:** `Mobile-Frontend/src/features/spinner/coop/CoopRoomScreen.tsx` (in the v2 refactor — `deriveSelfUserId` helper)

```ts
function deriveSelfUserId(state): string {
  return state.hostId ?? '';
}
```

The previous version of the screen took `userId` as a prop. The v2 H-3 fix dropped the prop because "identity should come from the JWT, not the UI tree." Correct in principle — but the v2 implementation derives identity by *guessing* it's the host. For joiners that's wrong:

- Alice (host) creates a room. `hostId == "alice_id"`.
- Bob joins. The screen on Bob's device renders `deriveSelfUserId(state) == "alice_id"`.
- `StakingView`'s "me" lookup `state.players.find(p => p.user_id === userId)` finds **Alice**, not Bob.
- Bob's stepper edits show Alice's stake; the lock button toggles Alice's lock visually; the highlight on the roster wraps the wrong row.

This is a real correctness regression that the existing tests don't catch (no test mounts the screen as a non-host player).

**Fix options (pick one):**

A. **Carry self id alongside the JWT.** Decode the `user_id` claim client-side from the access token and pass it down:

```ts
import { jwtDecode } from 'jwt-decode';

const selfUserId = useMemo(() => {
  if (typeof token !== 'string') return null; // thunks: read first frame
  try { return String(jwtDecode<{ user_id: number }>(token).user_id); }
  catch { return null; }
}, [token]);
```

B. **Have the server echo the authenticated id in `room.created` / `room.joined`.** Add a `you_are: { user_id }` block to those frame bodies. The reducer stores it on `state.meUserId`. No client-side JWT decode needed.

B is the cleaner protocol-level fix. Either way, the `deriveSelfUserId(state) = state.hostId` shortcut needs to die.

### H-2 `isServerFrame` only validates the envelope, not the body
**File:** `Mobile-Frontend/src/features/spinner/coop/coopClient.ts:208-225`

```ts
function isServerFrame(x: unknown): x is ServerFrame {
  if (!isRecord(x)) return false;
  if (typeof x.v !== 'number') return false;
  if (typeof x.type !== 'string') return false;
  if (typeof x.ts !== 'number') return false;
  if (!isRecord(x.body)) return false;
  ...
  return true;
}
```

A frame `{ v:1, type:'room.reveal', ts:0, seq:1, room_id:'r', body:{ shares:"oops" } }` passes. The reducer walks `frame.body.shares` — but TS thinks it's `ShareSnapshot[]` and `RevealAnimation` calls `.map(...)` on the string, throwing.

The v2 review flagged this and the fix added the envelope guard but left body shapes unvalidated. Real fix needs per-`type` body checks. Two paths:

**A. Hand-rolled per-type guard** (no new deps, ~80 lines):

```ts
function isPlayerSnapshot(x: unknown): x is PlayerSnapshot {
  return isRecord(x)
    && typeof x.user_id === 'string'
    && typeof x.seat === 'number'
    && typeof x.stake === 'number' && x.stake >= 1 && x.stake <= 5
    && typeof x.locked === 'boolean'
    && typeof x.progress === 'number'
    && typeof x.is_charging === 'boolean'
    && typeof x.connected === 'boolean';
}

function isShareSnapshot(x: unknown): x is ShareSnapshot { ... }

function isServerFrame(x: unknown): x is ServerFrame {
  if (!envelopeOk(x)) return false;
  switch (x.type) {
    case 'room.reveal':
      return isRecord(x.body)
        && typeof x.body.M === 'number'
        && typeof x.body.total_payout === 'number'
        && Array.isArray(x.body.shares)
        && x.body.shares.every(isShareSnapshot);
    ...
  }
}
```

**B. Zod (recommended per `~/.claude/rules/typescript/coding-style.md`):**

```ts
const PlayerSnapshotSchema = z.object({
  user_id: z.string(),
  seat: z.number().int().min(0).max(2),
  stake: z.number().int().min(1).max(5),
  locked: z.boolean(),
  progress: z.number().min(0).max(1),
  is_charging: z.boolean(),
  connected: z.boolean(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
});
const RoomRevealBodySchema = z.object({
  round_id: z.string(),
  M: z.number().int().min(0),
  G_total: z.number().int().min(1),
  f: z.number().int().min(0),
  total_payout: z.number().int().min(0),
  shares: z.array(ShareSnapshotSchema),
  reveal_plan: z.object({ phases: z.array(...) }),
  state: PhaseSchema,
});
const ServerFrameSchema = z.discriminatedUnion('type', [...]);
```

The bundle cost of Zod is ~12 KB gzipped. Worth it for the safety on a wire that shapes runtime UI.

### H-3 `useCoopRoom`'s `useEffect` cleanup races onFrame callbacks
**File:** `useCoopRoom.ts:82-87`

```ts
return () => {
  client.close();
  clientRef.current = null;
  setStatus('closed');
  dispatch({ kind: 'reset' });
};
```

`client.close()` schedules `ws.close()` but the WS may have queued messages already in the JS event loop. They fire `ws.onmessage` → `handleMessage` → `this.opts.onFrame(frame)` → the closure-captured `dispatch`. The dispatch goes into the *unmounted* reducer. React 18+ ignores dispatches on unmounted reducers (no warning; no effect), but it's still a dropped frame and a wasted parse.

**Fix:** add a "released" flag to the closure so the onFrame closure no-ops post-cleanup:

```ts
useEffect(() => {
  if (!enabled) { setStatus('closed'); return; }
  let released = false;
  const client = new CoopClient({
    token,
    baseUrl,
    onFrame: (frame) => { if (!released) dispatch({ kind: 'frame', frame }); },
    onOpen: () => { if (!released) setStatus('open'); },
    onClose: () => { if (!released) setStatus('closed'); },
  });
  ...
  return () => {
    released = true;
    client.close();
    ...
  };
}, [enabled, token, baseUrl]);
```

Combined with the C-1 fix (token in ref), the dep array shrinks to `[enabled, baseUrl]` and the race window collapses.

---

## MEDIUM

### M-1 `OUT_OF_BAND_TYPES: ReadonlySet<string>` should be typed against `ServerFrame['type']`
**File:** `coopClient.ts:23`

```ts
const OUT_OF_BAND_TYPES: ReadonlySet<string> = new Set(['error', 'room.aborted', 'ping']);
```

Typo'd entries (`'rooom.aborted'`) compile fine. Tighten:

```ts
const OUT_OF_BAND_TYPES: ReadonlySet<ServerFrame['type']> = new Set([
  'error',
  'room.aborted',
  'ping',
]);
```

Now adding a typo errors at compile time.

### M-2 Synthetic close events are typed-cast to `CloseEvent`
**File:** `coopClient.ts:91,95`

```ts
this.handleClose({ reason: 'token_unavailable' } as CloseEvent);
```

`CloseEvent` has `wasClean`, `code`, `reason`, `type`, `bubbles`, etc. — the cast is dishonest. `handleClose` only reads `.reason` so it doesn't crash today, but the next maintainer who reads `.code` to differentiate close reasons gets `undefined`.

**Fix:** introduce a small internal type:

```ts
type CloseReason = { reason: string; code?: number };
private handleClose(e: CloseReason): void { ... }
```

WS's real `CloseEvent` has both fields, so the existing handler still works.

### M-3 `useForceUpdate` increments forever
**File:** `useForceUpdate.ts:18`

```ts
return useCallback(() => setTick((n) => n + 1), []);
```

A 60Hz tick over years of uptime won't reach `Number.MAX_SAFE_INTEGER`, but it's the kind of unbounded counter a static analyzer flags. Cheap fix:

```ts
return useCallback(() => setTick((n) => (n + 1) & 0x7fffffff), []);
```

(Mask to 31 bits — still triggers re-render on every call because the value changes.)

### M-4 Tests don't cover any of the v2 new code paths
**Files:** `Mobile-Frontend/src/features/spinner/coop/__tests__/*`

Net new code in v2 fix batch:
- `coopClient.handleMessage` schema guard + out-of-band routing (C-2 + H-2)
- `useCoopRoom` status as state, clearError dispatch (H-1, H-5)
- `useForceUpdate`, `useLocalChargeProgress` (M-2)
- `?token=` URL build (C-1)
- Synthetic abort with real seq (server C-2)

Existing test surface:
- `coopReducer.test.ts` — unchanged from before v2; doesn't test the new `'clear-error'` action.
- `fuzzer.test.ts` — unchanged; covers `applyFrame`, not the client / hook.
- `charge.test.ts`, `reveal.test.ts` — pure-math, unchanged.

Add at minimum:
- `coopClient.test.ts` — mock global `WebSocket`, assert `?token=` in URL; assert `room.aborted` with `seq=-1` is still delivered to `onFrame`; assert malformed frame routes to `onMalformedFrame`.
- `coopReducer.test.ts` — one case for `clearLastError(state)` clearing the field; one no-op case when `state.lastError === null`.

### M-5 `_ROOM_CREATE_HISTORY` cleanup on disconnect runs even when the user has no active history
**File:** `Backend/api/spinner_coop/consumer.py:`disconnect`

```py
if self.user_id is not None:
    history = _ROOM_CREATE_HISTORY.get(self.user_id)
    if history is not None:
        now_s = time.monotonic()
        history[:] = [t for t in history if now_s - t < _ROOM_CREATE_WINDOW_S]
        if not history:
            _ROOM_CREATE_HISTORY.pop(self.user_id, None)
```

Correct, but called for every disconnect including ones with no history (those just hit the `is None` guard early — fine). Style nit: hoist to a small helper `_evict_history(user_id)` since the same pattern lives in `_cmd_room_create`.

---

## LOW

- **L-1** `useCoopRoom.ts:88` — `[enabled, token, baseUrl]` includes `token` (function); see C-1.
- **L-2** `CoopRoomScreen.tsx` `deriveSelfUserId` is exported as a top-level helper; should be either inlined or moved to a `selfId.ts` module so it can be unit-tested in isolation.
- **L-3** `useCoopRoom`'s `helpers` `useMemo` deps `[send]` — but `send` is itself stable via `useCallback([])`. So helpers are computed once. Worth a comment noting the chain.
- **L-4** `coopClient.ts:99` `'/ws/spinner/v1/?token='` — string literal. Hoist to `WS_PATH = '/ws/spinner/v1/'` so server + client share a single source of truth (could even be generated from a shared OpenAPI/proto file later).
- **L-5** `coopProtocol.ts` ServerFrame union still has the duplicated envelope shape per variant (v2 M-6 follow-up). DRYing with a `SeqEnvelope<T, B>` generic remains a pure cleanup.
- **L-6** `consumer.py:_emit_system_abort` reads `_ROOM_STORE.get(room_id)` for `next_seq`, but if the room was already disposed in a concurrent path, falls back to `seq=1`. In the abort case the room is being disposed anyway, so a stale low seq is harmless to clients (out-of-band routing covers it). Worth documenting.

---

## Style / convention check

| Rule | Status | Notes |
|---|---|---|
| No `any` | ✓ | One internal `as` cast on synthetic `CloseEvent` (M-2). |
| `unknown` for external input | ✓ | `coopClient.handleMessage` parses to `unknown`, then guards. |
| Schema validation on external input | ⚠ | Envelope only (H-2). |
| No `console.log` | ✓ | Zero in production code. |
| Custom hooks small + focused | ✓ | `useForceUpdate`, `useLocalChargeProgress` extracted per `frontend-patterns` skill. |
| `useCallback` for stable identity | ✓ | `send`, `close`, `clearError` in `useCoopRoom`. |
| `useMemo` for expensive deps | ✓ | `helpers` memoized against `[send]`. |
| `useState` for visible state | ✓ | `status` is now state (was ref in v1). |
| File size <800 | ✓ | `CoopRoomScreen.tsx` is the largest at ~590. |
| Function size <50 | ✓ | `ChargingView` reduced to ~25 lines after `useLocalChargeProgress` extraction. |
| Effect cleanup correctness | ⚠ | Race in `useCoopRoom` cleanup (H-3). |

---

## Security re-scan (TS only)

| OWASP | Finding | Severity |
|---|---|---|
| **A01 Broken access control** | C-1 reconnect storm trips backend rate limit → effectively a DoS-self condition. The user, having done nothing wrong, is locked out by `RATE_LIMIT`. | HIGH |
| **A02 Crypto** | JWT in URL — same posture as before (acceptable for WS, log-redact recommended). | LOW |
| **A03 Injection** | H-2 partial validation (envelope only). A buggy/compromised server can still send shape-invalid bodies that crash UI. | HIGH |
| **A04 Insecure design** | H-1 wrong "self" identity for joiners — players can't see their own state, edits go to the wrong row. Trust violation; the user thinks they're seeing themself. | HIGH |
| **A05 Sec misconfiguration** | OUT_OF_BAND_TYPES set is `<string>` not `<ServerFrame['type']>` — typos compile (M-1). | MEDIUM |
| **A06 Vulnerable components** | None new. | OK |
| **A07 Auth failures** | C-1 — repeated reconnects revalidate the JWT; after refresh-token expiry the user is stuck in a reconnect loop. | HIGH |
| **A08 Software integrity** | Same as H-2. | HIGH |
| **A09 Logging** | `onMalformedFrame` is a noop default — protocol violations are silently dropped. Wire to Sentry once available. | LOW |
| **A10 SSRF** | N/A | OK |

---

## Priority order

1. **C-1 (10 min)** — `token` to a ref; remove from `useEffect` deps. Add a regression test that re-renders the parent and asserts `WebSocket` is constructed exactly once.
2. **H-1 (20 min)** — pick H-1 path A (decode JWT) or B (server echoes `you_are`); my recommendation is B because it doesn't require adding `jwt-decode` to the bundle and matches the principle of "server is source of truth".
3. **H-2 (45 min, or 90 min for Zod)** — body-shape validation per type. Hand-rolled or Zod.
4. **H-3 (5 min)** — `released` flag in the cleanup closure.
5. **M-* (30 min total)** — typed Set, internal CloseReason type, masked counter, helper extraction.
6. **Tests (45 min)** — `coopClient.test.ts`, additional reducer cases for `clear-error`, regression test for C-1.

Approve once C-1 + H-1 are fixed — those are the two real correctness bugs; everything else is hardening.
