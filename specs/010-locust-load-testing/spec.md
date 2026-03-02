# Feature Specification: CouPro Load Testing (Locust)

**Feature Branch**: `010-locust-load-testing`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: Test stages (1 Merchant/200 Users baseline; 1 Merchant/200→1000 step-up; 50 Merchants/1500 Users; 50 Merchants/5000 Users), data consistency verification rules, merchant dashboard correctness per stage, and stage-to-stage redemption reset.

## Summary

Deliver a load-testing capability for the CouPro platform so that under different load scenarios the system satisfies three quality dimensions: **performance** (stable response under stress), **availability** (no outage under high concurrency), and **correctness** (every interaction’s outcome matches business rules, including merchant dashboard figures). The specification defines four test stages (baseline, step-up ramp, multi-tenant, breaking point), verification rules that must use direct database checks (not only API responses), and merchant dashboard consistency with stored data in every stage. It does not prescribe the load-testing tool or internal implementation details.

---

## Clarifications

### Session 2026-02-26

- Q: How is "known initial state" for merchant/coupon defined for reset—fixed seed, restore-from-backup, or full re-seed? → A: One versioned seed (script or fixture) defines initial state; reset = clear redemptions + re-run that seed (or restore DB to post-seed snapshot).
- Q: Who runs the post-run DB consistency checks—same process as load test, separate script, or manual? → A: Same automation as the load test runs the DB consistency checks (e.g. teardown or next step in the same runner/script).
- Q: What must the system return when a duplicate redemption is attempted (idempotency)? → A: A distinct conflict response (e.g. 409 or 4xx) with a clear "already redeemed" or "duplicate" signal in status or body; load test asserts at most one success and that duplicates are non-success.
- Q: Where must test outputs (latency, error rate, curves) be produced? → A: At least one machine-readable or viewable artifact (e.g. HTML report, CSV, or JSON) in a defined output location (e.g. project output dir or CI artifact path); format not prescribed.
- Q: How does the load test authenticate to the API? → A: Pre-created pool of test users (or tokens), one per virtual user; each simulated user has its own identity.

---

## Test Assumptions (Standards)

| Item | Standard |
|------|----------|
| Latency | P95 &lt; 500 ms |
| Error Rate | &lt; 1% (Stage 4: 5% is the hard stop threshold) |
| Throughput | 5–20 RPS (normal to peak) |
| Concurrent Users | 50 (normal) / 200 (peak) |
| Spawn Rate | 5–50 users/sec (per stage) |
| Test Duration | 5–10 min (per stage) |
| Consistency | Limited coupons must not be oversold; the same coupon must not be redeemed more than once |

---

## User Scenarios & Testing *(mandatory)*

Each test stage is a distinct scenario that can be run and validated on its own. **Each new stage runs in a totally clean environment**: before a stage starts, the environment must be reset so that no residual data from a previous stage remains (see Stage-Transition Requirements).

### User Story 1 - Baseline: 1 Merchant / 200 Users (Priority: P1)

**Scenario**: Campus lunch peak—one merchant receives concentrated browse and claim traffic from nearby users (e.g. 200 users).

**Purpose**: Establish a performance baseline and confirm the system is fully stable under normal campus load.

**Why this priority**: Without a stable baseline, later stages cannot be interpreted; this is the foundation for all load and correctness checks.

**Independent Test**: Run this stage alone; assert P95 latency &lt; 500 ms, error rate &lt; 1%, and that redemption results match persistent records.

**Acceptance Scenarios**:

1. **Given** one merchant and 200 simulated users, **When** users browse and redeem coupons for that merchant, **Then** P95 response time is under 500 ms and error rate is under 1%.
2. **Given** the same run, **When** redemptions are performed, **Then** every redemption result is consistent with the stored redemption records (no mismatch between API response and persisted state).
3. **Given** the same run, **When** the merchant dashboard is inspected after the test, **Then** dashboard figures (e.g. map coupon clicks, redemption counts) match the actual operations and database records.

---

### User Story 2 - Step-up Ramp: 1 Merchant / 200 → 1000 Users (Priority: P2)

**Scenario**: A spike event (e.g. “系際爭霸戰”) where many users simultaneously compete for the same merchant’s limited coupons. Users ramp from 200 to 1000 by adding 100 users every 30 seconds to expose latency and error-rate breakpoints from the resulting curves.

