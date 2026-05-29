# CouPro Development Guidelines

Last updated: 2026-05-08

## Active Technologies

**Backend:**

- Language: Python 3.10+
- Framework: Django 5.2 + Django REST Framework 3.16
- Database: SQLite (dev), PostgreSQL (prod via `DATABASE_URL`)
- Authentication: JWT via `rest_framework_simplejwt`
- Email: Resend API (`resend` SDK)
- SMS / OTP: Twilio SDK
- Media storage: Cloudflare R2 (`django-storages[s3]`); falls back to local `FileSystemStorage`
- Error tracking: Sentry (`sentry-sdk`)
- Serving: Gunicorn + UvicornWorker (ASGI); WhiteNoise for static files

**Mobile Frontend:**

- Framework: Expo ~54.0.34 (React Native 0.81.5, React 19.1.0)
- Language: TypeScript strict mode
- UI: custom neo-brutalism design system (`src/theme/`) — no external UI library
- State Management: React Context + hooks (`WalletContext` for gems/couPoints)
- Navigation: Expo Router ~6.0.23 (file-based)
- Animations: react-native-reanimated ~4.1.1
- Error tracking: `@sentry/react-native` ~7.2.0
- Analytics: `@react-native-firebase/analytics` ^23.8.6

## Project Structure

```text
Backend/
├── api/
│   ├── models.py                  # All Django models
│   ├── serializers.py             # DRF serializers
│   ├── views/                     # View modules
│   │   ├── authentication.py      # Login, register, password reset
│   │   ├── phone_otp.py           # OTP send/verify
│   │   ├── user_profile.py        # User stats, history, phone
│   │   ├── merchant_coupon.py     # Merchant coupon CRUD
│   │   ├── merchant_profile.py    # Merchant profile + stats
│   │   ├── coupon_views.py        # Consumer coupon views
│   │   ├── sharing_views.py       # Coupon sharing (private + public)
│   │   ├── platform_voucher_views.py  # Platform voucher CRUD + sharing
│   │   ├── daily_draw.py          # Daily draw flow
│   │   ├── qr_claim.py            # QR session generate/claim
│   │   ├── content_moderation.py  # UGC reporting and blocking
│   │   ├── admin_moderation.py    # Admin moderation dashboard
│   │   ├── eula_acceptance.py     # EULA, terms, privacy policy
│   │   ├── consumer_account_deletion.py
│   │   ├── account_deletion.py    # Merchant account deletion
│   │   ├── feedback.py
│   │   ├── events.py              # Template view tracking
│   │   └── web_v1/                # Unauthenticated web consumer endpoints
│   ├── urls/                      # URL routers per domain
│   ├── services/                  # email_service, sms_service, analytics_service, moderation_service
│   ├── management/commands/       # Seed, purge, backfill, migrate-media commands
│   ├── migrations/                # DB migrations (0001 → 0052)
│   └── tests/                     # App-level tests
├── tests/                         # Project-level, E2E, and contract tests
├── Backend/                       # Django project config (settings, urls, wsgi)
└── manage.py

Mobile-Frontend/
├── app/
│   ├── (tabs)/                    # Tab screens: home, map, spinner, settings
│   ├── coupon/                    # Coupon detail, share, QR redemption routes
│   └── coupoint/                  # CouPoint use + history routes
├── src/
│   ├── components/
│   │   ├── chrome/                # TabBar, StatusBar
│   │   ├── icons/                 # GemIcon, LogoIcon
│   │   ├── onboarding/            # OnboardingOverlay
│   │   └── ui/                    # BottomSheet, GemPips, Stepper, AnimNum
│   ├── features/
│   │   ├── coupon/                # CouponDetailScreen, CouponShareScreen, CouponUseQRScreen
│   │   ├── coupoint/              # CouPointUseScreen
│   │   ├── home/                  # HomeScreen, CouPointsCard, HistoryScreen, HistoryDetailScreen
│   │   ├── map/                   # MapScreen (NeoBrut web map variants)
│   │   ├── settings/              # SettingsScreen + modals
│   │   └── spinner/               # SpinnerScreen, WheelDial, CoopQRModal, MeltdownOverlay
│   ├── services/api/              # Axios API client modules
│   ├── context/                   # WalletContext (gems, couPoints)
│   └── theme/                     # colors.ts, typography.ts (neo-brutalism tokens)
└── package.json
```

## Commands

**Backend (always activate venv first):**

```bash
cd Backend
.venv\Scripts\activate              # Windows
source .venv/bin/activate           # Unix/macOS

python manage.py runserver          # Start dev server
python manage.py makemigrations     # Create migrations
python manage.py migrate            # Apply migrations
python manage.py test api tests     # Full test suite
python manage.py test api           # App-level tests only
python manage.py test tests         # Project-level tests only
python manage.py shell              # Django shell
```

**Mobile Frontend:**

```bash
cd Mobile-Frontend
npm install                         # Install dependencies
npm start                           # Start Expo dev server
npm run android                     # Run on Android
npm run ios                         # Run on iOS simulator
npm test                            # Jest tests
npm run test:coverage               # Jest with coverage
npm run typecheck                   # TypeScript check
npm run lint                        # ESLint
npm run clean                       # Clear Expo cache
```

## Code Style

**Python (Backend):**

- Type hints on all function signatures
- PEP 8 naming conventions
- DRF serializers for all API input/output validation
- `from django.utils import timezone` — never `datetime.now()`
- No `print()` — use the `logging` module

**TypeScript (Frontend):**

- Strict mode enabled
- Interfaces for all API request/response shapes
- `async/await` for all API calls
- Chinese UI text for consumer-facing copy
- Design tokens only from `src/theme/` — no inline hex colors or font sizes

## Detailed Docs

- `docs/CONTRIBUTING.md` — full setup, commands, env vars, PR checklist
- `docs/RUNBOOK.md` — deployment, API reference, common issues, rollback

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
