# Research: Phone OTP Verification

**Feature**: 002-phone-otp-verification | **Date**: 2026-01-07

## Overview

This document consolidates research findings for implementing SMS OTP verification via Twilio in the CouPro mobile coupon application. All "NEEDS CLARIFICATION" items from the Technical Context have been resolved.

---

## 1. Twilio SMS Integration

### Decision: Use Twilio Python SDK with Service Layer Pattern

**Rationale**: Twilio is the industry standard for SMS delivery with 99%+ deliverability, supports Taiwan mobile numbers, and provides test credentials for development.

**Alternatives Considered**:

- AWS SNS: More complex setup, overkill for single-region Taiwan use case
- Resend: Already configured for email but doesn't support SMS
- MessageBird: Similar features but less documentation/community support

### Implementation Pattern

```python
# Backend/api/services/sms_service.py
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class SMSService:
    """Twilio SMS service with development mode fallback."""

    def __init__(self):
        self.dev_mode = getattr(settings, 'SMS_DEV_MODE', True)
        if not self.dev_mode:
            self.client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )
            self.from_number = settings.TWILIO_PHONE_NUMBER

    def send_otp(self, phone_number: str, otp_code: str) -> dict:
        """Send OTP via SMS. Returns {success: bool, error: str|None}"""
        message = f"您的 CouPro 驗證碼是：{otp_code}，10分鐘內有效。請勿分享此驗證碼。"

        if self.dev_mode:
            logger.info(f"[DEV MODE] OTP for {phone_number}: {otp_code}")
            return {"success": True, "error": None, "dev_mode": True}

        try:
            self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=f"+886{phone_number[1:]}"  # Convert 09... to +8869...
            )
            return {"success": True, "error": None}
        except TwilioRestException as e:
            logger.error(f"Twilio error for {phone_number}: {e.code} - {e.msg}")
            return {"success": False, "error": str(e.msg)}
```

### Environment Variables Required

**Development** (Backend/Backend/settings.py or .env):

```python
SMS_DEV_MODE = True  # Logs OTP to console instead of sending SMS
```

**Production** (Backend/Backend/production_settings.py):

```python
# Add to production_settings.py
SMS_DEV_MODE = False
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
```

**Render Environment Variables** (production):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+886xxxxxxxxxx  # Taiwan number
```

### Taiwan Phone Number Format

- Input format: `09XXXXXXXX` (10 digits, starts with 09)
- E.164 format for Twilio: `+886XXXXXXXXX` (remove leading 0, prepend +886)
- Conversion: `phone[1:]` removes leading 0, then prepend `+886`

---

## 2. OTP Rate Limiting Strategy

### Decision: Database-Based Rate Limiting with PhoneOTPRecord Model

**Rationale**: Simpler than Redis, sufficient for current scale, tracks attempts per-OTP and requests per-phone-per-hour.

**Alternatives Considered**:

- Redis: Overkill for current scale, adds infrastructure complexity
- Django cache: Not persistent, loses state on restart
- Third-party rate limiting (django-ratelimit): Additional dependency, less control

### Rate Limiting Rules (from spec)

| Limit Type            | Value      | Scope            | Reset               |
| --------------------- | ---------- | ---------------- | ------------------- |
| OTP requests          | 3 per hour | Per phone number | Rolling hour window |
| Verification attempts | 5 per OTP  | Per OTP code     | New OTP required    |
| Resend cooldown       | 60 seconds | Per phone number | After each send     |
| OTP expiration        | 10 minutes | Per OTP code     | N/A                 |

### Implementation Approach

```python
# In PhoneOTPRecord model
@classmethod
def can_send_otp(cls, phone_number: str) -> tuple[bool, str]:
    """Check if OTP can be sent. Returns (allowed, error_message)."""
    one_hour_ago = timezone.now() - timedelta(hours=1)

    # Check hourly limit (3 per hour)
    recent_count = cls.objects.filter(
        phone_number=phone_number,
        created_at__gte=one_hour_ago
    ).count()

    if recent_count >= 3:
        return False, "已超過每小時OTP請求次數限制，請稍後再試"

    # Check cooldown (60 seconds)
    one_minute_ago = timezone.now() - timedelta(seconds=60)
    recent_send = cls.objects.filter(
        phone_number=phone_number,
        created_at__gte=one_minute_ago
    ).exists()

    if recent_send:
        return False, "請等待60秒後再重新發送驗證碼"

    return True, ""
