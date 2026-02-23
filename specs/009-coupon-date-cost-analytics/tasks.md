---
description: "Task list for 009 Coupon Date-Range and Cost Analytics"
---

# Tasks: Coupon Date-Range and Cost Analytics

**Input**: Design documents from `specs/009-coupon-date-cost-analytics/`  
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md, contracts/

**Tests**: Per constitution (III. Quality Assurance), API endpoints require contract tests. Backend tests in `Backend/tests/` or `Backend/api/tests/`; full suite: `python manage.py test api tests`. This feature adds/extends contract tests for template analytics (date_from/date_to, date_range_cost) and merchant statistics (today_cost).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `Backend/api/` (models, views, serializers); tests in `Backend/tests/` (e.g. `Backend/tests/contract/`)
- **Mobile Merchant Frontend**: `Mobile-Merchant-Frontend/app/`, `Mobile-Merchant-Frontend/utils/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm environment and structure; no new top-level apps per plan.

- [X] T001 Verify Backend and Mobile-Merchant-Frontend structure and runnability per plan.md and CLAUDE.md (Backend: venv, manage.py; Frontend: app/(coupons), app/(profile), utils/api.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Optional Store fields and timezone/currency helpers required for date-range validation and cost display. Must be done before any user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add optional Store.timezone (CharField, IANA e.g. Asia/Taipei) and Store.currency_code (CharField) in Backend/api/models.py; create and run migration
- [X] T003 [P] Add migration upgrade and downgrade test for Store timezone/currency_code in Backend/tests/ (e.g. test_migrations.py or in a contract test) per Constitution III
- [X] T004 Implement timezone and currency helpers (e.g. get store "today" as date in store TZ, get store currency for display) for use by merchant_coupon and merchant_profile views in Backend/api/utils.py or Backend/api/views/
- [X] T005 [P] Add or extend serializers in Backend/api/serializers.py for new response fields (template analytics: date_range_cost, date_range_cost_currency; merchant statistics: today_cost, today_cost_currency) and use in get_template_analytics and get_merchant_statistics per Constitution II

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Choose Date Range for Template Analytics (Priority: P1) — MVP

**Goal**: Merchant selects start/end date and sees all template analytics (exposure, redemptions, conversion, etc.) for that range only.

**Independent Test**: Open template analytics, select a date range, confirm all displayed stats match that range only; invalid range (future end, >730 days, start>end) shows validation error.

### Tests for User Story 1 (required per constitution)

- [X] T006 [P] [US1] Extend Backend/tests/contract/test_template_analytics.py: request with date_from and date_to returns 200 and metrics scoped to range; date_to > today (store TZ) returns 400; range > 730 days returns 400; date_to < date_from returns 400

### Implementation for User Story 1

- [X] T007 [US1] In Backend/api/views/merchant_coupon.py get_template_analytics: accept query params date_from and date_to (ISO YYYY-MM-DD); validate (date_to ≥ date_from, date_to ≤ today in store TZ, range ≤ 730 days); return 400 with clear message on failure; compute time bounds in store TZ and filter Log/CouponRedemption by range; return all existing metrics scoped to selected range (keep days fallback when date_from/date_to not both provided)
- [X] T008 [US1] Extend getTemplateAnalytics in Mobile-Merchant-Frontend/utils/api.ts to accept options { date_from?, date_to?, days? } and add TypeScript types for request/response
- [X] T009 [US1] Add date range picker (start, end) and client-side validation (start ≤ end, end ≤ today, range ≤ 730 days) in Mobile-Merchant-Frontend/app/(coupons)/template-analytics/[id].tsx; call API with date_from/date_to when both selected; show validation errors from API or client; optionally keep 近3/7/30/90 as shortcuts mapping to date_from/date_to
- [X] T010 [US1] Pass same date range to API in Mobile-Merchant-Frontend/app/template-analytics-count/[id].tsx when date range is used (align with template-analytics behavior)

**Checkpoint**: User Story 1 is functional; template analytics work for arbitrary date range with validation

---

## Phase 4: User Story 2 — Date-Range Cost for Exclusive (Collection) Templates (Priority: P2)

**Goal**: On template analytics for exclusive templates, show 此區間成本 (sum of savings_amount in selected range); do not show for store/EasyUse templates.

**Independent Test**: Open analytics for an exclusive template with a date range; confirm 此區間成本 is shown and equals sum of discount in range; for store template confirm 此區間成本 is not shown.

### Tests for User Story 2 (required per constitution)

- [X] T011 [P] [US2] Extend Backend/tests/contract/test_template_analytics.py: for exclusive template with date_from/date_to, assert response includes date_range_cost (and optional date_range_cost_currency); for store template assert response does not include date_range_cost

### Implementation for User Story 2

- [X] T012 [US2] In Backend/api/views/merchant_coupon.py get_template_analytics: for exclusive (Collection) templates only compute date_range_cost = sum of Coalesce(savings_amount, 0) for redemptions in selected range; add date_range_cost and optional date_range_cost_currency to response; omit for store templates
- [X] T013 [US2] In Mobile-Merchant-Frontend/utils/api.ts add response types date_range_cost and date_range_cost_currency for template analytics
- [X] T014 [US2] Display 此區間成本 (and optional currency/unit) for exclusive templates only in Mobile-Merchant-Frontend/app/(coupons)/template-analytics/[id].tsx and Mobile-Merchant-Frontend/app/template-analytics-count/[id].tsx; do not show block for store templates

**Checkpoint**: User Stories 1 and 2 are functional; date-range cost visible for exclusive templates only

---

## Phase 5: User Story 3 — Today's Total Cost on Merchant Settings (Priority: P3)

**Goal**: Merchant profile/settings page shows 今日成本 (total discount given today in store timezone) for daily 總帳. Implementation MUST use a single aggregate query for 今日成本 (no N+1) per plan performance goals.

**Independent Test**: Open merchant profile/settings page; confirm 今日成本 is shown and equals sum of savings for redemptions today; zero redemptions today shows 0.

### Tests for User Story 3 (required per constitution)

- [X] T015 [P] [US3] Add or extend contract test in Backend/tests/contract/test_merchant_statistics.py: GET /api/merchant/statistics/ with merchant auth returns 200 and response includes today_cost (number ≥ 0) and optionally today_cost_currency

### Implementation for User Story 3

- [X] T016 [US3] In Backend/api/views/merchant_profile.py get_merchant_statistics: compute "today" in store timezone (using Phase 2 helper); sum Coalesce(CouponRedemption.savings_amount, 0) for coupon__store=store and redeemed_at on that calendar day (single aggregate query); add today_cost and optional today_cost_currency to response
- [X] T017 [US3] Extend merchant statistics response types in Mobile-Merchant-Frontend/utils/api.ts with today_cost and today_cost_currency
- [X] T018 [US3] Add MetricCard or row for 今日成本 in Mobile-Merchant-Frontend/app/(profile)/index.tsx using statistics.today_cost; show optional currency/unit; format number (e.g. toLocaleString) and show 0 when zero

**Checkpoint**: All three user stories are functional; 今日成本 visible on profile page

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, docs, and full-suite confidence.

- [X] T019 [P] Run full backend test suite from Backend: `python manage.py test api tests`; run quickstart.md validation (contract tests for template analytics and merchant statistics, frontend smoke); optionally verify 今日成本 is implemented as single aggregate query (code review or smoke check)
- [X] T020 [P] Update Backend/README.md or feature docs if test commands or new endpoints need documenting

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — MVP
- **Phase 4 (US2)**: Depends on Phase 3 (same endpoint and screen as US1)
- **Phase 5 (US3)**: Depends on Phase 2 only (independent endpoint and profile page)
- **Phase 6 (Polish)**: Depends on completion of desired user stories

### User Story Dependencies

- **US1 (P1)**: After Foundational only — no other story required
- **US2 (P2)**: Builds on US1 (same template analytics endpoint and UI)
- **US3 (P3)**: After Foundational only — can be done in parallel with US1/US2 if staffed

### Within Each User Story

- Contract tests (T006, T011, T015) should be written first and fail before implementation
- Backend view changes before frontend display
- API types (utils/api.ts) before UI components that consume them

### Parallel Opportunities

- T003 (migration test) and T005 (serializers) can run in parallel after T002
- T006 (US1 contract test) can run in parallel with T004–T005 once T002 is done
- T011 (US2 contract test) can run in parallel with T007–T010 once Phase 2 is done
- T015 (US3 contract test) can run in parallel with US1 implementation once Phase 2 is done
- US3 implementation (T016–T018) can run in parallel with US2 (T012–T014) after Phase 2
- T019 and T020 in Polish can run in parallel

---

## Parallel Example: User Story 1

```text
# After Phase 2 complete:
Contract test: Backend/tests/contract/test_template_analytics.py (T006)
Then sequentially: T007 (backend) → T008 (api.ts) → T009, T010 (frontend screens)
```

---

## Parallel Example: User Stories 2 and 3

```text
# After US1 complete, US2 and US3 can be parallel:
US2: T011 (contract) → T012 (backend) → T013, T014 (frontend)
US3: T015 (contract) → T016 (backend) → T017, T018 (frontend)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup  
2. Complete Phase 2: Foundational (Store fields, migration test, helpers, serializers)  
3. Complete Phase 3: User Story 1 (date range for template analytics)  
4. **STOP and VALIDATE**: Contract tests pass; frontend date picker and range-scoped stats work  
5. Deploy/demo if ready  

### Incremental Delivery

1. Setup + Foundational → foundation ready  
2. Add US1 → test independently → deploy (MVP: date range analytics)  
3. Add US2 → test independently → deploy (date-range cost for exclusive)  
4. Add US3 → test independently → deploy (今日成本 on profile)  
5. Polish → full suite and quickstart validation  

### Parallel Team Strategy

- After Phase 2: Developer A does US1; Developer B can do US3 (no dependency on US1).  
- After US1: Developer A does US2 (builds on US1).  

---

## Notes

- [P] tasks use different files and have no blocking dependency on other unchecked tasks in the same phase
- [USn] maps each task to the user story for traceability
- Write contract tests first and ensure they fail before implementing (constitution III)
- Commit after each task or logical group
- Validation rules: date_to ≤ today (store TZ); range ≤ 730 days; date_to ≥ date_from (quickstart.md table)
