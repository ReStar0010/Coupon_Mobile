# Local PostgreSQL for Backend Tests and Development — Brainstorm

**Date:** 2026-02-26  
**Scope:** One local Postgres used for (1) automated test suite (`manage.py test`) and (2) local development. Stage 4 load testing remains on the remote dev server.

---

## What We're Building

- **Local Postgres:** A way to run PostgreSQL locally so the Backend can use it for both development and tests.
- **Config:** When `DATABASE_URL` is set (e.g. in `.env`), base settings use Postgres; otherwise keep current SQLite default. Test settings inherit, so `manage.py test` and scripts using `test_settings` automatically use Postgres when `DATABASE_URL` is set.
- **Out of scope:** Running stage 4 load tests locally; those run on the remote dev server.

---

## Why This Approach

**Chosen approach: Docker Compose with a Postgres-only service.**

- **Single, reproducible setup** — One command to start Postgres; no system install or version drift.
- **Same as prod** — Prod already uses Postgres via `DATABASE_URL`; local mirrors that.
- **Tests and dev share one DB path** — No extra settings modules; `DATABASE_URL` flips both.
- **Optional later** — Can document “use system Postgres + DATABASE_URL” for non-Docker users (hybrid) without changing code.

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| How to run Postgres locally | Docker Compose, single Postgres service in **Backend/**. |
| Compose location | `docker-compose.yml` in **Backend/**. |
| Database | **Single** Postgres DB (e.g. `coupro_local`) for both dev and tests; Django test runner handles isolation. |
| Gitignore | Add Backend-local entries (e.g. `Backend/.env`, `Backend/postgres_data`) so secrets and local DB data are not committed. |
| When to use Postgres | If `DATABASE_URL` is set in env (e.g. `.env`), use `dj_database_url` in base `settings.py`; else keep SQLite. |
| Test settings | `test_settings.py` continues to inherit from `settings`; no separate “postgres test” settings file. |
| Stage 4 load testing | Unchanged; run on remote dev server. |
| CI | No change for now; CI can stay on SQLite unless we add a Postgres service later. |

---

## Approaches Considered

- **A. Docker Compose (Postgres only)** — Recommended. One compose file, dev runs Django on host, `DATABASE_URL` points at container.
- **B. Native Postgres** — Install via Homebrew etc., set `DATABASE_URL`. No Docker; more variation across machines.
- **C. Hybrid** — Same as A in code; docs also explain using system Postgres for those who prefer it.

---

## Resolved Questions

- **Compose location:** `docker-compose.yml` in **Backend/**.
- **Default DB:** **Single** Postgres database for both dev and test (Django test runner provides isolation).
- **Gitignore:** Add Backend-local entries for `.env` and local Postgres data (e.g. `postgres_data`) so they are not committed.

---

## References

- Existing: `Backend/Backend/production_settings.py` uses `dj_database_url.config(default=os.environ.get('DATABASE_URL'))`.
- Existing: `Backend/Backend/settings.py` uses SQLite; `load_dotenv()` already in place.
- Existing: `Backend/Backend/test_settings.py` overrides `DATABASES` to SQLite; will need to optionally use Postgres when `DATABASE_URL` is set (e.g. inherit from settings that already handle it, or check env in test_settings).
