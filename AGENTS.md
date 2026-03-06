# CouPro Development Agent Instructions

See `CLAUDE.md` for full project structure, commands, and code style guidelines.

## Cursor Cloud specific instructions

### Services overview

| Service | Directory | Dev command | Port | Notes |
|---|---|---|---|---|
| Backend (Django) | `Backend/` | `source .venv/bin/activate && python manage.py runserver 0.0.0.0:8000` | 8000 | SQLite dev DB, zero external deps |
| Web-Frontend (Next.js) | `Web-Frontend/` | `NEXT_PUBLIC_API_URL=http://localhost:8000 npx next dev -p 3000` | 3000 | Consumer web UI |
| Mobile-Frontend (Expo) | `Mobile-Frontend/` | `EXPO_PUBLIC_BACKEND_MODE=local npx expo start` | 8081 | Consumer mobile app (native target) |
| Mobile-Merchant-Frontend (Expo) | `Mobile-Merchant-Frontend/` | `EXPO_PUBLIC_BACKEND_MODE=local npx expo start` | 8082 | Merchant mobile app (native target) |

### Non-obvious caveats

- **Backend venv**: `python3.12-venv` system package is required before creating venv. The update script handles this.
- **Expo web mode**: Both mobile frontends fail to bundle for web due to native-only modules (`react-native-maps`). This is expected—they target iOS/Android. Metro bundler starts fine and would serve native clients. Use `--web` flag only for quick smoke tests of non-map screens.
- **Email verification in dev**: Newly registered users need `verified=True` set via Django shell or tests. Console email backend prints verification links to terminal (no real email sent). `SMS_DEV_MODE=True` (default) logs OTP codes to console instead of sending SMS.
- **Backend Swagger UI**: `http://localhost:8000/swagger/` loads the UI frame but schema generation may show errors for some endpoints. The API itself works correctly—test via curl or Postman.
- **Mobile-Frontend lint**: The `eslint-config-expo` package is referenced in `eslint.config.js` but not listed in `package.json` devDependencies. The `npm run lint` script will fail. This is a pre-existing issue.
- **Environment variables for local dev**: Set `EXPO_PUBLIC_BACKEND_MODE=local` for mobile frontends to hit `localhost:8000`. Set `NEXT_PUBLIC_API_URL=http://localhost:8000` for Web-Frontend.
- **Backend tests**: Run `python manage.py test api.tests tests` from `Backend/` (with venv activated) to execute all 209 tests. Both `api.tests` and `tests` directories contain test files.
