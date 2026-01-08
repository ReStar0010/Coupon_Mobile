# Implementation Plan: Analytics Count View

**Branch**: `004-analytics-count-view` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-analytics-count-view/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a count view page for template analytics that displays absolute count values (張數) instead of percentages. Merchants can toggle between percentage and count views via a switch button. The backend API is extended to return count fields alongside existing rate fields, and a new frontend route displays count metrics with proper number formatting. Count values are derived from existing rate calculation numerators, requiring no new database queries.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict mode (Mobile Merchant Frontend)
**Primary Dependencies**: Django REST Framework, Expo/React Native, Tamagui, Expo Router
**Storage**: SQLite (dev), PostgreSQL (prod) - existing setup, no new tables required
**Testing**: pytest (backend), contract tests required per constitution
**Target Platform**: iOS/Android mobile via Expo, Django REST API server
**Project Type**: Mobile + API (Expo frontend + Django backend)
**Performance Goals**: API response time <200ms, page navigation <1s per spec (SC-001)
**Constraints**: <2s data loading on time range change (SC-003), maintain existing API compatibility
**Scale/Scope**: Existing merchant user base, no new database entities

**Existing Infrastructure**:
- Analytics endpoint: `Backend/api/views/merchant_coupon.py:775-1100` (get_template_analytics)
- Frontend analytics page: `Mobile-Merchant-Frontend/app/(coupons)/template-analytics.tsx`
- API client: `Mobile-Merchant-Frontend/utils/api.ts:511-514` (getTemplateAnalytics)
- Trend chart component: `Mobile-Merchant-Frontend/app/(profile)/components/TrendChart.tsx`
- Count values already calculated as numerators in rate calculations (no new queries needed)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| I. Mobile-First Design | Touch interaction first | ✅ PASS | Toggle switch uses Tamagui Switch component, positioned for easy thumb access |
| I. Mobile-First Design | <3s load, <100ms response | ✅ PASS | API endpoint already optimized, count values derived from existing queries |
| I. Mobile-First Design | Responsive layouts | ✅ PASS | Reuses existing metric card layout, maintains consistency |
| II. API-Driven & Type-Safe | Complete serializer definitions | ✅ PASS | Count fields added to existing response, TypeScript interfaces updated |
| II. API-Driven & Type-Safe | TypeScript strict mode | ✅ PASS | Frontend uses TypeScript strict mode, interfaces match backend schema |
| II. API-Driven & Type-Safe | Consistent error responses | ✅ PASS | Reuses existing error handling patterns |
| III. Quality Assurance | Contract tests for API endpoints | ⚠️ REQUIRED | Must add contract tests in `Backend/tests/contract/test_template_analytics.py` |
| III. Quality Assurance | Test critical paths | ✅ PASS | Count calculation logic uses existing tested querysets |

**Gate Status**: ✅ PASS (with contract test requirement noted)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── views/
│   │   └── merchant_coupon.py    # Modify: Add count fields to get_template_analytics response
│   └── serializers.py            # Update: Document count fields in API schema
├── tests/
│   └── contract/
│       └── test_template_analytics.py  # NEW: Contract tests for count fields

Mobile-Merchant-Frontend/
├── app/
│   └── (coupons)/
│       ├── template-analytics.tsx           # Modify: Add toggle switch, navigate to count view
│       └── template-analytics-count.tsx      # NEW: Count view page component
├── utils/
│   └── api.ts                    # Update: TypeScript interface for AnalyticsData with count fields
```

**Structure Decision**: Mobile + API architecture matching existing codebase. Backend changes extend existing endpoint, frontend adds new route page. No new directories at root level; follows established patterns.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations requiring justification. Feature extends existing patterns and infrastructure.

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| I. Mobile-First Design | Touch interaction first | ✅ PASS | Toggle switch uses Tamagui Switch component, positioned above date selector for easy thumb access |
| I. Mobile-First Design | <3s load, <100ms response | ✅ PASS | Count values derived from existing queries, no additional database load |
| I. Mobile-First Design | Responsive layouts | ✅ PASS | Reuses existing metric card layout, maintains visual consistency |
| II. API-Driven & Type-Safe | Complete serializer definitions | ✅ PASS | Count fields documented in OpenAPI spec (contracts/api.yaml) |
| II. API-Driven & Type-Safe | TypeScript strict mode | ✅ PASS | TypeScript interfaces updated in data-model.md, matches backend schema |
| II. API-Driven & Type-Safe | Consistent error responses | ✅ PASS | Reuses existing error handling patterns, no new error types |
| III. Quality Assurance | Contract tests for API endpoints | ⚠️ REQUIRED | Contract tests specified in quickstart.md, must be implemented in `Backend/tests/contract/test_template_analytics.py` |
| III. Quality Assurance | Test critical paths | ✅ PASS | Count calculation uses existing tested querysets, edge cases documented |

**Post-Design Gate Status**: ✅ PASS (contract test implementation required before completion)
