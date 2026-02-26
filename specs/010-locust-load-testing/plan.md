# Implementation Plan: CouPro Load Testing (Locust)

**Branch**: `010-locust-load-testing` | **Date**: 2026-02-26 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/010-locust-load-testing/spec.md`

## Summary

Implement a load-testing capability for the CouPro platform using Locust. Four stages (1M/200 baseline, 1M/200→1000 step-up, 50M/1500 multi-tenant, 50M/5000 breaking point) run in a totally clean environment per stage. Reset is achieved via a versioned seed (script or fixture) plus clearing redemptions; the same automation runs the load test and post-run DB consistency checks. Test users are pre-created (one per virtual user); outputs (latency, error rate, curves) are written to a defined artifact location. The plan aligns with the existing Django backend, JWT auth, and staging DB access.

## Technical Context

**Language/Version**: Python 3.10+ (Locust and Django seed/scripts)  
**Primary Dependencies**: Locust (load test), Django/DRF (existing backend; seed data and reset via management commands or fixtures)  
**Storage**: Staging DB (SQLite or PostgreSQL) for consistency queries and seed data; no new persistent store for the load-test tooling  
**Testing**: Locust scenarios for load; post-run consistency checks (DB queries) in same automation; optional pytest for harness/seed scripts if needed  
**Target Platform**: Staging environment (backend API); load-test runner on same network (CI or local)  
**Project Type**: Mobile + API (Backend + Mobile-Frontend); load tests are additive (`load_tests/` at repository root)  
**Performance Goals**: P95 &lt; 500 ms, error rate &lt; 1% (Stages 1–3); Stage 4 finds breaking point; 5% error rate triggers stop  
**Constraints**: Totally clean env per stage; one versioned seed; same automation for load + consistency checks; artifact output in defined location  
**Scale/Scope**: 4 stages; up to 50 merchants, 5000 users; pre-created user pool; versioned seed for 1 and 50 merchants

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Mobile-First**: N/A — load testing targets API only; no mobile UI.
- **II. API-Driven & Type-Safe**: Satisfied — load test exercises existing REST APIs; no new API contracts introduced; consistency checks validate existing backend behavior.
- **III. Quality Assurance**: Satisfied — load tests are a form of QA for critical paths (redemption, dashboard, multi-tenant). Backend unit/integration tests remain in `Backend/api/tests/` and `Backend/tests/`; load tests live in `load_tests/` at repo root and do not replace the Django test runner. CI can run load tests as a separate job (staging) and need not block PRs if run optionally.

**Structure Decision**: Load-test code and config live in `load_tests/` at repository root. Seed and consistency-check logic live in Backend (Django management commands); Locust files, stage configs, and runner live under `load_tests/` and are versioned together so one automation can run reset → load test → consistency checks.

## Project Structure

### Documentation (this feature)

```text
specs/010-locust-load-testing/
├── plan.md              # This file
├── research.md         # Phase 0
├── data-model.md       # Phase 1 (seed + stage config)
├── quickstart.md       # Phase 1 (run stages, reset, consistency checks)
├── contracts/          # Phase 1 (config/env contract only; APIs under test are existing)
└── tasks.md            # From /speckit.tasks (not created by /speckit.plan)
```

### Source Code (repository root)

```text
load_tests/                    # At repository root
├── locustfile.py              # Locust tasks (browse, redeem, dashboard)
├── stages/                    # Stage configs (users, spawn, duration)
│   ├── stage1_baseline.py
│   ├── stage2_ramp.py
│   ├── stage3_multitenant.py
│   └── stage4_breaking.py
├── reset.py                   # Clear redemptions + re-run seed (invokes Backend commands)
├── config/                    # Base URL, output path; test_users.json written here by seed
│   └── ...
└── requirements.txt          # locust, requests, etc. (no DB adapter; consistency uses Backend)

Backend/                       # Existing + load-test support
├── api/
│   └── management/commands/
│       ├── seed_load_test.py       # Versioned seed: merchants, coupons, test users → config
│       ├── reset_load_test.py      # Clear redemptions + re-run seed
│       └── verify_load_test_consistency.py  # Post-run DB checks (same automation)
├── tests/
└── manage.py
```

**Seed and consistency**: Seed and reset are Django management commands in `Backend/api/management/commands/` (e.g. `seed_load_test`, `reset_load_test`). They use the project's DATABASE_URL and ORM. The consistency check is a Django management command (e.g. `verify_load_test_consistency`) in Backend, invoked by the runner after each stage; it uses the same DATABASE_URL and ORM so no separate DB adapter is needed in `load_tests/`. Runner in `load_tests/run_stage.py` invokes these commands (e.g. `python Backend/manage.py …`).

**Structure Decision**: Use `load_tests/` at repository root for Locust, stage configs, and runner; use Backend for seed, reset, and consistency-check logic so one runner can execute: reset → load test → consistency checks, with artifacts written to a defined path.

## Complexity Tracking

No constitution violations. Load tests are additive and do not modify backend test roots or Django test runner.

---

## Agent context update

Run `.specify/scripts/bash/update-agent-context.sh cursor-agent` from repo root **when on branch `010-locust-load-testing`** so that plan and tech stack (Locust, load-test harness) are reflected in agent-specific context files. On other branches (e.g. `dev`) the script may not find this plan.