```

### Error Responses (Chinese)

| Error                 | Message                                    |
| --------------------- | ------------------------------------------ |
| Rate limited (hourly) | "已超過每小時OTP請求次數限制，請稍後再試"  |
| Cooldown active       | "請等待60秒後再重新發送驗證碼"             |
| Max attempts reached  | "驗證碼輸入錯誤次數過多，請重新獲取驗證碼" |
| OTP expired           | "驗證碼已過期，請重新獲取"                 |
| Invalid OTP           | "驗證碼錯誤，請重新輸入"                   |

---

## 3. Secure OTP Generation

### Decision: Use Python `secrets` Module with 6-Digit Numeric Code

**Rationale**: `secrets` provides cryptographically secure random numbers. 6 digits balance security (1 million combinations) with usability.

**Alternatives Considered**:

- `random` module: NOT cryptographically secure, never use for security
- UUID/token-based: Harder for users to type on mobile
- 4-digit codes: Too easy to brute force (10,000 combinations)
- 8-digit codes: Frustrating for users without significant security gain

### Implementation

```python
import secrets

def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return ''.join(str(secrets.randbelow(10)) for _ in range(length))
```

### OTP Storage Strategy

**Decision**: Store OTP as plaintext in database

**Rationale**:

- Short-lived (10 minutes)
- Automatically deleted after verification or expiration
- Rate limiting prevents brute force even if DB is compromised
- Hashing adds complexity without significant security benefit for time-limited codes

**Alternative (rejected)**: Hash OTP before storage

- Pros: Defense in depth if DB compromised
- Cons: Added complexity, OTPs are already short-lived and rate-limited

---

## 4. Development Mode Fallback

### Decision: Console Logging with SMS_DEV_MODE Flag

**Rationale**: Enables development/testing without Twilio costs or configuration.

### Behavior by Mode

| Mode        | SMS_DEV_MODE | Behavior                                |
| ----------- | ------------ | --------------------------------------- |
| Development | True         | Log OTP to console, return success      |
| Production  | False        | Send SMS via Twilio                     |
| Testing     | True         | Log OTP to console, capturable in tests |

### Test Verification

```python
# In tests
@override_settings(SMS_DEV_MODE=True)
def test_otp_send(self):
    with self.assertLogs('api.services.sms_service', level='INFO') as logs:
        response = self.client.post('/api/phone-otp/send/', {'phone_number': '0912345678'})
        self.assertIn('0912345678', logs.output[0])  # OTP was logged
```

---

## 5. Phone Number Uniqueness

### Decision: Reject OTP Request if Phone Already Registered

**Rationale**: Spec requirement FR-008 - prevent registering a phone number already linked to another user.

### Implementation

```python
def send_otp_view(request):
    phone = validate_phone_number(request.data['phone_number'])

    # Check if phone already registered to ANOTHER user
    existing_user = StudentProfile.objects.filter(
        phone_number=phone
    ).exclude(user=request.user).first()

    if existing_user:
        return Response(
            {'error': '此電話號碼已被其他帳號使用'},
            status=400
        )

    # Proceed with OTP...
```

### Edge Case: User Re-verifying Same Phone

Allow users to re-verify their current phone number (useful if they want to confirm ownership). Skip uniqueness check if phone matches current user's phone.

---

## 6. Coupon Transfer Logic

### Decision: "Coupons Follow the Person" Model

**Rationale**: From spec clarification - when user changes phone, unclaimed coupons transfer immediately to their account.

### Scenarios

**Scenario A: New user verifies phone with pending coupons**

```
1. User has no phone number set
2. User verifies phone 0912345678
3. System claims all coupons with pending_phone_number=0912345678
4. Coupons: current_holder=user, pending_phone_number=NULL
```

**Scenario B: User changes phone from A to B**

```
1. User has phone A (0911111111) with 2 unclaimed coupons
2. User starts verification for phone B (0922222222)
3. On successful verification:
   a. Transfer unclaimed coupons from phone A to user account
   b. Update user's phone to B
   c. Claim any coupons pending on phone B
