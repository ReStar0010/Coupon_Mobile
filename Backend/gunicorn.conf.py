"""
Gunicorn configuration for CouPro backend (Render).

Actual start command on Render:
    python -m gunicorn Backend.wsgi:application -k gthread --workers 3 --threads 2
        --timeout 30 --graceful-timeout 15 --keep-alive 5
        --max-requests 500 --max-requests-jitter 50

This file documents and supplements the above. Values here are overridden by
explicit CLI flags, so the Render start command remains the source of truth.
"""
import os

# 3 workers × 2 threads = 6 concurrent request slots on 1 CPU / 2 GB.
workers = int(os.environ.get("WEB_CONCURRENCY", 3))
worker_class = "gthread"
threads = int(os.environ.get("THREADS", 2))

# 60 s gives DB-heavy views (redeem_coupon: ~10 sequential queries) enough
# headroom before gunicorn kills a worker under momentary DB slowness.
# The root fix is reducing DB round-trips in the view; this is the safety net.
timeout = 60
graceful_timeout = 15
keepalive = 5

# Recycle workers after N requests to prevent memory leaks.
# 500 + jitter avoids simultaneous restarts that would drop capacity to 4 slots.
max_requests = 500
max_requests_jitter = 50

# Use /dev/shm for heartbeat temp file to avoid disk I/O stalls.
worker_tmp_dir = "/dev/shm"

# Send all logs to stdout so Render captures them.
accesslog = "-"
errorlog = "-"
loglevel = "info"
