# Spinner Co-op — State Machine & Server Event Contract

**Status:** Draft v1 · awaiting review
**Scope:** Deliverable 1 of 7. Defines the authoritative state graph, transitions, guards, side effects, server-emitted events, client-sent commands, and ordering / idempotency rules. **No code yet.** All later deliverables (multinomial draw, WS server, client state, charge meter, reveal animation, tests) will reference this document by section.

---

## 1. Vocabulary

| Term | Meaning |
|---|---|
| **Room** | A short-lived multiplayer session bound to a single spin. Identified by `room_id` (uuid) and `code` (6-char alphanumeric, ambiguous chars stripped). |
| **Player** | An authenticated user. Identified by `user_id`. Within a room, also by `seat` ∈ {0,1,2}. |
| **Host** | The player whose intent created the room. Holds promotion privileges. Seat 0 by default. |
| **Stake** | A player's gem commitment, `G_i ∈ {1..5}`. Set during `STAKING`. |
| **Lock** | An explicit flag a player toggles to commit their stake. Required before `READY`. |
| **Charge** | A held-button progress value `[0..1]` driven by 2.5s timing. Server is the timekeeper; client renders. |
| **G** | Total gems in the room, `Σ G_i`. |
| **P** | Number of seated players, ∈ {1,2,3}. |
| **M** | Server-rolled multiplier (inverse-probability distribution). |
| **f** | Floor multiplier per locked math: `f = max(𝟙[G≥3], P·𝟙[P≥2])`. |
| **R_i** | Per-player random excess from a multinomial, stake-weighted draw. |
| **share_i** | Final per-player payout = `G_i · f + R_i`. Invariant: `Σ share_i = G · M`. |

All randomness (`M`, `R_i`) is computed **server-side** at the `SPINNING → REVEAL` boundary. Clients never roll.

---

## 2. State machine

States are room-level. A single room has one current state. Per-player attributes (lock status, charge progress) are sub-state visible inside `STAKING`/`CHARGING`.

```
                                 ┌──────────┐
                  (solo path)    │   SOLO   │
                  ┌─────────────▶│ (P = 1)  │────┐
                  │              └──────────┘    │
                  │                              │
                  │                              ▼
              create_room                 (skip lobby)
                  │                              │
                  ▼                              │
         ┌────────────────┐                      │
         │   LOBBY_OPEN   │  joiner adds        │
         │  (1 ≤ P < 3,   │◀───── room.joined ──┐│
         │  not all       │                     ││
         │  locked)       │  joiner leaves      ││
         └───┬─────┬──────┘    (free-slot)      ││
             │     │                            ││
   host_lock │     │ joiner_lock                ││
             ▼     ▼                            ││
         ┌────────────────┐                      ││
         │    STAKING     │ ←───── room.staked ─┘│
         │ (each player   │                      │
         │  picks G_i,    │                      │
         │  may lock /    │                      │
         │  unlock until  │                      │
         │  ALL locked)   │                      │
         └─────┬──────────┘                      │
               │  all_locked                     │
               ▼                                 │
         ┌────────────────┐                      │
         │     READY      │  any disconnect →    │
         │ (all locked,   │  ABORT_REFUND        │
         │  awaiting      │                      │
         │  countdown)    │                      │
         └─────┬──────────┘                      │
               │  countdown_start (host trigger  │
               │  OR auto after 2s)              │
               ▼                                 │
         ┌────────────────┐                      │
         │   COUNTDOWN    │  (3-2-1 ticks)       │
         │  (3-2-1, fixed │                      │
         │  3.0s)         │                      │
         └─────┬──────────┘                      │
               │  press_in (all players          │
               │  simultaneously)                │
               ▼                                 │
         ┌────────────────┐                      │
         │   CHARGING     │  release →           │
         │ (2.5s held     │  PAUSE then back     │
         │  charge per    │  to CHARGING when    │
         │  player; all   │  re-pressed          │
         │  must reach 1) │                      │
         └─────┬──────────┘                      │
               │  all_charged_full               │
               │  → DEBIT GEMS atomically        │
               ▼                                 │
         ┌────────────────┐                      │
         │   SPINNING     │ ───── server rolls ──┘
         │  (animation,   │       M, computes R_i
         │   1.5s, server │       commits payouts
         │   has rolled M)│
         └─────┬──────────┘
               │
               ▼
         ┌────────────────┐
         │    REVEAL      │ (sequenced: total → floor → excess)
         └─────┬──────────┘
               │  reveal_complete
               ▼
         ┌────────────────┐
         │    SETTLED     │ (gems consumed, CouPoints credited)
         └─────┬──────────┘
               │  any_player(rematch) → STAKING (new round, same room)
               │  any_player(leave)   → DISPOSE
               ▼
            (POST_SPIN: stay in room until manual rematch or leave)
```

