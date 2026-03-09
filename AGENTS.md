# CouPro - Agent Instructions

## Cursor Cloud specific instructions

### Services overview

| Service | Directory | How to run | Port |
|---|---|---|---|
| Django Backend API | `Backend/` | `source Backend/.venv/bin/activate && python Backend/manage.py runserver 0.0.0.0:8000` | 8000 |
| Web Frontend (Next.js) | `Web-Frontend/` | `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev --prefix Web-Frontend` | 3000 |
| Consumer Mobile App (Expo) | `Mobile-Frontend/` | `npx expo start` (from that dir) | 8081 |
| Merchant Mobile App (Expo) | `Mobile-Merchant-Frontend/` | `npx expo start` (from that dir) | 8081 |

### Running commands

Standard commands are documented in `CLAUDE.md`. Key non-obvious notes:

- **Backend venv**: Always activate `Backend/.venv/bin/activate` before running any `manage.py` command.
- **Database**: SQLite is used by default in dev; no external DB setup needed. The DB auto-falls-back from PostgreSQL if `DATABASE_URL` is set but unreachable.
- **Migrations**: Run `python manage.py migrate` from `Backend/` after pulling changes — new migrations may have been added.
- **Web-Frontend API URL**: Set `NEXT_PUBLIC_API_URL=http://localhost:8000` when starting the dev server so it connects to the local backend instead of the production Render deployment.
- **SMS/Email in dev**: `SMS_DEV_MODE=True` by default (OTP codes logged to console). Email uses Django console backend (no Resend key needed).
- **Lint**: Mobile frontends use flat ESLint config (`eslint.config.js`). Web-Frontend uses legacy `.eslintrc.json` with `next lint`. The Merchant-Frontend has pre-existing lint errors in `jest.setup.js` (eslint doesn't recognize `jest` global there) — these are not regressions.
- **TypeScript**: Both mobile frontends have pre-existing type errors in test files and Tamagui config. App source code compiles cleanly.
- **Tests**: Backend: `python manage.py test api.tests`. Mobile-Frontend: `npx jest`. Mobile-Merchant-Frontend: `npx jest`. Web-Frontend has no test script configured.
- **User registration flow**: The API requires email verification (`verified=True` on `StudentProfile`) before login works. In dev, verify via Django shell since emails go to console.
