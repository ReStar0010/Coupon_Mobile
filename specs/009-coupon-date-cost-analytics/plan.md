# Implementation Plan: Coupon Date-Range and Cost Analytics

**Branch**: `009-coupon-date-cost-analytics` | **Date**: 2026-02-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/009-coupon-date-cost-analytics/spec.md`

## Summary

Enable merchants to choose an arbitrary calendar date range (start/end) for template analytics and see all stats (exposure, redemptions, conversion) plus date-range cost (此區間成本) for exclusive templates; show 今日成本 (today's cost) on the merchant profile/settings page for daily 總帳. Backend: add `date_from`/`date_to` to template analytics (max 730 days, end ≤ today in store timezone), add date-range cost (sum of `savings_amount`) for exclusive templates, extend merchant statistics with `today_cost` (store timezone "today"). Optionally add Store timezone and Store currency for correct "today" and cost display. Frontend: date picker for range, validation, display 此區間成本 and 今日成本 with optional currency.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict mode (Mobile Merchant Frontend)  
**Primary Dependencies**: Django REST Framework, Expo/React Native, Tamagui, Expo Router  
**Storage**: SQLite (dev), PostgreSQL (prod); optional new fields on Store (timezone, currency_code)  
**Testing**: Django test runner, contract tests for template analytics and merchant statistics (Backend/tests/, Backend/api/tests/)  
**Target Platform**: iOS/Android via Expo, Django REST API  
**Project Type**: Mobile + API (Expo merchant frontend + Django backend)  
**Performance Goals**: Template analytics with date range and cost: response &lt; 3s; 今日成本: single aggregate query  
**Constraints**: Max range 730 days; end date ≤ today (store timezone); future end date disallowed  
**Scale/Scope**: Existing merchant base; no new apps; optional Store columns

**Existing Infrastructure**:
- Template analytics: `Backend/api/views/merchant_coupon.py` — `get_template_analytics(request, id)` (query param `days` 3/7/30/90)
- Merchant statistics: `Backend/api/views/merchant_profile.py` — `get_merchant_statistics(request)` (active_coupons, total_redemptions, total_views)
- Store model: `Backend/api/models.py` — Store (no timezone or currency today); CouponRedemption.savings_amount
- Merchant profile UI: `Mobile-Merchant-Frontend/app/(profile)/index.tsx` (MetricCards: 優惠數, 總核銷, 總曝光)
- Template analytics UI: `Mobile-Merchant-Frontend/app/(coupons)/template-analytics/[id].tsx` and count view; time range buttons 近3天/7/30/90

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| I. Mobile-First Design | Touch-first, &lt;3s load, &lt;100ms response | ✅ PASS | Date picker and cost display are touch-friendly; analytics and today_cost are server-computed |
| II. API-Driven & Type-Safe | Serializers, TypeScript interfaces, consistent errors | ✅ PASS | New/updated endpoints documented in contracts; frontend types for date range and cost |
| III. Quality Assurance | Contract tests, critical paths | ⚠️ REQUIRED | Contract tests for template analytics (date_from/date_to, date_range_cost) and merchant statistics (today_cost) |
| III. Backend testing framework | Tests in Backend/tests/ or api/tests/, full suite | ✅ PASS | Plan adds contract tests under Backend/tests/contract/ |

**Gate Status**: ✅ PASS (contract tests required as in quickstart)

## Project Structure

### Documentation (this feature)

```text
specs/009-coupon-date-cost-analytics/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (OpenAPI fragments or api.yaml)
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py              # Optional: Store.timezone, Store.currency_code (migration)
│   ├── views/
│   │   ├── merchant_coupon.py # get_template_analytics: date_from, date_to, validation, date_range_cost (exclusive)
│   │   └── merchant_profile.py # get_merchant_statistics: today_cost (store timezone)
│   └── serializers.py        # If needed for response schema
├── tests/
│   └── contract/
│       ├── test_template_analytics.py  # Extend: date range params, date_range_cost
│       └── test_merchant_statistics.py # NEW or extend: today_cost
└── README.md                 # No change required

Mobile-Merchant-Frontend/
├── app/
│   ├── (coupons)/
│   │   └── template-analytics/[id].tsx  # Date range picker (start/end), replace or supplement 3/7/30/90
│   ├── template-analytics-count/[id].tsx  # Same date range; show 此區間成本 when exclusive
│   └── (profile)/
│       └── index.tsx         # Add 今日成本 MetricCard (and optional currency)
├── utils/
│   └── api.ts                # getTemplateAnalytics(date_from, date_to), getStatistics() → today_cost types
```

**Structure Decision**: Mobile + API; backend extends existing views and optionally Store; frontend extends existing analytics and profile screens. No new top-level apps.

## Complexity Tracking

No constitution violations requiring justification. Feature extends existing endpoints and UI patterns; optional Store fields are additive.

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design.*

| Principle | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| I. Mobile-First Design | Touch, performance | ✅ PASS | Date picker and cost cards fit existing layouts; queries scoped by range/today |
| II. API-Driven & Type-Safe | Contracts, types | ✅ PASS | contracts/ and data-model.md define request/response shapes |
| III. Quality Assurance | Contract tests | ⚠️ REQUIRED | quickstart.md and contracts specify tests for new params and today_cost |

**Post-Design Gate Status**: ✅ PASS (implementation of contract tests required before completion)
