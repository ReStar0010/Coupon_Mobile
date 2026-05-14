# Spinner Co-op — Code Review & Security Scan

**Scope:** every file produced or modified across deliverables 1–7 of the spinner co-op build (≈ 2,500 LOC backend + 1,400 LOC frontend + 1,900 LOC tests). Reviewed inline by re-reading each file; findings reference specific line ranges.

**Conventions applied:** CLAUDE.md severity grades (CRITICAL / HIGH / MEDIUM / LOW), per-rule citations from `~/.claude/rules/common/{code-review,security}.md` and `~/.claude/rules/python/{coding-style,security,patterns}.md`.

**Verdict:** **BLOCK** until the CRITICAL findings (auth, broadcast-before-commit, origin check, intra-room race) are fixed. The math layer (`compute_round`) and transition layer (`transitions.py`) are clean; the consumer / dispatch boundary is where the issues cluster.

---

## CRITICAL — must fix before merge

### C-1 No authentication on WebSocket connect (impersonation)
**File:** `Backend/api/spinner_coop/consumer.py:71-87`

```py
self.user_id = int(qs.get("user", ""))
...
self.display_name = qs.get("name", f"User{self.user_id}")
```

Anyone connecting to `/ws/spinner/v1/?user=42` claims to be user 42. There is **no JWT verification**, no signature check, no session lookup. This is documented as "dev only" in the docstring, but the production code path is identical — there's no environment guard.

