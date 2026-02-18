# Data Model / Test Inventory: 008-backend-test-coverage

**Feature**: 008-backend-test-coverage  
**Date**: 2026-02-16

This feature does not introduce new domain entities or database tables. The following structures describe the **test inventory** and **coverage model** used to satisfy the spec.

## 1. Public route (coverage target)

- **Source**: `Backend/Backend/urls.py` — every `path()` / `re_path()` except:
  - `admin/`
  - `swagger`, `redoc` (and schema JSON/YAML)
- **Attributes**:
  - **path**: URL pattern (e.g. `api/login/`, `claim/<str:token>/`)
  - **method(s)**: HTTP method(s) exercised by tests (e.g. GET, POST); typically one primary method per route
  - **auth**: whether the route requires authentication / specific role (user vs merchant)
- **Validation**: Each public route MUST be mapped to at least one test that asserts on expected success and/or on a 4xx/5xx response (status and optionally body/headers).
- **Canonical list**: See [contracts/public-routes.md](./contracts/public-routes.md).

## 2. Critical user flow (multi-step test target)

- **List maintained in**: This feature spec (`spec.md`), Assumptions and FR-005.
- **Initial set**: Login (with client_type), phone OTP send/verify, QR session generate/claim (and claim landing), account deletion (pre-delete-check + delete), template analytics.
- **Attributes**:
  - **name**: Short identifier (e.g. "Login (user/merchant)", "QR claim E2E")
  - **sequence**: Ordered list of API/web requests (e.g. generate session → claim → GET claim landing)
  - **actor**: user or merchant where applicable
- **Validation**: Each critical flow MUST have at least one multi-step test that runs the sequence and asserts on outcome (success or documented failure).

## 3. Test locations (discovery)

- **Project-level tests**:
  - **Path**: `Backend/tests/`
  - **Run**: `python manage.py test tests`
  - **Discovery**: Django discovers modules matching test pattern under `tests/` (e.g. `test_*.py`).
  - **Purpose**: Cross-cutting, contract, performance (e.g. QR claim E2E, login client_type, phone OTP, template analytics).
- **App-level tests**:
  - **Path**: `Backend/api/tests/`
  - **Run**: `python manage.py test api`
  - **Discovery**: Django discovers tests in the `api` app’s `tests` package.
  - **Purpose**: API app behavior (e.g. account deletion).
- **Full suite**: Union of both — `python manage.py test api tests`.

## 4. Test suite (runtime artifact)

- **Definition**: The set of all tests executed by the full-suite command.
- **Properties**: Self-contained (no real SMS/email); deterministic; state isolated per test (e.g. DB rollback).
- **Test data**: Created in test setup (setUp or equivalent); no unversioned or undocumented shared fixtures required for default run.

## 5. Route–test mapping (coverage assessment)

- **Relationship**: Many-to-many in practice: one route can be hit by multiple tests; one test can hit multiple routes.
- **Requirement**: For every public route, at least one test must exercise it and assert on success or 4xx/5xx.
- **Protected routes**: Must have both authorized and (where relevant) unauthorized/wrong-role tests.

No state transitions or persistence model for these; they are inventory and discovery metadata for the test suite.
