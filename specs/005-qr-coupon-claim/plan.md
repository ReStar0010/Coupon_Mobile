# Implementation Plan: QR Code Coupon Claim

**Branch**: `005-qr-coupon-claim` | **Date**: 2026-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-qr-coupon-claim/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature enables merchants to generate QR codes for coupon templates in their Collections (專屬優惠) detail page, and allows users to scan these QR codes to claim coupons. The QR codes contain a template ID and a session token, and are only valid while the merchant keeps the QR code display open. When users scan the QR code, the system validates the session token, checks template availability, and creates a coupon instance with acquisition method `'qr_claim'`. The feature requires backend API endpoints for QR code session management and claim processing, plus frontend UI components for QR code generation (merchant app) and scanning (user app).

## Technical Context

**Language/Version**: Python 3.10+ (backend), TypeScript 5.9+ (frontend)  
**Primary Dependencies**: Django 5.2, Django REST Framework 3.16.0, Expo ~54.0, React Native 0.81.5, Tamagui 1.136+, expo-camera ~17.0.10  
**Storage**: SQLite (dev), PostgreSQL (prod) - Django ORM models for QR code sessions  
**Testing**: Django test framework, pytest (backend), Jest (frontend)  
**Target Platform**: iOS/Android mobile apps (Expo), Django REST API backend  
**Project Type**: Mobile + API (separate consumer app, merchant app, and backend API)  
**Performance Goals**: QR code generation < 1s, claim operation < 5s end-to-end, 95% success rate for valid scans  
**Constraints**: QR codes must be invalidated when merchant closes display, session tokens must be unique and time-limited, must handle race conditions for last available coupon  
**Scale/Scope**: Multiple concurrent QR code sessions per merchant, multiple users scanning same QR code simultaneously

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Mobile-First Design ✅
- **UI Components**: QR code display and camera scanning are mobile-native features
- **Offline Capability**: Not required for this feature (network needed for claim validation)
- **Performance**: QR code generation < 1s, claim operation < 5s (meets < 3s initial load, < 100ms interaction budgets)
- **Screen Layouts**: QR code modal and camera view support various device sizes
- **Images**: QR code generation uses URL-based service (progressive loading not needed for small QR codes)

### II. API-Driven & Type-Safe Architecture ✅
- **Backend Serializers**: New endpoints will have complete serializer definitions with field-level validation
- **Frontend Types**: TypeScript interfaces will match backend response schemas
- **API Versioning**: Following existing RESTful conventions, no breaking changes
- **Error Responses**: Consistent error response structures matching existing patterns
- **Type Hints**: Python backend uses type hints, TypeScript strict mode enabled

### III. Quality Assurance ✅
- **Authentication**: QR code claim endpoint requires user authentication (IsAuthenticated)
- **Edge Cases**: Must test expired sessions, invalid tokens, race conditions, out-of-stock templates
- **API Contracts**: Contract tests for new endpoints (session generation, claim, invalidation)
- **Database Migrations**: New QRCodeSession model requires migration with upgrade/downgrade tests

**Gate Status**: ✅ PASS - All constitution principles satisfied

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
│   ├── models.py                    # Add QRCodeSession model
│   ├── serializers.py               # Add QR code session and claim serializers
│   ├── views/
│   │   └── qr_claim.py              # New: QR code session and claim endpoints
│   └── migrations/
│       └── XXXX_add_qrcode_session.py
└── tests/
    └── contract/
        └── test_qr_claim.py         # Contract tests for QR claim endpoints

Mobile-Merchant-Frontend/
└── app/
    └── (coupons)/
        └── [id]/
            └── qr-code.tsx           # New: QR code generation and display component

Mobile-Frontend/
└── app/
    ├── components/
    │   └── QRClaimScanner.tsx       # New: QR code scanner component
    └── index.tsx                     # Add "Scan to Claim Coupon" button
```

**Structure Decision**: Mobile + API structure. Backend API adds new endpoints in `api/views/qr_claim.py` and new model in `api/models.py`. Merchant frontend adds QR code display component in coupon detail page. User frontend adds scanner component and navigation button.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | No violations | All constitution principles satisfied |

## Implementation Status

### Phase 0: Outline & Research ✅ COMPLETE
- **research.md**: Generated with all technical decisions documented
- All NEEDS CLARIFICATION items resolved
- Technology choices documented with rationale

### Phase 1: Design & Contracts ✅ COMPLETE
- **data-model.md**: Generated with QRCodeSession model, schema, and validation rules
- **contracts/qr-claim-api.yaml**: OpenAPI 3.0 specification for all endpoints
- **quickstart.md**: Generated with setup instructions, API usage, and testing guide
- **Agent Context**: Updated `.cursor/rules/specify-rules.mdc` with new technology stack

### Phase 2: Task Breakdown
- **Status**: Pending (to be generated by `/speckit.tasks` command)
- **Output**: `tasks.md` with implementation tasks

## Generated Artifacts

1. **research.md** - Technical decisions and rationale
2. **data-model.md** - Database schema and entity relationships
3. **contracts/qr-claim-api.yaml** - API contract specification
4. **quickstart.md** - Developer setup and usage guide
5. **Agent context updated** - Cursor IDE rules file updated

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement backend endpoints (see `data-model.md` and `contracts/`)
3. Implement frontend components (see `quickstart.md`)
4. Write tests (see `quickstart.md` for test cases)
5. Test end-to-end flow
