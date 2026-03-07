# CouPro Backend

Django REST API backend for the CouPro coupon mobile app. Provides authentication, merchant and user profiles, coupon templates, redemption, sharing, daily draw, and UGC moderation.

## Running the server

From this directory (Backend):

```bash
python manage.py runserver
```

Use a virtual environment and install dependencies from `requirements.txt`.

### Local Postgres (Docker)

To use PostgreSQL locally, start the DB with `docker compose up -d`. Data is stored in **`Backend/postgres_data/`** (gitignored). That folder may be hidden in the file tree; the actual cluster files are under `postgres_data/18/docker/`. Set `DATABASE_URL` in `Backend/.env` (see `.env.example`), then run `python manage.py migrate`.

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

**E2E user journeys:** Full flows (register → login → token-based API calls) for consumer, merchant, and sharing (private + public) in `tests/test_e2e_user_journeys.py`. Run with `python manage.py test tests.test_e2e_user_journeys`.

**Contract tests (009):** Template analytics contract tests in `tests/contract/test_template_analytics.py` (date range params, date_range_cost). Merchant statistics contract tests in `tests/contract/test_merchant_statistics.py` (today_cost). Run with `python manage.py test tests.contract`.
