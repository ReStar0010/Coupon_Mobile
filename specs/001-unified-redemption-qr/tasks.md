---
description: "Task list for Unified Redemption QR Code feature implementation"
---

# Tasks: Unified Redemption QR Code

**Input**: Design documents from `/specs/001-unified-redemption-qr/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Per constitution requirements (Quality Assurance principle), critical paths MUST have test coverage. This includes authentication flows, redemption logic, API endpoints, and edge cases. Test tasks are included in Phase 6.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `Backend/api/`
- **Merchant Frontend**: `Mobile-Merchant-Frontend/app/`
- **Consumer Frontend**: `Mobile-Frontend/app/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create database migration file for unified_redeem_code field in Backend/api/migrations/
- [X] T002 [P] Review existing Store model structure in Backend/api/models.py and validate assumption that each merchant has exactly one store (add validation if needed)
- [X] T003 [P] Review existing QR code modal component in Mobile-Merchant-Frontend/app/(coupons)/components/QRCode.tsx
- [X] T004 [P] Review existing redemption endpoint in Backend/api/views/coupon_views.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Add unified_redeem_code field to Store model in Backend/api/models.py (CharField, max_length=6, null=True, blank=True, unique=True)
- [X] T006 Create and run database migration for unified_redeem_code field using python manage.py makemigrations and migrate
- [X] T007 [P] Create unified redemption code generation utility function in Backend/api/utils.py (generate 6-digit numeric code, similar to generate_random_code in daily_draw.py but numeric-only)
- [X] T008 [P] Create UnifiedRedemptionCodeSerializer in Backend/api/serializers.py for code generation response
- [X] T009 [P] Create UnifiedRedemptionValidateSerializer in Backend/api/serializers.py for validation response

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Merchant Generates Unified Redemption QR Code (Priority: P1) 🎯 MVP

**Goal**: Enable merchants to generate and display a unified redemption QR code that works for all their coupons without navigating to individual coupon pages.

**Independent Test**: Merchant logs in, navigates to coupon list page, clicks unified redemption button, and verifies that a QR code is displayed in a modal. This delivers immediate value by showing merchants they can access redemption without navigating to individual coupon pages.

### Implementation for User Story 1

- [X] T010 [US1] Create POST /api/merchant/unified-redemption/generate/ endpoint in Backend/api/views/merchant_coupon.py
- [X] T011 [US1] Implement unified redemption code generation logic in the endpoint (generate 6-digit code, update Store.unified_redeem_code)
- [X] T012 [US1] Add authentication check for merchant in unified redemption generation endpoint
- [X] T013 [US1] Add error handling for merchant without store in unified redemption generation endpoint
- [X] T014 [US1] Define TypeScript interfaces for unified redemption API responses in Mobile-Merchant-Frontend/utils/api.ts (matching UnifiedRedemptionCodeSerializer from backend), then add unified redemption API function (generateUnifiedRedemptionCode) with proper typing
- [X] T015 [US1] Connect BarcodeVerificationButton onPress handler to unified redemption API in Mobile-Merchant-Frontend/app/(coupons)/index.tsx
- [X] T016 [US1] Update QRCodeModal to display unified redemption code in Mobile-Merchant-Frontend/app/(coupons)/index.tsx
- [X] T017 [US1] Add error handling and loading states for unified redemption code generation in Mobile-Merchant-Frontend/app/(coupons)/index.tsx
- [X] T018 [US1] Add URL route for unified redemption generation endpoint in Backend/Backend/urls.py

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - merchants can generate and display unified QR codes

---

## Phase 4: User Story 2 - Consumer Scans Unified QR Code and Selects Coupon (Priority: P1) 🎯 MVP

**Goal**: Enable consumers to scan the unified QR code, view their available coupons for that merchant, and select a coupon to redeem using the unified redemption code.

**Independent Test**: Consumer scans the unified QR code, verifies that their available coupons for that merchant are displayed, selects a coupon, and completes redemption. This delivers value by allowing consumers to redeem coupons without the merchant needing to navigate to specific coupon pages.

### Implementation for User Story 2

