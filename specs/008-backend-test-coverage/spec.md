# Feature Specification: Backend Test Coverage and Test Infrastructure

**Feature Branch**: `008-backend-test-coverage`  
**Created**: 2026-02-16  
**Status**: Draft  
**Input**: User description: Backend test coverage and test infrastructure for CouPro (Django backend). Document where tests live, how they are run, which endpoints are covered; establish full coverage and user-flow test expectations.

## Clarifications

### Session 2026-02-16

- Q: Where must the documented full-suite and subset test commands be written? → A: Backend README (e.g. `Backend/README.md`).
- Q: Where is the designated list of critical user flows maintained? → A: In this spec only (extend the list here when new critical flows are added).
- Q: What counts as "documented error behavior" for a route when requiring test coverage? → A: Any 4xx/5xx response that the test explicitly asserts (status and optionally body/headers).
- Q: Should the spec require a specific test result format or CI integration? → A: CI must run the full suite on every PR (or equivalent); no required output format.
- Q: Should the spec set a numeric target for full-suite run time? → A: No numeric target; keep "predictable/reasonable" (plan or CI may set timeouts separately).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Full Backend Test Suite (Priority: P1)

A developer or CI pipeline runs the entire backend automated test suite from a single, documented command. All tests execute and report pass/fail without manual setup of external services (SMS, email, storage are mocked or disabled in test mode). The run completes in a predictable time so that feedback is fast and CI stays reliable.

**Why this priority**: Without a single, reliable "run all backend tests" flow, regressions can slip through and releases are risky.

**Independent Test**: Run the documented full-suite command from the backend root; all tests pass and no external service calls are made.

**Acceptance Scenarios**:

1. **Given** the backend codebase and test configuration, **When** the documented full-suite command is run from the backend root, **Then** all tests in both project-level and app-level test modules execute and report results.
2. **Given** the test environment, **When** tests that involve SMS or email are run, **Then** no real SMS or email is sent (e.g., test mode or mocks are used).
3. **Given** a clean checkout, **When** a developer runs the full test suite, **Then** no manual fixture loading or external service credentials are required for the suite to run.

---

### User Story 2 - Run Subsets of Tests (Priority: P2)

A developer runs only app-level tests or only project-level (contract/integration) tests so they can iterate quickly on one area without running the full suite every time. The way to run each subset is documented and stable.

**Why this priority**: Faster feedback during development; full suite remains the source of truth for release.

**Independent Test**: Run the app-only command and the project-level-only command; each runs the expected subset and reports results.

**Acceptance Scenarios**:

1. **Given** the backend codebase, **When** the documented app-only test command is run, **Then** only tests under the API app test package execute.
2. **Given** the backend codebase, **When** the documented project-level test command is run, **Then** only tests under the project-level tests directory execute.
3. **Given** both subsets, **When** both commands are run in sequence, **Then** the combined set matches the full-suite command in scope.

---

### User Story 3 - Every Public API Route Has Test Coverage (Priority: P1)

Every public API and web route (excluding admin and documentation-only URLs) has at least one automated test that verifies expected success or documented error behavior. Gaps between "routes that exist" and "routes with tests" are known and tracked until closed.

**Why this priority**: Uncovered routes are the main source of undetected regressions and unclear contract.

**Independent Test**: A documented list or derivation of public routes is compared against tests; each route has at least one test that hits it.

**Acceptance Scenarios**:

1. **Given** the list of public API and web routes (e.g., from URL configuration), **When** coverage is assessed, **Then** each route is mapped to at least one test case (by route path and method where applicable).
2. **Given** a new public route added to the backend, **When** the test suite is updated, **Then** at least one test is added or updated to cover that route.
3. **Given** routes that require authentication or specific roles, **When** tests run, **Then** both authorized and unauthorized (or wrong-role) behavior are covered where relevant.

---

### User Story 4 - Critical User Flows Are Covered by Multi-Step Tests (Priority: P2)

Critical end-to-end flows (e.g., login with client type, phone OTP send and verify, QR session generate and claim, account deletion, template analytics) are covered by tests that perform multiple requests in sequence and assert on outcomes. These tests validate behavior across endpoints, not just a single request.

**Why this priority**: Single-endpoint tests can pass while real user journeys break; multi-step tests catch integration and ordering issues.

**Independent Test**: For each critical flow, at least one test runs the full sequence (e.g., generate session → claim → land on claim page) and asserts on final state or response.

**Acceptance Scenarios**:

1. **Given** a defined list of critical user flows (e.g., login, OTP verification, QR claim, account deletion), **When** the test suite runs, **Then** each flow has at least one multi-step test that exercises the flow and asserts on success or documented failure.
2. **Given** a critical flow that includes rate limits or idempotency, **When** tests run, **Then** edge cases (e.g., duplicate claim, rate limit) are covered where specified.
3. **Given** flows that depend on authenticated user or merchant, **When** tests run, **Then** authentication is established in the test (e.g., via test client) and the flow is asserted as that actor.

---

### User Story 5 - Test Organization and Discovery Are Clear (Priority: P3)

Tests are organized in two clear places: project-level tests (cross-cutting, contract, performance) and app-level tests (API app behavior). Naming and layout make it obvious where to add a new test and how the suite is discovered by the runner.

