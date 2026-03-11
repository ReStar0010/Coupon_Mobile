#!/usr/bin/env python3
"""
Run a single load test stage: reset -> Locust -> consistency check.
Reads BASE_URL, OUTPUT_DIR, STAGE from env (see load_tests/config/settings.py).
When BASE_URL is remote (or LOAD_TEST_REMOTE=1), uses reset and verify-consistency APIs.
Remote reset only clears redemptions and returns {ok: true}; client uses shared repo config
(load_tests/config/) and does not send or write config. When local, uses manage.py
reset_load_test and verify_load_test_consistency.
"""
import os
import subprocess
import sys
from pathlib import Path

# Repo root (parent of load_tests)
REPO_ROOT = Path(__file__).resolve().parent.parent
LOAD_TESTS_DIR = REPO_ROOT / "load_tests"
CONFIG_DIR = LOAD_TESTS_DIR / "config"
BACKEND_DIR = REPO_ROOT / "Backend"


def run(cmd: list[str], env: dict | None = None, cwd: Path | None = None) -> int:
    env = env or {}
    cwd = cwd or REPO_ROOT
    result = subprocess.run(cmd, env={**os.environ, **env}, cwd=cwd)
    return result.returncode


def is_remote_run(base_url_str: str) -> bool:
    """True if LOAD_TEST_REMOTE=1 or BASE_URL is not localhost."""
    if os.environ.get("LOAD_TEST_REMOTE") == "1":
        return True
    url = (base_url_str or "").lower()
    if url.startswith("http://127.0.0.1") or url.startswith("https://127.0.0.1"):
        return False
    if "localhost" in url:
        return False
    return True


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
        error_rate_stop,
    )

    st = stage()
    ensure_output_dir()
    out = output_dir()
    url = base_url()

    # Stage params (from stages/stageN_*.py or env/defaults)
    stage_modules = {
        1: "stage1_baseline",
        2: "stage2_ramp",
        3: "stage3_multitenant",
        4: "stage4_breaking",
    }
    try:
        name = stage_modules.get(st, "stage1_baseline")
        mod = __import__(
            f"load_tests.stages.{name}",
            fromlist=["USERS", "SPAWN_RATE", "RUN_TIME"],
        )
        users = getattr(mod, "USERS", 200)
        spawn = getattr(mod, "SPAWN_RATE", 10)
        run_t = getattr(mod, "RUN_TIME", "5m")
    except Exception:
        users = {1: 200, 2: 1000, 3: 1500, 4: 5000}.get(st, 200)
        spawn = spawn_rate()
        run_t = run_time()

    if is_remote_run(url):
        # Remote: reset (clear redemptions only) and verify via HTTP; skip reset if RUN_LOCUST_ONLY=1
        import requests
        run_locust_only = os.environ.get("RUN_LOCUST_ONLY") == "1"
        secret = os.environ.get("LOAD_TEST_SECRET")
        if not secret:
            print("LOAD_TEST_SECRET is required for remote load test.", file=sys.stderr)
            return 1
        headers = {"X-Load-Test-Secret": secret, "Content-Type": "application/json"}

        if not run_locust_only:
            reset_timeout = int(os.environ.get("LOAD_TEST_RESET_TIMEOUT", "60"))
            print("Step 1: Reset (POST /api/load-test/reset/)...")
            try:
                r = requests.post(
                    f"{url}/api/load-test/reset/",
                    json={"stage": st},
                    headers=headers,
                    timeout=reset_timeout,
                )
            except requests.RequestException as e:
                print(f"Reset request failed: {e}", file=sys.stderr)
                return 1
            if r.status_code != 200:
                print(f"Reset failed: {r.status_code} {r.text}", file=sys.stderr)
                return 1
            data = r.json() if r.content else {}
            if not data.get("ok"):
                print(f"Reset returned not ok: {data}", file=sys.stderr)
                return 1
            print("Reset ok; using repo config for Locust.")
        else:
            print("RUN_LOCUST_ONLY=1: skipping reset, using repo config.")

        # Step 2: Run Locust
        print("Step 2: Run Locust...")
        csv_prefix = str(Path(out) / f"stage{st}")
        locust_env = {**os.environ, "STAGE": str(st)}
        if st == 4:
            locust_env["ERROR_RATE_STOP"] = str(error_rate_stop())
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
        rc = run(locust_cmd, env=locust_env)
        if rc != 0:
            print("Locust run had failures (check artifacts).", file=sys.stderr)

        # Step 4: Verify consistency via API
        print("Step 3: Consistency check (GET /api/load-test/verify-consistency/)...")
        try:
            r2 = requests.get(
                f"{url}/api/load-test/verify-consistency/",
                headers=headers,
                timeout=60,
            )
        except requests.RequestException as e:
            print(f"Verify request failed: {e}", file=sys.stderr)
            return 1
        if r2.status_code != 200:
            print(f"Verify failed: {r2.status_code} {r2.text}", file=sys.stderr)
            return 1
        result = r2.json()
        if not result.get("passed"):
            for e in result.get("errors", []):
                print(e, file=sys.stderr)
            print("Consistency check FAILED.", file=sys.stderr)
            return 1
        print("Consistency check passed.")
        return rc
    else:
        # Local: management commands
        print("Step 1: Reset (clear redemptions + seed)...")
        os.environ["STAGE"] = str(st)
        rc = run(
            [sys.executable, "manage.py", "reset_load_test"],
            cwd=BACKEND_DIR,
        )
        if rc != 0:
            print("Reset failed.", file=sys.stderr)
            return rc

        print("Step 2: Run Locust...")
        csv_prefix = str(Path(out) / f"stage{st}")
        locust_env = {**os.environ, "STAGE": str(st)}
        if st == 4:
            locust_env["ERROR_RATE_STOP"] = str(error_rate_stop())
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
        rc = run(locust_cmd, env=locust_env)
        if rc != 0:
            print("Locust run had failures (check artifacts).", file=sys.stderr)

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
