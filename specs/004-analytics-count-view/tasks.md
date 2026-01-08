---
description: "Task list template for feature implementation"
---

# Tasks: Analytics Count View

**Input**: Design documents from `/specs/004-analytics-count-view/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Contract tests are REQUIRED per constitution (constitution.md:68). Tests must be implemented before feature completion.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `Backend/api/`, `Backend/tests/`
- **Frontend**: `Mobile-Merchant-Frontend/app/(coupons)/`, `Mobile-Merchant-Frontend/utils/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 [P] Create contract tests directory structure in Backend/tests/contract/ if it doesn't exist
- [X] T002 [P] Verify existing test infrastructure (pytest, DRF APIClient) is available in Backend/tests/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Extend backend API response structure to include count fields in Backend/api/views/merchant_coupon.py (get_template_analytics function)
- [X] T004 [P] Update TypeScript interfaces to include count fields in Mobile-Merchant-Frontend/utils/api.ts (AnalyticsData interface)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Statistics as Counts (Priority: P1) 🎯 MVP

**Goal**: Enable merchants to view template analytics metrics as absolute counts (張數) instead of percentages by navigating to a new count view page.

**Independent Test**: Navigate to template analytics page, tap count view toggle switch, verify all five metrics (留客數, 陌生獲客數, 核銷數, 流動數, 流動核銷數) display as counts with appropriate labels. Time range selector should update count values correctly.

### Tests for User Story 1 (REQUIRED per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T005 [P] [US1] Create contract test file Backend/tests/contract/test_template_analytics.py
- [X] T006 [P] [US1] Add contract test for exclusive template API response includes count fields (retention_count, stranger_acquisition_count, redemption_count, circulation_count, circulation_redemption_count) in Backend/tests/contract/test_template_analytics.py
- [X] T007 [P] [US1] Add contract test for store template API response excludes exclusive-only count fields in Backend/tests/contract/test_template_analytics.py
- [X] T008 [P] [US1] Add contract test for count field types are integers >= 0 in Backend/tests/contract/test_template_analytics.py
- [X] T009 [P] [US1] Add contract test for trend daily_data contains count values for count metrics in Backend/tests/contract/test_template_analytics.py

### Implementation for User Story 1

- [X] T010 [US1] Add retention_count field to API response (use consolidate_redemption_count) in Backend/api/views/merchant_coupon.py
- [X] T011 [US1] Add stranger_acquisition_count field to API response (use non_consolidate_redemption_count) in Backend/api/views/merchant_coupon.py
- [X] T012 [US1] Add redemption_count field to API response (use exclusive_redemptions_count) in Backend/api/views/merchant_coupon.py
- [X] T013 [US1] Add circulation_count field to API response (use transfer_count) in Backend/api/views/merchant_coupon.py
- [X] T014 [US1] Add circulation_redemption_count field to API response (use transfer_redemption_count) in Backend/api/views/merchant_coupon.py
- [X] T015 [US1] Update trend daily_data calculation to include count values for retention_rate trend in Backend/api/views/merchant_coupon.py
- [X] T016 [US1] Update trend daily_data calculation to include count values for stranger_acquisition_rate trend in Backend/api/views/merchant_coupon.py
- [X] T017 [US1] Update trend daily_data calculation to include count values for circulation_rate trend in Backend/api/views/merchant_coupon.py
- [X] T018 [US1] Update trend daily_data calculation to include count values for circulation_redemption_rate trend in Backend/api/views/merchant_coupon.py
- [X] T019 [US1] Update trend daily_data calculation to include count values for redemption_rate trend in Backend/api/views/merchant_coupon.py
- [X] T020 [US1] Add count fields to AnalyticsData TypeScript interface in Mobile-Merchant-Frontend/app/(coupons)/template-analytics.tsx
- [X] T021 [US1] Add toggle switch component (labeled "張數" / "百分比") positioned above time range selector, below page title in Mobile-Merchant-Frontend/app/(coupons)/template-analytics.tsx
- [X] T022 [US1] Implement navigation to count view page on toggle switch change using router.push('/template-analytics-count/:id') in Mobile-Merchant-Frontend/app/(coupons)/template-analytics.tsx
- [X] T023 [US1] Create new count view page route file Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T024 [US1] Copy page structure from template-analytics.tsx to template-analytics-count.tsx in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T025 [US1] Update metric labels to show count labels (留客數, 陌生獲客數, 核銷數, 流動數, 流動核銷數) instead of rate labels in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T026 [US1] Display count fields instead of rate fields in metric cards in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T027 [US1] Format count values with toLocaleString('zh-TW') for thousand separators in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T028 [US1] Handle zero count values by displaying "0" without errors in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T029 [US1] Update MetricCard component to display count values (not percentages) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T030 [US1] Ensure time range selector updates count values correctly when days parameter changes in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Merchants can navigate to count view and see all metrics as counts.

---

## Phase 4: User Story 2 - Consistent Page Layout and Navigation (Priority: P2)

**Goal**: Ensure the count view page maintains the same layout, styling, and navigation patterns as the percentage view page for consistency and ease of use.

