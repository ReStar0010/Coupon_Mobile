# Quickstart: CouPro Load Testing

**Feature**: 010-locust-load-testing | **Date**: 2026-02-26

## Prerequisites

- Python 3.10+ with Locust and harness dependencies installed (see `load_tests/requirements.txt` or equivalent).
- Access to **staging** backend API and staging database (for consistency checks). Do not run against production.
- Versioned seed available (Django management command or fixtures) that creates merchants, coupons, and test users for the chosen stage.

## One-time setup

1. **Create test user pool and seed data**  
   Run the versioned seed for the desired stage (e.g. 1 merchant + 200 users for Stage 1, or 50 merchants + 5000 users for Stage 4). Seed creates merchants, coupons, and test users; no redemptions.

2. **Configure environment**  
   Set at least:
   - `BASE_URL` — staging API base URL  
   - `OUTPUT_DIR` — directory for CSV/HTML and consistency report  
   - `STAGE` — `1`, `2`, `3`, or `4`  
   - DB connection for consistency checks (`DATABASE_URL` or equivalent)

3. **Install and verify**  
   From repo root (or `load_tests/`):  
   `pip install -r load_tests/requirements.txt`  
   Ensure you can reach `BASE_URL` and the staging DB.

## Running a single stage (high level)

Each stage MUST run in a **totally clean environment**. The same automation MUST run reset, load test, and consistency checks.

1. **Reset**  
   Clear all redemptions and re-run the versioned seed (or restore post-seed DB snapshot) so the env is clean for this stage.

2. **Run Locust**  
   Start Locust for the chosen stage (e.g. 200 users for Stage 1, or 200→1000 ramp for Stage 2). Use a pre-created test user pool (one credential per virtual user). Write artifacts to `OUTPUT_DIR` (e.g. `--csv`, `--html`).

3. **Run consistency checks**  
   In the same runner script, after Locust exits, invoke the Backend consistency-check command (e.g. `python Backend/manage.py verify_load_test_consistency`). It uses the project DB and verifies: no oversell, no duplicate redemption, merchant isolation, API success ⇒ DB record, dashboard vs DB. Results can be printed or written under `OUTPUT_DIR`.

4. **Inspect artifacts**  
   Open CSV/HTML in `OUTPUT_DIR` for latency, error rate, and (Stage 2) breakpoint curves. Fix any consistency-check failures before treating the stage as passed.

## Stage summary

| Stage | Merchants | Users    | Notes |
|-------|-----------|----------|--------|
| 1     | 1         | 200      | Baseline; P95 &lt; 500 ms, error &lt; 1%. |
| 2     | 1         | 200→1000 | Ramp +100/30 s; idempotency (shared coupon_id); breakpoint from curves. Optional: high-spawn variant (e.g. up to 50 users/sec) to verify consistency under rapid spawn (see spec edge case). |
| 3     | 50        | 1500     | Multi-tenant; data isolation; P95 &lt; 500 ms. |
| 4     | 50        | 5000     | Breaking point; stop when error rate &gt; 5%; consistency still checked after stop. |

## Stopping at 5% errors (Stage 4)

Stage 4 MUST stop when error rate exceeds 5%. The harness (Locust run as library or wrapper that polls) MUST enforce this and then run consistency checks on the requests that succeeded.

## Full command sequence (example)

```bash
export BASE_URL=https://staging-api.example.com
export OUTPUT_DIR=./load-test-results
export STAGE=1

# 1. Reset (clear redemptions + re-run seed)
python -m load_tests.reset

# 2. Run Locust (artifacts to OUTPUT_DIR)
locust -f load_tests/locustfile.py --headless -u 200 -r 10 -t 5m \
  --csv $OUTPUT_DIR/stage1 --html $OUTPUT_DIR/stage1_report.html

# 3. Consistency checks (same automation)
python Backend/manage.py verify_load_test_consistency
```

Exact commands and flags depend on the implemented runner and Locust entrypoints.
