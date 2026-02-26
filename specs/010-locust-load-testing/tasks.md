# Tasks: CouPro Load Testing (Locust)

**Input**: Design documents from `/specs/010-locust-load-testing/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This feature adds load-test tooling, not new backend APIs. No contract or unit tests are required for the harness itself per spec; validation is by running each stage and checking consistency rules. Optional: pytest for reset/consistency scripts if desired.

**Organization**: Tasks are grouped by user story (US1–US4 = Stage 1–4) so each stage can be implemented and run independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Load-test harness: `load_tests/` at repository root (per plan.md)
- Seed/reset: Django management commands in `Backend/api/management/commands/` or scripts invoked from `load_tests/`
- Backend tests: `Backend/tests/` or `Backend/api/tests/` (not used for this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create load-test directory structure and config

- [x] T001 Create directory structure: `load_tests/`, `load_tests/config/`, `load_tests/stages/` at repo root per plan.md
- [x] T002 Add `load_tests/requirements.txt` with locust and dependencies (e.g. requests); no DB adapter needed (consistency check runs as Backend management command)
- [x] T003 [P] Implement config loading in `load_tests/config/settings.py` (or env module) for BASE_URL, OUTPUT_DIR, STAGE, DATABASE_URL (or DB_*) per specs/010-locust-load-testing/contracts/load-test-config.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Versioned seed, reset, consistency checks, and runner so any stage can run in a clean env with the same automation

**⚠️ CRITICAL**: No stage (user story) work can begin until this phase is complete

- [x] T004 Implement versioned seed: Django management command `Backend/api/management/commands/seed_load_test.py` that creates N merchants, M coupons per merchant, and P test users (N, P from STAGE or env; e.g. 1 merchant / 200 users for stage 1, 50 / 5000 for stage 4); writes test user credentials to a file (e.g. `load_tests/config/test_users.json`) so Locust can assign one per virtual user
- [x] T005 Implement reset procedure: script or Django command that (1) clears all redemption records for the test env, (2) re-runs the seed for the current STAGE so merchant/coupon/user state is restored; implement in `Backend/api/management/commands/` (e.g. `reset_load_test`) or `load_tests/reset.py` that invokes Django commands
- [x] T006 Implement consistency-check as a Django management command `Backend/api/management/commands/verify_load_test_consistency.py` that uses the project DATABASE_URL and ORM to verify all five rules: (a) redemption count per coupon ≤ quantity, (b) at most one success per coupon_id, (c) per-merchant sums = platform total, (d) every API success has DB record, (e) dashboard API vs DB aggregation; output pass/fail and optional summary to OUTPUT_DIR. Runner in `load_tests/run_stage.py` invokes it (e.g. `python Backend/manage.py verify_load_test_consistency`) so the same automation runs load test and consistency checks without a separate DB adapter in load_tests.
- [x] T007 Implement runner script in `load_tests/run_stage.py` (or `run_stage.sh`) that runs in order: (1) reset (invoke Backend reset command), (2) Locust for the configured STAGE, (3) consistency check (invoke Backend verify_load_test_consistency command); reads BASE_URL, OUTPUT_DIR, STAGE from config; ensures same automation runs load test and consistency checks

**Checkpoint**: Foundation ready — Stage 1 (US1) implementation can begin

---

## Phase 3: User Story 1 - Baseline 1 Merchant / 200 Users (Priority: P1) 🎯 MVP

**Goal**: Run Stage 1 in a totally clean env; 200 users browse and redeem for 1 merchant; P95 &lt; 500 ms, error &lt; 1%; redemption and dashboard consistency verified after run

**Independent Test**: Run stage 1 only (reset → Locust 200 users → consistency); assert P95 &lt; 500 ms, error rate &lt; 1%, and that redemption results and dashboard figures match DB

### Implementation for User Story 1

- [x] T008 [P] [US1] Implement Locust HttpUser in `load_tests/locustfile.py`: on_start() loads one credential from test user pool (file from seed) and logs in; tasks: browse/list coupons for one merchant, redeem coupon; use BASE_URL from config
- [x] T009 [US1] Add Stage 1 config in `load_tests/stages/stage1_baseline.py` (or in locustfile): 200 users, spawn rate, run time; ensure Locust is invoked with --csv and --html writing to OUTPUT_DIR so artifacts are in defined location
- [x] T010 [US1] Wire runner in `load_tests/run_stage.py` for STAGE=1: run reset (1 merchant, 200 users seed), run Locust with stage 1 params and artifact output to OUTPUT_DIR, run Backend verify_load_test_consistency command; document in quickstart

**Checkpoint**: Stage 1 runnable end-to-end; P95 and error rate checkable from artifacts; consistency checks run in same automation

---

## Phase 4: User Story 2 - Step-up Ramp 1 Merchant / 200→1000 Users (Priority: P2)

**Goal**: Run Stage 2 with ramp +100 users every 30 s; idempotency check (multiple users same coupon_id); no oversell; latency/error curves for breakpoint analysis; dashboard consistency after run

**Independent Test**: Run stage 2 only; verify limited coupons not oversold, at most one success per coupon_id and duplicates get conflict response, and curves visible in CSV/HTML

### Implementation for User Story 2

- [x] T011 [P] [US2] Add idempotency task in `load_tests/locustfile.py`: task (or dedicated user class) where multiple virtual users share the same coupon_id and submit redemption requests concurrently; assert at most one success and that duplicate attempts receive 4xx/409 with "already redeemed" or "duplicate" signal
- [x] T012 [US2] Add Stage 2 config in `load_tests/stages/stage2_ramp.py`: ramp 200→1000 users (+100 every 30 s), run time; ensure --csv-full-history or equivalent so latency/error curves are in artifact for breakpoint identification. Document or support an optional high-spawn variant (e.g. up to 50 users/sec per spec edge case) for rapid-spawn consistency checks.
- [x] T013 [US2] Wire runner for STAGE=2 in `load_tests/run_stage.py`: reset for 1 merchant and 1000 users, run Locust with stage 2 params, run consistency; document Stage 2 in quickstart

**Checkpoint**: Stage 2 runnable; idempotency and oversell verified; curves available in OUTPUT_DIR

---

## Phase 5: User Story 3 - Multi-tenant 50 Merchants / 1500 Users (Priority: P3)

**Goal**: Run Stage 3 with 50 merchants and 1500 users; cross-merchant browse and redeem; data isolation and P95 &lt; 500 ms; per-merchant and dashboard consistency

**Independent Test**: Run stage 3 only; verify no cross-merchant data leakage, P95 &lt; 500 ms, and per-merchant vs platform totals match in consistency script

### Implementation for User Story 3

- [x] T014 [P] [US3] Extend Locust tasks in `load_tests/locustfile.py` for multi-tenant: browse/list coupons across multiple merchants, redeem from different merchants; ensure test user pool and merchant/coupon list align with seed for 50 merchants and 1500 users
- [x] T015 [US3] Add Stage 3 config in `load_tests/stages/stage3_multitenant.py`: 50 merchants, 1500 users, spawn rate, run time; wire artifact output to OUTPUT_DIR
- [x] T016 [US3] Ensure consistency command `Backend/api/management/commands/verify_load_test_consistency.py` asserts merchant data isolation (per-merchant redemption sums = platform total) and dashboard vs DB per merchant; wire runner for STAGE=3 in `load_tests/run_stage.py`

**Checkpoint**: Stage 3 runnable; isolation and P95 checkable; consistency includes dashboard and per-merchant rules

---

## Phase 6: User Story 4 - Breaking Point 50 Merchants / 5000 Users (Priority: P4)

**Goal**: Run Stage 4 with 5000 users; automatic stop when error rate &gt; 5%; after stop, consistency checks still run; artifacts show RPS/concurrency at degradation

**Independent Test**: Run stage 4; verify test stops when error rate exceeds 5%, and that after stop every successful redemption has DB record and dashboard matches DB

### Implementation for User Story 4

- [x] T017 [P] [US4] Implement stop-at-5% in `load_tests/locustfile.py` or `load_tests/stages/stage4_breaking.py`: when fail_ratio exceeds ERROR_RATE_STOP (default 0.05), call runner quit (e.g. Locust run as library with polling, or request/failure event that checks and quits); ensure clean exit so consistency script can run after
- [x] T018 [US4] Add Stage 4 config in `load_tests/stages/stage4_breaking.py`: 50 merchants, 5000 users, ERROR_RATE_STOP=0.05; wire artifact output to OUTPUT_DIR
- [x] T019 [US4] Wire runner for STAGE=4 in `load_tests/run_stage.py`: reset for 50 merchants and 5000 users, run Locust with stage 4 params (with stop at 5%), run consistency after stop; document Stage 4 and stop behavior in quickstart

**Checkpoint**: Stage 4 runnable; stops at 5% error rate; consistency verified on successful redemptions and dashboard after stop

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and quickstart validation

- [x] T020 [P] Add `load_tests/README.md` with run_stage usage, required env (BASE_URL, OUTPUT_DIR, STAGE, DATABASE_URL), and pointer to specs/010-locust-load-testing/quickstart.md; run through quickstart steps to validate end-to-end for at least Stage 1

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — first runnable stage (MVP)
- **Phase 4 (US2)**: Depends on Phase 2; shares locustfile with US1 — add ramp and idempotency
- **Phase 5 (US3)**: Depends on Phase 2; shares locustfile — add multi-tenant and 50-merchant seed
- **Phase 6 (US4)**: Depends on Phase 2; shares locustfile — add stop-at-5% and 5000 users
- **Phase 7 (Polish)**: Depends on at least Phase 3 (Stage 1) — docs and quickstart validation

### User Story Dependencies

- **US1 (Stage 1)**: After Foundational only — baseline; no dependency on US2–US4
- **US2 (Stage 2)**: After Foundational; extends locustfile and runner — idempotency and ramp
- **US3 (Stage 3)**: After Foundational; extends seed (50 merchants), locustfile, consistency — multi-tenant
- **US4 (Stage 4)**: After Foundational; extends locustfile and runner — stop at 5%, 5000 users

### Parallel Opportunities

- T002 and T003 can run in parallel after T001
- T008, T011, T014, T017 are [P] within their phases (locustfile/stages)
- T020 can run in parallel with other polish once Stage 1 works

---

## Parallel Example: Phase 2

```text
After T001–T003:
  T004 (seed) → T005 (reset, may depend on T004)
  T006 (consistency command in Backend) can be done in parallel with T004/T005
  T007 (runner) after T004, T005, T006
