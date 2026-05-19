"""
ASGI entry-point smoke test.

Exercises the lifespan protocol handled inline in `Backend/asgi.py`.
ASGI servers (uvicorn, daphne) send a `lifespan.startup` message at
boot and a `lifespan.shutdown` message at terminate; our entrypoint
must reply with the matching `complete` messages so uvicorn doesn't
crash on startup.

The other thing this proves is that `Backend.asgi:application` IS
importable — a regression there would mean every deploy boot-fails.
"""

from __future__ import annotations

import asyncio
import unittest


class AsgiLifespanTests(unittest.TestCase):
    def test_lifespan_startup_and_shutdown_complete(self):
        # Import inside the test so test discovery doesn't double-load
        # Django at import time.
        from Backend.asgi import application

        outbox: list[dict] = []
        inbox: list[dict] = [
            {'type': 'lifespan.startup'},
            {'type': 'lifespan.shutdown'},
        ]

        async def receive() -> dict:
            # The application loops on receive() — feed startup, then
            # shutdown, then a sentinel that we never expect to be
            # consumed because shutdown.complete should `return`.
            return inbox.pop(0) if inbox else {'type': 'lifespan.sentinel'}

        async def send(message: dict) -> None:
            outbox.append(message)

        # `asyncio.run` creates and tears down its own loop — this is
        # the canonical way to drive an ASGI coroutine from a sync
        # `unittest.TestCase`. The prior `get_event_loop_policy()` call
        # was a no-op carried over from an older asyncio convention.
        asyncio.run(application({'type': 'lifespan'}, receive, send))

        self.assertEqual(
            outbox,
            [
                {'type': 'lifespan.startup.complete'},
                {'type': 'lifespan.shutdown.complete'},
            ],
        )
        # The sentinel inbox entry must not have been consumed — proves
        # the application returned cleanly after shutdown.complete.
        self.assertEqual(inbox, [])
