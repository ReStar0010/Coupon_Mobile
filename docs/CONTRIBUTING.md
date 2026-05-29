# Contributing Guide

<!-- AUTO-GENERATED: env vars, scripts, and command tables are derived from settings.py, requirements.txt, and package.json. Hand-written prose sections are marked below. -->

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10+ | Backend |
| Node.js | 18+ | Mobile-Frontend |
| npm | 9+ | Mobile-Frontend package manager |
| Expo CLI | via npx | `npx expo` — no global install needed |
| Docker (optional) | any | Local PostgreSQL via `docker compose` |

---

## Backend Setup

```bash
cd Backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Copy environment template and fill in values
cp .env.example .env          # (create this file if missing — see env table below)

# Apply migrations
python manage.py migrate

# Start development server (SQLite by default)
python manage.py runserver
```

### Local PostgreSQL (optional)

```bash
docker compose up -d          # starts Postgres; data stored in Backend/postgres_data/
# Set DATABASE_URL in Backend/.env then:
python manage.py migrate
```

### Backend Commands

<!-- AUTO-GENERATED from manage.py + README -->
| Command | Description |
|---------|-------------|
| `python manage.py runserver` | Start dev server (default port 8000) |
| `python manage.py migrate` | Apply pending migrations |
| `python manage.py makemigrations` | Create new migration files |
| `python manage.py test api tests` | Full test suite (app-level + project-level) |
| `python manage.py test api` | App-level tests only (`api/tests/`) |
| `python manage.py test tests` | Project-level tests only (`tests/`) |
| `python manage.py test tests.test_e2e_user_journeys` | E2E user journey tests |
| `python manage.py test tests.contract` | Contract tests (analytics, statistics) |
| `python manage.py shell` | Django interactive shell |
| `python manage.py create_sample_data` | Seed sample stores and coupons |
| `python manage.py seed_load_test` | Seed load test data |
| `python manage.py purge_load_test` | Remove load test data |
| `python manage.py reset_load_test` | Clear load test redemptions |
| `python manage.py recompute_progress` | Recompute user progress trackers |
| `python manage.py check_escalations` | Run moderation escalation checks |
| `python manage.py cleanup_old_reports` | Purge old moderation reports |
| `python manage.py backfill_coupon_templates` | Backfill coupon template fields |
| `python manage.py migrate_media_to_r2` | Migrate local media files to Cloudflare R2 |

### Running Tests with pytest

```bash
# From Backend/ with venv active
pytest                                    # all tests with coverage
pytest --cov=api --cov-report=html        # HTML coverage report
pytest api/tests/test_platform_voucher_views.py  # single module
```

pytest is configured in `pytest.ini` (`DJANGO_SETTINGS_MODULE = Backend.settings`, coverage threshold 30%).

---

## Mobile Frontend Setup

```bash
cd Mobile-Frontend
npm install
```

### Mobile Frontend Commands

