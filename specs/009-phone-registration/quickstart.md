# Quickstart: Phone-Based Registration Flow

**Feature**: 009-phone-registration | **Branch**: `009-phone-registration`

## Prerequisites

1. Backend virtual environment activated:
   ```bash
   cd Backend
   .venv\Scripts\activate          # Windows
   source .venv/bin/activate       # Unix
   ```

2. SMS_DEV_MODE=True in backend settings (for local development without Twilio):
   ```python
   # Backend/Backend/settings.py
   SMS_DEV_MODE = True
   ```

3. Frontend dependencies installed:
   ```bash
   cd Mobile-Frontend
   npm install
   ```

## Development Workflow

### 1. Backend Changes (do first)

**Step 1**: Apply model changes
```bash
cd Backend
python manage.py makemigrations
python manage.py migrate
```

**Step 2**: Verify new endpoints work
```bash
python manage.py runserver

# Test registration OTP send (unauthenticated)
curl -X POST http://localhost:8000/api/register/send-otp/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "0912345678"}'

# Test registration OTP verify + account creation
curl -X POST http://localhost:8000/api/register/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "0912345678", "otp_code": "CODE_FROM_ABOVE", "password": "testpass123"}'

# Test phone login
curl -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "0912345678", "password": "testpass123", "client_type": "user"}'
```

**Step 3**: Run tests
```bash
python manage.py test api.tests
```

### 2. Frontend Changes

**Step 1**: Start dev server
```bash
cd Mobile-Frontend
npx expo start
```

**Step 2**: Test the registration flow
1. Open the app → should see phone number + password registration form
2. Enter a valid phone (0912345678) and password
3. Tap register → should navigate to OTP verification screen
4. Enter the OTP code (shown in terminal if SMS_DEV_MODE=True)
5. Should create account and redirect to main app

**Step 3**: Test login
1. Log out → should see phone + password login form
2. Enter registered phone and password
3. Tap login → should authenticate and redirect to main app
4. Tap "使用 Email 登入" → should switch to email + password form

## Key Files to Modify

| File | Changes |
|------|---------|
| `Backend/api/models.py` | Add `phone_verified` to StudentProfile, add `purpose` to PhoneOTPRecord, make `user` nullable on PhoneOTPRecord |
| `Backend/api/serializers.py` | Add PhoneRegisterSerializer, PhoneLoginSerializer, PhoneForgotPasswordSerializer, PhoneResetPasswordSerializer, RegistrationOTPSendSerializer, RegistrationOTPVerifySerializer |
| `Backend/api/views/authentication.py` | Add `register_phone()`, modify `login()` to accept phone_number |
| `Backend/api/views/phone_otp.py` | Add `send_registration_otp()`, `verify_registration_otp()`, `send_password_reset_otp()`, `verify_password_reset_otp()` |
| `Backend/Backend/urls.py` | Add routes for new endpoints |
| `Backend/tests/test_phone_otp.py` | Add registration OTP tests |
| `Mobile-Frontend/app/(auth)/login.tsx` | Swap to phone default, add email toggle |
| `Mobile-Frontend/app/(auth)/login-components/LoginFormContainer.tsx` | Phone input field, mode switching |
| `Mobile-Frontend/app/services/phoneOtpAPI.ts` | Add unauthenticated OTP functions |
| `Mobile-Frontend/app/utils/authAPI.ts` | Add new endpoints to public endpoint list |

## New Endpoints Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/register/send-otp/` | None | Send registration OTP |
| POST | `/api/register/verify-otp/` | None | Verify OTP + create account |
| POST | `/api/login/` | None | Login (now accepts phone_number OR email) |
| POST | `/api/forgot-password/phone/send-otp/` | None | Send password reset OTP |
| POST | `/api/forgot-password/phone/reset/` | None | Verify OTP + reset password |

## Gotchas

- **SMS_DEV_MODE**: When True, OTP codes are returned in API responses and logged to console. Never deploy with this enabled.
- **Phone format**: Always 09XXXXXXXX (10 digits). The serializer strips dashes/spaces automatically.
- **Existing users**: Email-registered users are unaffected. They use the email toggle on login.
- **Username**: Phone-registered users have `username = phone_number`. This is internal only.
- **OTP purpose**: Registration OTPs have `purpose='registration'`. They cannot be reused at other OTP endpoints.