### 2.1 State table

| State | Entered by | Server invariants on entry | Exit triggers |
|---|---|---|---|
| `SOLO` | `create_room(solo=true)` | `P = 1`, host = creator, no lobby ever opens | → `STAKING` immediately |
| `LOBBY_OPEN` | `create_room(solo=false)` | `1 ≤ P ≤ 3`, no player has locked | `room.joined`, `room.left`, host_lock → `STAKING`; abandonment timeout (5min) → `DISPOSE` |
| `STAKING` | first lock event OR solo path | every player has a stake (default `G_i = 1`) | All locked → `READY`; new joiner allowed if `P < 3` (resets the joiner's lock) |
| `READY` | last player locks | All `G_i` final; `f` and `G` computed | `disconnect` → `ABORT_REFUND`; `countdown_start` (host or auto-2s) → `COUNTDOWN` |
| `COUNTDOWN` | from `READY` | Fixed 3.0s; clients tick locally for visual; server confirms phase end | Auto → `CHARGING` |
| `CHARGING` | from `COUNTDOWN` | Server starts charge clock per player on `press_in` | All players reach `progress=1.0` → `SPINNING`; any `disconnect` → `ABORT_REFUND` |
| `SPINNING` | from `CHARGING` | **Atomic:** debit `G_i` from each player's gem balance, roll `M`, compute `R_i`, persist round | After 1500ms server animation budget → `REVEAL` |
| `REVEAL` | from `SPINNING` | Server has authoritative `{ M, share_i }`; emits sequenced reveal frames | All clients ack reveal_complete OR 8s timeout → `SETTLED` |
| `SETTLED` | from `REVEAL` | CouPoints credited, ledger row written | Any player triggers rematch → `STAKING`; or all leave → `DISPOSE` |

### 2.2 Guards (formal)

- `can_lock(player)`: state ∈ {`STAKING`} ∧ player.stake ∈ {1..5}
- `can_unlock(player)`: state == `STAKING` ∧ player.locked ∧ ¬all_locked
- `can_join(room)`: state ∈ {`LOBBY_OPEN`, `STAKING`} ∧ P < 3 ∧ no player has locked yet OR scope='any-couppro' allows late joiners during `LOBBY_OPEN` only
- `can_start_countdown(player)`: state == `READY` ∧ player == host
- `can_press_in(player)`: state == `CHARGING` ∧ player.charge < 1.0
- `can_release(player)`: state == `CHARGING` ∧ player.is_charging
- `can_rematch(player)`: state == `SETTLED` ∧ player.balance.gems ≥ player.last_stake

### 2.3 Side effects (where money / gems move)

| Transition | Side effect | Atomic? |
|---|---|---|
| `STAKING → READY` | none (no debit yet) | — |
| `CHARGING → SPINNING` | **DEBIT** `G_i` from each player atomically (single DB tx) | Yes — all-or-nothing. If any debit fails, transition aborts to `ABORT_REFUND` with no partial state. |
| `SPINNING → REVEAL` | server commits `{round_id, M, R_i, share_i}` to ledger; not yet credited | No — read-only commit; refund possible up to this point on system error |
| `REVEAL → SETTLED` | **CREDIT** `share_i` CouPoints to each player atomically | Yes |
| `* → ABORT_REFUND` | refund all `G_i` if state ≥ `SPINNING`; otherwise no-op (gems were never debited) | Yes |

### 2.4 Drop-off matrix

| Player drops in… | Decision (locked spec) | Server action |
|---|---|---|
| `LOBBY_OPEN` (joiner, pre-READY) | free-slot | Remove player; broadcast `room.left`; seat reopens. |
| `LOBBY_OPEN` (host, pre-READY) | promote | Promote oldest joiner to host; broadcast `room.host_changed`. If no joiners, dispose room. |
| `STAKING` | free-slot (joiners), promote (host) | Same as `LOBBY_OPEN`. |
| `READY`, `COUNTDOWN`, `CHARGING` | abort-refund | Cancel countdown/charge, transition `→ ABORT_REFUND`, no debit (or refund if mid-debit), broadcast `room.aborted`. |
| `SPINNING` | abort-refund | Refund `G_i` to ALL players, mark round `aborted`, no payout. Broadcast `room.aborted`. |
| `REVEAL`, `SETTLED` | best-effort | Disconnected player still gets credited (server already committed). 30s re-entry grace lets them rejoin and see the result. |

Re-entry grace = 30s, applies only to disconnects from `REVEAL`/`SETTLED`. After grace, room either disposes or continues with remaining players (rematch path).

---

## 3. Server event contract

All over a single WebSocket per player at `/ws/spinner/v1/?room=<id-or-code>` with JWT in the connection query. Both directions are JSON envelopes.

### 3.1 Envelope

```json
{
  "v": 1,
  "type": "<event-name>",
  "ts": 1715520000123,
  "seq": 42,
  "room_id": "uuid",
  "body": { /* event-specific */ }
}
```

- `v` — protocol version (currently 1). Bump on breaking changes.
- `seq` — server-assigned monotonic per-room counter. Clients must drop out-of-order frames (`seq < last_seen`).
- `ts` — server epoch ms. Clients use this only for display; never derive state from it.
- `room_id` — present on every server frame except `error.connect`.

### 3.2 Client → server commands

Direction: **client to server**. Each command may be replied to with a state-change broadcast OR an `error` frame.

| Command | Body | Allowed in states | Idempotent? |
|---|---|---|---|
| `room.create` | `{ solo: bool }` | (no room yet) | No — creates a new room each call |
| `room.join` | `{ code: "ABCD12" }` OR `{ room_id: "uuid" }` | `LOBBY_OPEN`, `STAKING` (if free-slot) | Yes — re-joining own room is no-op |
| `room.leave` | `{}` | any | Yes |
| `stake.set` | `{ gems: 1..5 }` | `STAKING` (or first call enters `STAKING` from `LOBBY_OPEN`) | Yes — last-write-wins |
| `stake.lock` | `{}` | `STAKING` | Yes |
| `stake.unlock` | `{}` | `STAKING` and not all-locked | Yes |
| `countdown.start` | `{}` | `READY` (host only) | Yes — already-counting → ignored |
| `charge.press_in` | `{ at: ts }` | `CHARGING` | No — server records the press epoch |
| `charge.press_out` | `{ at: ts }` | `CHARGING` | No |
| `reveal.ack` | `{ round_id }` | `REVEAL` | Yes |
| `rematch.request` | `{}` | `SETTLED` | Yes |
| `pong` | `{ id }` | any | Yes |

### 3.3 Server → client events

Direction: **server to all clients in room** unless marked otherwise. Servers MUST emit at least one event per state transition; clients render off the latest broadcast.

#### `room.created`
```json
{
  "room_id": "...",
  "code": "ABCD12",
  "host_id": "user_123",
  "max_players": 3,
  "expires_at": 1715520060000,         // 60s after issue
  "state": "SOLO" | "LOBBY_OPEN"
}
```

#### `room.joined`
```json
{
  "player": { "user_id": "...", "seat": 1, "display_name": "...", "avatar_url": "..." },
  "players": [ /* full snapshot of all seats, ordered */ ],
  "state": "LOBBY_OPEN" | "STAKING"
}
```

#### `room.left`
```json
{
  "player_id": "...",
  "reason": "voluntary" | "disconnect" | "kicked",
  "host_changed_to": null | "user_id",
  "players": [...],
  "state": "<resulting state>"
}
```

#### `room.host_changed`
```json
{
  "previous_host_id": "...",
  "new_host_id": "...",
  "players": [...]
}
```

#### `room.staked`
Emitted on every `stake.set`/`stake.lock`/`stake.unlock`.
```json
{
  "players": [
    { "user_id": "...", "seat": 0, "stake": 3, "locked": true },
    { "user_id": "...", "seat": 1, "stake": 1, "locked": false }
  ],
  "G_total": 4,
  "P": 2,
  "f_preview": 2,                       // computed live from current stakes
  "all_locked": false,
  "state": "STAKING"
}
```

#### `room.ready`
```json
{
  "players": [...],
  "G_total": 7,
  "P": 3,
  "f": 3,                               // final floor
  "auto_countdown_in_ms": 2000,         // host has this long to start; otherwise auto
  "state": "READY"
}
```

#### `room.countdown`
Emitted at countdown start and every tick (3, 2, 1).
```json
{
  "tick": 3 | 2 | 1,
  "started_at": 1715520010000,
  "duration_ms": 3000,
  "state": "COUNTDOWN"
}
```

#### `room.charging`
Emitted on charge phase entry, then on every charge state change (press_in / press_out / progress milestone every 100ms).
```json
{
  "players": [
    { "user_id": "...", "seat": 0, "progress": 0.62, "is_charging": true },
    { "user_id": "...", "seat": 1, "progress": 0.40, "is_charging": false }
  ],
  "started_at": 1715520013000,
  "duration_ms": 2500,
  "state": "CHARGING"
}
```

#### `room.spinning`
Marks the atomic debit + spin start. **No client may show a result speculatively** — only `M` arrives in `room.reveal`.
```json
{
  "round_id": "uuid",
  "spin_duration_ms": 1500,
  "debited": { "user_id": gems_amount, ... },
  "state": "SPINNING"
}
```

#### `room.reveal`
Single atomic frame containing the authoritative round outcome. Sequenced animation hints in `reveal_plan` per the locked "total → floor → excess" order.
```json
{
  "round_id": "uuid",
  "M": 4,
  "G_total": 7,
  "f": 3,
  "total_payout": 28,
  "shares": [
    { "user_id": "...", "seat": 0, "stake": 3, "floor": 9, "excess": 4, "share": 13 },
    { "user_id": "...", "seat": 1, "stake": 2, "floor": 6, "excess": 1, "share": 7 },
    { "user_id": "...", "seat": 2, "stake": 2, "floor": 6, "excess": 2, "share": 8 }
  ],
  "reveal_plan": {
    "phases": [
      { "phase": "total",  "duration_ms": 600,  "payload": { "total_payout": 28 } },
      { "phase": "floor",  "duration_ms": 800,  "payload": { /* per-seat floor values */ } },
      { "phase": "excess", "duration_ms": 1200, "payload": { /* per-seat target R_i values */ } }
    ]
  },
  "state": "REVEAL"
}
```

Invariant the server MUST satisfy before emitting:
```
Σ shares[i].share == G_total * M
shares[i].share   == shares[i].floor + shares[i].excess
shares[i].floor   == shares[i].stake * f
Σ shares[i].excess == G_total * (M - f)
shares[i].excess  >= 0
```

#### `room.settled`
```json
{
  "round_id": "uuid",
  "credited": { "user_id": coupoints_amount, ... },
  "balances_after": { "user_id": { "gems": 4, "couPoints": 142 }, ... },
  "state": "SETTLED"
}
```

#### `room.aborted`
```json
{
  "round_id": "uuid" | null,            // null if abort happened before SPINNING
  "reason": "disconnect" | "timeout" | "host_left" | "system_error",
  "refunded": { "user_id": gems_amount, ... } | {},
  "state": "DISPOSED" | "LOBBY_OPEN"    // DISPOSED if room is also torn down
}
```

#### `error`
```json
{ "code": "INVALID_STATE" | "FORBIDDEN" | "RATE_LIMIT" | "ROOM_FULL" | ..., "message": "...", "command": "<echo of offending type>" }
```

#### `ping` / `pong`
Server pings every 15s; client must `pong` within 5s or be marked disconnected (which triggers the drop-off matrix).

### 3.4 Ordering & idempotency rules

1. **Per-room monotonic seq.** Server stamps `seq` on every outbound frame. Clients drop frames where `seq <= last_processed_seq`.
2. **At-least-once with idempotency keys.** Commands with side effects (`stake.set`, `stake.lock`, `room.join`) are safe to retry — server reconciles via `(room_id, user_id, command_type, args_hash)`.
3. **No speculative state.** Clients render only what was confirmed by a server frame. The charge meter is allowed to interpolate locally between `room.charging` updates (max 100ms of dead-reckoning) but must snap to server values on receipt.
4. **Sync tolerance.** All players' visible state must converge within 200ms of the server transition. Server batches charge-progress broadcasts at ≥10 Hz to make this achievable.
5. **Single source of truth for time.** Server epoch in `started_at`/`expires_at` fields. Clients compute remaining time as `server_started_at + duration_ms − server_now_estimate`, where `server_now_estimate` is calibrated from the last received frame's `ts` minus an RTT/2 estimate.

### 3.5 Error codes

| Code | When |
|---|---|
| `INVALID_STATE` | Command not allowed in current state |
| `FORBIDDEN` | Non-host attempted host-only command |
| `ROOM_FULL` | join when `P == 3` |
| `ROOM_EXPIRED` | join after `expires_at` and `state == LOBBY_OPEN` |
| `ROOM_NOT_FOUND` | bad code/id |
| `STAKE_OUT_OF_RANGE` | `stake.set` with gems ∉ {1..5} |
| `INSUFFICIENT_GEMS` | stake exceeds player's gem balance at `STAKING → READY` reconciliation |
| `RATE_LIMIT` | per-player command flood (>20/s) |
| `SESSION_EXPIRED` | JWT expired on the WS connection |
| `INTERNAL` | server bug; client may retry once then surface failure |

---

## 4. Client state-machine sketch (for deliverable 4)

Pure mirror of server state. Client state = `{ phase: server_state, room: snapshot, me: user_id, last_seq }`. Reducer:

```
on('room.*', ev) → if ev.seq > last_seq: replace local snapshot with ev.body; advance phase
on user input → emit corresponding command; do NOT mutate phase locally
local-only animations (charge interpolation, countdown ticking, reveal phases) read from snapshot durations
```

Rendering by phase:
- `SOLO`/`LOBBY_OPEN`: room screen with QR + short code (60s expiry timer locally rendered from `expires_at`)
- `STAKING`: per-seat stake stepper + lock toggle + live `f_preview`
- `READY`: "press to start countdown" CTA (host) or "waiting for host" (others)
- `COUNTDOWN`: full-screen 3-2-1
- `CHARGING`: hold-to-charge button + peer charge meters (rendered from `players[].progress`)
- `SPINNING`: big wheel animation, no result text
- `REVEAL`: total banner → floor bars → small per-player spinners animating to `R_i`
- `SETTLED`: payout summary, rematch button

---

## 5. Open questions for review

These were not in the locked decisions and need confirmation before I move past deliverable 1:

1. **Seat assignment** — strict join order (0=host, 1=first joiner, 2=second), or randomized? (Default proposal: join order.)
2. **Host countdown grace** — locked spec says "manual rematch trigger" but says nothing about countdown trigger. Proposed: host taps "Start" in `READY`, OR server auto-starts after 2s if host idles. ✱ Need confirmation on the 2s auto-start.
3. **Re-entry grace** — locked spec says 30s grace. After REVEAL/SETTLED only? Or also during STAKING/READY? (Proposal: STAKING/READY drops fall under drop-off matrix immediately; grace applies only post-`REVEAL` so the disconnected player can see results.)
4. **Charge progress broadcast cadence** — 10Hz proposed (every 100ms). Acceptable, or should it be 20Hz for smoother peer meters?
5. **Anti-cheat on charge** — server is the timekeeper, but what if a client lies about `at` timestamps in `press_in`/`press_out`? Proposed: server overwrites with its own receive timestamp; `at` is hint-only.
6. **Persistence** — settled rounds written to a `spinner_round` table? (Required for ledger / dispute / analytics.)
7. **Authorization on `room.join`** — anyone scanning a valid code can join (matches `scan-scope: any-couppro`), or restricted to "friends only"? Currently proposing "any authenticated CouPro user with a valid code".
8. **Voucher denominations / merchant revenue** — listed in Math but not used in this flow. Confirm they're for the redemption side (separate flow), not this co-op flow.

---

## 6. Out of scope for this deliverable

- WS handler implementation (deliverable 3)
- Multinomial draw helper (deliverable 2)
- Client UI (deliverables 4–6)
- Tests (deliverable 7)
- Wallet ledger schema (will be defined as a sub-spec inside deliverable 3)
- Reconnect / replay protocol (will live in a deliverable 3 addendum)

---

## 7. Sign-off checklist

Before I start deliverable 2, please confirm:

- [ ] State graph (§2) accurately reflects intent
- [ ] Drop-off matrix (§2.4) matches the locked decisions
- [ ] Side-effect ordering (§2.3) — gem debit at `CHARGING → SPINNING` is correct
- [ ] Server event names + envelope (§3.1, §3.3) acceptable
- [ ] Reveal payload (§3.3 `room.reveal`) — single atomic frame with `reveal_plan` for sequenced animation, vs. multiple frames per phase
- [ ] Open questions (§5) resolved or deferred with explicit answers
