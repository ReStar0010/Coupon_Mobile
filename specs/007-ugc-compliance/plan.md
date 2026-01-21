# Implementation Plan: UGC Compliance for Apple Guideline 1.2

**Branch**: `007-ugc-compliance` | **Date**: 2026-01-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-ugc-compliance/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement Apple App Store Guideline 1.2 compliance for User-Generated Content (UGC). This includes content reporting mechanism for consumers, merchant blocking functionality, EULA acceptance flow for merchants before first upload, admin moderation dashboard with 24-hour SLA, and accessible support/privacy information. Technical approach extends existing Django REST Framework backend with new models (ContentReport, BlockedMerchant, EULAAcceptance, ModerationAction, ViolationRecord) and Expo React Native frontend screens for consumer reporting/blocking and merchant EULA acceptance.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict mode (Mobile Frontend)
**Primary Dependencies**: Django REST Framework 3.x, Expo/React Native, Tamagui UI, Resend API (email), rest_framework_simplejwt (auth)
**Storage**: SQLite (dev) / PostgreSQL (prod) via Django ORM
**Testing**: Django TestCase (`python manage.py test api.tests`), Frontend: ESLint + TypeScript
**Target Platform**: iOS/Android mobile apps (Expo), Django API server
**Project Type**: Mobile + API (separate consumer and merchant apps with shared backend)
**Performance Goals**: Initial load < 3s on 4G, interaction response < 100ms, report submission < 2s
**Constraints**: 24-hour moderation SLA, offline capability for viewing owned coupons, Chinese UI text
**Scale/Scope**: 6 user stories, 30 functional requirements, ~8 new screens (consumer + merchant + admin)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate Evaluation

| Principle | Requirement | Compliance | Notes |
|-----------|-------------|------------|-------|
| **I. Mobile-First Design** | Touch-first UI, < 3s load, < 100ms interaction | ✅ PASS | Report/block flows designed for 2-tap completion; EULA scroll detection native |
| **II. API-Driven & Type-Safe** | DRF serializers, TS interfaces, consistent error responses | ✅ PASS | All new endpoints via DRF; TS strict mode enabled; follows existing patterns |
| **III. Quality Assurance** | Tests for auth flows, edge cases, API contracts | ✅ PASS | Will add tests for report flow, block filtering, EULA gate, moderation actions |

### Constitution Compliance Details

1. **Mobile-First Design**
   - Report button accessible within merchant profile and coupon detail screens (existing patterns)
   - Block merchant: 2 taps from profile (requirement SC-004)
   - EULA scroll-to-bottom detection uses native scroll events
   - Privacy Policy accessible within 2 taps from any screen (SC-005)

2. **API-Driven & Type-Safe Architecture**
   - All new models will have complete DRF serializers with field-level validation
   - Frontend services will define TypeScript interfaces for all request/response types
   - Error responses follow existing pattern: `{"error": "message"}` with Chinese text
   - Python type hints for all new function signatures

3. **Quality Assurance**
   - Integration tests for: report submission, block/unblock, EULA acceptance gate
   - Unit tests for: duplicate report prevention, 24-hour escalation logic, violation counting
   - Contract tests for: all new API endpoints

**GATE RESULT**: ✅ PASS - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/007-ugc-compliance/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── content-report.yaml
│   ├── blocked-merchant.yaml
│   ├── eula-acceptance.yaml
│   └── moderation.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py                    # Extend: ContentReport, BlockedMerchant, EULAAcceptance, ModerationAction, ViolationRecord
│   ├── serializers.py               # Extend: ContentReportSerializer, BlockedMerchantSerializer, EULAAcceptanceSerializer
│   ├── views/
│   │   ├── content_moderation.py    # NEW: Report submission, block/unblock endpoints
│   │   ├── eula_acceptance.py       # NEW: EULA acceptance flow
│   │   └── admin_moderation.py      # NEW: Admin moderation dashboard endpoints
│   ├── services/
│   │   └── moderation_service.py    # NEW: Escalation alerts, violation tracking
│   └── admin.py                     # Extend: Register new models for Django admin
├── Backend/
│   └── urls.py                      # Extend: New API routes
└── tests/
    └── test_ugc_compliance.py       # NEW: Tests for UGC compliance features

