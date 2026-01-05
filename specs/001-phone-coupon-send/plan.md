# Implementation Plan: Phone-Based Coupon Send

**Branch**: `001-phone-coupon-send` | **Date**: 2026-01-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-phone-coupon-send/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable merchants to send coupons to specific users via phone number, and allow users to register their phone numbers in the user-side app. The system supports sending coupons to both registered and unregistered phone numbers (pending coupons), with automatic assignment when users register their phone numbers.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript 5.9+ (Mobile Frontends)
**Primary Dependencies**: Django 5.2 + Django REST Framework 3.16, Expo ~54 + React Native 0.81.5, Tamagui 1.136+ (UI)
**Storage**: SQLite (dev), PostgreSQL (prod) - existing setup
**Testing**: Django Test Framework (Backend), Jest (Frontend) - existing patterns
**Target Platform**: iOS/Android via Expo, Django REST API backend
**Project Type**: Mobile + API (multiple frontends with shared backend)
**Performance Goals**: API response < 200ms, UI interaction response < 100ms (per constitution)
**Constraints**: Initial load < 3s on 4G, offline capability for viewing owned coupons (per constitution)
**Scale/Scope**: Existing user base, 2 mobile apps (User + Merchant), 1 Django backend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence/Notes |
|-----------|--------|----------------|
| I. Mobile-First Design | PASS | Feature adds UI components to existing mobile apps with touch-first design |
| II. API-Driven & Type-Safe | PASS | REST endpoints with serializers exist, TypeScript interfaces in frontends |
| III. Quality Assurance | PASS | Will add tests for new phone validation and coupon sending logic |

**Specific Checks:**

1. **Touch interaction first** - PASS: Phone input fields use existing Input components designed for mobile
2. **Offline capability** - PASS: Coupons once received appear in user's collection (existing offline-capable flow)
3. **Performance budgets** - PASS: New API endpoints are simple lookups (< 200ms)
4. **Complete serializer definitions** - PASS: `ConsolidateCouponSerializer` already exists with field validation
5. **TypeScript interfaces matching backend** - WILL IMPLEMENT: Add phone number types to frontend interfaces
6. **Consistent error response structures** - PASS: Existing error patterns in `merchant_coupon.py`
7. **Authentication flows tested** - WILL IMPLEMENT: Add tests for merchant-only endpoint restriction
8. **Coupon logic edge cases** - WILL IMPLEMENT: Test pending coupon assignment, expiration handling

**Security Fix Required:**
- `merchant_consolidate_coupon` currently uses `AllowAny` permission (line 28 in `merchant_coupon.py`)
- MUST change to `IsAuthenticated` per FR-014

## Project Structure

### Documentation (this feature)

```text
specs/001-phone-coupon-send/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # API contracts
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py              # StudentProfile.phone_number (exists), Coupon.pending_phone_number (new)
│   ├── serializers.py         # ConsolidateCouponSerializer (exists), add user phone serializers
│   └── views/
│       ├── merchant_coupon.py # merchant_consolidate_coupon (exists, needs auth fix + pending support)
│       ├── user_profile.py    # Add phone number management endpoints
│       └── authentication.py  # Modify registration to handle pending coupon assignment
├── Backend/
│   └── urls.py               # Add new user phone endpoints

Mobile-Frontend/
├── app/
│   ├── OptionsMenu/
│   │   ├── index.tsx              # Add phone number display/edit navigation
│   │   └── PhoneSettings/
│   │       └── index.tsx          # New: Phone number management screen
│   ├── utils/
│   │   └── authAPI.ts        # Add phone number API methods
│   └── config/
│       └── api.ts            # Existing API config

Mobile-Merchant-Frontend/
├── app/
│   └── (coupons)/
│       └── [id].tsx          # Modify to call consolidate-coupon API
├── utils/
│   └── api.ts                # Add consolidate coupon API method
```

**Structure Decision**: Mobile + API pattern selected as project already has two mobile frontends (User and Merchant) with a shared Django REST backend. Changes are distributed across all three codebases.

## Complexity Tracking

> No constitution violations requiring justification. Feature uses existing patterns and infrastructure.

| Aspect | Complexity | Justification |
|--------|------------|---------------|
| New model field | Low | Single nullable field `pending_phone_number` on existing Coupon model |
| API changes | Low | Extend existing `merchant_consolidate_coupon`, add 2 new user endpoints |
| Frontend changes | Low | Add phone input screen to user app, connect existing button in merchant app |
| Pending coupon flow | Medium | New business logic for deferred coupon assignment on registration |

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Mobile-First Design | PASS | PhoneSettings screen uses Tamagui components, phone-pad keyboard type |
| II. API-Driven & Type-Safe | PASS | OpenAPI spec defined in contracts/, TypeScript interfaces in quickstart.md |
| III. Quality Assurance | PASS | Test checklist included in quickstart.md with edge cases |

**All gates PASSED. Design is ready for task generation.**