```

## Parallel Example: User Story 1

```text
T008 (Locust user + tasks) and T009 (stage 1 config) can be done in parallel;
T010 wires them in the runner after both.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T007)
3. Complete Phase 3: User Story 1 (T008–T010)
4. **STOP and VALIDATE**: Run Stage 1 (reset → Locust → consistency), check P95 and error rate from artifacts, confirm consistency script passes
5. Add README and quickstart pass (T020) for MVP deliverable

### Incremental Delivery

1. Setup + Foundational → runner can invoke reset and consistency; seed and Locust not yet wired per stage
2. Add US1 → Stage 1 runnable (MVP)
3. Add US2 → Stage 2 runnable (ramp + idempotency)
4. Add US3 → Stage 3 runnable (multi-tenant)
5. Add US4 → Stage 4 runnable (breaking point + stop at 5%)
6. Polish → README and quickstart validated

### Suggested MVP Scope

**Phase 1 + Phase 2 + Phase 3** (T001–T010): one runnable stage (Stage 1) with clean env, artifact output, and consistency checks in the same automation. Total tasks for MVP: 10.

---

## Notes

- [P] tasks = different files or independent work; no shared-state dependency
- [USn] label maps task to stage for traceability
- Each stage is independently runnable after its phase is complete
- Seed, reset, and consistency check are Django management commands in Backend; they use the project DATABASE_URL and ORM. Runner in load_tests invokes them; no separate DB adapter in load_tests.
- Commit after each task or logical group; run Stage 1 after T010 to validate before proceeding to US2
