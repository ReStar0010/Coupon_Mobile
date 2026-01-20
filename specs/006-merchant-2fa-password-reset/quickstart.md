# Quickstart: Merchant 2FA Email Verification and Password Reset

**Feature**: 006-merchant-2fa-password-reset
**Date**: 2026-01-16

## Overview

This guide provides the essential implementation steps for adding email verification and password reset to the merchant app. The feature reuses existing infrastructure from the consumer app.

---

## Prerequisites

- Backend virtual environment activated: `.venv\Scripts\activate` (Windows)
- Resend API key configured in environment: `RESEND_API_KEY`
- Mobile-Merchant-Frontend development environment ready

---

## Backend Implementation

### Step 1: Update MerchantProfile Model

**File**: `Backend/api/models.py`

Add verification fields to `MerchantProfile`:

```python
class MerchantProfile(models.Model):
    # ... existing fields ...

    # New verification fields
    verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(
        max_length=64, unique=True, null=True, blank=True
    )
    verification_token_created_at = models.DateTimeField(null=True, blank=True)
    last_verification_email_sent = models.DateTimeField(null=True, blank=True)
    verification_email_count = models.PositiveIntegerField(default=0)
```

Run migrations:
```bash
cd Backend
python manage.py makemigrations
python manage.py migrate
```

### Step 2: Add Merchant Verification Endpoint

**File**: `Backend/api/views/authentication.py`

```python
@api_view(['GET'])
def verify_merchant_email(request):
    """GET /api/merchant/verify-email/?token=xxx"""
    token = request.GET.get('token')
    if not token:
        return Response({'error': 'missing_token', 'message': '缺少驗證碼'}, status=400)

    try:
        merchant = MerchantProfile.objects.get(email_verification_token=token)
        if not merchant.is_verification_token_valid():
            return Response({'error': 'expired_token', 'message': '驗證連結已過期'}, status=400)

        merchant.verify_email()
        return Response({'success': True, 'message': '電子郵件驗證成功！'})
    except MerchantProfile.DoesNotExist:
        return Response({'error': 'invalid_token', 'message': '驗證連結無效'}, status=400)
```

### Step 3: Update Login to Check Verification

**File**: `Backend/api/views/authentication.py`

In the `login` function, after merchant authentication:

```python
# After successful authentication, check merchant verification
if user.groups.filter(name='Merchant').exists():
    try:
        merchant_profile = MerchantProfile.objects.get(user=user)
        if not merchant_profile.verified:
            return Response({
                'error': 'email_not_verified',
                'message': '請先驗證您的電子郵件',
                'email': user.email
            }, status=status.HTTP_403_FORBIDDEN)
    except MerchantProfile.DoesNotExist:
        pass
```

### Step 4: Send Verification Email on Registration

**File**: `Backend/api/views/authentication.py`

In the `register` function, after creating merchant:

```python
# After MerchantProfile.objects.create(...)
token = merchant_profile.generate_verification_token()
send_merchant_verification_email(user.email, token)

return Response({
    'message': '註冊成功！驗證郵件已發送到您的信箱。',
    'user_id': user.id,
    'email': user.email,
    'verification_required': True
}, status=status.HTTP_201_CREATED)
```

### Step 5: Add Resend Verification Endpoint

**File**: `Backend/api/views/authentication.py`

```python
@api_view(['POST'])
def resend_merchant_verification(request):
    """POST /api/merchant/resend-verification/"""
    email = request.data.get('email')

    # Always return generic response (prevent enumeration)
    generic_response = Response({
        'success': True,
        'message': '如果此電子郵件存在且尚未驗證，驗證郵件將會發送。'
    })

    try:
        user = User.objects.get(email=email)
        if not user.groups.filter(name='Merchant').exists():
            return generic_response

        merchant = MerchantProfile.objects.get(user=user)
        if merchant.verified:
            return generic_response

        # Check rate limit
        allowed, message, wait = merchant.can_send_verification_email()
        if not allowed:
            return Response({
                'error': 'rate_limit_exceeded',
                'message': message,
                'wait_seconds': wait
            }, status=429)

        token = merchant.generate_verification_token()
        send_merchant_verification_email(email, token)
        return generic_response

    except (User.DoesNotExist, MerchantProfile.DoesNotExist):
        return generic_response
```

### Step 6: Register URLs

**File**: `Backend/Backend/urls.py`

```python
from api.views.authentication import verify_merchant_email, resend_merchant_verification

urlpatterns = [
    # ... existing patterns ...
    path('api/merchant/verify-email/', verify_merchant_email),
    path('api/merchant/resend-verification/', resend_merchant_verification),
]
```

---

## Frontend Implementation

### Step 1: Add Verify Email Screen

**File**: `Mobile-Merchant-Frontend/app/(auth)/verify-email.tsx`

