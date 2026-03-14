"""
Stage 2: Step-up ramp — 1 merchant, 200 → 1000 users (+100 every 30 s).
Idempotency and no oversell; latency/error curves for breakpoint identification.
Optional: high-spawn variant (e.g. up to 50 users/sec) for rapid-spawn consistency.
"""
USERS = 200
SPAWN_RATE = 10  # ramp can be implemented as step load in runner
RUN_TIME = "10m"
# Ramp: +100 users every 30s — configure via Locust step load or spawn schedule
