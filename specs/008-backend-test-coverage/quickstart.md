# Quickstart: Backend Tests

**Feature**: 008-backend-test-coverage  
**Date**: 2026-02-16

## Prerequisites

- Python 3.10+ with Backend dependencies installed (use venv: `source .venv/bin/activate` or `.venv\Scripts\activate` on Windows).
- From repo root: `cd Backend`.

## Run tests

All commands are run from **Backend** (project root containing `manage.py`).

| Goal | Command |
|------|--------|
| **Full suite** (app + project-level) | `python manage.py test api tests` |
| **App-level only** (api app tests) | `python manage.py test api` |
| **Project-level only** | `python manage.py test tests` |

These commands MUST be documented in **Backend README** (`Backend/README.md`) per spec. No real SMS or email is sent when tests run (use `SMS_DEV_MODE=True` or mocks).

## Add a new test

1. **Choose location**:
   - **Project-level** (cross-app, contract, E2E): add a `test_*.py` under `Backend/tests/` (e.g. `tests/contract/`, or `tests/test_foo.py`). It will be run with `python manage.py test tests`.
   - **App-level** (API app behavior): add a `test_*.py` under `Backend/api/tests/`. It will be run with `python manage.py test api`.
2. **Naming**: Use `test_*.py` and test methods named `test_*` so Django discovers them.
3. **Data**: Create users, stores, templates, etc. in `setUp` (or equivalent). Do not rely on unversioned fixtures.
4. **Protected endpoints**: Include both authorized and (where relevant) unauthorized/wrong-role cases. Use `self.client.force_authenticate(user=self.user)` for auth.
5. **Errors**: For routes that can return 4xx/5xx, add assertions on status (and body/headers if relevant) so “documented error behavior” is satisfied.

## Coverage targets

- **Routes**: Every public route in [contracts/public-routes.md](./contracts/public-routes.md) must have at least one test that hits it and asserts on success or 4xx/5xx.
- **Critical flows**: Each critical flow (login, OTP, QR claim, account deletion, template analytics) must have at least one multi-step test. List is in [spec.md](./spec.md).

## CI

The full backend test suite MUST run in CI on every PR (or equivalent). No specific output format is required. A failing test MUST fail the CI run.