```

**Scenario C: Phone previously linked to another user**

```
1. User A had phone 0912345678, then changed to new phone
   - User A's pending coupons transferred to User A's account on change
2. User B verifies phone 0912345678
   - User B does NOT receive User A's old coupons (they were transferred)
   - User B receives any NEW coupons sent to 0912345678 after User A unlinked
```

### Implementation

```python
def complete_phone_verification(user, new_phone):
    profile = user.student_profile
    old_phone = profile.phone_number

    with transaction.atomic():
        # 1. Transfer unclaimed coupons from old phone (if exists)
        old_phone_transferred = 0
        if old_phone:
            old_phone_transferred = Coupon.objects.filter(
                pending_phone_number=old_phone,
                current_holder__isnull=True
            ).update(
                current_holder=user,
                pending_phone_number=None,
                acquisition_method='consolidate'  # Same method - phone-based claim
            )

        # 2. Update phone number
        profile.phone_number = new_phone
        profile.save()

        # 3. Claim coupons pending on new phone
        new_phone_claimed = Coupon.objects.filter(
            pending_phone_number=new_phone,
            current_holder__isnull=True
        ).update(
            current_holder=user,
            pending_phone_number=None,
            acquisition_method='consolidate'
        )

        # 4. Clean up OTP records
        PhoneOTPRecord.objects.filter(
            phone_number=new_phone,
            user=user
        ).delete()

        return new_phone_claimed, old_phone_transferred
```

---

## 7. API Endpoint Design

### Endpoints

| Method | Endpoint                 | Purpose                           |
| ------ | ------------------------ | --------------------------------- |
| POST   | `/api/phone-otp/send/`   | Request OTP for phone number      |
| POST   | `/api/phone-otp/verify/` | Verify OTP and update phone       |
| GET    | `/api/user/phone/`       | Get current phone (unchanged)     |
| DELETE | `/api/user/phone/`       | Remove phone (BLOCKED per FR-017) |

### PUT `/api/user/phone/` Modification

**Before**: Directly update phone number
**After**: Return 405 Method Not Allowed with redirect message

```python
def put(self, request):
    return Response(
        {'error': '請使用 OTP 驗證流程更新電話號碼',
         'redirect': '/api/phone-otp/send/'},
        status=405
    )
```

---

## 8. Frontend OTP Input UX

### Decision: Auto-Submit on 6-Digit Entry with Individual Input Boxes

**Rationale**: Better mobile UX - shows progress, auto-advances, auto-submits when complete.

### OTPInput Component Behavior

1. Six separate input boxes (each holds 1 digit)
2. Auto-advance focus on digit entry
3. Backspace navigates to previous box
4. Auto-submit when 6th digit entered
5. Support paste of full 6-digit code

### Countdown Timer

- Show "重新發送 (45s)" when cooldown active
- Enable resend button after 60 seconds
- Disable button during API call

---

## Summary

| Unknown          | Decision                       | Key Rationale                                |
| ---------------- | ------------------------------ | -------------------------------------------- |
| SMS Provider     | Twilio                         | Industry standard, Taiwan support, test mode |
| Rate Limiting    | Database-based                 | Simple, sufficient for scale                 |
| OTP Generation   | `secrets` module, 6-digit      | Cryptographically secure, user-friendly      |
| Dev Mode         | Console logging                | Zero-cost development                        |
| OTP Storage      | Plaintext (time-limited)       | Simplicity, rate limiting protects           |
| Phone Uniqueness | Reject if registered elsewhere | Spec requirement FR-008                      |
| Coupon Transfer  | Follow the person              | Spec clarification                           |

---

## References

- [Zuplo - API Rate Limiting Best Practices 2025](https://zuplo.com/blog/2025/01/06/10-best-practices-for-api-rate-limiting-in-2025)
- [Security Boulevard - Ninja OTP Implementation Guide](https://securityboulevard.com/2025/09/ninja-otp-complete-guide-to-secure-otp-implementation/)
- [Unkey - Ratelimiting OTP Endpoints](https://www.unkey.com/blog/ratelimiting-otp)
- [Arkesel - Securing Transactions with OTP APIs](https://arkesel.com/securing-transactions-with-otp-apis-10-best-practices/)
- [Twilio Python SDK Documentation](https://www.twilio.com/docs/libraries/python)
