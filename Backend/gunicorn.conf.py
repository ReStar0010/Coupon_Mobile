"""
Gunicorn configuration for CouPro backend (Render, 0.5 CPU / 512 MB).

Start command:
    python -m gunicorn Backend.asgi:application -k uvicorn.workers.UvicornWorker

Two workers: if one crashes the other continues serving while gunicorn
restarts the failed worker, breaking the crash-and-no-recovery loop.
Each UvicornWorker runs its own asyncio event loop; Django's ASGI handler
dispatches synchronous views to a thread pool.
"""
import os

# 2 workers on 0.5 CPU / 512 MB: one crash does not take the service offline.
# Override via WEB_CONCURRENCY env var (Render sets this on paid plans).
workers = int(os.environ.get("WEB_CONCURRENCY", 2))

# UvicornWorker for ASGI (required by Backend.asgi:application).
worker_class = "uvicorn.workers.UvicornWorker"

# Recycle each worker after N requests to prevent memory leaks accumulating.
# Jitter spreads the restarts so both workers don't recycle simultaneously.
max_requests = 200
max_requests_jitter = 50

# Kill a worker that has not responded in 120 s.
# 30 s was too short under moderate load; slow DB queries under concurrent
# connections need more headroom before the worker is declared dead.
timeout = 120
graceful_timeout = 30

# Use /dev/shm for the worker heartbeat temp file.
# Avoids disk I/O stalls on Render's ephemeral filesystem under load.
worker_tmp_dir = "/dev/shm"

# Send all logs to stdout so Render captures them.
accesslog = "-"
errorlog = "-"
loglevel = "info"
