# Quickstart: Phone OTP Verification

**Feature**: 002-phone-otp-verification | **Date**: 2026-01-07

This guide helps developers set up and test the phone OTP verification feature locally.

---

## Prerequisites

- Python 3.10+ with virtual environment set up
- Node.js 18+ and npm/yarn
- Expo CLI installed globally
- Git repository cloned and on `002-phone-otp-verification` branch

---

## 1. Backend Setup

### 1.1 Activate Virtual Environment

```bash
# Windows
cd Backend
.venv\Scripts\activate

# Unix/macOS
cd Backend
source .venv/bin/activate
```

### 1.2 Install New Dependencies

```bash
pip install twilio
pip freeze > requirements.txt
```

### 1.3 Environment Variables

**Development** - Add to `Backend/Backend/settings.py`:

```python
# SMS Configuration (at end of settings.py)
SMS_DEV_MODE = True  # Logs OTP to console instead of sending SMS
```

**Production** - Add to `Backend/Backend/production_settings.py`:

```python
# SMS Configuration
SMS_DEV_MODE = False
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
```

Then set these in Render environment variables:

- `TWILIO_ACCOUNT_SID=ACxxxxx`
- `TWILIO_AUTH_TOKEN=xxxxxxx`
- `TWILIO_PHONE_NUMBER=+886xxxxxxxxxx`

**Development Mode (`SMS_DEV_MODE=True`):**

- OTP codes are logged to console instead of being sent via SMS
- No Twilio credentials required
- Perfect for local development and testing

### 1.4 Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

Expected migration:

- `0032_phonootprecord` - Creates PhoneOTPRecord model

### 1.5 Start Development Server

```bash
python manage.py runserver
```

Server runs at `http://127.0.0.1:8000/`

---

## 2. Frontend Setup

### 2.1 Install Dependencies

```bash
cd Mobile-Frontend
npm install
```

### 2.2 Configure API URL

Edit `app/config/api.ts` if needed:

```typescript
// For local development with physical device
const API_CONFIG = {
  mode: "local-network", // or 'local' for emulator
  // ...
};
```

### 2.3 Start Expo

```bash
npx expo start
```

Press `a` for Android emulator or `i` for iOS simulator, or scan QR code with Expo Go app.

---

## 3. Testing the OTP Flow

### 3.1 Development Mode Testing

With `SMS_DEV_MODE=True`, OTPs are logged to the Django console:

```
[DEV MODE] OTP for 0912345678: 123456
```

**Test Flow:**

1. Open app → Settings → Phone Settings
2. Enter phone number: `0912345678`
3. Tap "Send OTP"
4. Check Django console for OTP code
5. Enter the 6-digit code in the app
6. Phone should be verified

### 3.2 API Testing with curl

**Send OTP:**

```bash
curl -X POST http://127.0.0.1:8000/api/phone-otp/send/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"phone_number": "0912345678"}'
```

**Verify OTP:**

```bash
curl -X POST http://127.0.0.1:8000/api/phone-otp/verify/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"phone_number": "0912345678", "otp_code": "123456"}'
```

**Get Phone (after verification):**

```bash
curl -X GET http://127.0.0.1:8000/api/user/phone/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3.3 Rate Limiting Testing

Test rate limits by making rapid requests:

```bash
# Should succeed (1st request)
curl -X POST http://127.0.0.1:8000/api/phone-otp/send/ ...

# Should fail with cooldown error (within 60 seconds)
curl -X POST http://127.0.0.1:8000/api/phone-otp/send/ ...
# Response: {"error": "請等待60秒後再重新發送驗證碼"}

# After 3 requests in 1 hour, should fail with hourly limit
# Response: {"error": "已超過每小時OTP請求次數限制，請稍後再試"}
```

### 3.4 Verification Attempt Testing

Test max attempts (5 per OTP):

```bash
# Send OTP first
curl -X POST .../phone-otp/send/ ...

# Wrong code attempts (5 times)
curl -X POST .../phone-otp/verify/ -d '{"phone_number": "0912345678", "otp_code": "000000"}'
# Response includes: "attempts_remaining": 4, 3, 2, 1, 0

