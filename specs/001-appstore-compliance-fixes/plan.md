# Implementation Plan: App Store Compliance Fixes

**Branch**: `001-appstore-compliance-fixes` | **Date**: 2026-01-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-appstore-compliance-fixes/spec.md`

## Summary

This feature addresses two critical App Store compliance issues blocking app publication:

1. **Photo Library Permission Purpose String**: Update Info.plist to provide a clear, specific purpose string explaining why photo access is needed (e.g., "to upload your business logo"), and implement a permission denied dialog with "Open Settings" link.

2. **Account Deletion**: Implement in-app account deletion for merchants, including password verification, data permanence warnings, coupon anonymization (keeping active coupons valid), and proper cleanup.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict mode (Mobile Frontend)
**Primary Dependencies**: Django REST Framework (Backend), Expo/React Native with expo-image-picker ~17.0.10 (Frontend)
**Storage**: SQLite (dev) / PostgreSQL (prod) via Django ORM
**Testing**: Django test framework (Backend), manual testing (Frontend)
**Target Platform**: iOS (App Store submission), Android secondary
**Project Type**: Mobile + API (Mobile-Merchant-Frontend + Backend)
**Performance Goals**: initial load < 3s on 4G, interaction response < 100ms (per constitution)
**Constraints**: Offline-capable for critical flows, must pass Apple Guideline 5.1.1
**Scale/Scope**: Single merchant app, ~50 screens, cascading data relationships

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| **I. Mobile-First Design** | ✅ PASS | Account deletion UI designed for touch, photo permission dialogs are native iOS patterns |
| **II. API-Driven & Type-Safe** | ✅ PASS | New endpoint requires serializer, TypeScript interface for request/response |
| **III. Quality Assurance** | ✅ PASS | Account deletion is critical path, requires integration tests; password verification must be tested |
| **Virtual Env Required** | ✅ PASS | Backend work will use `.venv/Scripts/activate` |
| **Conventional Commits** | ✅ PASS | Will use `feat:` for new functionality |

**Pre-Design Gate Status: PASSED** - No violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/001-appstore-compliance-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── account-deletion.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py              # Existing - may need AccountDeletionLog model
│   ├── serializers.py         # Add AccountDeletionSerializer
│   ├── views/
│   │   ├── authentication.py  # Existing - password verification pattern
│   │   └── account_deletion.py # NEW - account deletion endpoint
│   └── utils.py               # Existing utilities
├── tests/
│   └── test_account_deletion.py # NEW - deletion tests
└── Backend/
    └── urls.py                # Add new endpoint route

Mobile-Merchant-Frontend/
├── app/
│   ├── (profile)/
│   │   ├── index.tsx          # MODIFY - add "Delete Account" button
│   │   └── delete-account.tsx # NEW - deletion confirmation flow
│   └── components/
│       └── ui/
│           └── PermissionDeniedModal.tsx # NEW - photo permission dialog
├── utils/
│   └── api.ts                 # Add deleteAccount() function
└── app.json                   # MODIFY - add NSPhotoLibraryUsageDescription
```

**Structure Decision**: Mobile + API structure, modifications to existing Backend and Mobile-Merchant-Frontend directories.

## Complexity Tracking

> No violations - table not required.

---

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Compliance | Design Validation |
|-----------|------------|-------------------|
| **I. Mobile-First Design** | ✅ PASS | Multi-step deletion flow with touch-friendly buttons; PermissionDeniedModal follows iOS HIG patterns; all screens support various device sizes |
| **II. API-Driven & Type-Safe** | ✅ PASS | OpenAPI contract defined (contracts/account-deletion.yaml); AccountDeletionSerializer for input validation; TypeScript interfaces specified in quickstart.md |
| **III. Quality Assurance** | ✅ PASS | Test file defined (test_account_deletion.py); password verification covered; edge cases documented in data-model.md |
| **Offline Capability** | ✅ PASS | Pending deletion status with retry mechanism handles network failures |
| **Performance Budget** | ✅ PASS | No heavy processing; deletion is single API call; no impact on load times |

**Post-Design Gate Status: PASSED** - Design aligns with all constitution principles.

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](research.md) | ✅ Complete |
| Data Model | [data-model.md](data-model.md) | ✅ Complete |
| API Contract | [contracts/account-deletion.yaml](contracts/account-deletion.yaml) | ✅ Complete |
| Quickstart | [quickstart.md](quickstart.md) | ✅ Complete |
| Tasks | tasks.md | ⏳ Pending (`/speckit.tasks`) |

---

## Next Steps

Run `/speckit.tasks` to generate the implementation task list from this plan.