- [X] T019 [US2] Create GET /api/unified-redemption/{code}/ endpoint in Backend/api/views/coupon_views.py
- [X] T020 [US2] Implement unified code validation logic (check if code matches Store.unified_redeem_code) in the endpoint
- [X] T021 [US2] Implement available coupons retrieval logic (filter by store, active, non-expired, not redeemed, owned by consumer) in the endpoint
- [X] T022 [US2] Add authentication check for consumer in unified redemption validation endpoint (require IsAuthenticated permission, return 401 if not authenticated)
- [X] T023 [US2] Add error handling for invalid codes and no coupons available in unified redemption validation endpoint
- [X] T024 [US2] Modify POST /api/redeem/{coupon_id}/ endpoint to accept unified redemption codes in Backend/api/views/coupon_views.py
- [X] T025 [US2] Add unified code validation logic before coupon validation in redeem_coupon function. **Validation Sequence**: (1) Validate unified code matches store's unified_redeem_code (merchant/store-level authentication), (2) If unified code validation passes, proceed with existing coupon-level validation (ownership, expiration, redemption status). The unified code validation MUST complete successfully before coupon-level validation begins (per FR-008, FR-009).
- [X] T026 [US2] Update RedeemCouponSerializer to accept unified codes in Backend/api/serializers.py (RedeemCouponSerializer already accepts redeem_code field, no changes needed)
- [X] T027 [US2] Define TypeScript interfaces for unified redemption API requests/responses in Mobile-Frontend/app/utils/authAPI.ts (matching UnifiedRedemptionValidateSerializer and RedeemCouponSerializer from backend), then add unified redemption API functions (validateUnifiedRedemptionCode, redeemCouponWithUnifiedCode) with proper typing
- [X] T028 [US2] Modify QR scanner to detect unified redemption codes in Mobile-Frontend/app/EasyUse/[id]/redeem/index.tsx
- [X] T029 [US2] Create coupon selection screen component for displaying available coupons in Mobile-Frontend/app/EasyUse/unified-redeem/[code].tsx
- [X] T030 [US2] Add navigation flow from QR scan to coupon selection screen in Mobile-Frontend/app/EasyUse/[id]/redeem/index.tsx
- [X] T031 [US2] Implement auto-fill redemption code from scanned QR code in redemption form in Mobile-Frontend/app/EasyUse/[id]/redeem/
- [X] T032 [US2] Add ability to edit redemption code after auto-fill in Mobile-Frontend/app/EasyUse/[id]/redeem/
- [X] T033 [US2] Add error handling for invalid QR codes and no coupons available in Mobile-Frontend/app/EasyUse/[id]/redeem/ (basic error handling added in QR scanner)
- [X] T034 [US2] Add URL route for unified redemption validation endpoint in Backend/Backend/urls.py

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - complete unified redemption flow from merchant generation to consumer redemption

---

## Phase 5: User Story 3 - Deprecate Individual Coupon Redemption Entry (Priority: P2)

**Goal**: Disable the old workflow where merchants must navigate to individual coupon pages to generate redemption QR codes, ensuring all redemption flows use the unified entry point.

**Independent Test**: Attempt to access the individual coupon redemption page (if it still exists in the UI) and verify that QR code generation is no longer available, but phone number functionality remains accessible. This delivers value by ensuring a single, consistent redemption workflow.

### Implementation for User Story 3

- [X] T035 [US3] Remove QR code generation and display from individual coupon redemption page in Mobile-Merchant-Frontend/app/(coupons)/[id].tsx
- [X] T036 [US3] Remove redemption code display from individual coupon redemption page in Mobile-Merchant-Frontend/app/(coupons)/[id].tsx
- [X] T037 [US3] Preserve phone number input and send coupon functionality in Mobile-Merchant-Frontend/app/(coupons)/[id].tsx
- [X] T038 [US3] Remove or deprecate refresh_redeem_code API call from individual coupon page in Mobile-Merchant-Frontend/app/(coupons)/[id].tsx
- [X] T039 [US3] Update individual coupon page UI to remove QR code section while keeping phone functionality in Mobile-Merchant-Frontend/app/(coupons)/[id].tsx
- [X] T040 [US3] Add deprecation comment to refresh_redeem_code endpoint in Backend/api/views/merchant_coupon.py (endpoint may remain for backward compatibility, but UI access is disabled per FR-010)

