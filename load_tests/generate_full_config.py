#!/usr/bin/env python3
"""
Generate the full load test config once (Stage 4 scale: 50 merchants, 5000 users).
Writes to load_tests/config/. Commit and push this config; then local and remote
runs for any stage (1–4) use this single dataset (only load params differ per stage).

Run from repo root:
  STAGE=4 python load_tests/generate_full_config.py
  # or
  python load_tests/generate_full_config.py
"""
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "Backend"


def main() -> int:
    os.environ["STAGE"] = "4"
    if not (BACKEND_DIR / "manage.py").exists():
        print("Backend/manage.py not found. Run from repo root.", file=sys.stderr)
        return 1
    print("Generating full config (STAGE=4: 50 merchants, 5000 users)...")
    rc = subprocess.run(
        [sys.executable, "manage.py", "seed_load_test", "--stage", "4"],
        cwd=BACKEND_DIR,
        env={**os.environ, "STAGE": "4"},
    )
    if rc.returncode != 0:
        return rc.returncode
    config_dir = REPO_ROOT / "load_tests" / "config"
    print(f"Config written to {config_dir}. Commit and push; then use for all stages.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
