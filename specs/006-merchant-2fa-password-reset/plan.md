# Implementation Plan: Merchant 2FA Email Verification and Password Reset

**Branch**: `006-merchant-2fa-password-reset` | **Date**: 2026-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-merchant-2fa-password-reset/spec.md`

## Summary

Add email-based two-factor authentication (2FA) during merchant registration and password reset functionality with email confirmation. This feature reuses the existing Resend email service infrastructure already configured for consumer (student) accounts. The implementation adds email verification requirement for merchant login, email-based password reset flow accessible from the login page, and deep link handling in Mobile-Merchant-Frontend for both flows.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict mode (Frontend)
**Primary Dependencies**: Django REST Framework, Resend API (existing), Expo Router, Tamagui
**Storage**: SQLite (dev) / PostgreSQL (prod) via Django ORM
**Testing**: Django TestCase, manual E2E testing via Expo
**Target Platform**: iOS/Android via Expo (Mobile-Merchant-Frontend), Django REST API (Backend)
**Project Type**: Mobile + API
**Performance Goals**: Email delivery within 30 seconds, verification/reset flows complete < 3 minutes
**Constraints**: 24-hour token expiration, rate limiting (3 requests/hour per email), Chinese UI text
**API Versioning**: New merchant auth endpoints use existing unversioned URL patterns (e.g., `/api/merchant/verify-email/`). This is consistent with current API design. No breaking changes to existing endpoints.
**Scale/Scope**: Same merchant base as existing app, reuses existing infrastructure

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Mobile-First Design | ✅ PASS | Deep links open native app screens; touch-first UI; performance within budgets |
| II. API-Driven & Type-Safe Architecture | ✅ PASS | All endpoints have serializers; TypeScript interfaces for API responses; REST patterns |
| III. Quality Assurance | ✅ PASS | Auth flows require integration tests; token validation has unit tests |

**Pre-Design Gate**: ✅ PASSED - No violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-merchant-2fa-password-reset/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── merchant-auth-api.yaml  # OpenAPI spec for new endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py                    # Add MerchantProfile.verified field, update PasswordResetProfile
│   ├── serializers.py               # Add merchant verification serializers
│   ├── views/
│   │   └── authentication.py        # Add merchant verification endpoints, update login check
│   └── auth.py                      # Reuse token validation utilities
├── Backend/
│   └── urls.py                      # Add new endpoint routes
└── tests/
    └── test_merchant_auth.py        # New: integration tests for merchant auth

Mobile-Merchant-Frontend/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx                # Update: add unverified state handling
│   │   ├── forgot-password.tsx      # Exists: already implemented
│   │   ├── register.tsx             # Update: show verification pending message
│   │   ├── verify-email.tsx         # New: email verification deep link handler
│   │   └── reset-password.tsx       # New: password reset deep link handler
│   └── _layout.tsx                  # Update: handle deep link routing
├── utils/
│   └── api.ts                       # Update: add verification/reset API calls
└── app.json                         # Already configured: coupromerchant:// scheme
```

**Structure Decision**: Mobile + API pattern. Backend modifications extend existing `api/views/authentication.py` with merchant-specific logic. Frontend adds new screens under `(auth)/` group following existing patterns.

## Complexity Tracking

> No violations requiring justification. Implementation reuses existing patterns and infrastructure.
