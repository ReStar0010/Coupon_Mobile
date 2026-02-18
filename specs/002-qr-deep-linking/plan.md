# Implementation Plan: QR Code Deep Linking

**Branch**: `002-qr-deep-linking` | **Date**: 2026-02-05 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-qr-deep-linking/spec.md`

## Summary

Refactor the QR code claim flow to support deep linking: QR codes encode a claim URL (web or app scheme) with a single claim token. When scanned outside the app, the URL opens the app and starts the claim flow; when the app is not installed, the user sees a landing page (same pattern as share link) with install guidance and store links. The in-app scanner accepts only deep-link URL format and retains existing re-scan prevention; legacy JSON QR payloads are out of scope. Claim tokens are single-use and short-lived; the backend resolves the token to template_id and session_token. Merchant/system generates the claim QR; users only scan and claim.

## Technical Context

**Language/Version**: Python 3.10+ (Backend), TypeScript strict (Mobile-Frontend, Mobile-Merchant-Frontend)  
**Primary Dependencies**: Django REST Framework, Expo (React Native), expo-router, expo-linking, Tamagui  
**Storage**: SQLite (dev) / PostgreSQL (prod) via Django ORM; existing QRCodeSession, CouponTemplate, QRCodeClaim  
**Testing**: pytest (Backend), contract tests for API; Expo/React Native tests for mobile  
**Target Platform**: Backend (Linux server); Mobile-Frontend (iOS/Android via Expo); Mobile-Merchant-Frontend (merchant QR display)  
**Project Type**: Mobile + API (Backend, Mobile-Frontend, Mobile-Merchant-Frontend)  
**Performance Goals**: Initial load &lt; 3s on 4G (constitution); claim flow response &lt; 100ms (constitution: interaction response)  
**Constraints**: Re-scan prevention behaviour unchanged; no legacy JSON in QR; claim token single-use/short-lived  
**Scale/Scope**: Same as existing QR claim (merchant-generated sessions); one claim URL pattern aligned with share link

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Mobile-First Design | Pass | Deep link and landing page are mobile-focused; touch-first. |
| API-Driven & Type-Safe | Pass | New/updated endpoints have serializers and TypeScript types; claim-by-token contract. |
| Quality Assurance | Pass | Claim flow and redemption logic require tests; contract tests for claim-by-token. |
| Python venv (Backend) | Pass | All backend work uses `.venv`. |
| REST + JSON, type hints, strict TS | Pass | REST APIs; Python type hints; TypeScript strict. |

No violations. Complexity Tracking table left empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-qr-deep-linking/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (claim deep link API)
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py              # QRCodeSession (existing); no new model for claim token (use session_token)
│   ├── views/
│   │   ├── qr_claim.py        # Extend: claim by token; generate returns claim URLs; fix template binding
│   │   └── sharing_views.py   # Add claim_landing (same pattern as collection_landing)
│   ├── serializers.py         # ClaimByTokenRequest, extend GenerateQRSessionResponse
│   └── templates/
│       └── claim_landing.html # New (install + store links only)
├── Backend/
│   └── urls.py                # Add /claim/<token>/; extend AASA/assetlinks paths
└── tests/
    └── contract/              # Claim-by-token, claim landing

Mobile-Frontend/
├── app/
│   ├── _layout.tsx            # Deep link handling (claim URL -> claim flow)
│   ├── EasyUse/
│   │   └── qr-claim.tsx       # Scanner: accept only URL; parse token; re-scan prevention unchanged
│   └── claim/                 # Optional route for claim?token= (or handle in existing flow)
└── app.json                   # associatedDomains: add /claim path if needed

Mobile-Merchant-Frontend/
└── app/
    └── (coupons)/             # QR display: encode claim URL (from API) in QR instead of JSON
```

**Structure Decision**: Backend + Mobile-Frontend + Mobile-Merchant-Frontend. Backend adds claim landing route and claim-by-token support; Mobile-Frontend handles deep links and in-app URL-only scanner; Mobile-Merchant-Frontend switches QR content from JSON to claim URL.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

(No violations.)
