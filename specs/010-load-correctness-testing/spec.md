# Feature Specification: Load and Correctness Testing for CouPro

**Feature Branch**: `010-load-correctness-testing`  
**Created**: 2026-02-23  
**Status**: Draft  
**Input**: User description defined load-test goals, assumptions, four test stages (1–50 merchants, 200–5000 users), and data consistency rules to ensure performance, availability, and business-logic correctness under load.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish Performance Baseline (Priority: P1)

Platform operators need to confirm that CouPro behaves predictably under typical campus traffic (e.g., single merchant, lunch-hour peak). The system must meet latency and error targets and record every redemption correctly.

**Why this priority**: Baseline stability is the precondition for all higher-load and multi-tenant scenarios.

**Independent Test**: Run Stage 1 (1 merchant, 200 users) and verify P95 latency under 500 ms, error rate under 1%, and that every successful redemption is reflected correctly in persistent storage.

**Acceptance Scenarios**:

1. **Given** one merchant and 200 simulated users browsing and redeeming, **When** the test runs to completion, **Then** P95 response time is under 500 ms.
2. **Given** the same run, **When** responses are counted, **Then** the error rate is under 1%.
3. **Given** any request that returns success to the client, **When** persistent storage is queried, **Then** a matching redemption record exists.

---

### User Story 2 - Verify Spike Handling and Business Rules (Priority: P1)

Operators need assurance that during a spike (e.g., limited-quantity campaign), the system never oversells coupons and never allows the same coupon to be redeemed twice.

**Why this priority**: Overselling or duplicate redemption directly violates business rules and trust.

**Independent Test**: Run Stage 2 (1 merchant, 1000 users) and verify that total redemptions do not exceed configured coupon limits and that each coupon identifier has at most one successful redemption.

**Acceptance Scenarios**:

1. **Given** limited-quantity coupons and 1000 users redeeming under load, **When** the test ends, **Then** total redemption count per coupon does not exceed the configured limit.
2. **Given** the same run, **When** redemption records are inspected by coupon identifier, **Then** each coupon has at most one successful redemption (no duplicate redemption).
3. **Given** the same run, **When** latency is measured, **Then** P95 remains under 500 ms where the system is still meeting the above rules.

---

### User Story 3 - Multi-Tenant Isolation and Query Performance (Priority: P2)

Operators need to confirm that with many merchants and users (e.g., multi-store district), each merchant’s data stays isolated and query performance remains within target.

**Why this priority**: Data isolation and stable query performance are required before scaling to more merchants and regions.

**Independent Test**: Run Stage 3 (50 merchants, 1500 users) and verify that redemptions and counts are correct per merchant and that P95 latency stays under 500 ms.

**Acceptance Scenarios**:

1. **Given** 50 merchants and 1500 users performing cross-merchant browsing and redemption, **When** the test ends, **Then** each merchant’s redemption total matches the sum of records for that merchant only (no cross-merchant leakage).
2. **Given** the same run, **When** platform-wide redemption totals are summed per merchant, **Then** the total equals the overall platform redemption count.
3. **Given** the same run, **When** response times are measured, **Then** P95 is under 500 ms.

---

### User Story 4 - Identify Scaling Limits Safely (Priority: P3)

Operators need to discover when the system begins to degrade (latency increase, error rate rise, or resource exhaustion) so they can plan capacity. Even under degradation, already-completed redemptions must remain correct and durable.

**Why this priority**: Informs infrastructure and scaling decisions without requiring the system to “pass” at maximum load.

**Independent Test**: Run Stage 4 (50 merchants, 5000 users) and record the point where latency degrades and error rate exceeds 1%; verify that every successful (client-success) redemption has a corresponding persistent record and that no overselling or duplicate redemption occurs.

**Acceptance Scenarios**:

