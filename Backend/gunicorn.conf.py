"""
Gunicorn + UvicornWorker configuration for CouPro backend.

Why ASGI:
    The spinner co-op lobby (`api/spinner_coop/consumer.py`) is a WebSocket
    consumer wired through `Backend/asgi.py`. WSGI workers (gevent, sync,
    gthread) cannot serve the WebSocket upgrade — connections to
    /ws/spinner/v1/ get HTTP 400/426 against a WSGI server. Switching the
    worker class to `uvicorn.workers.UvicornWorker` and pointing at the
    ASGI entry serves HTTP and WebSocket from the same process.

Worker model: uvicorn.workers.UvicornWorker
    - Each worker runs its own uvicorn event loop.
    - Async I/O (WebSocket frames, asyncio sleeps) runs concurrently
      within a single worker.
    - Sync Django views are dispatched through `asgiref.sync.sync_to_async`
      to a per-event-loop thread pool. Default pool size is
      `min(32, os.cpu_count() + 4)` — about 5 threads on a 1-CPU Render
      container. So `workers × pool_size ≈ 10` concurrent in-flight sync
      requests with WEB_CONCURRENCY=2 — not the 2000 the gevent setup
      advertised, but also not 2. Pure async paths (WebSocket frames,
      async-native views) get true asyncio concurrency on top.
    - For I/O-heavy or WebSocket-heavy workloads, bump WEB_CONCURRENCY
      after measuring with a load test. The cold default of 2 is a
      conservative starting point that matches the old gevent worker
      count.

Capacity on 1 CPU / 2 GB RAM (Render starter):
    Default 1 worker (see CRITICAL note below). When the spinner
    RoomStore is moved to Redis, bump WEB_CONCURRENCY after a load test.

Start command on Render:
    python -m gunicorn Backend.asgi:application --config gunicorn.conf.py
"""

import os

# ── Workers ──────────────────────────────────────────────────────────────────
#
# CRITICAL: default is 1, NOT cores+1.
#
# `api/spinner_coop/consumer.py` stores room state in a module-level
# `_ROOM_STORE` dict — that's per-process. With 2+ workers, two players
# in the "same" room are routed to different OS processes and see
# divergent state. The channel layer broadcasts events between workers
# via Redis, but the state machine and wallet debits run on whichever
# worker happens to receive the user's command — opening a window for
# double-debit / missed-debit on concurrent moves.
#
# Until the RoomStore moves to Redis (tracked separately as H-5),
# WEB_CONCURRENCY must stay at 1 in production. The env-var override
# is intentionally still here so a developer who has migrated the
# RoomStore can bump it, but the default fails closed.
workers = int(os.environ.get("WEB_CONCURRENCY", 1))
worker_class = "uvicorn.workers.UvicornWorker"

# ── Timeouts ─────────────────────────────────────────────────────────────────
# 60s covers analytics queries and external API calls (Resend, Twilio).
# Keep keepalive low — uvicorn workers don't benefit from long-lived idle
# HTTP keepalives the way gevent did, and short keepalives drain workers
# faster during graceful restarts.
timeout = 60
graceful_timeout = 15
keepalive = 5

# ── Reliability ──────────────────────────────────────────────────────────────
# Recycle workers to bound memory leaks; jitter avoids simultaneous restarts.
max_requests = 1000
max_requests_jitter = 100

# Use /dev/shm for heartbeat temp file to avoid disk I/O stalls on Render.
worker_tmp_dir = "/dev/shm"

# ── Logging ───────────────────────────────────────────────────────────────────
accesslog = "-"
errorlog = "-"
loglevel = "info"

# NB: no `post_fork` hook. The previous gevent setup patched psycopg2 via
# `psycogreen.gevent.patch_psycopg`, which is incompatible with asyncio.
# Django's ORM under ASGI uses `sync_to_async` to run sync DB calls on a
# thread; no monkey-patch needed.