# After 5 wrong attempts:
# Response: {"error": "驗證碼輸入錯誤次數過多，請重新獲取驗證碼"}
```

---

## 4. Running Tests

### 4.1 Backend Tests

```bash
cd Backend
.venv\Scripts\activate  # or source .venv/bin/activate

# Run all OTP-related tests
python manage.py test api.tests.test_phone_otp

# Run specific test class
python manage.py test api.tests.test_phone_otp.PhoneOTPSendTests

# Run with coverage
coverage run manage.py test api.tests.test_phone_otp
coverage report
```

### 4.2 Test Cases to Verify

| Test Case                                     | Expected Result                       |
| --------------------------------------------- | ------------------------------------- |
| Send OTP with valid phone                     | 200 OK, OTP logged                    |
| Send OTP with invalid format                  | 400 Bad Request                       |
| Send OTP for phone registered to another user | 400 Bad Request                       |
| Send OTP within 60-second cooldown            | 429 Too Many Requests                 |
| Send OTP after 3 requests in 1 hour           | 429 Too Many Requests                 |
| Verify with correct OTP                       | 200 OK, phone updated                 |
| Verify with wrong OTP                         | 400 Bad Request, attempts decremented |
| Verify with expired OTP                       | 400 Bad Request                       |
| Verify after 5 wrong attempts                 | 400 Bad Request, locked               |
| PUT /api/user/phone/ (direct update)          | 405 Method Not Allowed                |
| DELETE /api/user/phone/                       | 405 Method Not Allowed                |

---

## 5. Common Issues & Solutions

### Issue: "ModuleNotFoundError: No module named 'twilio'"

**Solution:** Activate virtual environment and install twilio:

```bash
.venv\Scripts\activate
pip install twilio
```

### Issue: OTP not appearing in console

**Solution:** Ensure `SMS_DEV_MODE=True` in `.env` and restart Django server.

### Issue: "Authentication credentials were not provided"

**Solution:** Get a valid JWT token:

```bash
curl -X POST http://127.0.0.1:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "yourpassword"}'
```

Use the `access` token in the Authorization header.

### Issue: Phone number validation failing

**Solution:** Ensure phone matches Taiwan format:

- Valid: `0912345678`, `0912-345-678`
- Invalid: `912345678` (missing leading 0), `09123456789` (too long)

### Issue: Rate limit hit during testing

**Solution:** Clear OTP records for the test phone:

```python
# In Django shell: python manage.py shell
from api.models import PhoneOTPRecord
PhoneOTPRecord.objects.filter(phone_number='0912345678').delete()
```

---

## 6. Production Checklist

Before deploying to production:

- [ ] Set `SMS_DEV_MODE=False`
- [ ] Configure valid Twilio credentials
- [ ] Test SMS delivery to real Taiwan phone numbers
- [ ] Verify rate limiting works correctly
- [ ] Run full test suite
- [ ] Review Twilio usage pricing
- [ ] Set up Twilio delivery status webhooks (optional)

---

## 7. File Structure After Implementation

```
Backend/
├── api/
│   ├── models.py              # + PhoneOTPRecord
│   ├── serializers.py         # + PhoneOTPSerializer
│   ├── views/
│   │   ├── user_profile.py    # Modified: blocks direct phone updates
│   │   └── phone_otp.py       # NEW
│   ├── services/
│   │   └── sms_service.py     # NEW
│   └── urls.py                # + OTP routes
├── tests/
│   └── test_phone_otp.py      # NEW

Mobile-Frontend/
├── app/
│   ├── OptionsMenu/
│   │   └── PhoneSettings/
│   │       ├── index.tsx          # Modified
│   │       ├── OTPRequestScreen.tsx   # NEW
│   │       └── OTPVerifyScreen.tsx    # NEW
│   ├── components/
│   │   └── OTPInput.tsx           # NEW
│   └── services/
│       └── phoneOtpAPI.ts         # NEW
```

---

## 8. Useful Commands Reference

```bash
# Backend
cd Backend && .venv\Scripts\activate
python manage.py runserver           # Start server
python manage.py shell               # Django shell
python manage.py makemigrations      # Create migrations
python manage.py migrate             # Apply migrations
python manage.py test api.tests      # Run tests

# Frontend
cd Mobile-Frontend
npx expo start                       # Start Expo
npm run lint                         # Run linter
npm run typecheck                    # TypeScript check
```