**Why this priority**: Reduces confusion and keeps the suite maintainable as the codebase grows.

**Independent Test**: A new developer can add a test in the correct location and have it run with the appropriate subset or full suite without special configuration.

**Acceptance Scenarios**:

1. **Given** the backend repository, **When** a developer looks at the test layout, **Then** they can identify which directory is for project-level tests and which is for app-level tests.
2. **Given** a new test file added in the correct directory with the project's naming convention, **When** the full-suite or subset command is run, **Then** the new tests are discovered and executed.
3. **Given** test data needs (users, stores, templates), **When** tests are written, **Then** data is set up in test setup (e.g., per-test or per-class) without relying on shared fixtures that are not part of the repo or docs.

---

### Edge Cases

- What happens when a test depends on an external service (SMS, email, storage) that is unavailable? Tests must not call real services; test configuration or mocks must ensure the suite is self-contained.
- How does the system handle tests that modify shared state (e.g., database)? Each test runs in a way that isolates state (e.g., rollback or separate DB) so that order and parallelism do not cause flakiness.
- What happens when a new route is added but no test is added? Coverage assessment or checklist should make the gap visible so it can be addressed before or with the change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend MUST provide a single, documented command that runs all automated tests (project-level and app-level) from the backend root. The command and subset commands MUST be documented in the Backend README (e.g. `Backend/README.md`).
- **FR-002**: The backend MUST support running only app-level tests via a documented command and only project-level tests via a documented command; both MUST be documented in the Backend README.
- **FR-003**: The test environment MUST NOT send real SMS or email when running the suite; test mode or mocks MUST be used for OTP and email.
- **FR-004**: Every public API and web route (excluding admin and documentation-only URLs) MUST have at least one automated test that exercises it and asserts on expected success or error behavior. Error behavior is documented by the test when it explicitly asserts on a 4xx or 5xx response (status code and, where relevant, body or headers).
- **FR-005**: Critical user flows (login with client type, phone OTP send/verify, QR session generate/claim, account deletion, template analytics, and any other flows designated critical) MUST have at least one multi-step test that runs the flow and asserts on outcome.
- **FR-006**: Tests MUST be discoverable by the runner from two designated locations: project-level tests directory and app-level tests package, with naming consistent with the runner's discovery rules.
- **FR-007**: Test data (users, stores, templates, etc.) MUST be created in test setup (e.g., in setUp or equivalent); no reliance on unversioned or undocumented shared fixtures for the default suite run.
- **FR-008**: Protected endpoints MUST be tested both with authorized access (correct user/role) and, where relevant, with unauthorized or wrong-role access to verify access control.
- **FR-009**: The full backend test suite MUST be run in CI on every PR (or equivalent trigger, e.g. push to main); no specific test output format is required.

### Key Entities

- **Public route**: An HTTP endpoint (path + method) exposed by the backend for API or web use, excluding admin and documentation-only URLs. Test coverage requires asserting on expected success and/or on 4xx/5xx responses (status and optionally body/headers) where applicable.
- **Critical user flow**: A sequence of API or web requests that represents a primary user or merchant journey (e.g., request OTP → verify OTP → update phone; generate QR session → claim coupon → view claim page). The list of flows designated as critical is maintained in this spec.
- **Project-level tests**: Tests that live outside the API app and cover cross-cutting behavior, contracts, or performance (e.g., QR claim E2E, login client type, phone OTP, template analytics).
- **App-level tests**: Tests that live inside the API app and cover that app's behavior (e.g., account deletion, other API app features).
- **Test suite**: The set of all tests run by the full-suite command; must be self-contained (no real external services) and deterministic.

## Assumptions

- The existing test runner and test client remain in use; the spec does not require a specific runner or framework, only that the above requirements are met with whatever runner is chosen.
- "Public routes" are defined by the project's URL configuration; admin and documentation (e.g., Swagger/ReDoc) routes are excluded from the coverage requirement.
- Critical flows are initially those already partially covered (login, OTP, QR claim, account deletion, template analytics). The designated list of critical user flows is maintained in this spec only; when new critical flows are designated, the list is extended here (e.g. in Assumptions or in the Critical user flow entity / FR-005).
- Test run time is not specified numerically; "predictable" means the suite completes in a reasonable time for local and CI use (e.g., no multi-minute timeouts per test unless justified). No numeric target is required in this spec; timeouts may be set in the implementation plan or in CI configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single documented command run from the backend root executes 100% of tests in both project-level and app-level locations and reports pass/fail without requiring real SMS, email, or external credentials.
- **SC-002**: 100% of public API and web routes (excluding admin and docs) are covered by at least one automated test that asserts on expected behavior.
- **SC-003**: Every critical user flow in the designated list has at least one multi-step test that runs the flow and asserts on success or documented failure.
- **SC-004**: Developers can run app-only or project-level-only test subsets via documented commands, and the union of those subsets equals the full suite.
- **SC-005**: New tests added in the correct directory with the project's naming convention are automatically discovered and run by the full-suite and relevant subset commands.
- **SC-006**: CI runs the full backend test suite on every PR (or equivalent); a failing test fails the CI run.
