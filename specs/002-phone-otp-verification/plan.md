# Implementation Plan: Phone OTP Verification

**Branch**: `002-phone-otp-verification` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-phone-otp-verification/spec.md`

## Summary

Add SMS OTP verification via Twilio before saving any phone number to prevent coupon theft. Currently, users can change phone numbers freely, allowing theft of pending coupons meant for others. The implementation requires: (1) new PhoneOTPRecord model for tracking verification attempts, (2) Twilio SMS integration for sending OTPs, (3) new API endpoints for OTP request/verify flow, (4) frontend OTP entry UI with countdown timers, and (5) modification of existing phone update flow to require OTP verification.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict mode (Mobile)
**Primary Dependencies**: Django REST Framework, Expo/React Native, Tamagui, Twilio SDK (NEW)
**Storage**: SQLite (dev), PostgreSQL (prod) - existing setup
**Testing**: pytest (backend), existing patterns for integration tests
**Target Platform**: iOS/Android mobile via Expo, Django REST API server
**Project Type**: Mobile + API (Expo frontend + Django backend)
**Performance Goals**: OTP SMS delivery within 30 seconds, 99% delivery rate per spec
**Constraints**: <100ms API response time, 10-minute OTP expiration, 60-second resend cooldown
**Scale/Scope**: Taiwan mobile numbers only (09XXXXXXXX format), existing user base

**Existing Infrastructure**:
- Phone validation utility: `Backend/api/utils.py:10-32` (reusable)
- Phone masking utility: `Backend/api/utils.py:35-48` (reusable)
- User phone endpoint: `Backend/api/views/user_profile.py:293-379` (INSECURE - needs OTP gate)
- Email service: Resend API configured (SMS via Twilio NEEDS CLARIFICATION)
- JWT auth: rest_framework_simplejwt (separate from OTP flow)
- Frontend phone settings: `Mobile-Frontend/app/OptionsMenu/PhoneSettings/index.tsx`

**Security Gap Addressed**:
- Current: PUT /api/user/phone/ allows direct phone update without verification
- After: PUT /api/user/phone/ blocked; must use POST /api/phone-otp/verify/ with valid OTP

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Mobile-First Design | Touch interaction first, <3s load on 4G, <100ms response | ✅ PASS | OTP entry UI designed for mobile, API response target <100ms |
| I. Mobile-First Design | Offline capability for critical flows | ⚠️ N/A | OTP verification requires network; phone display can work offline |
| II. API-Driven & Type-Safe | Complete serializer definitions, TypeScript interfaces | ✅ PASS | Will define PhoneOTPSerializer, TypeScript request/response types |
| II. API-Driven & Type-Safe | Consistent error response structures | ✅ PASS | Follow existing pattern: {error: "...", details: {...}} |
| II. API-Driven & Type-Safe | Python type hints, TypeScript strict mode | ✅ PASS | Project already uses both |
| III. Quality Assurance | Authentication flows have integration tests | ✅ REQUIRED | OTP verification = auth flow; tests mandatory |
| III. Quality Assurance | Bug fixes include regression tests | ✅ PASS | This fixes coupon theft vulnerability; tests will cover |
| III. Quality Assurance | API endpoints have contract tests | ✅ REQUIRED | New OTP endpoints need contract tests |

**Constitution Gate: PASS** - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/002-phone-otp-verification/
├── plan.md              # This file
├── research.md          # Phase 0 output: Twilio integration, rate limiting patterns
├── data-model.md        # Phase 1 output: PhoneOTPRecord model
├── quickstart.md        # Phase 1 output: Developer setup guide
├── contracts/           # Phase 1 output: OpenAPI specs for OTP endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py              # Add PhoneOTPRecord model
│   ├── serializers.py         # Add PhoneOTPSerializer
│   ├── views/
│   │   ├── user_profile.py    # Modify phone endpoint to require OTP
│   │   └── phone_otp.py       # NEW: OTP send/verify endpoints
│   ├── services/
│   │   └── sms_service.py     # NEW: Twilio SMS integration
│   └── utils.py               # Existing phone validation (reuse)
├── tests/
│   ├── test_phone_otp.py      # NEW: OTP unit/integration tests
│   └── test_user_profile.py   # Update: phone update rejection tests

Mobile-Frontend/
├── app/
│   ├── OptionsMenu/
│   │   └── PhoneSettings/
│   │       ├── index.tsx          # Modify: route through OTP flow
│   │       ├── OTPRequestScreen.tsx   # NEW: phone input + send OTP
│   │       └── OTPVerifyScreen.tsx    # NEW: 6-digit code entry
│   ├── components/
│   │   └── OTPInput.tsx           # NEW: 6-digit code input component
│   └── services/
│       └── phoneOtpAPI.ts         # NEW: OTP API client functions
```

**Structure Decision**: Mobile + API architecture matching existing codebase. Backend changes in `Backend/api/`, frontend changes in `Mobile-Frontend/app/`. No new directories at root level; follows established patterns.

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Requirement | Status | Evidence |
|-----------|-------------|--------|----------|
| I. Mobile-First Design | Touch interaction first | ✅ PASS | OTPInput component with 6 individual boxes for touch-friendly input; auto-advance on digit entry |
| I. Mobile-First Design | <3s load, <100ms response | ✅ PASS | API endpoints are lightweight (DB queries only); no heavy processing |
| I. Mobile-First Design | Offline capability | ⚠️ N/A | OTP verification inherently requires network; verified phone displays offline |
| II. API-Driven & Type-Safe | Complete serializer definitions | ✅ PASS | `contracts/phone-otp-api.yaml` defines all request/response schemas |
| II. API-Driven & Type-Safe | TypeScript interfaces | ✅ PASS | `contracts/phone-otp-types.ts` provides full type coverage |
| II. API-Driven & Type-Safe | Consistent error responses | ✅ PASS | ErrorResponse schema with error, redirect, retry_after_seconds fields |
| II. API-Driven & Type-Safe | Python type hints | ✅ PASS | PhoneOTPRecord model methods have return type annotations |
| III. Quality Assurance | Integration tests for auth | ✅ DESIGNED | `quickstart.md` lists 11 test cases covering all OTP scenarios |
| III. Quality Assurance | Regression tests | ✅ DESIGNED | Direct phone update rejection tests specified |
| III. Quality Assurance | Contract tests | ✅ DESIGNED | OpenAPI spec enables automated contract testing |

**Post-Design Gate: PASS** - All requirements addressed in design artifacts.

### Design Artifacts Summary

| Artifact | Purpose | Status |
|----------|---------|--------|
| `research.md` | Twilio integration, rate limiting patterns, OTP security | ✅ Complete |
| `data-model.md` | PhoneOTPRecord model, migration plan, state transitions | ✅ Complete |
| `contracts/phone-otp-api.yaml` | OpenAPI 3.0 specification for all endpoints | ✅ Complete |
| `contracts/phone-otp-types.ts` | TypeScript interfaces and validation helpers | ✅ Complete |
| `quickstart.md` | Developer setup and testing guide | ✅ Complete |
| `CLAUDE.md` | Agent context file with project guidelines | ✅ Created |

## Complexity Tracking

> No constitution violations to justify. Implementation follows existing patterns.