**Impact:** trivial impersonation. An attacker reads any user id (visible in any social interaction in the app, e.g. a shared coupon's `sharer` field) and connects as that user. They can stake / commit wallet operations on the victim's behalf.

**Fix:** require a JWT in the query string (`?token=<jwt>`) and validate via `rest_framework_simplejwt`:

```py
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

async def connect(self):
    token = self._parse_qs().get("token")
    if not token:
        await self.close(code=4401); return
    try:
        validated = JWTAuthentication().get_validated_token(token)
        self.user_id = int(validated["user_id"])
    except (InvalidToken, TokenError, KeyError, ValueError):
        await self.close(code=4401); return
    user = await database_sync_to_async(User.objects.get)(pk=self.user_id)
    self.display_name = user.username  # NOT the client-supplied query string
    ...
```

Take `display_name` from the authenticated `User`, **not** from the client query string (see H-3).

---

### C-2 Broadcast-before-commit allows state desync
**File:** `Backend/api/spinner_coop/consumer.py:309-324`

```py
async def _apply(self, result: TransitionResult) -> None:
    new_room: Room = result.room
    # 1) persist
    if new_room.phase.value not in ("DISPOSED",):
        _ROOM_STORE.put(new_room)
    ...
    # 2) broadcast
    for ev in result.events:
        await self._broadcast(new_room.room_id, ev)
    # 3) side effects
    if result.side_effects:
        await database_sync_to_async(self._exec_effects, ...)(...)
```

The order is: in-memory store → broadcast → DB side effects. If `DEBIT_GEMS` raises `InsufficientGemsError` (a player's wallet dropped below their stake between STAKING and SPINNING — e.g., they spent gems in another window), clients have **already received `room.spinning`** but no gems were debited and no round is persisted.

**Impact:** clients animate the spin, eventually see `room.reveal` (which fires from the timer that was scheduled before the wallet failure), but the wallet never moved. Trust violation.

**Fix:** run wallet side effects FIRST in a transaction that includes a "pending broadcast" log; only commit broadcasts after the DB transaction succeeds. Simplest reordering:

```py
async def _apply(self, result):
    if result.side_effects:
        await database_sync_to_async(self._exec_effects, ...)(...)  # may raise → bail
    _ROOM_STORE.put(result.room) if not DISPOSED else _ROOM_STORE.remove(...)
    for ev in result.events:
        await self._broadcast(...)
```

Plus: catch the exception and emit `room.aborted` instead of bubbling it up silently. The current code path lets the WS frame hang in a half-state.

---

### C-3 No origin allowlist on WebSocket
**File:** `Backend/Backend/asgi.py:18-25`

```py
_protocol_router = ProtocolTypeRouter({
    "http": django_application,
    "websocket": URLRouter(websocket_urlpatterns),  # no origin check!
})
```

A malicious page on any origin can open a WebSocket to `/ws/spinner/v1/` from the victim's browser (cookies aren't required since auth is via JWT query). Combined with C-1, a phishing page can impersonate the user as soon as they leak any JWT.

**Fix:** wrap the websocket route in Channels' `AllowedHostsOriginValidator`:

```py
from channels.security.websocket import AllowedHostsOriginValidator

"websocket": AllowedHostsOriginValidator(
    URLRouter(websocket_urlpatterns)
),
```

`ALLOWED_HOSTS` already exists in settings.py for HTTP — same list applies.

---

### C-4 Intra-room race on `_apply` → seq collision + lost state
**File:** `Backend/api/spinner_coop/consumer.py:108-122` + `transitions.py:_emit`

Channels serializes inbound messages **per connection**, not per room. Two players in the same room run on two consumer instances. Both can call `_apply` concurrently:

1. Alice's consumer reads `room.seq = 5`, produces `room' (seq=6)`, broadcasts event(seq=6).
2. Bob's consumer reads `room.seq = 5` (same!), produces `room'' (seq=6)`, broadcasts event(seq=6).
3. Both call `_ROOM_STORE.put` — last write wins. Other player's state mutation is lost.

**Impact:** lost stake updates, lost locks, players seeing each others' transitions overwrite their own. The frontend's seq dedup makes this worse — it drops one of the two seq=6 events, so one player never sees the other's action.

**Fix:** per-room async lock taken inside `_apply` (and any read-modify-write site). Sketch:

```py
_ROOM_LOCKS: dict[str, asyncio.Lock] = {}

def _lock_for(room_id: str) -> asyncio.Lock:
    if room_id not in _ROOM_LOCKS:
        _ROOM_LOCKS[room_id] = asyncio.Lock()
    return _ROOM_LOCKS[room_id]

async def _apply(self, result):
    room_id = result.room.room_id
    async with _lock_for(room_id):
        # read-side: re-fetch the latest room snapshot, re-run the transition
        # against it (or accept the staleness for transitions whose body
        # doesn't depend on prior state — joins, etc.)
        ...
```

The clean solution is to re-fetch the room inside the lock and re-apply the transition (compare-and-swap style). Otherwise add a `room.version` field and reject stale writes.

---

## HIGH — should fix before merge

### H-1 No rate limiting (trivial DoS)
**Files:** `consumer.py` (entire file) + spec §3.5 mentions `ErrorCode.RATE_LIMIT` but nothing implements it.

A misbehaving or malicious client can flood `stake.set` / `charge.press_in` / `room.create` and consume CPU + channel-layer bandwidth. Spec calls for ">20 commands/s per player" as the cap.

**Fix:** sliding-window counter in `receive_json`:

```py
class SpinnerCoopConsumer(...):
    _RATE_WINDOW_S = 1.0
    _RATE_MAX = 20

    async def receive_json(self, content, **kw):
        now = time.monotonic()
        self._cmd_times = [t for t in getattr(self, '_cmd_times', []) if now - t < self._RATE_WINDOW_S]
        if len(self._cmd_times) >= self._RATE_MAX:
            await self._send_error(ErrorCode.RATE_LIMIT, "slow down", None)
            return
        self._cmd_times.append(now)
        ...
```

Plus: cap rooms-per-user-per-minute on `room.create` (consume memory).

---

### H-2 `display_name` accepted unbounded from query string
**File:** `consumer.py:83`

```py
self.display_name = qs.get("name", f"User{self.user_id}")
```

No length cap, no character filter. A client with `?name=` followed by 1 MiB of text broadcasts that to every room member on every state change. Memory + bandwidth amplification.

**Fix:** clamp + sanitize:

```py
raw_name = qs.get("name", f"User{self.user_id}")
self.display_name = raw_name[:40].replace("\n", " ").replace("\r", " ")
```

Better: ignore the query-string name entirely once C-1 is fixed and pull `display_name` from the authenticated `User` row.

---

### H-3 Ledger `f_floor` recovered by division (fragile)
**File:** `Backend/api/spinner_coop/executor.py:115-122`

```py
"f_floor": (
    p["shares"][0]["floor"] // p["shares"][0]["stake"]
    if p.get("shares") and p["shares"][0]["stake"] > 0
    else 0
),
```

`f_floor` is reconstructed by integer-dividing the first share's `floor` by `stake`. This works only because we know `floor_i == stake_i · f` (locked invariant). If a future round emits malformed shares, this silently produces wrong ledger data. Also: stake==0 returns 0 instead of failing loudly — the invariant says stake ≥ 1, so 0 indicates a bug we should surface.

**Fix:** pass `f` directly in the `PERSIST_ROUND` side effect payload from `transitions.complete_spinning`:

```py
# transitions.py
SideEffect(SideEffectKind.PERSIST_ROUND, {
    "round_id": round_id,
    "M": result.M,
    "f": result.f,           # ← add
    "G_total": result.G_total,  # ← add
    "shares": [...],
})

# executor.py
"f_floor": p["f"],
"g_total": p["G_total"],
```

Eliminates reconstruction and makes the ledger row a faithful copy of the computed result.

---

### H-4 Solo room is joinable after first stake
**File:** `transitions.py:set_stake` line 250-ish and `join_room` guard.

`set_stake` auto-promotes SOLO → STAKING. After that, `join_room` accepts the room because `Phase.STAKING ∈ JOINABLE_PHASES`. A "solo" room is no longer solo as soon as the player picks a stake.

**Impact:** users who explicitly chose solo and then staked could be ambushed by a stranger scanning the (visible) code.

**Fix:** add `is_solo: bool` to `Room`, set at create time, gate `join_room` on it:

```py
@dataclass(frozen=True)
class Room:
    ...
    is_solo: bool = False

# join_room:
if room.is_solo:
    raise TransitionError(ErrorCode.INVALID_STATE, "solo room cannot accept joiners")
```

---

### H-5 Module-level singleton `RoomStore` breaks multi-worker deploys
**File:** `consumer.py:30` (`_ROOM_STORE = RoomStore()`)

Daphne / Uvicorn typically run multiple worker processes. Each gets its own `_ROOM_STORE`. A player connecting to worker A creates a room visible only on worker A; their friend connecting to worker B sees "room not found".

**Mitigation in dev:** single worker. **Production fix:** swap `RoomStore` for a Redis-backed implementation behind the same interface. Documented in the package docstring already, but blocking for prod.

---

## MEDIUM — fix when convenient

### M-1 `_apply` swallows exceptions from `database_sync_to_async`

Currently exceptions from `_exec_effects` propagate out of `_apply` → out of the consumer's `receive_json` → channels logs them but the client gets no `error` frame. Wrap in try/except and emit `room.aborted` with reason="system_error".

### M-2 `_handle_timer` returns silently for unknown `kind`
**File:** `consumer.py:295-296`. Logs nothing. If a future side effect schedules a typo'd kind, debugging is hard. Log at WARN.

### M-3 `_parse_qs` doesn't handle decoding errors
**File:** `consumer.py:354`. `bytes.decode("utf-8")` raises on malformed bytes. Use `errors="replace"`.

### M-4 `lastError` never clears on reducer
**File:** `Mobile-Frontend/src/features/spinner/coop/coopReducer.ts:lastError`. Once an error frame populates `lastError`, subsequent successful frames don't clear it. Either clear it on every successful applyFrame, or have the UI reset it after a few seconds.

### M-5 No max-rooms-per-user on `room.create`
A user could create thousands of rooms holding gems via stakes. Cap at one active room per user (reject `room.create` if `user_id` is in any active room).

### M-6 `state.bodyText` shows raw `lastError.code` to users
**File:** `CoopRoomScreen.tsx` error banner. Leaks server-side enum names like `INSUFFICIENT_GEMS` directly into the UI. Map to localized strings.

---

## LOW — notes for follow-up

- **L-1** `transitions.py:_handle_player_exit` calls `min(new_room.players, key=lambda p: p.seat)` to promote host. Defensive but assumes seat 0 is always the host originally. Safe today; brittle later.
- **L-2** `useCoopRoom` reconnect prompt missing — when `CoopClient.onClose('max_reconnect_exceeded')` fires there's no UI surface. Add a banner.
- **L-3** `reveal.test.ts` skips animation interaction tests — the count-up math is covered, but the React component itself isn't render-tested. Add an RTL render that fast-forwards `jest.useFakeTimers()` through phases.
- **L-4** `wallet_service.py:124-127` log payloads include user IDs. Acceptable for audit; consider redacting in lower environments to reduce log size.
- **L-5** `MAX_DEAD_RECKON_MS = 100` matches the broadcast cadence; if you bump charge broadcast Hz to 20, drop this to 50 to match.

---

## Security scan — by OWASP category

| Category | Finding | Severity |
|---|---|---|
| **A01 Broken access control** | C-1 unauthenticated WS, C-3 missing origin check, H-4 solo room joinable | CRITICAL |
| **A02 Cryptographic failures** | `random.SystemRandom()` default for `compute_round` is cryptographic-grade ✓ | OK |
| **A03 Injection** | All DB access via Django ORM + parameterized queries. No raw SQL anywhere. JSONField `shares` not eval'd. | OK |
| **A04 Insecure design** | C-2 broadcast-before-commit; C-4 missing per-room lock. | CRITICAL |
| **A05 Security misconfiguration** | `CHANNEL_LAYERS = InMemoryChannelLayer` (dev only — must be Redis for prod). `?user=<id>` query auth (dev only). Both must be replaced before deploy. | HIGH |
| **A06 Vulnerable components** | `channels==4.1.0`, `daphne==4.1.2` — current LTS. ✓ | OK |
| **A07 Auth & session failures** | C-1 same root cause. | CRITICAL |
| **A08 Software/data integrity** | Σshare = G·M enforced at `compute_round` runtime + in invariant tests. Ledger reconstruction in H-3 is fragile but doesn't change outcomes. | MEDIUM |
| **A09 Logging & monitoring** | `WalletService` logs every debit/refund/credit. `_handle_timer` swallows unknown kinds (M-2). No metrics on room counts / charge cadence / abort rate — add when shipping. | LOW |
| **A10 SSRF** | No outbound requests from spinner_coop code. | OK |

---

## Style / convention check

Against `~/.claude/rules/python/coding-style.md` and `common/coding-style.md`:

- **PEP 8 + type annotations** — every public function has return + arg annotations ✓.
- **Immutability** — `Room` and `Player` are `@dataclass(frozen=True)`; mutations return new instances ✓.
- **No print()** — confirmed via grep: zero `print(` calls in spinner_coop ✓.
- **File size** — biggest file is `transitions.py` at 530 lines. Within `<800 max` limit ✓.
- **Function size** — only one borderline function: `complete_charging` at ~60 lines (includes the docstring + invariant assertions). Acceptable. ✓
- **Deep nesting** — max nesting depth = 3 in `_dispatch_ledger`. Within `<4` limit ✓.
- **Magic numbers** — all timing constants live in `states.py` (`LOBBY_TTL_MS`, `COUNTDOWN_DURATION_MS`, etc.). Wheel multipliers + alphabet are named. ✓
- **Error handling** — every public entry point raises a typed exception (`TransitionError`, `WalletError`); silent failure mostly avoided except M-1.

Against `~/.claude/rules/typescript/coding-style.md`:

- **Strict types** — discriminated `ServerFrame` union; no `any` in production code (one `as Extract<...>` in `coopClient.ts` for the seq-check narrowing — acceptable). ✓
- **No console.log** in shipped TS ✓.
- **React FC pattern** — using prop types + named functions, not `React.FC` ✓.
- **Immutability** — reducer always returns new state via spread; never mutates ✓.

---

## Test coverage assessment

- Backend pytest: **413 tests** across draw helper, transitions (every drop-off cell), wallet service, executor (atomicity), consumer (channels), full integration. Σshare = G·M invariant verified across 1000+ seeded rolls.
- Frontend jest: **432 tests** across reducer (per-event), charge math, reveal math, fuzzer (500 random sequences, no crashes), Phase parity.
- **Untested:** the consumer's `_apply` ordering path (C-2), no per-room race test (C-4), no auth test (C-1). Once C-1 is fixed add an auth-fail integration test.

---

## Priority order to fix

1. **C-1 auth** — biggest blast radius; needed before any preview / staging traffic.
2. **C-3 origin check** — one-line fix, pairs with C-1.
3. **C-2 broadcast-before-commit** — refactor of `_apply`; carries a test that asserts no `room.spinning` is broadcast if `DEBIT_GEMS` raises.
4. **C-4 per-room lock** — required correctness for multi-player. Add a stress test that hammers a 3-player room with concurrent stake.set commands.
5. **H-1 rate limit** — small sliding window per consumer.
6. **H-2 + H-4** — both small.
7. **H-3 ledger** — add `f` and `G_total` to PERSIST_ROUND payload.
8. **H-5 RoomStore** — defer to Redis migration sprint; document as "single-worker only" until then.

Approve once C-1 to C-4 are fixed. H-* can land in the same PR or follow-up.
