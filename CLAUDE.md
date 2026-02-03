# CouPro Development Guidelines

Auto-generated from feature plans. Last updated: 2026-01-07

## Active Technologies
- TypeScript (Mobile Frontend - Expo/React Native), Python 3.10+ (Backend - Django) (001-appstore-comliance-fixes)
- Backend uses Django ORM with SQLite (dev) / PostgreSQL (prod) for merchant account data (001-appstore-comliance-fixes)
- Python 3.10+ (Backend), TypeScript strict mode (Mobile Frontend) + Django REST Framework (Backend), Expo/React Native with expo-image-picker ~17.0.10 (Frontend) (001-appstore-compliance-fixes)
- SQLite (dev) / PostgreSQL (prod) via Django ORM (001-appstore-compliance-fixes)
- Python 3.10+ (Backend), TypeScript strict mode (Mobile Frontend) + Django REST Framework 3.x, Expo/React Native, Tamagui UI, Resend API (email), rest_framework_simplejwt (auth) (007-ugc-compliance)
- TypeScript (strict mode), React 19.1.0, React Native 0.81.5 + Expo ~54.0.32, expo-router ~6.0.22, Tamagui ^1.136.6, react-native-reanimated ~4.1.1 (008-navigation-refactor)
- N/A (navigation refactor only) (008-navigation-refactor)

**Backend:**
- Language: Python 3.10+
- Framework: Django REST Framework
- Database: SQLite (dev), PostgreSQL (prod)
- Authentication: JWT via rest_framework_simplejwt
- Email: Resend API
- SMS: Twilio SDK (NEW - for OTP verification)

**Mobile Frontend:**
- Framework: Expo (React Native)
- Language: TypeScript (strict mode)
- UI Library: Tamagui
- State Management: React Context + hooks
- Navigation: Expo Router (file-based)

## Project Structure

```text
Backend/
├── api/
│   ├── models.py              # Django models
│   ├── serializers.py         # DRF serializers
│   ├── views/                 # View modules
│   │   ├── authentication.py  # Login, register, password reset
│   │   ├── user_profile.py    # User profile & phone management
│   │   ├── merchant_coupon.py # Merchant coupon operations
│   │   └── phone_otp.py       # OTP send/verify (NEW)
│   ├── services/              # Business logic services
│   │   └── sms_service.py     # Twilio SMS integration (NEW)
│   └── utils.py               # Utility functions
├── tests/                     # Test modules
└── manage.py

Mobile-Frontend/
├── app/
│   ├── (tabs)/                # Tab-based navigation
│   ├── OptionsMenu/           # Settings screens
│   │   └── PhoneSettings/     # Phone verification flow
│   ├── components/            # Reusable components
│   ├── services/              # API client functions
│   └── utils/                 # Utilities (authAPI, etc.)
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
python manage.py test api.tests     # Run tests
python manage.py shell              # Django shell
```

**Frontend:**
```bash
cd Mobile-Frontend
npm install                         # Install dependencies
npx expo start                      # Start Expo dev server
npm run lint                        # Run ESLint
npm run typecheck                   # TypeScript check
```

## Code Style

**Python (Backend):**
- Use type hints for function signatures
- Follow PEP 8 naming conventions
- Serializers for all API input/output validation
- Use `from django.utils import timezone` for datetime

**TypeScript (Frontend):**
- Strict mode enabled
- Define interfaces for all API request/response types
- Use `async/await` for API calls
- Chinese UI text for user-facing messages

## Recent Changes
- 008-navigation-refactor: Added TypeScript (strict mode), React 19.1.0, React Native 0.81.5 + Expo ~54.0.32, expo-router ~6.0.22, Tamagui ^1.136.6, react-native-reanimated ~4.1.1
- 007-ugc-compliance: Added Python 3.10+ (Backend), TypeScript strict mode (Mobile Frontend) + Django REST Framework 3.x, Expo/React Native, Tamagui UI, Resend API (email), rest_framework_simplejwt (auth)
- 001-appstore-compliance-fixes: Added Python 3.10+ (Backend), TypeScript strict mode (Mobile Frontend) + Django REST Framework (Backend), Expo/React Native with expo-image-picker ~17.0.10 (Frontend)

**002-phone-otp-verification (2026-01-07):**

**001-phone-coupon-send (2026-01-05):**

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