Mobile-Frontend/
├── app/
│   ├── EasyUse/
│   │   └── [id]/
│   │       └── components/
│   │           └── ReportModal.tsx  # NEW: Report content modal
│   ├── OptionsMenu/
│   │   ├── BlockedMerchants/        # NEW: Blocked merchants list screen
│   │   │   └── index.tsx
│   │   ├── HelpSupport/             # NEW: Help & support screen
│   │   │   └── index.tsx
│   │   └── PrivacyPolicy/           # NEW: Privacy policy screen (pre-login accessible)
│   │       └── index.tsx
│   ├── components/
│   │   ├── ReportButton.tsx         # NEW: Reusable report button component
│   │   └── providers/
│   │       └── BlockedMerchantsProvider.tsx  # NEW: Blocked merchants context
│   └── services/
│       ├── contentReportAPI.ts      # NEW: Content report API service
│       └── blockListAPI.ts          # NEW: Block list API service

Merchant-Frontend/ (or merchant app within Mobile-Frontend if shared)
├── app/
│   ├── components/
│   │   └── EULAModal.tsx            # NEW: EULA acceptance modal
│   └── services/
│       └── eulaAPI.ts               # NEW: EULA acceptance API service
```

**Structure Decision**: Mobile + API pattern following existing codebase. Backend extends `api/` directory with new view modules for separation of concerns. Frontend adds new screens under `OptionsMenu/` and extends coupon detail pages with report functionality. New context provider for blocked merchants state management.

## Complexity Tracking

> No violations identified. Constitution Check passed without justifications needed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

### Post-Design Gate Evaluation

| Principle | Requirement | Compliance | Design Evidence |
|-----------|-------------|------------|-----------------|
| **I. Mobile-First Design** | Touch-first UI, < 3s load, < 100ms interaction | ✅ PASS | Report modal uses native components; Block in 2 taps; EULA uses ScrollView with onScroll detection |
| **II. API-Driven & Type-Safe** | DRF serializers, TS interfaces, consistent error responses | ✅ PASS | 4 OpenAPI contracts defined; All request/response types documented; Chinese error messages specified |
| **III. Quality Assurance** | Tests for auth flows, edge cases, API contracts | ✅ PASS | 10 test cases defined in quickstart.md; Coverage for critical paths |

### Design Artifacts Produced

| Artifact | Path | Status |
|----------|------|--------|
| Research findings | `specs/007-ugc-compliance/research.md` | ✅ Complete |
| Data model | `specs/007-ugc-compliance/data-model.md` | ✅ Complete |
| Content Report API | `specs/007-ugc-compliance/contracts/content-report.yaml` | ✅ Complete |
| Blocked Merchant API | `specs/007-ugc-compliance/contracts/blocked-merchant.yaml` | ✅ Complete |
| EULA Acceptance API | `specs/007-ugc-compliance/contracts/eula-acceptance.yaml` | ✅ Complete |
| Moderation API | `specs/007-ugc-compliance/contracts/moderation.yaml` | ✅ Complete |
| Quickstart guide | `specs/007-ugc-compliance/quickstart.md` | ✅ Complete |

### Compliance Summary

- **5 new Django models** defined with complete field specifications
- **4 OpenAPI contract files** with full request/response schemas
- **~20 new API endpoints** across consumer, merchant, and admin domains
- **All endpoints** use DRF serializers with field-level validation
- **All TypeScript services** have interface definitions
- **Chinese UI text** specified in all error responses and user-facing content
- **Test cases** defined for all critical compliance paths

**POST-DESIGN GATE RESULT**: ✅ PASS - Design complete and compliant. Ready for `/speckit.tasks`.