**Purpose**: Find the single-merchant load limit and ensure business rules (no overselling, idempotent redemption) hold under high concurrency. The test must deliberately provoke race conditions (multiple virtual users sharing the same coupon_id and submitting redemption requests at the same time), not rely on random traffic to collide.

**Why this priority**: Validates spike behavior and correctness under contention; required before scaling to multiple merchants.

**Independent Test**: Run this stage with step-up ramp (+100 users every 30 s); verify limited coupons are never oversold; verify idempotency by having multiple virtual users share the same coupon_id and send redemption requests concurrently; use latency and error-rate curves to identify breakpoints, not only a final pass/fail.

**Acceptance Scenarios**:

1. **Given** limited-quantity coupons and a step-up to 1000 users, **When** users redeem, **Then** total successful redemptions never exceed the configured coupon quantity (no overselling).
2. **Given** multiple virtual users sharing the same coupon_id, **When** they submit redemption requests concurrently (script-driven, not by chance), **Then** at most one redemption succeeds for that coupon; the rest receive a distinct conflict response (e.g. HTTP 409 or 4xx) with a clear "already redeemed" or "duplicate" signal in status or body. The load test asserts at most one success per coupon and that duplicate attempts are non-success (idempotency / no double redemption).
3. **Given** the ramp, **When** load increases, **Then** the test produces curves for latency and error rate so that the breakpoint (where latency or errors degrade) can be identified from the curves, not only a single pass/fail at the end.
4. **Given** the same run, **When** the merchant dashboard is inspected after high concurrency, **Then** dashboard redemption counts and coupon-exchange history match the database records exactly; no concurrency-induced errors in displayed statistics.

---

### User Story 3 - Multi-tenant: 50 Merchants / 1500 Users (Priority: P3)

**Scenario**: A multi-merchant zone (e.g. 公館商圈) with 50 merchants and 1500 users browsing the map, favouring merchants, and redeeming across different merchants.

**Purpose**: Verify data isolation across merchants and that query performance remains acceptable under multi-tenant load.

**Why this priority**: Ensures cross-merchant correctness and shared-infrastructure behavior before maximum scale.

**Independent Test**: Run this stage with 50 merchants and 1500 users; assert cross-merchant data does not mix and P95 remains under 500 ms where applicable.

**Acceptance Scenarios**:

1. **Given** 50 merchants and 1500 users, **When** users perform cross-merchant browse and redeem, **Then** each merchant’s redemption and coupon data remain isolated (no cross-tenant data leakage).
2. **Given** the same run, **When** queries are executed (e.g. map, list, redeem), **Then** P95 response time for those operations stays under 500 ms.
3. **Given** redemptions across multiple merchants, **When** results are checked against persistent storage, **Then** each merchant’s redemption totals and status are consistent with the database (and platform-wide totals reconcile with per-merchant sums).

---

### User Story 4 - Breaking Point: 50 Merchants / 5000 Users (Priority: P4)

**Scenario**: Peak scale (e.g. 雙北校園商圈) with 50 merchants and 5000 users to find the system’s breaking point.

**Purpose**: Provide data for capacity and infrastructure decisions; this stage is not required to “pass” all metrics. The test must stop when error rate exceeds 5% to avoid damaging the staging environment and to keep later stages meaningful.

**Why this priority**: Informs scaling and hardening; safety stop protects staging and subsequent runs.

**Independent Test**: Run this stage; observe at which RPS/concurrency latency and error rate degrade and how the system behaves as the DB connection pool approaches exhaustion; enforce automatic stop at 5% error rate; after stop, verify that every successful redemption is correctly persisted and that dashboard figures match DB (no statistical loss or wrong totals due to degradation).

**Acceptance Scenarios**:

1. **Given** 50 merchants and 5000 users, **When** error rate exceeds 5%, **Then** the test stops automatically (no continued hammering of the system).
2. **Given** the run (including after a stop), **When** checking persistent storage, **Then** every request that was reported as successful (e.g. HTTP 200) has a corresponding correct record; no successful redemptions are lost or corrupted.
3. **Given** the run, **When** analyzing results, **Then** the test output indicates the approximate RPS and concurrency at which latency began to degrade, at which error rate exceeded 1%, and how the system behaved as the connection pool approached exhaustion.
4. **Given** degradation or partial failures during the run, **When** the merchant dashboard is inspected, **Then** dashboard figures (clicks, redemption counts, exchange history) match the database aggregation of actually successful redemptions; no missing or incorrect totals due to degradation.

