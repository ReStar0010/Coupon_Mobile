"""
Gunicorn + Gevent configuration for CouBox backend.

Worker model: gevent (cooperative multitasking via greenlets)
- Each worker handles up to `worker_connections` concurrent greenlets
- Greenlets yield to each other during I/O (DB queries, Resend API, Twilio)
- psycogreen patches psycopg2's wait callback so DB queries are non-blocking

Capacity on 1 CPU / 2 GB RAM (Render starter):
  2 workers × 1000 greenlets = up to 2 000 concurrent in-flight requests
  (vs previous gthread: 3 workers × 2 threads = 6 slots)

Actual start command on Render:
    python -m gunicorn Backend.wsgi:application
        --config gunicorn.conf.py
"""
import os

# ── Workers ──────────────────────────────────────────────────────────────────
# 2 gevent workers on a single-CPU container; set WEB_CONCURRENCY to override.
workers = int(os.environ.get("WEB_CONCURRENCY", 2))
worker_class = "gevent"
# Max greenlets per worker. Each greenlet is lightweight (~few KB).
worker_connections = int(os.environ.get("WORKER_CONNECTIONS", 1000))

# ── Timeouts ─────────────────────────────────────────────────────────────────
# 60 s covers analytics queries and external API calls (Resend, Twilio).
timeout = 60
graceful_timeout = 15
keepalive = 5

# ── Reliability ──────────────────────────────────────────────────────────────
# Recycle workers to prevent memory leaks; jitter avoids simultaneous restarts.
max_requests = 1000
max_requests_jitter = 100

# Use /dev/shm for heartbeat temp file to avoid disk I/O stalls on Render.
worker_tmp_dir = "/dev/shm"

# ── Logging ───────────────────────────────────────────────────────────────────
accesslog = "-"
errorlog = "-"
loglevel = "info"


# ── Gevent DB patching ────────────────────────────────────────────────────────
def post_fork(server, worker):
    """Patch psycopg2 after fork so DB waits yield to the gevent event loop."""
    try:
        from psycogreen.gevent import patch_psycopg
        patch_psycopg()
        server.log.info("psycogreen: psycopg2 patched for gevent worker %s", worker.pid)
    except ImportError:
        server.log.warning("psycogreen not installed — DB calls will block the event loop")
