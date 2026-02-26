# Load Test Harness Configuration Contract

**Feature**: 010-locust-load-testing | **Date**: 2026-02-26

The load-test harness (reset, Locust, consistency checks) MUST be configurable without code changes. Below is the contract for environment variables and/or config file keys. Implementations may use env only, a config file, or both (env overrides file).

## Required

| Key / Env | Description |
|-----------|-------------|
| `BASE_URL` | Backend API base URL (e.g. `https://staging.example.com/api`) used by Locust and by the seed if it calls the API. |
| `OUTPUT_DIR` | Directory where artifacts (CSV, HTML, consistency summary) are written. Must exist or be created by the runner. |
| `STAGE` | Stage identifier: `1` \| `2` \| `3` \| `4` so the runner and Locust know which scenario and seed variant to use. |

## For consistency checks (post-run DB queries)

| Key / Env | Description |
|-----------|-------------|
| `DB_*` or `DATABASE_URL` | Connection to the staging database so the consistency script can run read-only (or dedicated) queries. Same DB the backend uses for the target environment. |

Exact key names (e.g. `DATABASE_URL`, `DB_HOST`, `DB_NAME`) can follow backend conventions.

## For seed / reset

| Key / Env | Description |
|-----------|-------------|
| Seed parameters | Number of merchants (1 or 50), number of test users (≥ max users for stage), and any coupon counts or limits. Can be derived from `STAGE` or set explicitly (e.g. `SEED_MERCHANTS`, `SEED_USERS`). |

## Optional

| Key / Env | Description |
|-----------|-------------|
| `RUN_TIME` | Locust run time (e.g. `10m`). Default per stage if not set. |
| `SPAWN_RATE` | Users per second (Locust). Default per stage. |
| `ERROR_RATE_STOP` | Stop threshold (e.g. `0.05` for 5%). Used in Stage 4. |

## APIs under test

The harness does not define new API contracts. It calls **existing** CouPro backend endpoints (e.g. login, list coupons, redeem, merchant dashboard). Request/response shapes are defined by the backend; the locustfile and consistency checks MUST align with those existing contracts.
