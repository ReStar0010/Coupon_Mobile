#!/usr/bin/env bash
#
# Fetch load-test-results from a remote server to your local machine.
# Run this locally (not on the remote). Uses rsync if available, else scp.
#
# Required:
#   REMOTE       — SSH target (e.g. user@host or host if user is default)
#
# Optional:
#   REMOTE_BASE          — Path to repo root on remote (use for Render: project/src; overrides REMOTE_REPO)
#   REMOTE_REPO          — Path to repo on remote (default: local repo name; ignored if REMOTE_BASE set)
#   REMOTE_OUTPUT_DIR    — Dir name on remote, same level as load_tests (default: load-test-results)
#   LOCAL_DIR            — Local directory to save results into (default: ./load-test-results)
#   REMOTE_HOME          — Remote home (default: empty); only used when REMOTE_REPO is defaulted
#
# Render server (repo at ~/project/src):
#   REMOTE=render@your-render-host REMOTE_BASE=project/src ./load_tests/scripts/fetch_load_test_results.sh
#
# Example (generic):
#   REMOTE=deploy@myserver.com ./load_tests/scripts/fetch_load_test_results.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_NAME="$(basename "$REPO_ROOT")"

REMOTE="${REMOTE:?Set REMOTE (e.g. user@host)}"
REMOTE_BASE="${REMOTE_BASE:-}"
REMOTE_REPO="${REMOTE_REPO:-}"
REMOTE_OUTPUT_DIR="${REMOTE_OUTPUT_DIR:-load-test-results}"
LOCAL_DIR="${LOCAL_DIR:-$REPO_ROOT/load-test-results}"

# Remote path to load-test-results directory
if [[ "$REMOTE_OUTPUT_DIR" == /* ]]; then
  REMOTE_RESULTS="$REMOTE_OUTPUT_DIR"
elif [ -n "$REMOTE_BASE" ]; then
  # e.g. Render: REMOTE_BASE=project/src -> project/src/load-test-results
  REMOTE_RESULTS="$REMOTE_BASE/$REMOTE_OUTPUT_DIR"
else
  if [ -z "$REMOTE_REPO" ]; then
    if [ -n "${REMOTE_HOME:-}" ]; then
      REMOTE_REPO="$REMOTE_HOME/$REPO_NAME"
    else
      REMOTE_REPO="$REPO_NAME"
    fi
  fi
  REMOTE_RESULTS="$REMOTE_REPO/$REMOTE_OUTPUT_DIR"
fi

mkdir -p "$LOCAL_DIR"

if command -v rsync >/dev/null 2>&1; then
  echo "Fetching load-test-results from $REMOTE:$REMOTE_RESULTS to $LOCAL_DIR (rsync)..."
  rsync -avz --progress "$REMOTE:$REMOTE_RESULTS/" "$LOCAL_DIR/"
else
  echo "Fetching load-test-results from $REMOTE:$REMOTE_RESULTS to $LOCAL_DIR (scp)..."
  scp -r "$REMOTE:$REMOTE_RESULTS/"* "$LOCAL_DIR/" 2>/dev/null || scp -r "$REMOTE:$REMOTE_RESULTS" "$LOCAL_DIR/"
fi

echo "Done. Results in $LOCAL_DIR"
