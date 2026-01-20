# Data Model: Merchant 2FA Email Verification and Password Reset

**Feature**: 006-merchant-2fa-password-reset
**Date**: 2026-01-16

## Entity Overview

This feature modifies one existing entity (`MerchantProfile`) and reuses one existing entity (`PasswordResetProfile`). No new models are required.

---

## Entity: MerchantProfile (Modified)

**Location**: `Backend/api/models.py`

### Current Schema

```python
class MerchantProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='merchant_profile')
    phone = models.CharField(max_length=20)
    contact_person = models.CharField(max_length=100)
    contact_info = models.CharField(max_length=100)
```

### New Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `verified` | BooleanField | default=False | Email verification status |
| `email_verification_token` | CharField(64) | unique=True, null=True, blank=True | Token for email verification |
| `verification_token_created_at` | DateTimeField | null=True, blank=True | Token generation timestamp for expiration |
| `last_verification_email_sent` | DateTimeField | null=True, blank=True | Timestamp for rate limiting |
| `verification_email_count` | PositiveIntegerField | default=0 | Count for rate limiting (resets hourly) |

### Updated Schema

```python
class MerchantProfile(models.Model):
    # Existing fields
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='merchant_profile')
    phone = models.CharField(max_length=20)
    contact_person = models.CharField(max_length=100)
    contact_info = models.CharField(max_length=100)

    # New verification fields
    verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True
    )
    verification_token_created_at = models.DateTimeField(null=True, blank=True)
    last_verification_email_sent = models.DateTimeField(null=True, blank=True)
    verification_email_count = models.PositiveIntegerField(default=0)

    def is_verification_token_valid(self) -> bool:
        """Check if verification token is still valid (24-hour expiration)."""
        if not self.verification_token_created_at:
            return False
        expiry_time = self.verification_token_created_at + timedelta(hours=24)
        return timezone.now() < expiry_time

    def can_send_verification_email(self) -> tuple[bool, str, int]:
        """
        Check if a verification email can be sent.
        Returns: (allowed, message, wait_seconds)
        """
        now = timezone.now()

        # Reset count if last send was > 1 hour ago
        if self.last_verification_email_sent:
            if now - self.last_verification_email_sent > timedelta(hours=1):
                self.verification_email_count = 0

        # Rate limit: max 3 per hour
        if self.verification_email_count >= 3:
            return (False, '已達到發送限制，請稍後再試', 0)

        # Cooldown: 60 seconds between sends
        if self.last_verification_email_sent:
            elapsed = (now - self.last_verification_email_sent).total_seconds()
            if elapsed < 60:
                wait = 60 - int(elapsed)
                return (False, f'請等待 {wait} 秒後再試', wait)

        return (True, '', 0)

    def generate_verification_token(self) -> str:
        """Generate a new verification token."""
        import secrets
        self.email_verification_token = secrets.token_urlsafe(32)
        self.verification_token_created_at = timezone.now()
        self.last_verification_email_sent = timezone.now()
        self.verification_email_count += 1
        self.save()
        return self.email_verification_token

    def verify_email(self) -> None:
        """Mark email as verified and clear token."""
        self.verified = True
        self.email_verification_token = None
        self.verification_token_created_at = None
        self.save()
```

### Validation Rules

| Rule | Description |
|------|-------------|
| Token uniqueness | `email_verification_token` must be unique across all merchants |
| Token expiration | Token valid for 24 hours from `verification_token_created_at` |
| Rate limit | Max 3 verification emails per hour per merchant |
| Cooldown | Min 60 seconds between verification email requests |
| One-time use | Token cleared after successful verification |

### State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                    MERCHANT VERIFICATION STATE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     Registration      ┌──────────────────┐    │
│  │              │ ──────────────────►  │                  │    │
│  │  No Account  │                      │  Unverified      │    │
│  │              │                      │  (verified=False)│    │
│  └──────────────┘                      │  token=generated │    │
│                                         └────────┬─────────┘    │
│                                                  │              │
│                      ┌─────────────────────────────┤              │
│                      │ Click verification link  │              │
│                      │ (valid token)            │              │
│                      ▼                          │              │
│               ┌──────────────────┐              │              │
│               │                  │              │              │
│               │    Verified      │              │              │
│               │  (verified=True) │              │              │
│               │  token=null      │              │              │
│               └──────────────────┘              │              │
│                                                  │              │
│                      ┌─────────────────────────────┘              │
│                      │ Token expired or                        │
│                      │ resend requested                        │
│                      ▼                                          │
│               ┌──────────────────┐                              │
│               │  New Token       │ ──► Back to Unverified      │
│               │  (old invalidated)│    with new token          │
│               └──────────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entity: PasswordResetProfile (Existing - No Changes)

**Location**: `Backend/api/models.py`

This entity is already user-agnostic and works for both consumers and merchants.

### Current Schema

```python
class PasswordResetProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='password_reset')
    token = models.CharField(max_length=100, null=True, blank=True)
    token_created_at = models.DateTimeField(null=True, blank=True)
```

### Why No Changes Needed

1. **User-agnostic**: Links to `User` model, not profile type
2. **Token validation**: `is_token_valid()` in `api/auth.py` works for any user
3. **One-to-one**: Each user (merchant or consumer) can have one reset token

### Validation Rules (Existing)

| Rule | Description |
|------|-------------|
| Token expiration | 24 hours from `token_created_at` |
| One-time use | Token cleared after successful password reset |
| Overwrites | New request overwrites previous token |

---

## Entity: Store (No Changes)

Store records are created during merchant registration. No changes needed for this feature.

---

## Database Migration

### Migration File: `XXXX_add_merchant_verification_fields.py`

```python
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', 'XXXX_previous_migration'),
    ]

    operations = [
        migrations.AddField(
            model_name='merchantprofile',
            name='verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='merchantprofile',
            name='email_verification_token',
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='merchantprofile',
            name='verification_token_created_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='merchantprofile',
            name='last_verification_email_sent',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='merchantprofile',
            name='verification_email_count',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
```

### Data Migration Consideration

Existing merchants created before this feature will have:
- `verified = False` (default)

**Decision**: Existing merchants should be auto-verified or manually verified by admin. This is a business decision to be confirmed with stakeholders. Options:
1. Auto-verify existing merchants (data migration sets `verified=True` for existing)
2. Require existing merchants to verify on next login

---

## Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         ENTITY RELATIONSHIPS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐        1:1         ┌──────────────────┐       │
│  │              │ ◄──────────────────►│                  │       │
│  │    User      │                    │ MerchantProfile  │       │
│  │  (Django)    │                    │ (with new fields)│       │
│  │              │                    │                  │       │
│  └──────┬───────┘                    └──────────────────┘       │
│         │                                                        │
│         │ 1:1                                                    │
│         ▼                                                        │
│  ┌──────────────────┐                                           │
│  │                  │                                           │
│  │ PasswordReset    │  ← Shared by both merchant and consumer   │
│  │ Profile          │                                           │
│  │                  │                                           │
│  └──────────────────┘                                           │
│                                                                  │
│  NOTE: User.groups determines if user is merchant:              │
│        user.groups.filter(name='Merchant').exists()             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Indexes

### New Indexes for MerchantProfile

| Field | Index Type | Rationale |
|-------|------------|-----------|
| `email_verification_token` | UNIQUE | Token lookup for verification endpoint |
| `verified` | BTREE | Filter unverified merchants for admin |

```python
class Meta:
    indexes = [
        models.Index(fields=['verified']),
    ]
```

Note: `email_verification_token` gets automatic unique index from `unique=True`.
