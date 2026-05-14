"""
Channels WebSocket consumer for spinner co-op.

Single class:
    SpinnerCoopConsumer
        on connect: parse JWT from query, ensure wallet, join room (or hold pending)
        on receive: dispatch command type to the matching transitions function
                    apply transition, broadcast events to channel-layer group,
                    execute side effects via SideEffectExecutor + AsyncScheduler
        on disconnect: invoke handle_disconnect transition (drop-off matrix)

Notes:
  - The room state lives in the in-process RoomStore (deliverable 3a). Multi-
    worker deployments need a Redis-backed store; out of scope for 3b.
  - Transitions are sync, so we wrap them with sync_to_async and database calls
    in database_sync_to_async where needed.
  - Channel layer broadcasts use a group named "spinner_coop:<room_id>" so all
    connected players in a room receive every event.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Callable
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import User
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from . import transitions as T
from .events import Event, TransitionError, TransitionResult
from .executor import SideEffectExecutor
from .room import Room
from .scheduler import AsyncScheduler
from .states import (
    PROTOCOL_VERSION,
    CHARGING_DURATION_MS,
    ErrorCode,
    Phase,
)
from .store import RoomStore

log = logging.getLogger(__name__)


# Singletons for in-process operation. Multi-worker deployments swap RoomStore
# for a Redis-backed implementation behind the same interface.
# H-5 documented limitation.
_ROOM_STORE = RoomStore()

# C-4: one asyncio.Lock per active room. Serializes the read-transition-write
# cycle inside a single process so two consumers in the same room cannot stomp
# on each other's seq counter or state. (Multi-worker deployments need a
# distributed lock; out of scope here — see H-5.)
_ROOM_LOCKS: dict[str, asyncio.Lock] = {}


def _lock_for(room_id: str) -> asyncio.Lock:
    lock = _ROOM_LOCKS.get(room_id)
    if lock is None:
        lock = asyncio.Lock()
        _ROOM_LOCKS[room_id] = lock
    return lock


# M-5: cap rooms-per-user-per-minute to mitigate resource exhaustion.
_ROOM_CREATE_WINDOW_S = 60.0
_ROOM_CREATE_MAX = 5
_ROOM_CREATE_HISTORY: dict[int, list[float]] = {}


def _evict_room_create_history(user_id: int) -> None:
    """v3 M-5: trim entries past the rate-limit window and pop empty slots.
    Single source of truth for the eviction policy used by both _cmd_room_create
    and disconnect()."""
    history = _ROOM_CREATE_HISTORY.get(user_id)
    if history is None:
        return
    now_s = time.monotonic()
    history[:] = [t for t in history if now_s - t < _ROOM_CREATE_WINDOW_S]
    if not history:
        _ROOM_CREATE_HISTORY.pop(user_id, None)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _group_for(room_id: str) -> str:
    return f"spinner_coop_{room_id.replace('-', '_')}"


class SpinnerCoopConsumer(AsyncJsonWebsocketConsumer):
    """One instance per WebSocket connection."""

    # H-1: per-connection sliding-window rate limit (commands per second).
    _RATE_WINDOW_S = 1.0
    _RATE_MAX = 20

    # Set during connect()
    user_id: int | None = None
    display_name: str = ""
    room_id: str | None = None
    _scheduler: AsyncScheduler | None = None
    _cmd_times: list[float]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cmd_times = []

    # ── Lifecycle ─────────────────────────────────────────────────────────

    async def connect(self):
        # C-1: every connection MUST present a valid JWT in `?token=<...>`.
        # The token's `user_id` claim becomes the authenticated identity; the
        # display_name is read from the authenticated User row, not the client.
        # v4 M2: imports moved to module top.
        qs = self._parse_qs()
        token = qs.get("token")
        if not token:
            await self.close(code=4401)
            return

        try:
            validated = JWTAuthentication().get_validated_token(token)
            uid = int(validated["user_id"])
        except (InvalidToken, TokenError, KeyError, ValueError, TypeError):
            await self.close(code=4401)
            return

        try:
            user = await database_sync_to_async(User.objects.get)(pk=uid)
        except User.DoesNotExist:
            await self.close(code=4401)
            return

        self.user_id = uid
        # H-2: display_name comes from the authenticated user, not the client.
        # Cap at 40 chars to keep broadcasts bounded.
        raw_name = (user.get_full_name() or user.username or f"User{uid}")[:40]
        self.display_name = raw_name.replace("\n", " ").replace("\r", " ")

        self._scheduler = AsyncScheduler(
            callback=self._handle_timer, loop=asyncio.get_running_loop()
        )
        await self.accept()

    async def disconnect(self, code: int):
        # v2 H-4 / v3 M-5: drop our slot from the rate-limit history if it's
        # now empty. Same trim-and-evict pattern lives in _cmd_room_create.
        if self.user_id is not None:
            _evict_room_create_history(self.user_id)

        if self.room_id is None or self.user_id is None:
            return
        # C-4: take the lock around the disconnect transition + apply.
        async with _lock_for(self.room_id):
            room = _ROOM_STORE.get(self.room_id)
            if room is None:
                return
            try:
                result = T.handle_disconnect(
                    room, user_id=str(self.user_id), now_ms=_now_ms()
                )
            except TransitionError:
                return
            await self._apply(result)
            await self.channel_layer.group_discard(
                _group_for(self.room_id), self.channel_name
            )

    # ── Inbound dispatch ───────────────────────────────────────────────────

    async def receive_json(self, content: dict[str, Any], **kwargs):
        cmd_type = content.get("type")
        body = content.get("body", {})
        if not isinstance(cmd_type, str):
            await self._send_error(ErrorCode.INTERNAL, "missing type", cmd_type)
            return

        # H-1: rate limit. Pong is exempt — it's a keepalive driven by the server.
        if cmd_type != "pong":
            now = time.monotonic()
            self._cmd_times = [t for t in self._cmd_times if now - t < self._RATE_WINDOW_S]
            if len(self._cmd_times) >= self._RATE_MAX:
                await self._send_error(ErrorCode.RATE_LIMIT, "too many commands", cmd_type)
                return
            self._cmd_times.append(now)

        handler = self._COMMAND_HANDLERS.get(cmd_type)
        if handler is None:
            await self._send_error(ErrorCode.INVALID_STATE, f"unknown command {cmd_type!r}", cmd_type)
            return
        try:
            await handler(self, body)
        except TransitionError as exc:
            await self._send_error(exc.code, exc.message, cmd_type)

    # ── Command handlers (one per spec §3.2 command) ──────────────────────

    async def _cmd_room_create(self, body: dict):
        if self.room_id is not None:
            await self._send_error(ErrorCode.ALREADY_IN_ROOM, "already in a room", "room.create")
            return
        # v5 H5-3: real guard, not an assert. Asserts get stripped under
        # `python -O`; an unauthenticated handler call must fail safely in
        # every build.
        if self.user_id is None:
            await self._send_error(
                ErrorCode.SESSION_EXPIRED, "not authenticated", "room.create"
            )
            return
        # v3 M-5 / v4 M1: trim past-window entries via the shared helper, then
        # check the cap. setdefault() may have just been popped to None if the
        # eviction emptied the list, so re-init.
        _evict_room_create_history(self.user_id)
        history = _ROOM_CREATE_HISTORY.setdefault(self.user_id, [])
        if len(history) >= _ROOM_CREATE_MAX:
            await self._send_error(
                ErrorCode.RATE_LIMIT, "too many rooms created recently", "room.create"
            )
            return
        history.append(time.monotonic())

        solo = bool(body.get("solo", False))
        result = T.create_room(
            host_id=str(self.user_id),
            host_display_name=self.display_name,
            solo=solo,
            now_ms=_now_ms(),
        )
        new_room: Room = result.room
        self.room_id = new_room.room_id
        await self.channel_layer.group_add(
            _group_for(new_room.room_id), self.channel_name
        )
        await self._apply(result)

    async def _cmd_room_join(self, body: dict):
        if self.room_id is not None:
            await self._send_error(ErrorCode.ALREADY_IN_ROOM, "already in a room", "room.join")
            return
        # v5 C5-1: type-validate up front. Without this, a client sending
        # {"room_id": [...]} would crash dict.get with TypeError, which escapes
        # the TransitionError-only catch in receive_json and drops the socket.
        raw_room_id = body.get("room_id")
        raw_code = body.get("code")
        room_id: str | None = raw_room_id if isinstance(raw_room_id, str) and raw_room_id else None
        code: str | None = raw_code if isinstance(raw_code, str) and raw_code else None
        if room_id is None and code is None:
            await self._send_error(
                ErrorCode.ROOM_NOT_FOUND, "room_id or code required", "room.join"
            )
            return
        room = _ROOM_STORE.get(room_id) if room_id else _ROOM_STORE.get_by_code(code)
        if room is None:
            await self._send_error(ErrorCode.ROOM_NOT_FOUND, "no such room", "room.join")
            return
        # C-4: take the lock before applying the transition (concurrent joins on
        # the same room).
        target_room_id = room.room_id
        async with _lock_for(target_room_id):
            room = _ROOM_STORE.get(target_room_id)  # re-fetch under lock (compare-and-swap)
            if room is None:
                await self._send_error(ErrorCode.ROOM_NOT_FOUND, "no such room", "room.join")
                return
            result = T.join_room(
                room,
                user_id=str(self.user_id),
                display_name=self.display_name,
                now_ms=_now_ms(),
            )
            self.room_id = target_room_id
            await self.channel_layer.group_add(
                _group_for(target_room_id), self.channel_name
            )
            await self._apply(result)

    async def _cmd_room_leave(self, body: dict):
        await self._run_locked(
            "room.leave",
            lambda room: T.leave_room(room, user_id=str(self.user_id), now_ms=_now_ms()),
        )

    async def _cmd_stake_set(self, body: dict):
        gems = body.get("gems")
        # v5 H5-2: bool is a subclass of int — reject explicitly so True/False
        # don't smuggle through as 1/0.
        if type(gems) is not int:  # noqa: E721 — exact type, not subclass
            await self._send_error(ErrorCode.STAKE_OUT_OF_RANGE, "gems must be int", "stake.set")
            return
        await self._run_locked(
            "stake.set",
            lambda room: T.set_stake(room, user_id=str(self.user_id), gems=gems, now_ms=_now_ms()),
        )

    async def _cmd_stake_lock(self, body: dict):
        await self._run_locked(
            "stake.lock",
            lambda room: T.lock_stake(room, user_id=str(self.user_id), now_ms=_now_ms()),
        )

    async def _cmd_stake_unlock(self, body: dict):
        await self._run_locked(
            "stake.unlock",
            lambda room: T.unlock_stake(room, user_id=str(self.user_id), now_ms=_now_ms()),
        )

    async def _cmd_countdown_start(self, body: dict):
        await self._run_locked(
            "countdown.start",
            lambda room: T.start_countdown(room, user_id=str(self.user_id), now_ms=_now_ms()),
        )

    async def _cmd_charge_press_in(self, body: dict):
        result = await self._run_locked(
            "charge.press_in",
            lambda room: T.press_in(room, user_id=str(self.user_id), now_ms=_now_ms()),
        )
        # Schedule periodic charge ticks every 100ms while CHARGING
        if (
            result is not None
            and result.room.phase == Phase.CHARGING
            and self._scheduler is not None
            and self.room_id is not None
        ):
            self._scheduler.schedule(self.room_id, "charge_tick", _now_ms() + 100)

    async def _cmd_charge_press_out(self, body: dict):
        await self._run_locked(
            "charge.press_out",
            lambda room: T.press_out(room, user_id=str(self.user_id), now_ms=_now_ms()),
        )

    async def _cmd_reveal_ack(self, body: dict):
        round_id = body.get("round_id")
        if not isinstance(round_id, str):
            await self._send_error(ErrorCode.INVALID_STATE, "missing round_id", "reveal.ack")
            return
        await self._run_locked(
            "reveal.ack",
            lambda room: T.ack_reveal(
                room, user_id=str(self.user_id), round_id=round_id, now_ms=_now_ms()
            ),
        )

    async def _cmd_rematch_request(self, body: dict):
        await self._run_locked(
            "rematch.request",
            lambda room: T.request_rematch(room, user_id=str(self.user_id), now_ms=_now_ms()),
        )

    async def _cmd_pong(self, body: dict):
        # Keepalive — no state change
        return

    _COMMAND_HANDLERS: dict[str, Any] = {
        "room.create": _cmd_room_create,
        "room.join": _cmd_room_join,
        "room.leave": _cmd_room_leave,
        "stake.set": _cmd_stake_set,
        "stake.lock": _cmd_stake_lock,
        "stake.unlock": _cmd_stake_unlock,
        "countdown.start": _cmd_countdown_start,
        "charge.press_in": _cmd_charge_press_in,
        "charge.press_out": _cmd_charge_press_out,
        "reveal.ack": _cmd_reveal_ack,
        "rematch.request": _cmd_rematch_request,
        "pong": _cmd_pong,
    }

    # ── C-4: locked transition helper ─────────────────────────────────────

    async def _run_locked(
        self,
        cmd_name: str,
        transition: Callable[[Room], TransitionResult],
    ) -> TransitionResult | None:
        """Acquire the room's lock, re-fetch the room snapshot under the lock,
        run the transition, and apply the result. Returns the TransitionResult
        on success, None on error (an error frame has already been sent).
        """
        if self.room_id is None:
            return None
        async with _lock_for(self.room_id):
            room = _ROOM_STORE.get(self.room_id)
            if room is None:
                self.room_id = None
                return None
            try:
                result = transition(room)
            except TransitionError as exc:
                await self._send_error(exc.code, exc.message, cmd_name)
                return None
            await self._apply(result)
            return result

    # ── Timer callback (called by AsyncScheduler) ──────────────────────────

    async def _handle_timer(self, room_id: str, kind: str, fire_at_ms: int):
        # C-4: timers also serialize through the per-room lock.
        async with _lock_for(room_id):
            await self._run_timer_locked(room_id, kind, fire_at_ms)

    async def _run_timer_locked(self, room_id: str, kind: str, fire_at_ms: int):
        room = _ROOM_STORE.get(room_id)
        if room is None:
            return
        now = _now_ms()
        if kind == "auto_countdown":
            result = T.auto_start_countdown(room, now_ms=now)
        elif kind == "countdown_complete":
            result = T.complete_countdown(room, now_ms=now)
        elif kind == "charge_tick":
            result = T.tick_charge_progress(room, now_ms=now)
            # Re-schedule another tick if still charging
            if (
                result.room.phase == Phase.CHARGING
                and self._scheduler is not None
            ):
                # Cap re-schedule at the charging duration so we don't loop forever
                started = result.room.charging_started_at_ms or now
                if now - started < CHARGING_DURATION_MS + 200:
                    self._scheduler.schedule(room_id, "charge_tick", now + 100)
        elif kind == "spin_complete":
            result = T.complete_spinning(room, now_ms=now)
        elif kind == "reveal_timeout":
            result = T.reveal_timeout(room, now_ms=now)
        else:
            # M-2: surface unknown kinds so future typos are debuggable.
            log.warning("spinner_coop: unknown timer kind %r (room=%s)", kind, room_id)
            return
        await self._apply(result)

    # ── Apply: persist + broadcast + execute side effects ─────────────────

    async def _apply(self, result: TransitionResult) -> None:
        """Common path after every transition.

        C-2 fix — side effects run FIRST inside a try/except. Only if they
        succeed do we persist the new room snapshot and broadcast its events.
        On failure we emit `room.aborted` with reason='system_error'. This
        prevents clients from seeing a `room.spinning` they animate while the
        wallet debit silently failed on the server.

        M-1 fix — exceptions from side effects no longer escape silently.

        Note: this method MUST be called with the room's lock held by callers
        that read-then-write `self.room_id`-keyed state. See _run_locked.
        """
        new_room: Room = result.room

        # 1) Run side effects first. Wallet + ledger inside a single atomic;
        #    scheduler effects only run if the atomic commits.
        if result.side_effects:
            try:
                await database_sync_to_async(self._exec_effects, thread_sensitive=True)(
                    tuple(result.side_effects)
                )
            except Exception as exc:  # noqa: BLE001 — broad on purpose; log + abort below.
                log.exception(
                    "spinner_coop: side effects failed (room=%s) — emitting abort",
                    new_room.room_id,
                )
                await self._emit_system_abort(new_room.room_id, error=exc)
                return

        # 2) Persist (or remove on disposal) only after side effects succeeded.
        # v5 M5-2: enum-typed comparison instead of string-matching .value.
        if new_room.phase is Phase.DISPOSED:
            _ROOM_STORE.remove(new_room.room_id)
            _ROOM_LOCKS.pop(new_room.room_id, None)
        else:
            _ROOM_STORE.put(new_room)

        # 3) Broadcast every event last so clients see only confirmed state.
        for ev in result.events:
            await self._broadcast(new_room.room_id, ev)

    def _exec_effects(self, effects):
        executor = SideEffectExecutor(scheduler=self._scheduler)
        executor.execute_all(effects)

    async def _emit_system_abort(self, room_id: str, *, error: Exception) -> None:
        """M-1: emit a synthetic room.aborted to all subscribers when the
        side-effect dispatch fails after we'd committed to a state change.

        v2 C-2: assign a real (room.seq + 1) so clients dedup correctly.
        The client's CoopClient ALSO routes 'room.aborted' past the dedup gate
        as defense in depth, but giving the synthetic abort a normal seq means
        well-behaved clients see it in expected order.

        v5 H5-1: never put exception class names on the wire — that's
        infrastructure information disclosure. Log server-side instead so ops
        still get the diagnostic.
        """
        log.error(
            "spinner_coop: system abort (room=%s) caused by %s",
            room_id, error.__class__.__name__,
        )
        room = _ROOM_STORE.get(room_id)
        next_seq = (room.seq + 1) if room is not None else 1
        envelope = {
            "v": PROTOCOL_VERSION,
            "type": "room.aborted",
            "ts": _now_ms(),
            "seq": next_seq,
            "room_id": room_id,
            "body": {
                "round_id": None,
                "reason": "system_error",
                "refunded": {},
                "state": "DISPOSED",
            },
        }
        await self.channel_layer.group_send(
            _group_for(room_id),
            {"type": "spinner.event", "envelope": envelope},
        )
        _ROOM_STORE.remove(room_id)
        # v4 H2: pop the lock dict entry. The currently-held lock object stays
        # alive on the stack of the holder (caller in `_run_locked`) until that
        # frame unwinds, so the unlock still happens correctly. Removing the
        # dict entry frees the slot — without this we leak one asyncio.Lock per
        # side-effect failure (same shape as v3 H-4 leaks).
        _ROOM_LOCKS.pop(room_id, None)

    async def _broadcast(self, room_id: str, event: Event) -> None:
        envelope = event.to_envelope(room_id=room_id, ts_ms=_now_ms(), version=PROTOCOL_VERSION)
        await self.channel_layer.group_send(
            _group_for(room_id),
            {"type": "spinner.event", "envelope": envelope},
        )

    async def spinner_event(self, message: dict) -> None:
        """Channel-layer fan-out hook. Every group member's consumer receives
        this and forwards a per-recipient stamped envelope to its own WS.

        v3 H-1: stamps `you_are` so the client knows the authenticated identity
        for this connection. Joiners can't infer "self" from host_id; this lets
        the UI highlight the right row regardless of seat / host status.
        """
        envelope = dict(message["envelope"])  # shallow copy — don't mutate the broadcast payload
        if self.user_id is not None:
            envelope["you_are"] = str(self.user_id)
        await self.send_json(envelope)

    # ── Helpers ────────────────────────────────────────────────────────────

    def _require_room(self) -> Room | None:
        if self.room_id is None:
            return None
        room = _ROOM_STORE.get(self.room_id)
        if room is None:
            self.room_id = None
        return room

    def _parse_qs(self) -> dict[str, str]:
        # M-3: tolerate malformed bytes instead of crashing the handshake.
        # v5 M5-1: parse_qs imported at module top.
        raw = self.scope.get("query_string", b"").decode("utf-8", errors="replace")
        flat = {k: v[0] for k, v in parse_qs(raw).items() if v}
        return flat

    async def _send_error(self, code: ErrorCode, message: str, command: str | None) -> None:
        await self.send_json(
            {
                "v": PROTOCOL_VERSION,
                "type": "error",
                "ts": _now_ms(),
                "body": {"code": code.value, "message": message, "command": command},
            }
        )


# ── Test helpers ──────────────────────────────────────────────────────────

def reset_store_for_tests() -> None:
    """Used by the integration test fixture to start each test with an empty store."""
    _ROOM_STORE.clear()


def get_store_for_tests() -> RoomStore:
    return _ROOM_STORE
