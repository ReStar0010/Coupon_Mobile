# Implementation Plan: Platform Cash Voucher

**Branch**: `011-platform-cash-voucher` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/011-platform-cash-voucher/spec.md`

## Summary

Introduce **platform cash vouchers**: single-use, transferable vouchers not tied to a single store, redeemable only at stores explicitly marked as participating. Consumer redemption and share flows (private link, public pool, accept with race-safe handling) align with existing store-coupon behaviour. Management is admin-only; optional batch issue and optional merchant-initiated redeem. Unified redemption validation is extended to return both store coupons and platform vouchers so one screen can show all redeemable options when the user enters a store’s 6-digit code.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict (Mobile frontends)  
**Primary Dependencies**: Django, Django REST Framework, Expo/React Native (existing)  
**Storage**: Django ORM; SQLite (dev), PostgreSQL (prod). New models: PlatformVoucher, PlatformVoucherRedemption, PlatformVoucherShareRequest; Store gains optional `accepts_platform_vouchers` (or equivalent) flag.  
**Testing**: Django test runner, `rest_framework.test.APIClient`; tests in `Backend/api/tests/` or `Backend/tests/` per constitution.  
**Target Platform**: Backend API (Django); consumer and merchant mobile apps (Expo) unchanged for this feature except any new API consumption.  
**Project Type**: Mobile + API (Backend + Mobile-Frontend / Mobile-Merchant-Frontend).  
**Performance Goals**: Same as existing coupon flows; no new latency targets.  
**Constraints**: Do not change existing redeem_coupon, CouponShareRequest, or validate_unified_redemption_code logic except to add `available_platform_vouchers` to the validate response; store participation check required for platform voucher redemption.  
**Scale/Scope**: Same as current coupon/redemption scale; one redemption per platform voucher; share flow mirrors CouponShareRequest.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Mobile-First**: Unified redemption screen continues to serve mobile; new platform voucher list/detail and share flows are API-driven for existing mobile clients. ✅  
- **II. API-Driven & Type-Safe**: New endpoints have serializers and typed request/response; frontend interfaces must match backend contracts. ✅  
- **III. Quality Assurance**:  
  - Platform voucher redemption and share flows MUST have unit/integration tests (holder, expiry, already redeemed, store participation, race-safe accept). ✅  
  - Tests live in `Backend/api/tests/` or `Backend/tests/`; full suite runnable with `python manage.py test api tests` from Backend root. ✅  
  - No constitution violations; no extra projects or patterns that conflict with the principles.

## Project Structure

### Documentation (this feature)

```text
specs/011-platform-cash-voucher/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (API contracts)
└── tasks.md             # From /speckit.tasks (not created by /speckit.plan)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py              # Add PlatformVoucher, PlatformVoucherRedemption, PlatformVoucherShareRequest; extend Store
│   ├── admin.py               # PlatformVoucherAdmin, PlatformVoucherRedemptionAdmin, PlatformVoucherShareRequestAdmin
│   ├── serializers.py         # Platform voucher serializers
│   ├── views/
│   │   ├── coupon_views.py    # Extend validate_unified_redemption_code (add available_platform_vouchers)
│   │   ├── sharing_views.py   # Optional: shared helpers or reference only
│   │   └── platform_voucher_views.py  # New: list, detail, redeem, share, share-public, get_share, accept_share, my_public_shares
│   └── migrations/            # New migration(s) for platform voucher models and Store flag
├── tests/ or api/tests/      # Tests for platform voucher redemption, share, validate extension
└── Backend/urls.py           # Register platform voucher and (optional) merchant redeem routes

Mobile-Frontend/              # Consume new APIs (list, detail, redeem, share); no structural change
Mobile-Merchant-Frontend/     # Optional: merchant redeem-voucher UI
```

**Structure Decision**: Existing Backend + Mobile-Frontend + Mobile-Merchant-Frontend layout; all new backend code under `Backend/api/` with a dedicated `platform_voucher_views.py` and new models/serializers/admin; URLs registered in existing `Backend/Backend/urls.py`.

## Complexity Tracking

No constitution violations. No complexity table required.