**Independent Test**: Compare count view page layout with percentage view page - both should have the same header, time range selector, metric card layout, and trend chart section structure. Trend chart should display count values with appropriate y-axis labels.

### Implementation for User Story 2

- [X] T031 [US2] Ensure count view page header matches percentage view structure (title, spacing, styling) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T032 [US2] Ensure time range selector matches percentage view styling and positioning in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T033 [US2] Ensure metric cards grid layout matches percentage view layout (spacing, sizing, alignment) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T034 [US2] Update TrendChart component to display count values (pass isPercentage={false}) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T035 [US2] Update trend chart y-axis labels to show numeric values instead of percentages in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T036 [US2] Ensure trend chart uses count values from daily_data arrays (not rate values) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T037 [US2] Ensure metric card selection updates trend chart correctly (same behavior as percentage view) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T038 [US2] Ensure back navigation returns to percentage view page (preserve time range if possible) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T039 [US2] Verify store templates show only applicable metrics (exposure_count) in count view in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T040 [US2] Verify exclusive templates show all five count metrics in count view in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Count view page should match percentage view layout and functionality.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T041 [P] Update API documentation (Swagger/OpenAPI) to include count fields in Backend/api/views/merchant_coupon.py (swagger_auto_schema decorator)
- [X] T042 [P] Add error handling for API failures in count view page (consistent with percentage view) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T043 [P] Add loading states consistent with percentage view in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T044 [P] Verify navigation preserves time range selection when switching between views in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T045 [P] Test edge cases: zero counts, large numbers (>1000), null/undefined values, empty time ranges in Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx
- [X] T046 [P] Run quickstart.md validation scenarios from specs/004-analytics-count-view/quickstart.md
- [X] T047 [P] Code cleanup and refactoring (remove duplicate code between percentage and count views if applicable) in Mobile-Merchant-Frontend/app/(coupons)/
- [X] T048 [P] Performance validation: Navigation < 1s (SC-001), data loading < 2s (SC-003) per spec.md success criteria

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 completion for count view page structure

### Within Each User Story

- Tests (REQUIRED) MUST be written and FAIL before implementation
- Backend API changes before frontend changes
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, User Story 1 can start
- All contract tests for User Story 1 marked [P] can run in parallel
- Backend count field additions (T010-T014) can run in parallel (same file, but different fields)
- Trend daily_data updates (T015-T019) can run in parallel (same file, but different trends)
- Frontend tasks (T020-T030) can run after backend API is ready
- User Story 2 can start after User Story 1 is complete
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all contract tests for User Story 1 together:
Task: "Add contract test for exclusive template API response includes count fields"
Task: "Add contract test for store template API response excludes exclusive-only count fields"
Task: "Add contract test for count field types are integers >= 0"
Task: "Add contract test for trend daily_data contains count values"

# Launch all backend count field additions together (sequential in same file):
Task: "Add retention_count field to API response"
Task: "Add stranger_acquisition_count field to API response"
Task: "Add redemption_count field to API response"
Task: "Add circulation_count field to API response"
Task: "Add circulation_redemption_count field to API response"

# Launch all trend daily_data updates together (sequential in same file):
Task: "Update trend daily_data calculation to include count values for retention_rate trend"
Task: "Update trend daily_data calculation to include count values for stranger_acquisition_rate trend"
Task: "Update trend daily_data calculation to include count values for circulation_rate trend"
Task: "Update trend daily_data calculation to include count values for circulation_redemption_rate trend"
Task: "Update trend daily_data calculation to include count values for redemption_rate trend"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (including contract tests)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: Backend API changes (T010-T019)
   - Developer B: Contract tests (T005-T009) - can start in parallel
   - Developer C: Frontend count view page (T020-T030) - after backend ready
3. User Story 2 can be worked on after User Story 1 is complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **Contract tests are REQUIRED** per constitution - verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Count values are already calculated in backend (numerators of rate calculations) - no new database queries needed
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Format count values with `toLocaleString('zh-TW')` for thousand separators
- Zero counts display as "0", null/undefined display as "數據不足"
- Toggle switch uses Tamagui Switch component, positioned above time range selector, below page title
- Navigation uses Expo Router: `router.push('/template-analytics-count/:id')`

---

## Summary

- **Total Tasks**: 48
- **User Story 1 Tasks**: 26 (5 tests + 21 implementation)
- **User Story 2 Tasks**: 10
- **Setup Tasks**: 2
- **Foundational Tasks**: 2
- **Polish Tasks**: 8
- **Parallel Opportunities**: Contract tests, backend count fields, trend updates, polish tasks
- **Independent Test Criteria**:
  - **US1**: Navigate to count view, verify all five metrics display as counts with correct labels, time range updates work
  - **US2**: Compare count view layout with percentage view, verify trend charts show count values with numeric y-axis
- **Suggested MVP Scope**: User Story 1 only (Phase 1 + 2 + 3)
- **Format Validation**: ✅ All tasks follow checklist format (checkbox, ID, labels, file paths)
