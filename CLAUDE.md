# CouPro Development Guidelines

Auto-generated from feature plans. Last updated: 2026-01-07

## Active Technologies

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

**002-phone-otp-verification (2026-01-07):**
- Added Twilio SMS integration for OTP verification
- New PhoneOTPRecord model for tracking verification attempts
- Rate limiting: 3 OTP requests/hour, 5 verification attempts/OTP
- Blocked direct phone updates (PUT /api/user/phone/) - must use OTP flow

**001-phone-coupon-send (2026-01-05):**
- Added pending_phone_number field to Coupon model
- Merchants can send coupons to unregistered phone numbers
- Auto-claim coupons when user verifies phone number

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