---

### Edge Cases

- **Rapid spawn**: When spawn rate is high (e.g. 50 users/sec), the test must still enforce consistency rules (no oversell, no double redemption) and must not corrupt or duplicate redemption records.
- **Stop at 5% errors**: When error rate hits 5% in Stage 4, the test must halt cleanly and leave the environment in a state where redemption data can be reset and the next stage (or rerun) is valid.
- **DB connection exhaustion**: Under high load, if the system approaches or hits connection-pool limits, the test must record behavior (e.g. errors, timeouts) and, after stop, still allow consistency checks on persisted data.
- **Partial run**: If a stage is stopped early (manual or automatic), consistency checks must apply only to requests that completed with success (e.g. 200); no partial or inconsistent redemption records.
- **Clean env before next stage**: If reset fails or is skipped, the next stage must not be run until the environment is restored to a totally clean state; otherwise results would be contaminated by leftover data from the previous stage.

---

## Data-Consistency Verification Rules

Regardless of stage, the following rules must be checked **after** each test run. The **same automation** that runs the load test MUST run these consistency checks (e.g. in teardown or a follow-up step in the same runner/script)—not a separate manual step. Verification must use **direct queries against the database**, not only API responses, because there can be a time lag between what the load-test client sees and the final persisted state.

| Rule | Verification method |
|------|----------------------|
| No overselling of limited coupons | Query DB: total redemptions per coupon ≤ configured coupon quantity (see SQL/aggregation). |
| No duplicate redemption | For each coupon ID, at most one redemption record with status = success in the DB. |
| Merchant data isolation | Sum of per-merchant redemption counts equals platform-wide redemption count; no cross-merchant mixing. |
| API success implies DB record | Every request that returned success (e.g. 200) must have a corresponding record in the DB. |
| Dashboard matches DB | Dashboard API responses (click counts, redemption counts, exchange history) must match DB aggregation results; no cross-merchant leakage or wrong totals. |

---

## Stage-Transition Requirements

- **Totally clean environment per stage**: Each new stage MUST run in a totally clean environment. Before a stage starts, all test-affecting data from any previous stage must be cleared or restored so that the stage sees no residual state (no leftover redemptions, no stale counts, no mixed data). Results from one stage must not influence the next.
- **Between stages**: After each stage completes, the environment MUST be reset to a fully clean state before the next stage runs. The **known initial state** is defined by a single, versioned seed (script or fixture) that creates the required merchants and coupons. Reset = clear all redemption data + re-run that seed (or restore the database to a post-seed snapshot) so every stage starts from the same reproducible baseline.
- **Scope of reset**: Reset MUST remove all redemption data and any other runtime state that could affect the next stage, then restore merchant/coupon state by re-running the versioned seed or restoring the post-seed snapshot. The goal is a totally clean env for testing: no leftover redemptions, correct coupon quantities for the upcoming stage, and no cross-stage contamination.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The load-test capability MUST support four distinct stages: (1) 1 merchant / 200 users baseline, (2) 1 merchant step-up 200→1000 users, (3) 50 merchants / 1500 users, (4) 50 merchants / 5000 users with configurable spawn rate and duration per stage.
- **FR-002**: The test MUST collect and report latency (including P95) and error rate so that each stage can be validated against the assumptions (P95 &lt; 500 ms, error rate &lt; 1% where applicable).
- **FR-003**: The test MUST support an idempotency check: the script MUST allow multiple virtual users to share the same coupon_id and submit redemption requests concurrently, so that race conditions and double-redemption prevention are deliberately provoked and verified (not left to random collision). For duplicate redemption attempts, the system MUST return a distinct conflict response (e.g. 409 or 4xx) with a clear "already redeemed" or "duplicate" signal; the test asserts at most one success per coupon and that duplicates are non-success.
- **FR-004**: The test MUST support post-run consistency checks that query the database directly for: (a) redemption count per coupon ≤ configured quantity, (b) at most one successful redemption per coupon_id, (c) per-merchant vs platform-wide redemption totals, (d) matching DB records for every API-reported success, (e) dashboard-reported click counts, redemption counts, and exchange history matching DB aggregation. The same automation that runs the load test MUST execute these consistency checks (e.g. teardown or follow-up step in the same runner/script).
- **FR-005**: A reset procedure MUST be available that brings the environment to a totally clean state before each new stage. Reset MUST clear all redemption-related data and any other test-affecting state, then restore merchant/coupon state using a single, versioned seed (script or fixture) or by restoring a post-seed database snapshot, so that each stage runs from the same reproducible initial state.
- **FR-006**: In the Stage 4 scenario, the test MUST stop when error rate exceeds 5% (configurable threshold) to avoid unacceptable degradation and to protect the staging database and reset validity for later stages.
- **FR-007**: Test outputs MUST allow identification of the approximate load (RPS and concurrent users) at which latency and error rate begin to degrade, and of behavior as the connection pool approaches exhaustion, not only a final pass/fail. Latency, error rate, and breakpoint data MUST be produced as at least one machine-readable or viewable artifact (e.g. HTML report, CSV, or JSON) in a defined output location (e.g. project output dir or CI artifact path); format is not prescribed.
- **FR-008**: Each stage's verification MUST include merchant dashboard correctness: dashboard figures (e.g. map coupon clicks, redemption counts, exchange history) must match database records and must not show cross-merchant data or wrong totals under concurrency or degradation.
- **FR-009**: The test MUST use a pre-created pool of test users (or tokens), with one identity per virtual user, so that each simulated user authenticates with its own credentials; no single shared token for all users.

