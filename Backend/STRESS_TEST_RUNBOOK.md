# CouBox Stress Test Runbook

## Quick Start

### 1. Seed test data
```bash
cd Backend
python manage.py seed_load_test --stage 1
# Creates load_tests/config/test_users.json (~200 users, 1 merchant)
# Creates load_tests/config/stores.json
```

### 2. Start the server (separate terminal)
```bash
cd Backend
python manage.py runserver 8000
```

### 3. Run Locust (interactive)
```bash
cd Backend
locust -f locustfile.py --host=http://localhost:8000
# Open http://localhost:8089 — set users / spawn rate in the UI
```

### 4. Run headless (CI-style, 60s soak)
```bash
cd Backend
locust -f locustfile.py --host=http://localhost:8000 \
  --users 50 --spawn-rate 10 --run-time 60s --headless \
  --csv=stress_results
```

### 5. Verify data integrity post-test
```bash
curl -H "X-Load-Test-Secret: $LOAD_TEST_SECRET" \
  http://localhost:8000/api/load-test/verify-consistency/
```

### 6. Reset between runs
```bash
python manage.py reset_load_test
# Clears redemptions, re-seeds from scratch
```

---

## Locustfile user classes

| Class | Weight | Simulates |
|-------|--------|-----------|
| `ConsumerUser` | 4 | Student browsing coupons, viewing stats, refreshing tokens |
| `MerchantUser` | 1 | Merchant managing templates, generating QR sessions |
| `AnonymousUser` | 2 | Health probes and public legal content pages |

At 70 virtual users (default ratio): ~40 consumers, ~10 merchants, ~20 anonymous.

---

## Recommended test stages

| Stage | Users | Spawn rate | Duration | Purpose |
|-------|-------|------------|----------|---------|
| Smoke | 5 | 1/s | 30s | Verify setup and auth |
| Load | 50 | 5/s | 5min | Normal traffic baseline |
| Stress | 200 | 20/s | 5min | Peak traffic |
| Spike | 500 | 100/s | 2min | Traffic spike / failure mode |

---

## Performance targets

| Endpoint | p50 | p95 | Error rate |
|----------|-----|-----|-----------|
| `GET /api/health/` | <10ms | <50ms | 0% |
| `GET /api/ping/` | <5ms | <20ms | 0% |
| `GET /api/store-coupons/` | <100ms | <300ms | <0.1% |
| `POST /api/login/` | <200ms | <500ms | <1% |
| `POST /api/token/refresh/` | <50ms | <200ms | <0.5% |
| `POST /api/redeem/<id>/` | <300ms | <800ms | <1% |
| `GET /api/merchant/coupon-templates/<id>/analytics/` | <500ms | <1500ms | <1% |
| `POST /api/merchant/qr-session/generate/` | <300ms | <1000ms | <1% |

---

## What to watch during a run

- **Error rate**: Locust UI "Failures" tab — any 5xx is a regression
- **p95 latency**: Should stay under the targets above; rising p95 under load = DB bottleneck
- **Response time chart**: Sudden spikes indicate lock contention or GC pauses
- **DB connections**: SQLite serializes writes (dev only); use Postgres for stress/spike stages
- **Memory**: Watch for leaks — gunicorn recycles workers at `max_requests=1000`

---

## Pytest performance contracts

Run the Django-client performance contracts (no live server needed):

```bash
cd Backend
pytest tests/performance/ -v --no-cov -s
```

These tests verify:
- `ConcurrentRedemptionTest` — 10 redemptions, no 500s, <5s total
- `CouponListPerformanceTest` — 50-coupon list <500ms, paginated shape
- `TokenRefreshPerformanceTest` — refresh <200ms
- `HealthCheckPerformanceTest` — health check <200ms, correct JSON shape
- `PingPerformanceTest` — ping <50ms

---

## Infrastructure notes

- **Local dev**: SQLite + single Django process — suitable for Smoke/Load stages only
- **Postgres + gunicorn**: Required for Stress/Spike stages (see `gunicorn.conf.py`)
- **Gevent workers**: `gunicorn.conf.py` configures async workers — ensure `gevent` is installed
- **LOAD_TEST_SECRET**: Set in environment before calling `/api/load-test/` endpoints
