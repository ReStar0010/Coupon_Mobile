# Research: Merchant 2FA Email Verification and Password Reset

**Feature**: 006-merchant-2fa-password-reset
**Date**: 2026-01-16

## Executive Summary

All technical decisions have been resolved by analyzing the existing consumer (student) implementation. The feature reuses established patterns from `Mobile-Frontend` and `Backend` with minimal modifications. No external research required - all patterns exist in the codebase.

---

## Decision 1: Email Service Integration

**Question**: How to integrate Resend for merchant emails?

**Decision**: Reuse existing Resend configuration and email functions.

**Rationale**:
- Resend is already configured in `Backend/settings.py` (lines 10-13) with `RESEND_API_KEY`
- Two email functions already exist in `api/views/authentication.py`:
  - `send_verification_email()` (lines 27-105) - can be reused directly
  - `send_password_reset_email()` (lines 108-198) - can be reused directly
- Both functions use the verified domain `noreply@coupro.pro`
- HTML email templates with Chinese text already implemented

**Alternatives Considered**:
- Create separate merchant email functions: Rejected - identical requirements, unnecessary duplication
- Use different email provider: Rejected - Resend already working, no benefit to changing

**Implementation**:
```python
# No new email functions needed. Existing functions work for merchants:
send_verification_email(merchant_email, token)
send_password_reset_email(merchant_email, token)

# Only modify: URL format in email body to use merchant deep link scheme
# Change: coupro:// → coupromerchant://
```

---

## Decision 2: Token Storage Strategy

**Question**: How to store email verification tokens for merchants?

**Decision**: Add `verified` and `email_verification_token` fields to `MerchantProfile` model.

**Rationale**:
- Spec clarification states: "Reuse existing tables with user_type field to distinguish merchant vs consumer tokens"
- `StudentProfile` already has `verified` and `email_verification_token` fields (lines 16-57 in models.py)
- Adding same fields to `MerchantProfile` maintains consistency
- `PasswordResetProfile` is user-agnostic (one-to-one with User), works for both user types

**Alternatives Considered**:
- Create separate `MerchantVerificationToken` model: Rejected - over-engineering, not aligned with existing pattern
- Add `user_type` field to `PasswordResetProfile`: Not needed - model is already per-user, user type can be inferred from profile

**Implementation**:
```python
class MerchantProfile(models.Model):
    # ... existing fields ...
    verified = models.BooleanField(default=False)  # NEW
    email_verification_token = models.CharField(max_length=64, unique=True, null=True, blank=True)  # NEW
    token_created_at = models.DateTimeField(null=True, blank=True)  # NEW
```

---

## Decision 3: Deep Link URL Format

**Question**: What deep link format should verification and reset emails use?

**Decision**: Use existing `coupromerchant://` scheme with path-based routing.

**Rationale**:
- `Mobile-Merchant-Frontend/app.json` already configures scheme: `"scheme": ["coupromerchant"]`
- Consumer app uses `coupro://Login/verify?token=...&email=...` pattern
- Expo Router handles path-based deep links automatically

**Alternatives Considered**:
- Universal links (HTTPS): Rejected - requires additional server configuration, not used by consumer app
- Query-only deep links: Rejected - Expo Router prefers path-based routing

**Implementation**:
```
Email Verification: coupromerchant://verify-email?token={token}&email={email}
Password Reset: coupromerchant://reset-password?token={token}&email={email}
```

---

## Decision 4: Rate Limiting Strategy

**Question**: What rate limits should apply to email-sending features?

**Decision**: Follow existing `PhoneOTPRecord` pattern: 3 requests/hour, 60-second cooldown.

**Rationale**:
- `PhoneOTPRecord` model (lines 394-448 in models.py) implements proven rate limiting
- Method `can_send_otp()` already handles: 3 requests/hour per identifier, 60-second cooldown
- Spec suggests: "3-5 requests per hour per email" - choosing 3 for consistency
- Same pattern prevents abuse while allowing legitimate retries

**Alternatives Considered**:
- Different limits for merchants vs consumers: Rejected - no business reason for difference
- Stricter limits (1/hour): Rejected - email delivery issues may require retries

**Implementation**:
```python
# Add to MerchantProfile or create utility:
def can_send_verification_email(email: str) -> tuple[bool, str, int]:
    """
    Returns (allowed, message, wait_seconds)
    - 3 requests per hour per email
    - 60-second cooldown between requests
    """
    # Follow PhoneOTPRecord.can_send_otp() pattern
```

