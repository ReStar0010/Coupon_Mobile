"""
Load test harness configuration.
Reads BASE_URL, OUTPUT_DIR, STAGE, DATABASE_URL (or DB_*) from environment.
See specs/010-locust-load-testing/contracts/load-test-config.md.
"""
import json
import os
from pathlib import Path

# Default task weights for Stage 3/4 full flow (used when task_weights.json missing or key missing)
DEFAULT_TASK_WEIGHTS = {
    "browse_store_coupons": 10,
    "redeem_store_coupon": 2,
    "claim_public_pool": 1,
    "browse_exclusive_coupons": 5,
    "coupon_detail": 3,
    "share_private": 1,
    "accept_private_share": 1,
    "share_public": 1,
    "my_public_shares": 1,
    "daily_draw_templates": 2,
    "daily_draw": 1,
    "draw_history": 1,
    "redeem_shared_exclusive_idempotency": 0,
}


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


def _config_dir() -> Path:
    """Directory containing task_weights.json (load_tests/config)."""
    return Path(__file__).resolve().parent


def load_task_weights() -> dict[str, int]:
    """
    Load task weights from task_weights.json; merge with DEFAULT_TASK_WEIGHTS.
    Env TASK_WEIGHT_<KEY> (uppercase, key with underscores) overrides, e.g. TASK_WEIGHT_REDEEM_STORE=3.
    """
    config_path = _config_dir() / "task_weights.json"
    weights = dict(DEFAULT_TASK_WEIGHTS)
    if config_path.exists():
        try:
            with open(config_path, encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                for k, v in loaded.items():
                    if isinstance(v, (int, float)):
                        weights[k] = int(v)
        except (json.JSONDecodeError, OSError):
            pass
    # Env override: TASK_WEIGHT_BROWSE_STORE_COUPONS=10 etc.
    for key in list(weights.keys()):
        env_key = "TASK_WEIGHT_" + key.upper()
        val = os.environ.get(env_key)
        if val is not None:
            try:
                weights[key] = int(val)
            except ValueError:
                pass
    return weights
