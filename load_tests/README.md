# CouPro Load Test Harness

Load testing for the CouPro platform using [Locust](https://locust.io/). Four stages (baseline, step-up ramp, multi-tenant, breaking point) run in a clean environment per run. The same automation runs reset, Locust, and post-run consistency checks.

## Single shared config (recommended)

Generate the full dataset **once** locally, then use it for all stages (local and remote):

1. **Generate config once (from repo root)**  
   Creates 50 merchants, 5000 users, and stage 3+ data (daily draw, shares) in `load_tests/config/`:
   ```bash
   python load_tests/generate_full_config.py
   ```
   Or: `cd Backend && STAGE=4 python manage.py seed_load_test`

2. **Commit and push** the `load_tests/config/` files (e.g. `test_users.json`, `stores.json`, `task_weights.json`, `private_share_tokens.json`).

3. **Run any stage (local or remote)**  
   Both use this config; only load parameters change per stage (user count, spawn rate, run time).  
   - **Local:** `reset_load_test` sees `test_users.json` and seeds from that config (writes back `stores.json` with actual DB store IDs).  
   - **Remote:** Runner sends config to `POST /api/load-test/reset/` and overwrites only `stores.json` with the backend’s store IDs.

No need to regenerate config per stage or per environment.

## Quick start

1. **Prerequisites**
   - Python 3.10+
   - Backend Django app with DB (e.g. staging)
   - Install harness deps: `pip install -r load_tests/requirements.txt`
   - **Local runs:** Use PostgreSQL for the Backend (set `DATABASE_URL`). SQLite cannot handle concurrent load and will cause 500 errors under Locust. See `docs/load-test-500-diagnosis.md` if you see 500s on `/api/login/`.

2. **Environment**
   Set before running:
   - `BASE_URL` — Backend API base URL (e.g. `http://localhost:8000`)
   - `OUTPUT_DIR` — Directory for CSV/HTML and consistency summary (default: `./load-test-results`)
   - `STAGE` — Stage 1–4

3. **Run one stage (from repo root)**
   ```bash
   export BASE_URL=http://localhost:8000
   export OUTPUT_DIR=./load-test-results
   export STAGE=1
   python load_tests/run_stage.py
   ```
   This runs: reset (clear redemptions + seed) → Locust → consistency check. Artifacts go to `OUTPUT_DIR`.

4. **Run Locust only (e.g. UI mode)**
   After seed has run at least once:
   ```bash
   export BASE_URL=http://localhost:8000
   locust -f load_tests/locustfile.py
   ```
   Open the URL Locust prints (e.g. http://0.0.0.0:8089) and start a run.

## Stages

| Stage | Merchants | Users   | Notes |
|-------|-----------|---------|--------|
| 1     | 1         | 200     | Baseline; P95 < 500 ms, error < 1%. |
| 2     | 1         | 200→1000| Ramp; idempotency (shared coupon_id). |
| 3     | 50        | 1500    | Multi-tenant; data isolation. |
| 4     | 50        | 5000    | Breaking point; stop at 5% error rate. |

Config per stage: `load_tests/stages/stage1_baseline.py` … `stage4_breaking.py`.

## Backend commands (invoked by runner)

- **Seed**: `python Backend/manage.py seed_load_test` (from repo root: run from `Backend/` with `STAGE` set). Use `STAGE=4` or `generate_full_config.py` for the single shared dataset.
- **Reset**: `python Backend/manage.py reset_load_test` (clears redemptions; if `load_tests/config/test_users.json` exists, seeds from that config and updates `stores.json`; otherwise re-runs seed for current `STAGE`).
- **Consistency**: `python Backend/manage.py verify_load_test_consistency --output-dir <OUTPUT_DIR>`

## Config contract

See `specs/010-locust-load-testing/contracts/load-test-config.md` for required/optional env vars (`BASE_URL`, `OUTPUT_DIR`, `STAGE`, `RUN_TIME`, `SPAWN_RATE`, `ERROR_RATE_STOP`, DB connection for consistency).

## Scripts (remote run + fetch results)

- **Run on server:** `load_tests/scripts/run_load_test.sh [STAGE] [BASE_URL]` — set `STAGE`, `BASE_URL`, `OUTPUT_DIR`, `DATABASE_URL` (env or `load_tests/.env`). Use from repo root on the remote host (e.g. over SSH).
- **Fetch results locally:** `REMOTE=user@host ./load_tests/scripts/fetch_load_test_results.sh` — copies the remote `load-test-results` directory to your machine (uses rsync or scp).

See **load_tests/scripts/README.md** for full usage and examples.

## Full quickstart

See **specs/010-locust-load-testing/quickstart.md** for prerequisites, one-time setup, and stage-by-stage flow.