---

## Decision 5: Login Verification Check

**Question**: How should login handle unverified merchant accounts?

**Decision**: Return specific error code and message, frontend shows resend option.

**Rationale**:
- Consumer login already checks `StudentProfile.verified` (authentication.py line 365-375)
- Same pattern should apply to merchants for consistency
- Frontend can distinguish error types and show appropriate UI

**Alternatives Considered**:
- Allow login but restrict features: Rejected - spec requires verification before login
- Separate "unverified" login endpoint: Rejected - over-engineering

**Implementation**:
```python
# In login view, after merchant authentication:
if user.groups.filter(name='Merchant').exists():
    merchant_profile = MerchantProfile.objects.get(user=user)
    if not merchant_profile.verified:
        return Response({
            'error': 'email_not_verified',
            'message': '請先驗證您的電子郵件',
            'email': user.email
        }, status=status.HTTP_403_FORBIDDEN)
```

---

## Decision 6: Frontend Screen Structure

**Question**: How should verification and reset screens be organized?

**Decision**: Add two new screens in `(auth)/` group with deep link routing.

**Rationale**:
- `(auth)/` group already exists with login, register, forgot-password
- Expo Router file-based routing means `verify-email.tsx` handles `/verify-email` path
- Consumer app reference: `Mobile-Frontend/app/Login/components/verify/` and `Mobile-Frontend/app/ResetPassword/`

**Alternatives Considered**:
- Nested under login: Rejected - password reset is independent of login screen
- Separate group: Rejected - these are authentication-related screens

**Implementation**:
```
Mobile-Merchant-Frontend/app/
  (auth)/
    login.tsx           # Existing - add unverified state handling
    register.tsx        # Existing - add verification pending message
    forgot-password.tsx # Existing - already implemented
    verify-email.tsx    # NEW - handles coupromerchant://verify-email
    reset-password.tsx  # NEW - handles coupromerchant://reset-password
```

---

## Decision 7: Token Generation and Validation

**Question**: How should tokens be generated and validated?

**Decision**: Reuse existing token utilities from `api/auth.py`.

**Rationale**:
- `secrets.token_urlsafe(32)` already used for consumer tokens
- `is_token_valid()` function in `api/auth.py` validates 24-hour expiration
- No reason to create different token format or validation logic

**Alternatives Considered**:
- UUID-based tokens: Rejected - `token_urlsafe` is more secure and established
- Shorter expiration: Rejected - spec confirms 24-hour standard

**Implementation**:
```python
import secrets
from api.auth import is_token_valid

# Generate token
token = secrets.token_urlsafe(32)

# Validate token (reuse existing)
if not is_token_valid(merchant_profile, 'email_verification'):
    return Response({'error': 'Token expired'}, status=400)
```

---

## Decision 8: Resend Verification Flow

**Question**: How should resending verification emails work?

**Decision**: New endpoint `/api/merchant/resend-verification/` with rate limiting.

**Rationale**:
- Spec User Story 3 requires resend capability
- Must invalidate previous tokens (security requirement)
- Must apply rate limiting to prevent abuse

**Alternatives Considered**:
- Reuse existing forgot-password endpoint: Rejected - different flow and messaging
- Include in login response: Rejected - only handles immediate case, not explicit request

**Implementation**:
```python
@api_view(['POST'])
def resend_merchant_verification(request):
    """
    POST /api/merchant/resend-verification/
    Body: { "email": "merchant@example.com" }

    - Validates email exists and is unverified merchant
    - Checks rate limit
    - Generates new token (invalidates old)
    - Sends new verification email
    """
```

---

## Existing Code References

| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| Resend config | `Backend/settings.py:10-13` | Direct reuse |
| Email functions | `api/views/authentication.py:27-198` | Reuse with URL modification |
| Token validation | `api/auth.py:is_token_valid()` | Direct reuse |
| Student verification | `api/views/authentication.py:302-326` | Pattern reference |
| Consumer verify screen | `Mobile-Frontend/app/Login/components/verify/` | Pattern reference |
| Consumer reset screen | `Mobile-Frontend/app/ResetPassword/` | Pattern reference |
| Rate limiting | `api/models.py:PhoneOTPRecord.can_send_otp()` | Pattern reference |
| Deep link scheme | `Mobile-Merchant-Frontend/app.json:6-8` | Already configured |

---

## Unresolved Items

None. All technical decisions resolved through codebase analysis.