### Key Entities

- **Merchant**: Represents a store; has coupons and redemption records; data must be isolated from other merchants in multi-tenant runs.
- **Coupon**: Belongs to a merchant; may have a limited quantity; each coupon_id must allow at most one successful redemption in the system.
- **Redemption**: A single use of a coupon by a user; must be persisted correctly; must not exceed coupon quantity for limited coupons; must be unique per coupon for successful redemptions.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Under baseline load (1 merchant, 200 users), P95 response time is under 500 ms and error rate is under 1%.
- **SC-002**: Under the step-up ramp (1 merchant, 200→1000 users), limited coupons are never oversold (DB redemption count ≤ configured quantity for each coupon).
- **SC-003**: Under the step-up ramp, when multiple virtual users attempt to redeem the same coupon concurrently, at most one redemption succeeds and is persisted; duplicate attempts receive a distinct conflict response (e.g. 409 or 4xx) with a clear "already redeemed" or "duplicate" signal; no duplicate successful redemption for the same coupon_id.
- **SC-004**: Under multi-tenant load (50 merchants, 1500 users), P95 query/response time remains under 500 ms and per-merchant redemption data is correct and isolated (platform totals match sum of per-merchant totals).
- **SC-005**: In the high-scale stage (50 merchants, 5000 users), when error rate exceeds 5%, the test stops automatically; after any run (including after stop), every API-reported success has a matching correct record in the database (no loss or wrong data), and dashboard figures match DB aggregation even when some requests failed.
- **SC-006**: Test reports and/or artifacts allow an operator to determine the approximate RPS and concurrent-user level at which latency and error rate begin to exceed acceptable levels (e.g. P95 &gt; 500 ms or error rate &gt; 1%), and how the system behaves as the connection pool approaches exhaustion.
- **SC-007**: After each stage, merchant dashboard data (click counts, redemption counts, exchange history) matches direct DB aggregation with no cross-merchant leakage or concurrency-induced wrong totals.

---

## Assumptions

- Staging (or equivalent) environment is used for load tests; production is not the target of these tests.
- Each new stage runs in a totally clean environment: between stages, the env is reset so that no residual data from the previous stage remains. The known initial state is defined by a versioned seed (script or fixture); reset = clear redemptions + re-run that seed or restore a post-seed snapshot.
- The database used by the application is accessible for read-only (or dedicated) consistency queries after each run (e.g. staging DB).
- “Success” for a redemption is defined by the existing business rules (e.g. specific HTTP status and response body or status field); consistency checks align with that definition (e.g. status = 'success' or equivalent in persistence).
- Load-test configuration (base URL, spawn rate, duration, user counts) can be set per stage without code changes (e.g. config or command-line).
- Authentication: the load test uses a pre-created pool of test users (or tokens), with one identity per virtual user, so each simulated user has its own credentials; no single shared token for all users.
