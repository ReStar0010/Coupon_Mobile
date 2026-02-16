# Tasks: Backend Test Coverage and Test Infrastructure

**Input**: Design documents from `specs/008-backend-test-coverage/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-routes.md, quickstart.md

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[USn]**: User story (US1–US5) from spec.md
- Include exact file paths in descriptions

## Path Conventions

- Backend root: `Backend/` (contains `manage.py`)
- Project-level tests: `Backend/tests/`
- App-level tests: `Backend/api/tests/`
- Route list: `specs/008-backend-test-coverage/contracts/public-routes.md`

---

## Phase 1: Setup (Shared Infrastructure)

*Implementation Phase 1 — distinct from the plan’s "Design Phase 1" (data-model, quickstart, contracts).*

**Purpose**: Ensure Backend has a README and test layout so documentation and coverage tasks can proceed.

- [x] T001 Create or verify Backend/README.md exists at Backend/README.md with a minimal project title and description so test commands can be added in later phases.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the full test suite runs and test environment does not call real external services. Must be true before documenting commands or adding coverage.

- [x] T002 Run full suite from Backend root: `python manage.py test api tests`; fix any failing tests or import errors so the command exits 0 with current tests.
- [x] T003 Verify test configuration ensures no real SMS/email: check Backend/Backend/settings.py or Backend/Backend/test_settings.py for SMS_DEV_MODE or equivalent and confirm OTP tests use it (e.g. Backend/tests/test_phone_otp.py).

**Checkpoint**: Foundation ready — documentation and coverage tasks can proceed.

---

## Phase 3: User Story 1 – Run Full Backend Test Suite (Priority: P1) – MVP

**Goal**: A single, documented command runs all backend tests from Backend root; no real SMS/email; no manual fixtures or credentials required.

**Independent Test**: Run the documented full-suite command from Backend root; all tests pass and no external service calls are made.

- [x] T004 [US1] Add "Running tests" section to Backend/README.md documenting the full-suite command: `python manage.py test api tests` (run from Backend root), and note that no real SMS/email is sent (test mode/mocks).

**Checkpoint**: User Story 1 complete — full-suite command is documented and runnable.

---

## Phase 4: User Story 2 – Run Subsets of Tests (Priority: P2)

**Goal**: Documented commands to run app-only and project-level-only tests; union of both equals full suite.

**Independent Test**: Run app-only and project-level-only commands; each runs the expected subset; running both in sequence matches full-suite scope.

- [x] T005 [US2] In Backend/README.md add app-only command `python manage.py test api` and project-level-only command `python manage.py test tests` (run from Backend root), in the same "Running tests" section as T004.

**Checkpoint**: User Story 2 complete — subset commands documented.

---

## Phase 5: User Story 3 – Every Public API Route Has Test Coverage (Priority: P1)

**Goal**: Every route in contracts/public-routes.md has at least one test that exercises it and asserts on success or 4xx/5xx. Protected routes have authorized and (where relevant) unauthorized/wrong-role tests.

**Independent Test**: Compare contracts/public-routes.md to test modules; each listed route is hit by at least one test with appropriate assertions.

- [x] T006 [P] [US3] Add tests for authentication and token routes (api/register/, api/login/, api/logout/, api/token/refresh/, api/verify-email/, api/forgot-password/, api/reset-password/) in Backend/tests/test_auth_routes.py or Backend/api/tests/; assert success and relevant 4xx/5xx where applicable.
- [x] T007 [P] [US3] Add tests for merchant auth/redirect routes (api/merchant/verify-email/, api/merchant/resend-verification/, api/merchant/redirect/verify-email, api/merchant/redirect/reset-password) in Backend/tests/ or Backend/api/tests/; assert success and 4xx where applicable.
- [x] T008 [P] [US3] Add tests for coupon and store endpoints (api/store-coupons/, api/exclusive-coupons/, api/coupons/<id>/, api/redeem/<id>/, api/unified-redemption/<code>/) in Backend/tests/test_coupon_routes.py or Backend/api/tests/; include auth/unauth for protected routes.
- [x] T009 [P] [US3] Add tests for sharing and collection/claim landing routes (api/coupon/<id>/share/, api/coupon/share/<token>/, api/coupon/share/<token>/accept/, collection/<token>/, c/<token>/, claim/<token>/, cl/<token>/) in Backend/tests/ or Backend/api/tests/; assert success and 4xx where applicable.
- [x] T010 [P] [US3] Add tests for user profile and statistics routes (api/user-info/, api/user-statistics/, api/set-savings-goal/, api/reset-savings-goal/, api/completed-goals/, api/add-completed-goal/, api/coupon-history/, api/coupon-history/<id>/) in Backend/tests/ or Backend/api/tests/; use force_authenticate for user routes and assert 401/403 when unauthenticated.
- [x] T011 [P] [US3] Add tests for daily draw and events (api/daily-draw-templates/, api/coupon/daily-draw/, api/coupon/draw-history/, api/last-draw/, api/events/template-view/) in Backend/tests/ or Backend/api/tests/; include auth where required.
- [x] T012 [P] [US3] Add tests for merchant coupon templates and operations (api/merchant/coupon-templates/, api/merchant/coupon-templates/<id>/, create/update/delete, api/merchant/consolidate-coupon/, api/merchant/refresh_redeem_code/, api/merchant/redeem/, api/merchant/unified-redemption/generate/, api/merchant/upload-image/, api/tags/) in Backend/tests/ or Backend/api/tests/; use merchant auth and assert 403 for non-merchant.
- [x] T013 [P] [US3] Add tests for merchant profile and account (api/merchant/profile/, api/merchant/profile/update/, api/merchant/statistics/, api/merchant/account/pre-delete-check/, api/merchant/account/delete/, api/merchant/account/deletion-status/) in Backend/tests/ or Backend/api/tests/; cover authorized and unauthorized access.
- [x] T014 [P] [US3] Add tests for well-known and ping (api/ping/, .well-known/apple-app-site-association, .well-known/assetlinks.json) in Backend/tests/test_wellknown_ping.py or Backend/api/tests/; assert 200 and expected body/headers where applicable.
- [x] T015 [P] [US3] Add tests for UGC/content and EULA routes (api/content/.../report/, api/content/.../report/status/, api/user/reports/, api/user/blocked-merchants/, api/store/<id>/block-status/, api/merchant/eula/status/, api/merchant/eula/accept/, api/merchant/eula/content/, api/content-guidelines/, api/privacy-policy/) in Backend/tests/ or Backend/api/tests/; use appropriate auth and assert 4xx where applicable.
- [x] T016 [P] [US3] Add tests for admin moderation routes (api/admin/moderation/queue/, api/admin/moderation/reports/<id>/; reports/<id>/action/; escalations/; merchants/<id>/violations/; stats/) in Backend/tests/ or Backend/api/tests/; use admin/staff auth and assert 403 for non-admin.

**Checkpoint**: User Story 3 complete — all public routes in contracts/public-routes.md have at least one test with success or 4xx/5xx assertions; protected routes have auth/unauth coverage. Verify all new tests use setUp (or equivalent) for data and do not rely on unversioned fixtures (FR-007).

---

## Phase 6: User Story 4 – Critical User Flows Multi-Step Tests (Priority: P2)

**Goal**: Each critical flow (login with client_type, OTP send/verify, QR session generate/claim + claim landing, account deletion, template analytics) has at least one multi-step test that runs the sequence and asserts on outcome.

**Independent Test**: For each critical flow, run the test suite and confirm at least one test exercises the full sequence and asserts success or documented failure.

- [x] T017 [US4] Verify or add multi-step test for login with client_type (user/merchant) in Backend/tests/test_login_client_type.py; test sequence: POST api/login/ with client_type, assert success or 403 as specified.
- [x] T018 [US4] Verify or add multi-step test for phone OTP flow (send → verify → GET/PUT/DELETE api/user/phone/) in Backend/tests/test_phone_otp.py; assert success and rate-limit/error cases where specified.
- [x] T019 [US4] Verify or add multi-step test for QR claim flow (generate session → claim → GET claim landing) in Backend/tests/contract/test_qr_claim.py; assert final state or response.
- [x] T020 [US4] Verify or add multi-step test for account deletion (GET pre-delete-check → POST delete with password) in Backend/api/tests/test_account_deletion.py; assert anonymization and 403 where applicable.
- [x] T021 [US4] Verify or add multi-step test for template analytics (merchant auth → GET api/merchant/coupon-templates/<id>/analytics/) in Backend/tests/contract/test_template_analytics.py; assert response schema and count fields.

**Checkpoint**: User Story 4 complete — all five critical flows have at least one multi-step test. Verify multi-step tests use setUp for data and do not rely on unversioned fixtures (FR-007).

---

## Phase 7: User Story 5 – Test Organization and Discovery (Priority: P3)

**Goal**: Test layout and naming are documented so a developer knows where to add a test and how it is discovered.

**Independent Test**: A new developer can add a test in the correct directory with the project naming convention and have it run with the full-suite or subset command.

- [x] T022 [US5] In Backend/README.md add a "Test organization" section: document Backend/tests/ (project-level, cross-cutting/contract/E2E) and Backend/api/tests/ (app-level); state that Django discovers test_*.py and test_* methods; reference quickstart at specs/008-backend-test-coverage/quickstart.md for "how to add a test."

**Checkpoint**: User Story 5 complete — test organization is documented.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: CI integration and final validation per FR-009 and SC-006.

- [x] T023 Add or update CI workflow to run the full backend test suite on every PR (e.g. GitHub Actions workflow under .github/workflows/ or equivalent); command: `cd Backend && python manage.py test api tests`; ensure a failing test fails the run.
- [x] T024 Run full suite from Backend root (`python manage.py test api tests`) and confirm all tests pass; fix any regressions introduced by new tests.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — create/verify Backend/README.md.
- **Phase 2 (Foundational)**: Depends on Phase 1 — ensures suite runs and test env is self-contained; blocks all later phases.
- **Phase 3 (US1)**: Depends on Phase 2 — document full-suite command.
- **Phase 4 (US2)**: Depends on Phase 3 — document subset commands in same README section.
- **Phase 5 (US3)**: Depends on Phase 2 — add route coverage; tasks T006–T016 can be parallelized.
- **Phase 6 (US4)**: Depends on Phase 2 — verify/add multi-step tests; can run in parallel with Phase 5 (different files).
- **Phase 7 (US5)**: Depends on Phase 3/4 — document test organization in README.
- **Phase 8 (Polish)**: Depends on Phases 3–7 — CI job and full-suite validation.

### User Story Dependencies

- **US1 (P1)**: After Foundational — documents full-suite; no dependency on other stories.
- **US2 (P2)**: After US1 — documents subsets in same README.
- **US3 (P1)**: After Foundational — route coverage; independent of US1/US2/US4/US5.
- **US4 (P2)**: After Foundational — multi-step tests; independent of US3.
- **US5 (P3)**: After US1/US2 — extends README with test organization.

### Parallel Opportunities

- T006–T016 (US3 route coverage): Each touches different route groups/files; can be parallelized.
- T017–T021 (US4): Each touches a different test file; can be parallelized after Foundational.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002, T003).
3. Complete Phase 3: US1 (T004) — document full-suite command.
4. **STOP and VALIDATE**: Run `python manage.py test api tests` from Backend; confirm README matches.

### Incremental Delivery

1. Setup + Foundational → suite runs and env verified.
2. US1 → full-suite documented (MVP).
3. US2 → subset commands documented.
4. US3 → route coverage (can be split by route group).
5. US4 → critical flow multi-step tests verified/added.
6. US5 → test organization documented.
7. Polish → CI and final run.

---

## Notes

- [P] tasks use different files and can run in parallel.
- [USn] maps each task to a user story for traceability.
- Route coverage (US3) may require multiple test files; place under Backend/tests/ or Backend/api/tests/ per plan (project-level for cross-cutting, app-level for API app behavior).
- **FR-007 (test data)**: Tasks T006–T016 and T017–T021 MUST create test data in setUp (or per-test/per-class setup). No reliance on unversioned or undocumented shared fixtures for the default suite run. When adding or changing tests in those tasks, verify that the suite can run from a clean checkout without external fixture files or manual data load.
- Protected endpoints: include both authorized and unauthorized/wrong-role tests (FR-008).