<!-- AUTO-GENERATED from package.json scripts -->
| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server (Metro bundler) |
| `npm run android` | Build and run on Android device/emulator |
| `npm run ios` | Build and run on iOS simulator |
| `npm run web` | Start Expo web dev server |
| `npm test` | Run Jest test suite |
| `npm run test:watch` | Run Jest in interactive watch mode |
| `npm run test:coverage` | Run Jest with coverage report |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm run lint` | ESLint check across all JS/TS files |
| `npm run format` | ESLint auto-fix across all JS/TS files |
| `npm run clean` | Clear Expo cache and restart (`expo start -c`) |

### Key Dependencies

<!-- AUTO-GENERATED from package.json -->
| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~54.0.34 | React Native app platform |
| `expo-router` | ~6.0.23 | File-based navigation |
| `react-native-reanimated` | ~4.1.1 | High-performance animations |
| `react-native-maps` | 1.20.1 | Map view |
| `react-native-svg` | 15.12.1 | SVG rendering (spinner wheel) |
| `@sentry/react-native` | ~7.2.0 | Error tracking |
| `@react-native-firebase/*` | ^23.8.6 | Analytics and performance |
| `axios` | ^1.11.0 | HTTP client |
| `expo-secure-store` | ~15.0.8 | Secure token storage |

---

## Environment Variables

<!-- AUTO-GENERATED from Backend/Backend/settings.py -->

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | **Yes** (prod) | insecure dev key | Django secret key |
| `DATABASE_URL` | No | SQLite | PostgreSQL connection string (e.g. `postgres://user:pass@localhost:5432/coupro`) |
| `DEBUG` | No | `True` | Set to `False` in production |
| `API_BASE_URL` | No | `https://coupro-123.loca.lt` | Public URL of this backend (used in emails) |
| `FRONTEND_URL` | No | `https://app.coupro.pro` | Web consumer frontend URL |
| `WEB_CONSUMER_FLOW_ENABLED` | No | `false` | Route claim/collection pages to Web-Frontend |
| `EMAIL_BACKEND` | No | `console` | Set to `resend` backend class in production |
| `RESEND_API_KEY` | **Yes** (prod) | — | Resend transactional email API key |
| `FROM_EMAIL` | No | `noreply@coupro.pro` | Sender address for transactional emails |
| `ADMIN_EMAIL` | No | `duankayne@gmail.com` | Admin notification address |
| `SUPPORT_EMAIL` | No | `coupro707@gmail.com` | User-facing support address |
| `SUPPORT_URL` | No | terms site URL | Link included in deletion confirmation emails |
| `TWILIO_ACCOUNT_SID` | **Yes** (SMS) | — | Twilio account SID for OTP SMS |
| `TWILIO_AUTH_TOKEN` | **Yes** (SMS) | — | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | **Yes** (SMS) | — | Twilio sender phone number |
| `SMS_DEV_MODE` | No | `false` | Skip real SMS in dev/test (logs OTP instead) |
| `SENTRY_DSN` | No | — | Sentry project DSN for error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `1.0` | Trace sampling rate (use `0.1` in prod) |
| `SENTRY_PROFILES_SAMPLE_RATE` | No | `1.0` | Profile sampling rate (use `0.1` in prod) |
| `R2_ACCOUNT_ID` | No | — | Cloudflare R2 account ID (media storage) |
| `R2_ACCESS_KEY_ID` | No | — | R2 access key |
| `R2_SECRET_ACCESS_KEY` | No | — | R2 secret key |
| `R2_BUCKET_NAME` | No | — | R2 bucket name |
| `R2_PUBLIC_MEDIA_URL` | No | — | Public CDN URL for R2 media (e.g. `https://media.coupro.pro/`) |
| `LOAD_TEST_SECRET` | No | — | Shared secret for load test endpoints (header `X-Load-Test-Secret`) |
| `COUPRO_APP_STORE_ID` | No | — | iOS App Store ID (Universal Links) |
| `COUPRO_PLAY_STORE_ID` | No | `com.cokayne.MobileFrontend` | Android package name |
| `COUPRO_IOS_TEAM_ID` | No | — | Apple Team ID |
| `COUPRO_ANDROID_SHA256` | No | — | Android cert SHA-256 fingerprint |

---

## Code Style

### Backend (Python)

- PEP 8 naming conventions
- Type hints on all function signatures
- DRF serializers for all API input/output validation
- `from django.utils import timezone` for all datetime operations (never `datetime.now()`)
- No `print()` — use Python `logging` module

### Mobile Frontend (TypeScript)

- Strict mode enabled (`tsconfig.json`)
- Interfaces for all API request/response shapes
- `async/await` for all API calls
- Chinese UI text for user-facing strings
- Neo-brutalism design system: `src/theme/colors.ts`, `src/theme/typography.ts`

---

## Project Structure

```
Backend/
├── api/
│   ├── models.py              # All Django models
│   ├── serializers.py         # DRF serializers
│   ├── views/                 # View modules (auth, coupon, merchant, user, moderation, web_v1)
│   ├── urls/                  # URL routers per domain
│   ├── services/              # Business logic (email, SMS, analytics, moderation)
│   ├── management/commands/   # Django management commands
│   ├── migrations/            # Database migrations (0001 → 0052)
│   └── tests/                 # App-level tests
├── tests/                     # Project-level, E2E, and contract tests
├── Backend/                   # Django project config (settings, urls, wsgi)
├── docs/                      # Load test runbooks
└── manage.py

Mobile-Frontend/
├── app/
│   ├── (tabs)/                # Tab navigator screens (home, map, spinner, settings)
│   ├── coupon/                # Coupon detail, share, QR redemption routes
│   └── coupoint/              # CouPoint use and history routes
├── src/
│   ├── components/
│   │   ├── chrome/            # TabBar, StatusBar
│   │   ├── icons/             # GemIcon, LogoIcon
│   │   ├── onboarding/        # OnboardingOverlay
│   │   └── ui/                # BottomSheet, GemPips, Stepper, AnimNum
│   ├── features/
│   │   ├── coupon/            # CouponDetailScreen, CouponShareScreen, CouponUseQRScreen
│   │   ├── coupoint/          # CouPointUseScreen
│   │   ├── home/              # HomeScreen, CouPointsCard, HistoryScreen, HistoryDetailScreen
│   │   ├── map/               # MapScreen (NeoBrut web map)
│   │   ├── settings/          # SettingsScreen + modals
│   │   └── spinner/           # SpinnerScreen, WheelDial, CoopQRModal, MeltdownOverlay
│   ├── services/api/          # Axios API client modules
│   ├── context/               # WalletContext (gems, couPoints)
│   └── theme/                 # colors.ts, typography.ts
└── package.json
```

---

## PR Checklist

- [ ] Tests pass: `python manage.py test api tests` (backend) / `npm test` (frontend)
- [ ] TypeScript clean: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] New backend views have DRF serializer validation
- [ ] New migrations are backward-compatible or include data migration
- [ ] No secrets committed (API keys, tokens, passwords)
- [ ] UI strings in Chinese for consumer-facing copy
