# CouPro Backend

Django REST API backend for the CouPro coupon mobile app. Provides authentication, merchant and user profiles, coupon templates, redemption, sharing, daily draw, and UGC moderation.

## Running the server

From this directory (Backend):

```bash
python manage.py runserver
```

Use a virtual environment and install dependencies from `requirements.txt`.

## Running tests

All commands below are run from this directory (Backend root). No real SMS or email is sent when tests run; the test environment uses `SMS_DEV_MODE` or mocks.

| Goal | Command |
|------|--------|
| **Full suite** (app-level + project-level) | `python manage.py test api tests` |
| **App-level only** (api app tests) | `python manage.py test api` |
| **Project-level only** | `python manage.py test tests` |

## Test organization

- **Project-level tests** (`Backend/tests/`): Cross-cutting, contract, and E2E tests. Run with `python manage.py test tests`.
- **App-level tests** (`Backend/api/tests/`): API app behavior tests. Run with `python manage.py test api`.

Django discovers test modules matching `test_*.py` and test methods named `test_*`. For how to add a new test (location, naming, data setup, protected endpoints), see the quickstart at `specs/008-backend-test-coverage/quickstart.md`.