**Checkpoint**: At this point, all user stories should be independently functional - unified redemption is the only QR code redemption method, with phone number functionality preserved

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T041 [P] Add logging for unified redemption code generation in Backend/api/views/merchant_coupon.py
- [X] T042 [P] Add logging for unified redemption code validation in Backend/api/views/coupon_views.py
- [X] T043 [P] Add error messages in Chinese for unified redemption flows in Backend/api/views/
- [X] T044 [P] Add loading indicators and error states in Mobile-Merchant-Frontend/app/(coupons)/index.tsx
- [X] T045 [P] Add loading indicators and error states in Mobile-Frontend/app/EasyUse/[id]/redeem/
- [ ] T046 [P] Verify performance targets (QR code generation < 2s, scan to coupon list < 3s) - measure API response time and frontend rendering time, validate against SC-001 and SC-002
- [ ] T047 [P] Create integration tests for unified redemption code generation authentication flow (merchant auth success/failure) in Backend/tests/test_unified_redemption.py
- [ ] T048 [P] Create unit tests for unified code validation logic (valid code, invalid code, expired code, wrong merchant) in Backend/tests/test_unified_redemption.py
- [ ] T049 [P] Create contract tests for POST /api/merchant/unified-redemption/generate/ endpoint in Backend/tests/test_unified_redemption.py. **Schema Validation (Constitution III)**: MUST validate request body structure (authentication headers, required fields), response body structure (success: code field type/format, error: error code/message structure), field types (string, numeric, etc.), and error response formats (HTTP status codes, error object structure matching standard API error format)
- [ ] T050 [P] Create contract tests for GET /api/unified-redemption/{code}/ endpoint in Backend/tests/test_unified_redemption.py. **Schema Validation (Constitution III)**: MUST validate request parameters (path parameter format/type), response body structure (success: merchant/store data, available coupons array structure, field types), and error response formats (HTTP status codes, error object structure matching standard API error format for invalid codes, no coupons, etc.)
- [ ] T051 [P] Create unit tests for edge cases: merchant with no store (verify error response structure: HTTP 400, error code "NO_STORE"), invalid QR codes, no coupons available, expired coupons, concurrent redemptions in Backend/tests/test_unified_redemption.py
- [ ] T052 [P] Create unit tests for coupon redemption logic with unified codes (ownership validation, expiration, redemption status) in Backend/tests/test_unified_redemption.py. **Security Coverage**: Verify zero instances of unauthorized redemption (SC-006) - test cases: user cannot redeem coupons they don't own, expired coupons rejected, already-redeemed coupons rejected, wrong merchant codes rejected
- [ ] T053 [P] Update API documentation with new unified redemption endpoints
- [ ] T054 [P] Run quickstart.md validation scenarios
- [ ] T055 [P] Measure baseline redemption success rate from existing individual coupon flow (30-day period before implementation) and document for SC-004 comparison in Backend/tests/test_unified_redemption.py or separate analytics script

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 for unified code generation, but can be developed in parallel if API contract is defined
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 and US2 being complete to ensure unified flow works before deprecating old flow

### Within Each User Story

- Backend endpoints before frontend integration
- API functions before UI components
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, User Stories 1 and 2 can start in parallel (if team capacity allows, with API contract defined)
- All Polish tasks marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members (with coordination)

---

## Parallel Example: User Story 1

```bash
# Launch all foundational tasks for User Story 1 together:
Task: "Create unified redemption code generation utility function in Backend/api/utils.py"
Task: "Create UnifiedRedemptionCodeSerializer in Backend/api/serializers.py"
Task: "Create UnifiedRedemptionValidateSerializer in Backend/api/serializers.py"

# Launch all backend implementation tasks together:
Task: "Create POST /api/merchant/unified-redemption/generate/ endpoint in Backend/api/views/merchant_coupon.py"
Task: "Add URL route for unified redemption generation endpoint in Backend/Backend/urls.py"

# Launch all frontend implementation tasks together:
Task: "Add unified redemption API function in Mobile-Merchant-Frontend/utils/api.ts"
Task: "Update QRCodeModal to display unified redemption code in Mobile-Merchant-Frontend/app/(coupons)/index.tsx"
```