1. **Given** 50 merchants and 5000 users, **When** load increases, **Then** the test reports the approximate request rate and time at which P95 latency begins to exceed 500 ms.
2. **Given** the same run, **When** errors are counted, **Then** the test reports when and at what load the error rate exceeds 1%.
3. **Given** any request that returns success to the client, **When** persistent storage is queried, **Then** a matching redemption record exists; limited coupons are not oversold and no coupon is redeemed more than once.

---

### Edge Cases

- What happens when redemption data is not reset between stages? (Requirement: reset between stages so coupon limits do not contaminate later stages.)
- How is correctness verified when the system is under heavy load or partially degraded? (Requirement: every client success must have a corresponding persistent record; oversell and duplicate-redemption rules still apply.)
- How are “success” and “error” defined for the error-rate target? (Assumption: success = client receives a successful outcome; error = client receives an error or no valid response.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform MUST be tested under defined load assumptions: P95 latency under 500 ms, error rate under 1%, throughput 5–20 RPS (normal to peak), 50 concurrent users (normal) and 200 (peak), with spawn rate and duration as defined per stage.
- **FR-002**: Stage 1 (1 merchant, 200 users) MUST establish a baseline where latency, error rate, and redemption correctness all meet targets.
- **FR-003**: Stage 2 (1 merchant, 1000 users) MUST verify that limited-quantity coupons are never oversold and that each coupon can be successfully redeemed at most once (idempotency of redemption).
- **FR-004**: Stage 3 (50 merchants, 1500 users) MUST verify that merchant data is isolated (no cross-merchant leakage) and that multi-tenant query performance meets the P95 latency target.
- **FR-005**: Stage 4 (50 merchants, 5000 users) MUST be used to identify scaling limits (when latency degrades and when error rate exceeds 1%); the stage need not “pass” all targets but MUST ensure that every successful redemption is durable and that oversell and duplicate-redemption rules are never violated.
- **FR-006**: After each stage, redemption data MUST be reset so that coupon availability does not affect the next stage’s results.
- **FR-007**: The following consistency rules MUST be verified after testing: (1) total redemptions per coupon ≤ configured limit, (2) each coupon identifier has at most one successful redemption in persistent storage, (3) per-merchant redemption totals sum to platform totals with no cross-merchant mixing, (4) every request that returns success to the client has a corresponding record in persistent storage.

### Key Entities

- **Test stage**: A defined scenario (merchant count, user count, duration, spawn rate) with specific verification goals (latency, error rate, consistency rules).
- **Redemption**: A single successful use of a coupon by a user; must be persisted and must respect limit and idempotency rules.
- **Coupon (limited-quantity)**: A coupon with a finite redemption limit; total successful redemptions must never exceed this limit.

## Assumptions

- Latency target: P95 under 500 ms.
- Error rate target: under 1%.
- Throughput: 5–20 RPS (normal to peak); concurrent users 50 (normal) / 200 (peak).
- Spawn rate and test duration: 5–50 users/sec and 5–10 minutes per stage as appropriate.
- “Success” for error-rate calculation means the client receives a successful outcome; “error” means the client receives an error or no valid response.
- Consistency rules (no oversell, no duplicate redemption, merchant isolation, API-success implies DB record) apply in all stages regardless of load.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Under Stage 1 load, users experience P95 response time under 500 ms and the system reports an error rate under 1%.
- **SC-002**: Under Stage 2 spike load, limited-quantity coupons are never oversold and each coupon has at most one successful redemption in persistent storage.
- **SC-003**: Under Stage 3 multi-tenant load, each merchant’s redemption data is correct and isolated, and P95 latency remains under 500 ms.
- **SC-004**: Stage 4 identifies the approximate load (request rate and concurrency) at which P95 exceeds 500 ms and at which error rate exceeds 1%, while all successful redemptions remain correct and durable (no oversell, no duplicate redemption).
- **SC-005**: After every stage, consistency checks pass: redemption totals ≤ limits, one redemption per coupon, merchant totals sum to platform total, and every client success has a matching persistent record.
