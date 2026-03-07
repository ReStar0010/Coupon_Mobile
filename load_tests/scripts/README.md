# Load Test Scripts

Helper scripts for running load tests on a remote server and fetching results locally.

## 1. Run load test (on remote server)

Use **`run_load_test.sh`** on the machine where the test runs (e.g. after SSH into your server).

**From repo root:**

```bash
# Stage 1, default BASE_URL http://localhost:8000
./load_tests/scripts/run_load_test.sh

# Stage 3, custom BASE_URL
./load_tests/scripts/run_load_test.sh 3 https://api.example.com

# Using environment variables
export STAGE=4
export BASE_URL=https://staging.example.com
export OUTPUT_DIR=/var/load-test-results
export DATABASE_URL=postgres://user:pass@localhost/dbname
./load_tests/scripts/run_load_test.sh
```

**Optional `.env`:** Copy `load_tests/env.example` to `load_tests/.env` or repo root `.env` and set:

- `BASE_URL`
- `OUTPUT_DIR`
- `DATABASE_URL` (required for reset and consistency check)
- `STAGE`

The script sources `.env` if present, then overrides with arguments or existing env.

**Via SSH (one-liner):**

```bash
ssh user@myserver "cd /path/to/Coupon_Mobile && STAGE=3 BASE_URL=https://api.example.com ./load_tests/scripts/run_load_test.sh"
```

---

## 2. Fetch results to your local machine

Use **`fetch_load_test_results.sh`** on your **local** machine to copy the `load-test-results` directory from the remote.

**Required:** Set `REMOTE` to your SSH target.

```bash
# From your local repo; remote repo assumed at ~/Coupon_Mobile, results at ~/Coupon_Mobile/load-test-results
REMOTE=user@myserver.com ./load_tests/scripts/fetch_load_test_results.sh
```

**Custom paths:**

```bash
REMOTE=user@host \
  REMOTE_REPO=/var/app/Coupon_Mobile \
  REMOTE_OUTPUT_DIR=/var/app/Coupon_Mobile/load-test-results \
  LOCAL_DIR=./my-results \
  ./load_tests/scripts/fetch_load_test_results.sh
```

**Variables:**

| Variable             | Description                                      | Default                    |
|----------------------|--------------------------------------------------|----------------------------|
| `REMOTE`             | SSH target (e.g. `user@host`)                    | *(required)*               |
| `REMOTE_BASE`        | Path to repo root on remote (use for **Render**) | —                          |
| `REMOTE_REPO`        | Path to repo on remote                           | local repo name            |
| `REMOTE_OUTPUT_DIR`  | Remote dir (same level as load_tests) with CSV/HTML/summary | `load-test-results`        |
| `LOCAL_DIR`          | Local directory to save results                  | `./load-test-results`      |

**Render server** (repo at `~/project/src`):

```bash
REMOTE=render@your-render-host REMOTE_BASE=project/src ./load_tests/scripts/fetch_load_test_results.sh
```

Results are read from `~/project/src/load-test-results` (same level as `load_tests`). Use `REMOTE_BASE=project/src` (relative to remote home) or `REMOTE_BASE=~/project/src`.

Uses `rsync` if available, otherwise `scp`.

---

## Full workflow (SSH + fetch)

```bash
# 1. On remote: run Stage 3 load test (from repo root on server)
ssh user@myserver "cd /path/to/Coupon_Mobile && STAGE=3 BASE_URL=https://api.example.com DATABASE_URL=postgres://... ./load_tests/scripts/run_load_test.sh"

# 2. Locally: fetch results
REMOTE=user@myserver LOCAL_DIR=./load-test-results-stage3 ./load_tests/scripts/fetch_load_test_results.sh
```
