"""
Load test harness configuration.
Reads BASE_URL, OUTPUT_DIR, STAGE, DATABASE_URL (or DB_*) from environment.
See specs/010-locust-load-testing/contracts/load-test-config.md.
"""
import os
from pathlib import Path


def get(key: str, default: str | None = None) -> str | None:
    return os.environ.get(key, default)


def get_int(key: str, default: int | None = None) -> int | None:
    val = os.environ.get(key)
    if val is None:
        return default
    try:
        return int(val)
    except ValueError:
        return default


def base_url() -> str:
    """Backend API base URL (e.g. https://staging.example.com). No trailing slash."""
    url = get("BASE_URL", "http://localhost:8000")
    return url.rstrip("/")


def output_dir() -> str:
    """Directory for CSV, HTML, consistency summary. Created by runner if missing."""
    return get("OUTPUT_DIR", "./load-test-results") or "./load-test-results"


def stage() -> int:
    """Stage identifier 1|2|3|4."""
    s = get_int("STAGE", 1)
    if s not in (1, 2, 3, 4):
        return 1
    return s


def run_time() -> str:
    """Locust run time (e.g. 10m). Default per stage."""
    return get("RUN_TIME", "5m")


def spawn_rate() -> int:
    """Users per second for Locust. Default per stage."""
    return get_int("SPAWN_RATE", 10) or 10


def error_rate_stop() -> float:
    """Stop threshold for Stage 4 (e.g. 0.05)."""
    val = get("ERROR_RATE_STOP", "0.05")
    try:
        return float(val)
    except ValueError:
        return 0.05


def ensure_output_dir() -> Path:
    """Create OUTPUT_DIR if it does not exist; return Path."""
    d = Path(output_dir())
    d.mkdir(parents=True, exist_ok=True)
    return d