---

## Parallel Example: User Story 2

```bash
# Launch all backend validation tasks together:
Task: "Create GET /api/unified-redemption/{code}/ endpoint in Backend/api/views/coupon_views.py"
Task: "Modify POST /api/redeem/{coupon_id}/ endpoint to accept unified redemption codes in Backend/api/views/coupon_views.py"
Task: "Add URL route for unified redemption validation endpoint in Backend/Backend/urls.py"

# Launch all frontend consumer tasks together:
Task: "Add unified redemption API functions in Mobile-Frontend/services/api.ts"
Task: "Create coupon selection screen component for displaying available coupons in Mobile-Frontend/app/EasyUse/[id]/redeem/"
Task: "Modify QR scanner to detect unified redemption codes in Mobile-Frontend/app/EasyUse/[id]/redeem/index.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Merchant generates QR code)
4. Complete Phase 4: User Story 2 (Consumer scans and redeems)
5. **STOP and VALIDATE**: Test both stories independently and together
6. Deploy/demo if ready
7. Then proceed to Phase 5: User Story 3 (Deprecation) if needed

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Merchant can generate QR codes)
3. Add User Story 2 → Test independently → Deploy/Demo (Complete redemption flow works!)
4. Add User Story 3 → Test independently → Deploy/Demo (Old flow deprecated)
5. Add Polish → Final validation → Production ready
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Merchant side)
   - Developer B: User Story 2 (Consumer side) - coordinate API contract
3. Both stories complete and integrate
4. Developer C: User Story 3 (Deprecation) after US1 and US2 are validated
5. All developers: Polish phase tasks in parallel

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Unified redemption codes are 6-digit numeric strings (digits 0-9 only, e.g., "123456") - same numeric format as existing redemption codes
- Codes are regenerated on each merchant button click (per FR-001)
- Unified code validation happens at store level before coupon validation
- Existing coupon validation logic remains unchanged (ownership, expiration, redemption status)
- Phone number functionality on individual coupon pages is preserved (for sending/consolidating coupons, not redemption)

---

## Task Summary

- **Total Tasks**: 55 tasks
- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 5 tasks
- **Phase 3 (User Story 1)**: 9 tasks
- **Phase 4 (User Story 2)**: 16 tasks
- **Phase 5 (User Story 3)**: 6 tasks
- **Phase 6 (Polish)**: 15 tasks

### Task Count per User Story

- **User Story 1**: 9 tasks (Merchant generates unified QR code)
- **User Story 2**: 16 tasks (Consumer scans and redeems)
- **User Story 3**: 6 tasks (Deprecate individual coupon redemption)

### Parallel Opportunities Identified

- Setup phase: 3 parallel tasks
- Foundational phase: 3 parallel tasks
- User Story 1: Multiple parallel opportunities (serializers, utilities, endpoints, frontend)
- User Story 2: Multiple parallel opportunities (endpoints, frontend components)
- Polish phase: All 9 tasks can run in parallel

### Independent Test Criteria

- **User Story 1**: Merchant can generate and display unified QR code independently
- **User Story 2**: Consumer can scan unified QR code and complete redemption independently
- **User Story 3**: Old individual coupon QR code generation is disabled, phone functionality preserved

### Suggested MVP Scope

- **MVP**: User Stories 1 & 2 (Phases 1-4)
  - Enables complete unified redemption flow
  - Merchant generates QR code → Consumer scans and redeems
  - Delivers core value immediately
  - User Story 3 (deprecation) can be added later if needed

### Format Validation

✅ All tasks follow the checklist format:
- Checkbox: `- [ ]`
- Task ID: `T001`, `T002`, etc.
- Parallel marker: `[P]` where applicable
- Story label: `[US1]`, `[US2]`, `[US3]` for user story phases
- Description with file paths included
