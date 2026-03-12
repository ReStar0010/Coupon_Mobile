"""
Gunicorn configuration for CouPro backend (Render, ASGI + UvicornWorker).

Start command: python -m gunicorn Backend.asgi:application -k uvicorn.workers.UvicornWorker

Each UvicornWorker runs its own asyncio event loop. Django's ASGI handler
dispatches synchronous views to a thread pool (default: min(32, cpu+4) threads
per worker), so multiple sync requests can run concurrently per worker.

Increasing worker count is the primary lever for throughput on Render.
"""
import multiprocessing

# Number of uvicorn worker processes.
# Formula: 2 * CPU + 1; floor at 2 so low-CPU Render tiers get at least 2.
workers = max(2, multiprocessing.cpu_count() * 2 + 1)

# Kill a worker that hasn't responded in 30s (prevents zombie workers on slow DB queries).
timeout = 30

# Keep idle connections alive for 5s to reduce TCP handshake overhead.
keepalive = 5

# Log to stdout so Render captures it.
accesslog = "-"
errorlog = "-"
loglevel = "info"
