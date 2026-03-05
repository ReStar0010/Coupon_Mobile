#!/usr/bin/env bash
#
# Run the load test on the current machine (use on remote server via SSH).
# From repo root: load_tests/scripts/run_load_test.sh [STAGE] [BASE_URL]
# Or set env: STAGE=3 BASE_URL=https://api.example.com load_tests/scripts/run_load_test.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOAD_TESTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(dirname "$LOAD_TESTS_DIR")"
cd "$REPO_ROOT"

# Optional: load .env from repo root or load_tests/ if present
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/.env"
  set +a
elif [ -f "$REPO_ROOT/load_tests/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/load_tests/.env"
  set +a
fi

# STAGE: 1–4 (default 1)
export STAGE="${1:-${STAGE:-1}}"
# BASE_URL: Backend API base URL (no trailing slash)
export BASE_URL="${2:-${BASE_URL:-http://localhost:8000}}"
# OUTPUT_DIR: same level as load_tests (e.g. repo/load-test-results next to repo/load_tests)
export OUTPUT_DIR="${OUTPUT_DIR:-$(dirname "$LOAD_TESTS_DIR")/load-test-results}"

# DATABASE_URL: required for reset and consistency (Backend uses it). Set in .env or here.
# export DATABASE_URL="postgres://..."

echo "Running load test: STAGE=$STAGE BASE_URL=$BASE_URL OUTPUT_DIR=$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Ensure Python can find the repo when running run_stage.py
export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$REPO_ROOT"
python3 load_tests/run_stage.py
exit $?
