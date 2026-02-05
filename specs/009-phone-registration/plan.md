# Implementation Plan: Phone-Based Registration Flow

**Branch**: `009-phone-registration` | **Date**: 2026-02-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-phone-registration/spec.md`

## Summary

Swap the default registration flow from email+password to phone+password with SMS OTP verification. The login screen defaults to phone+password with an email toggle for backward compatibility. Forgot-password is reworked to use phone OTP instead of email. Email becomes optional post-registration information (mirroring the existing phone settings UX). The existing OTP infrastructure (PhoneOTPRecord model, SMSService, rate limiting) is reused — the main work is adding unauthenticated OTP endpoints for registration, modifying auth views/serializers, and updating the frontend forms.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict mode (Frontend)
**Primary Dependencies**: Django REST Framework 3.x, rest_framework_simplejwt, Twilio SDK (Backend); Expo ~54.0.32, expo-router ~6.0.22, Tamagui ^1.136.6 (Frontend)
**Storage**: SQLite (dev) / PostgreSQL (prod) via Django ORM
**Testing**: Django `manage.py test api.tests` (Backend); manual + TypeScript typecheck (Frontend)
**Target Platform**: iOS & Android via Expo, Django API server
**Project Type**: Mobile + API
**Performance Goals**: OTP delivery < 30s (Twilio SLA), registration flow < 3 minutes end-to-end
**Constraints**: Taiwan mobile format only (09XXXXXXXX), offline not required for auth flows, Chinese (繁體中文) UI text
**Scale/Scope**: Small user base (<1k), 5 user stories, ~12 files modified, ~4 new files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Mobile-First Design | PASS | Phone registration is inherently mobile-first; touch-optimized OTP input already exists |
| II. API-Driven & Type-Safe | PASS | New endpoints will have serializers with field-level validation; frontend will define TypeScript interfaces matching response schemas |
| III. Quality Assurance | PASS | Authentication flow changes MUST have integration tests (constitution requirement); existing test_phone_otp.py pattern will be extended for registration OTP |

**Gate violations**: None. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/009-phone-registration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── register-phone.yaml
│   ├── login.yaml
│   ├── forgot-password-phone.yaml
│   └── register-otp.yaml
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py              # MODIFY: Add phone_verified field to StudentProfile, add 'purpose' to PhoneOTPRecord
│   ├── serializers.py         # MODIFY: Add RegistrationOTPSendSerializer, RegistrationOTPVerifySerializer, PhoneLoginSerializer, PhoneForgotPasswordSerializer, PhoneResetPasswordSerializer
│   ├── views/
│   │   ├── authentication.py  # MODIFY: Update login() to accept phone_number OR email
│   │   └── phone_otp.py       # MODIFY: Add unauthenticated send_registration_otp(), verify_registration_otp(), send_password_reset_otp(), verify_password_reset_otp()
│   └── services/
│       └── sms_service.py     # NO CHANGE: Reuse existing Twilio integration
├── Backend/
│   └── urls.py                # MODIFY: Add new registration OTP and phone-auth endpoints
└── tests/
    └── test_phone_otp.py      # MODIFY: Add registration OTP tests

Mobile-Frontend/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx                      # MODIFY: Swap to phone+password default, add email toggle
│   │   └── login-components/
│   │       └── LoginFormContainer.tsx      # MODIFY: Phone input as default, email toggle mode
│   ├── (tabs)/                            # NO CHANGE
│   ├── options-menu/
│   │   ├── phone-settings/                # NO CHANGE: Existing phone change flow stays as-is
│   │   └── email-settings/                # NEW: Optional email add/verify screen (mirrors phone-settings UX)
│   │       └── EmailSettings/
│   │           └── index.tsx
│   ├── services/
│   │   └── phoneOtpAPI.ts                 # MODIFY: Add unauthenticated registration OTP functions
│   └── utils/
│       └── authAPI.ts                     # MODIFY: Add register-phone and phone-login endpoints to public list
└── package.json                           # NO CHANGE
```

**Structure Decision**: Mobile + API pattern matching existing project layout. No new directories except `email-settings/` which mirrors existing `phone-settings/` pattern.

## Complexity Tracking

> No constitution violations. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
