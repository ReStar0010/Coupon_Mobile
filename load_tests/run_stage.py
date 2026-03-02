#!/usr/bin/env python3
"""
Run a single load test stage: reset -> Locust -> consistency check.
Reads BASE_URL, OUTPUT_DIR, STAGE from env (see load_tests/config/settings.py).
"""
import os
import subprocess
import sys
from pathlib import Path

# Repo root (parent of load_tests)
REPO_ROOT = Path(__file__).resolve().parent.parent
LOAD_TESTS_DIR = REPO_ROOT / "load_tests"
BACKEND_DIR = REPO_ROOT / "Backend"
BACKEND_MANAGE = BACKEND_DIR / "manage.py"


def run(cmd: list[str], env: dict | None = None, cwd: Path | None = None) -> int:
    env = env or {}
    cwd = cwd or REPO_ROOT
    result = subprocess.run(cmd, env={**os.environ, **env}, cwd=cwd)
    return result.returncode


def main() -> int:
    # Ensure we can import config (run from repo root)
    sys.path.insert(0, str(REPO_ROOT))
    from load_tests.config.settings import (
        base_url,
        output_dir,
        stage,
        ensure_output_dir,
        run_time,
        spawn_rate,
    )

    st = stage()
    ensure_output_dir()
    out = output_dir()

    # Stage params (from stages/stageN_*.py or env/defaults)
    stage_modules = {
        1: "stage1_baseline",
        2: "stage2_ramp",
        3: "stage3_multitenant",
        4: "stage4_breaking",
    }
    try:
        name = stage_modules.get(st, "stage1_baseline")
        mod = __import__(f"load_tests.stages.{name}", fromlist=["USERS", "SPAWN_RATE", "RUN_TIME"])
        users = getattr(mod, "USERS", 200)
        spawn = getattr(mod, "SPAWN_RATE", 10)
        run_t = getattr(mod, "RUN_TIME", "5m")
    except Exception:
        users = {1: 200, 2: 1000, 3: 1500, 4: 5000}.get(st, 200)
        spawn = spawn_rate()
        run_t = run_time()

    # 1. Reset (clear redemptions + re-run seed)
    print("Step 1: Reset (clear redemptions + seed)...")
    os.environ["STAGE"] = str(st)
    rc = run(
        [sys.executable, "manage.py", "reset_load_test"],
        cwd=BACKEND_DIR,
    )
    if rc != 0:
        print("Reset failed.", file=sys.stderr)
        return rc

    # 2. Locust (stage params from above)
    print("Step 2: Run Locust...")
    csv_prefix = str(Path(out) / f"stage{st}")
    locust_cmd = [
        sys.executable,
        "-m",
        "locust",
        "-f",
        str(LOAD_TESTS_DIR / "locustfile.py"),
        "--headless",
        "-u",
        str(users),
        "-r",
        str(spawn),
        "-t",
        run_t,
        "--csv",
        csv_prefix,
        "--html",
        f"{csv_prefix}_report.html",
    ]
    rc = run(locust_cmd)
    if rc != 0:
        print("Locust run had failures (check artifacts).", file=sys.stderr)
        # Still run consistency check

    # 3. Consistency check
    print("Step 3: Consistency check...")
    rc2 = run(
        [
            sys.executable,
            "manage.py",
            "verify_load_test_consistency",
            "--output-dir",
            out,
        ],
        cwd=BACKEND_DIR,
    )
    if rc2 != 0:
        return rc2
    return rc


if __name__ == "__main__":
    sys.exit(main())
