# Implementation Plan: Backend Test Coverage and Test Infrastructure

**Branch**: `008-backend-test-coverage` | **Date**: 2026-02-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/008-backend-test-coverage/spec.md`

## Summary

Establish a single documented command to run the full backend test suite (project-level + app-level), document subset commands in the Backend README, ensure every public API and web route has at least one test asserting success or 4xx/5xx behavior, ensure critical user flows have multi-step tests, and require CI to run the full suite on every PR. No new frameworks; use existing Django test runner and two test locations (Backend/tests, Backend/api/tests).

## Technical Context

**Language/Version**: Python 3.10+  
**Primary Dependencies**: Django, Django REST Framework, rest_framework_simplejwt, drf-yasg  
**Storage**: SQLite (dev), PostgreSQL (prod); test DB isolated per run  
**Testing**: Django test runner (`python manage.py test`), rest_framework.test.APIClient, unittest.mock and @override_settings for SMS/email  
**Target Platform**: Backend server (Linux/macOS for CI and local)  
**Project Type**: Mobile + API (Backend sibling to Mobile-Frontend, Mobile-Merchant-Frontend)  
**Performance Goals**: Suite completes in reasonable time; no numeric target in spec (plan or CI may set timeouts)  
**Constraints**: No real SMS/email in tests; test data created in setUp; admin and Swagger/ReDoc routes excluded from route-coverage requirement  
**Scale/Scope**: 83 public routes (authoritative list: specs/008-backend-test-coverage/contracts/public-routes.md, derived from Backend/Backend/urls.py excluding admin, swagger, redoc); 2 test locations; 5 critical flows (login, OTP, QR claim, account deletion, template analytics)

## Constitution Check

*GATE: Must pass before Design Phase 0 research. Re-check after Design Phase 1.*

- **III. Quality Assurance**: This feature directly implements constitution requirements (authentication integration tests, API contract/endpoint tests, regression coverage). No violation.
- **Technology Standards (Backend)**: Python 3.10+, Django, DRF, venv — aligned. Test runner is Django built-in; no new test framework introduced.
- **Development Workflow**: Test commands will be documented in Backend README; CI runs full suite on every PR. Aligned.

**Result**: PASS. No violations; feature reinforces constitution.

## Project Structure

*Note: "Phase 0" and "Phase 1" in this plan refer to **design** phases (research, design outputs). Implementation phases (Setup, Foundational, US1–US5, Polish) are defined in tasks.md and are separate.*

### Documentation (this feature)

```text
specs/008-backend-test-coverage/
├── plan.md              # This file
├── research.md          # Design Phase 0 output
├── data-model.md        # Design Phase 1 output (test inventory / entities)
├── quickstart.md        # Design Phase 1 output (run tests, add tests, CI)
├── contracts/           # Design Phase 1 output (route-coverage list)
│   └── public-routes.md
└── tasks.md             # Implementation tasks (/speckit.tasks — not created by plan)
```

### Source Code (repository root)

```text
Backend/
├── api/
│   ├── models.py
│   ├── serializers.py
│   ├── views/           # authentication, coupon_views, merchant_coupon, phone_otp, qr_claim, account_deletion, etc.
│   ├── services/
│   ├── utils.py
│   └── tests/           # App-level tests (python manage.py test api)
│       ├── __init__.py
│       └── test_account_deletion.py
├── tests/               # Project-level tests (python manage.py test tests)
│   ├── contract/
│   │   ├── test_qr_claim.py
│   │   ├── test_qr_claim_performance.py
│   │   └── test_template_analytics.py
│   ├── test_login_client_type.py
│   └── test_phone_otp.py
├── Backend/
│   ├── urls.py          # Source of truth for public routes
│   ├── settings.py
│   └── test_settings.py # Optional test overrides
├── README.md            # MUST document: full-suite command, app-only, project-level-only (to be added/updated)
└── manage.py
```

**Structure Decision**: Existing layout retained. Two test roots: `Backend/tests/` (project-level) and `Backend/api/tests/` (app-level). Full suite = `python manage.py test api tests` from Backend root. Documentation for commands goes in `Backend/README.md`.

## Complexity Tracking

*No constitution violations requiring justification.*
