"""
In-process asyncio scheduler.

Fires phase-transition tick callbacks at scheduled wall-clock times. Used by
the WS consumer to drive auto-transitions:
  - room.ready → countdown auto-start (after 2s if host idles)
  - countdown → charging (after 3s)
  - charging → spinning (10Hz tick + auto when all charged; 2.5s timeout)
  - spinning → reveal (after 1.5s spin animation)
  - reveal → settled (after 8s if any client never acks)

Single-process only. Multi-worker deployments need a Redis-backed scheduler
(out of scope for 3b; documented in the deliverable spec for follow-up).
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Awaitable, Callable

log = logging.getLogger(__name__)


# Callback receives (room_id, kind, fire_at_ms).
TimerCallback = Callable[[str, str, int], Awaitable[None]]


class AsyncScheduler:
    """Per-process timer registry keyed by (room_id, kind).

    Captures the event loop at construction time so .schedule() can be safely
    called from a worker thread (e.g. via database_sync_to_async) and still
    create the task on the main event loop via call_soon_threadsafe.
    """

    def __init__(self, callback: TimerCallback, loop: asyncio.AbstractEventLoop | None = None):
        self._callback = callback
        self._tasks: dict[tuple[str, str], asyncio.Task] = {}
        try:
            self._loop = loop or asyncio.get_running_loop()
        except RuntimeError:
            # No running loop (e.g. instantiated in a sync context). Fall back
            # to creating tasks lazily inside schedule().
            self._loop = None

    # ── SchedulerProtocol surface ──────────────────────────────────────────

    def schedule(self, room_id: str, kind: str, fire_at_ms: int) -> None:
        """Cancel any prior timer of the same kind in the room, schedule a new one.

        Safe to call from any thread.
        """
        self.cancel(room_id, kind)
        delay_ms = max(0, fire_at_ms - int(time.time() * 1000))
        loop = self._loop
        if loop is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError as exc:
                log.warning(
                    "scheduler.schedule called outside an event loop "
                    "(room=%s kind=%s): %s",
                    room_id, kind, exc,
                )
                return

        def _create_task():
            task = loop.create_task(
                self._fire(room_id, kind, fire_at_ms, delay_ms / 1000)
            )
            self._tasks[(room_id, kind)] = task

        # v4 L1: replace private asyncio._get_running_loop() with the public
        # API. get_running_loop() raises RuntimeError if no loop is running on
        # this thread; we catch that and fall through to the threadsafe path.
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None
        if loop.is_running() and current_loop is loop:
            _create_task()
        else:
            loop.call_soon_threadsafe(_create_task)

    def cancel(self, room_id: str, kind: str) -> None:
        task = self._tasks.pop((room_id, kind), None)
        if task is not None and not task.done():
            task.cancel()

    def dispose(self, room_id: str) -> None:
        """Cancel every timer for a room."""
        keys = [k for k in self._tasks.keys() if k[0] == room_id]
        for k in keys:
            t = self._tasks.pop(k, None)
            if t is not None and not t.done():
                t.cancel()

    # ── internal ───────────────────────────────────────────────────────────

    async def _fire(
        self, room_id: str, kind: str, fire_at_ms: int, delay_s: float
    ) -> None:
        try:
            await asyncio.sleep(delay_s)
        except asyncio.CancelledError:
            return
        # Drop the entry from the registry before invoking, so the callback can
        # safely re-schedule the same kind.
        self._tasks.pop((room_id, kind), None)
        try:
            await self._callback(room_id, kind, fire_at_ms)
        except Exception:  # pragma: no cover (logged at consumer)
            log.exception("scheduler callback failed (room=%s kind=%s)", room_id, kind)

    # ── test helpers ───────────────────────────────────────────────────────

    def pending(self) -> tuple[tuple[str, str], ...]:
        return tuple(self._tasks.keys())

    def has(self, room_id: str, kind: str) -> bool:
        return (room_id, kind) in self._tasks
