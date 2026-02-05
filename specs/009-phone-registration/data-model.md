# Data Model: Phone-Based Registration Flow

**Feature**: 009-phone-registration | **Date**: 2026-02-05

## Entity Changes

### 1. StudentProfile (MODIFY)

**File**: `Backend/api/models.py` (lines 48-88)

**New Fields**:

| Field | Type | Default | Nullable | Notes |
|-------|------|---------|----------|-------|
| `phone_verified` | BooleanField | `False` | No | Tracks whether phone was verified (registration or phone-settings) |

**Existing Fields (no change)**:

| Field | Type | Notes |
|-------|------|-------|
| `phone_number` | CharField(20), unique | Already exists, nullable — will be set at registration for phone-registered users |
| `verified` | BooleanField | Remains for email verification status |
| `email_verification_token` | CharField(64) | Remains for email verification flow |

**Validation Rules**:
- A phone-registered user will have: `phone_number` set, `phone_verified=True`, `verified=False`, `email_verification_token=None`
- An email-registered user (existing) will have: `phone_number=None`, `phone_verified=False`, `verified=True`, `email_verification_token` used
- A user who later adds email: `phone_verified=True`, `verified=True` (after email verification)

**Migration**: `python manage.py makemigrations` — adds `phone_verified` BooleanField with default=False. Non-breaking; all existing records get `phone_verified=False`.

---

### 2. PhoneOTPRecord (MODIFY)

**File**: `Backend/api/models.py` (lines 493-619)

**New Fields**:

| Field | Type | Default | Choices | Notes |
|-------|------|---------|---------|-------|
| `purpose` | CharField(20) | `'phone_change'` | `phone_change`, `registration`, `password_reset` | Differentiates OTP use case |

**Existing Fields (no change)**:

| Field | Type | Notes |
|-------|------|-------|
| `phone_number` | CharField(20), indexed | The phone receiving OTP |
| `otp_code` | CharField(6) | 6-digit random code |
| `user` | ForeignKey(User), nullable | Null for registration OTPs (user doesn't exist yet) |
| `created_at` | DateTimeField | Auto-set |
| `expires_at` | DateTimeField | 10 minutes after creation |
| `attempt_count` | IntegerField | Max 5 attempts |
| `is_verified` | BooleanField | Set to True on successful verification |

**Behavioral Changes**:
- `user` field: Currently required (ForeignKey). Must be made nullable for registration OTPs where no user exists yet.
- `can_send_otp()`: Must accept `purpose` parameter to scope rate limiting per purpose.
- `create_otp()`: Must accept `purpose` parameter and allow `user=None` for registration.
- Verification logic: Must check that OTP `purpose` matches the calling endpoint.

**Migration**: `python manage.py makemigrations` — adds `purpose` CharField with default, makes `user` nullable. Non-breaking.

---

### 3. User (Django built-in — NO SCHEMA CHANGE)

**Usage Change**:
- Registration sets `username = phone_number` (instead of `username = email`)
- `email` field: left blank for phone-registered users (can be added later)
- No model change needed — just different values passed at creation time

---

### 4. PasswordResetProfile (NO CHANGE)

Existing email-based password reset remains functional. Phone-based password reset uses PhoneOTPRecord with `purpose='password_reset'` instead.

---

## New Serializers

### PhoneLoginSerializer

```python
class PhoneLoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20, required=False)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(style={'input_type': 'password'})
    client_type = serializers.ChoiceField(choices=['merchant', 'user'])
    # Validation: exactly one of phone_number or email must be provided
```

### PhoneForgotPasswordSerializer

```python
class PhoneForgotPasswordSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
```

### PhoneResetPasswordSerializer

```python
class PhoneResetPasswordSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    otp_code = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(style={'input_type': 'password'})
```

### RegistrationOTPSendSerializer

```python
class RegistrationOTPSendSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    # Reuses existing Taiwan format validation from SendOTPSerializer
```

### RegistrationOTPVerifySerializer

```python
class RegistrationOTPVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    otp_code = serializers.CharField(max_length=6, min_length=6)
    password = serializers.CharField(style={'input_type': 'password'})
```

---

## State Transitions

### Phone Registration Flow

```
[No account]
    → POST /register/send-otp/ (phone_number)
    → PhoneOTPRecord created (purpose=registration, user=None)
    → SMS sent
    → POST /register/verify-otp/ (phone_number, otp_code, password)
    → OTP verified
    → User created (username=phone_number)
    → StudentProfile created (phone_number=X, phone_verified=True, verified=False)
    → JWT tokens returned
    → [Logged in]
```

### Phone Login Flow

```
[Existing phone-registered user]
    → POST /login/ (phone_number, password, client_type=user)
    → Lookup StudentProfile by phone_number → get User
    → Check phone_verified=True
    → Check password
    → JWT tokens returned
    → [Logged in]
```

### Email Login Flow (backward compatible)

```
[Existing email-registered user]
    → POST /login/ (email, password, client_type=user)
    → Lookup User by email (existing logic)
    → Check verified=True (email verified)
    → Check password
    → JWT tokens returned
    → [Logged in]
```

### Forgot Password (Phone)

```
[User with phone]
    → POST /forgot-password/phone/send-otp/ (phone_number)
    → Verify phone is registered to a user
    → PhoneOTPRecord created (purpose=password_reset, user=matched_user)
    → SMS sent
    → POST /forgot-password/phone/reset/ (phone_number, otp_code, new_password)
    → OTP verified
    → User.set_password(new_password)
    → [Password reset complete]
```
