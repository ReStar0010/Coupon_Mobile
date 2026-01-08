# Implementation Plan: Unified Redemption QR Code

**Branch**: `001-unified-redemption-qr` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-unified-redemption-qr/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Refactor the coupon redemption flow to use a unified QR code entry point instead of requiring merchants to navigate to individual coupon pages. The unified QR code contains a unified redemption code (6-digit numeric format, digits 0-9 only, e.g., "123456") that identifies the merchant/store and works for all coupons from that merchant. When consumers scan the unified QR code, they see their available coupons for that merchant and can select one to redeem. The existing redemption validation logic remains unchanged; only the entry point and QR code generation mechanism changes.

**Technical Approach**: 
- Add `unified_redeem_code` field to `Store` model (CharField, max_length=6, 6-digit numeric format, digits 0-9 only, null=True, blank=True, unique=True). This field stores the Unified Redemption Code entity. **Field Lifecycle**: The field is generated on-demand when the merchant clicks the unified redemption button (per FR-001). The field is updated (not created) each time - it should never remain null for a store that has been used for unified redemption. If a store exists, code generation MUST always succeed and populate this field. The nullable constraint allows for stores that have never used unified redemption, but once generated, the field should always contain a valid 6-digit code.
- Create new API endpoints for unified code generation and validation
- Extend existing redemption endpoint to accept unified codes
- Frontend modifications to connect unified redemption button and handle unified QR code scanning
- Deprecate individual coupon QR code generation while preserving phone number functionality

## Technical Context

**Language/Version**: Python 3.10+ (Django 5.2), TypeScript (strict mode) with Expo/React Native  
**Primary Dependencies**: Django REST Framework, djangorestframework-simplejwt, Expo Router, Tamagui, expo-camera  
**Storage**: SQLite (dev), PostgreSQL (prod) - Django ORM models  
**Testing**: Django test framework, pytest (for backend), Jest/React Native Testing Library (for frontend)  
**Target Platform**: Mobile (iOS/Android via Expo), Backend API (Django REST Framework)  
**Project Type**: Mobile + API (Expo frontend + Django backend)  
**Performance Goals**: 
- Unified QR code generation: < 2 seconds (SC-001)
- Consumer scan to coupon list display: < 3 seconds (SC-002)
- 95% success rate for QR code scans (SC-003)
- API response time: < 200ms p95 for redemption endpoints  
**Constraints**: 
- Must maintain existing redemption validation logic (no changes to core validation)
- Must preserve phone number functionality on individual coupon pages
- Must support offline QR code display (generated codes cached locally)
- Must handle concurrent redemptions from multiple consumers  
**Scale/Scope**: 
- Multiple merchants, each with one store
- Consumers may have multiple coupons per merchant
- QR codes generated on-demand per merchant action
- Existing coupon redemption infrastructure (models, APIs) remains unchanged

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Mobile-First Design ✅
- **UI Components**: Unified redemption button and QR code modal already exist in Merchant-Mobile-Frontend (per spec)
- **Touch Interaction**: QR code modal uses existing modal component designed for touch
- **Performance**: QR code generation target < 2s meets < 3s initial load requirement
- **Screen Layouts**: Modal overlay works across device sizes
- **Status**: PASS - No violations

### II. API-Driven & Type-Safe Architecture ✅
- **Backend Serializers**: Must create new serializers for unified redemption code generation/validation
- **Frontend Types**: Must define TypeScript interfaces for unified redemption flow
- **API Versioning**: New endpoints follow existing REST conventions
- **Error Responses**: Must use consistent error response structures
- **Type Hints**: Python backend uses type hints (existing pattern)
- **TypeScript Strict Mode**: Frontend already uses strict mode
- **Status**: PASS - Must ensure new endpoints follow existing patterns

### III. Quality Assurance ⚠️
- **Authentication Flows**: Must test merchant authentication for QR code generation
- **Redemption Logic**: Must test unified code validation + existing coupon validation
- **API Endpoints**: Must create contract tests for new unified redemption endpoints
- **Edge Cases**: Must test no coupons available, invalid QR codes, concurrent redemptions
- **Status**: PASS - Testing requirements identified, must implement in Phase 2

**Overall Gate Status**: ✅ **PASS** - All constitution principles can be satisfied with proper implementation

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
│   ├── models.py                    # Store model (existing), may add UnifiedRedemptionCode model
│   ├── serializers.py               # Add unified redemption serializers
│   ├── views/
│   │   ├── merchant_coupon.py       # Add unified QR code generation endpoint
│   │   └── coupon_views.py          # Add unified redemption validation endpoint
│   └── utils.py                     # May add unified code generation helper
└── tests/
    └── test_unified_redemption.py   # New test file for unified redemption

Mobile-Merchant-Frontend/
├── app/
│   └── (coupons)/
│       ├── components/
│       │   └── QRCode.tsx           # Existing QR code modal component (reuse)
│       └── index.tsx                # Coupon list page with unified redemption button (already exists)
└── utils/
    └── api.ts                        # Add unified redemption API calls

Mobile-Frontend/
├── app/
│   └── EasyUse/
│       └── [id]/
│           └── redeem/
│               └── index.tsx        # Modify to handle unified QR code scanning
└── services/
    └── api.ts                        # Add unified redemption API calls
```

**Structure Decision**: Mobile + API structure. Backend adds new endpoints to existing Django REST Framework API. Frontend modifications extend existing Expo/React Native apps. No new projects required - changes integrate into existing codebase structure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