```typescript
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { YStack, Text, Button, Spinner } from 'tamagui';
import { fetchAPI } from '../../utils/api';

export default function VerifyEmail() {
  const { token, email } = useLocalSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const requestSent = useRef(false);

  useEffect(() => {
    if (requestSent.current || !token) return;
    requestSent.current = true;

    fetchAPI(`/merchant/verify-email/?token=${token}`, { method: 'GET' })
      .then(res => {
        setStatus('success');
        setMessage(res.data.message);
        setTimeout(() => router.replace('/login'), 2000);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message || '驗證失敗');
      });
  }, [token]);

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
      {status === 'loading' && <Spinner size="large" />}
      {status === 'success' && <Text color="$green10">{message}</Text>}
      {status === 'error' && (
        <>
          <Text color="$red10">{message}</Text>
          <Button marginTop="$4" onPress={() => router.replace('/login')}>
            返回登入
          </Button>
        </>
      )}
    </YStack>
  );
}
```

### Step 2: Add Reset Password Screen

**File**: `Mobile-Merchant-Frontend/app/(auth)/reset-password.tsx`

```typescript
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { YStack, Text, Input, Button } from 'tamagui';
import { fetchAPI } from '../../utils/api';

export default function ResetPassword() {
  const { token, email } = useLocalSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      setError('密碼不一致');
      return;
    }
    if (password.length < 8) {
      setError('密碼長度至少需要8個字元');
      return;
    }

    setLoading(true);
    try {
      await fetchAPI('/reset-password/', {
        method: 'POST',
        data: { email, token, new_password: password }
      });
      router.replace({ pathname: '/login', params: { email } });
    } catch (err) {
      setError(err.response?.data?.message || '重設失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack flex={1} padding="$4" gap="$4">
      <Text fontSize="$6" fontWeight="bold">重設密碼</Text>
      <Input
        placeholder="新密碼"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Input
        placeholder="確認密碼"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      {error && <Text color="$red10">{error}</Text>}
      <Button onPress={handleSubmit} disabled={loading}>
        {loading ? '處理中...' : '確認重設'}
      </Button>
    </YStack>
  );
}
```

### Step 3: Update Login Screen for Unverified State

**File**: `Mobile-Merchant-Frontend/app/(auth)/login.tsx`

Add handling for `email_not_verified` error:

```typescript
// In login error handling:
if (error.response?.data?.error === 'email_not_verified') {
  setUnverifiedEmail(error.response.data.email);
  setShowResendModal(true);
}

// Add resend function:
const handleResendVerification = async () => {
  await fetchAPI('/merchant/resend-verification/', {
    method: 'POST',
    data: { email: unverifiedEmail }
  });
  // Show success message
};
```

### Step 4: Update API Utils

**File**: `Mobile-Merchant-Frontend/utils/api.ts`

Add new API functions:

```typescript
export const authAPI = {
  // ... existing functions ...

  verifyEmail: async (token: string) => {
    return fetchAPI(`/merchant/verify-email/?token=${token}`, { method: 'GET' });
  },

  resendVerification: async (email: string) => {
    return fetchAPI('/merchant/resend-verification/', {
      method: 'POST',
      data: { email }
    });
  },

  resetPassword: async (email: string, token: string, newPassword: string) => {
    return fetchAPI('/reset-password/', {
      method: 'POST',
      data: { email, token, new_password: newPassword }
    });
  }
};
```

---

## Testing Checklist

### Backend Tests

```bash
cd Backend
python manage.py test api.tests.test_merchant_auth
```

Key test cases:
- [ ] Registration sends verification email
- [ ] Login blocked for unverified merchants
- [ ] Verification succeeds with valid token
- [ ] Verification fails with expired token
- [ ] Rate limiting works for resend requests
- [ ] Password reset email sent for merchants
- [ ] Password reset succeeds with valid token

### Manual E2E Testing

1. **Registration Flow**
   - [ ] Register new merchant → verification email received
   - [ ] Click verification link → app opens, shows success
   - [ ] Can login after verification

2. **Login Blocked Flow**
   - [ ] Register but don't verify
   - [ ] Try to login → see "verify email" message
   - [ ] Click resend → new email received
   - [ ] Verify → can login

3. **Password Reset Flow**
   - [ ] Click "Forgot Password" on login
   - [ ] Enter email → reset email received
   - [ ] Click reset link → app opens reset form
   - [ ] Enter new password → success, can login

---

## Deep Link Format

Configure in `app.json` (already done):
```json
"scheme": ["coupromerchant"]
```

Links:
- Verification: `coupromerchant://verify-email?token=xxx&email=yyy`
- Password Reset: `coupromerchant://reset-password?token=xxx&email=yyy`

---

## Environment Variables

Ensure these are set:

```env
RESEND_API_KEY=re_xxxxx
FRONTEND_URL=coupromerchant://
```

---

## Rollback Plan

If issues occur:
1. Keep `MerchantProfile.verified` field
2. Set all existing merchants to `verified=True` via data migration
3. Remove verification check from login temporarily
