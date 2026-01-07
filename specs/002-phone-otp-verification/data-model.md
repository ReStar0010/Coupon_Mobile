# Data Model: Phone OTP Verification

**Feature**: 002-phone-otp-verification | **Date**: 2026-01-07

## Overview

This document defines the data model for phone OTP verification. It includes one new model (`PhoneOTPRecord`) and modifications to the existing `StudentProfile` model behavior.

---

## New Model: PhoneOTPRecord

### Purpose

Tracks OTP verification attempts for phone number registration/updates. Enforces rate limiting, expiration, and attempt limits.

### Schema

```python
class PhoneOTPRecord(models.Model):
    """
    Tracks OTP verification attempts for phone numbers.
    Enforces: 3 requests/hour, 5 attempts/code, 10-min expiration.
    """

    # Core fields
    phone_number = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Taiwan mobile number in 09XXXXXXXX format"
    )
    otp_code = models.CharField(
        max_length=6,
        help_text="6-digit verification code"
    )
    user = models.ForeignKey(
        'auth.User',
        on_delete=models.CASCADE,
        related_name='phone_otp_records',
        help_text="User requesting verification"
    )

    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When OTP was generated"
    )
    expires_at = models.DateTimeField(
        help_text="When OTP expires (created_at + 10 minutes)"
    )

    # Attempt tracking
    attempt_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of verification attempts (max 5)"
    )

    # Status
    is_verified = models.BooleanField(
        default=False,
        help_text="True if OTP was successfully verified"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['phone_number', 'created_at']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        status = "verified" if self.is_verified else "pending"
        return f"OTP for {self.phone_number} ({status})"

    def is_expired(self) -> bool:
        """Check if OTP has expired."""
        return timezone.now() > self.expires_at

    def can_attempt(self) -> bool:
        """Check if more verification attempts are allowed."""
        return self.attempt_count < 5 and not self.is_expired()

    def increment_attempt(self) -> None:
        """Increment attempt count."""
        self.attempt_count += 1
        self.save(update_fields=['attempt_count'])

    @classmethod
    def can_send_otp(cls, phone_number: str) -> tuple[bool, str]:
        """
        Check rate limits for sending OTP.
        Returns (allowed, error_message_if_not_allowed).
        """
        from datetime import timedelta

        now = timezone.now()
        one_hour_ago = now - timedelta(hours=1)
        one_minute_ago = now - timedelta(seconds=60)

        # Check hourly limit: max 3 requests per phone per hour
        hourly_count = cls.objects.filter(
            phone_number=phone_number,
            created_at__gte=one_hour_ago
        ).count()

        if hourly_count >= 3:
            return False, "已超過每小時OTP請求次數限制，請稍後再試"

        # Check cooldown: 60 seconds between requests
        recent = cls.objects.filter(
            phone_number=phone_number,
            created_at__gte=one_minute_ago
        ).exists()

        if recent:
            return False, "請等待60秒後再重新發送驗證碼"

        return True, ""

    @classmethod
    def create_otp(cls, user, phone_number: str) -> 'PhoneOTPRecord':
        """
        Generate and store a new OTP for the given phone number.
        """
        import secrets
        from datetime import timedelta

        otp_code = ''.join(str(secrets.randbelow(10)) for _ in range(6))
        expires_at = timezone.now() + timedelta(minutes=10)

        return cls.objects.create(
            user=user,
            phone_number=phone_number,
            otp_code=otp_code,
            expires_at=expires_at
        )

    @classmethod
    def cleanup_old_records(cls, phone_number: str, user) -> None:
        """
        Delete old unverified OTP records for this phone/user.
        Called after successful verification.
        """
        cls.objects.filter(
            phone_number=phone_number,
            user=user,
            is_verified=False
        ).delete()
```

### Field Summary

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| phone_number | CharField(20) | indexed | Taiwan mobile (09XXXXXXXX) |
| otp_code | CharField(6) | - | 6-digit verification code |
| user | ForeignKey(User) | CASCADE | Requesting user |
| created_at | DateTimeField | auto_now_add, indexed | Request timestamp |
| expires_at | DateTimeField | - | Expiration (created + 10min) |
| attempt_count | PositiveIntegerField | default=0 | Verification attempts (max 5) |
| is_verified | BooleanField | default=False | Success flag |

### Validation Rules

| Rule | Enforcement | Error Message |
|------|-------------|---------------|
| Max 3 OTP requests/hour/phone | `can_send_otp()` class method | "已超過每小時OTP請求次數限制，請稍後再試" |
| 60-second cooldown between requests | `can_send_otp()` class method | "請等待60秒後再重新發送驗證碼" |
| Max 5 verification attempts/OTP | `can_attempt()` instance method | "驗證碼輸入錯誤次數過多，請重新獲取驗證碼" |
| 10-minute expiration | `is_expired()` instance method | "驗證碼已過期，請重新獲取" |
| Phone format: 09XXXXXXXX | `validate_phone_number()` utility | "請輸入有效的台灣手機號碼 (09開頭，共10碼)" |

---

## Existing Model: StudentProfile

### Current Phone-Related Fields

```python
class StudentProfile(models.Model):
    # ... existing fields ...
    phone_number = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        unique=True
    )
```

### Behavioral Changes (No Schema Changes)

| Aspect | Before | After |
|--------|--------|-------|
| Phone update method | Direct PUT /api/user/phone/ | Must go through OTP verification |
| Phone removal | DELETE /api/user/phone/ | Blocked (FR-017: must always have phone once set) |
| Uniqueness | Enforced at DB level | Same + checked before OTP send |

### No New Fields Required

The phone verification state is tracked in `PhoneOTPRecord`. The `StudentProfile.phone_number` field only stores verified phone numbers.

---

## Existing Model: Coupon

### Relevant Fields (No Changes)

```python
class Coupon(models.Model):
    # ... existing fields ...
    pending_phone_number = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        db_index=True,
        help_text='Phone number for pending (unclaimed) coupons'
    )
    current_holder = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='held_coupons'
    )
    acquisition_method = models.CharField(
        max_length=20,
        choices=ACQUISITION_METHOD_CHOICES,
        null=True,
        blank=True
    )
```

### Acquisition Method (No Changes)

Existing `'consolidate'` method covers all phone-based coupon claims:
- New phone verification → pending coupons claimed as `'consolidate'`
- Phone change → old phone's unclaimed coupons claimed as `'consolidate'`

No new acquisition method needed - both scenarios represent "phone-based coupon consolidation."

---

## Entity Relationships

```
┌─────────────────┐         ┌──────────────────┐
│      User       │─────────│  StudentProfile  │
│  (Django Auth)  │   1:1   │                  │
└────────┬────────┘         │  phone_number    │
         │                  └──────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐         ┌──────────────────┐
│ PhoneOTPRecord  │         │     Coupon       │
│                 │         │                  │
│  phone_number   │─ ─ ─ ─ ─│ pending_phone_   │
│  otp_code       │  (same  │     number       │
│  user (FK)      │  phone) │ current_holder   │
│  expires_at     │         │   (FK to User)   │
│  attempt_count  │         └──────────────────┘
│  is_verified    │
└─────────────────┘
```

### Relationship Notes

1. **User → PhoneOTPRecord**: One user can have multiple OTP records (for retries). Old records are cleaned up on successful verification.

2. **PhoneOTPRecord.phone_number → Coupon.pending_phone_number**: Same phone format. On verification, coupons with matching `pending_phone_number` are claimed.

3. **User → Coupon.current_holder**: When OTP is verified, coupons are transferred to the user via `current_holder` field.

---

## State Transitions

### OTP Lifecycle

```
[Not Created]
     │
     │ POST /api/phone-otp/send/
     ▼
[Created/Pending] ─────────────────────────────┐
     │                                         │
     │ 10 minutes pass                         │
     │                    ▼                    │
     │              [Expired] ─────────────────┤
     │                                         │
     │ 5 failed attempts                       │
     │                    ▼                    │
     │              [Locked Out] ──────────────┤
     │                                         │
     │ POST /api/phone-otp/verify/ (correct)   │
     ▼                                         │
[Verified] ────────────────────────────────────┘
     │                                         │
     │ Cleanup old records                     │
     ▼                                         │
[Deleted]                                      │
                                               │
                    All paths lead to ─────────┘
                    record deletion/expiration
```

### Phone Verification Flow

```
User has no phone
     │
     │ Enter phone + Send OTP
     ▼
OTP sent to phone
     │
     │ Enter correct code
     ▼
Phone verified & saved
     │
     │ Claim pending coupons
     ▼
Coupons transferred to user
```

### Phone Change Flow

```
User has phone A
     │
     │ Enter new phone B + Send OTP
     ▼
OTP sent to phone B
     │
     │ Enter correct code
     ▼
┌────┴────┐
│         │
▼         ▼
Transfer  Update phone
unclaimed A → B
coupons
from A    Claim pending
to user   coupons on B
```

---

## Migration Plan

### Migration 0032: Add PhoneOTPRecord

```python
# Backend/api/migrations/0032_phonootprecord.py
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '__latest__'),
        ('api', '0031_add_coupon_pending_phone_number'),
    ]

    operations = [
        migrations.CreateModel(
            name='PhoneOTPRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone_number', models.CharField(db_index=True, help_text='Taiwan mobile number in 09XXXXXXXX format', max_length=20)),
                ('otp_code', models.CharField(help_text='6-digit verification code', max_length=6)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, help_text='When OTP was generated')),
                ('expires_at', models.DateTimeField(help_text='When OTP expires (created_at + 10 minutes)')),
                ('attempt_count', models.PositiveIntegerField(default=0, help_text='Number of verification attempts (max 5)')),
                ('is_verified', models.BooleanField(default=False, help_text='True if OTP was successfully verified')),
                ('user', models.ForeignKey(help_text='User requesting verification', on_delete=django.db.models.deletion.CASCADE, related_name='phone_otp_records', to='auth.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='phonootprecord',
            index=models.Index(fields=['phone_number', 'created_at'], name='api_phoneotp_phone_created_idx'),
        ),
        migrations.AddIndex(
            model_name='phonootprecord',
            index=models.Index(fields=['user', 'created_at'], name='api_phoneotp_user_created_idx'),
        ),
    ]
```

**Note**: No migration needed for Coupon model - existing `'consolidate'` acquisition method is reused.

---

## Cleanup Strategy

### Automatic Cleanup

Old unverified OTP records should be cleaned up:

1. **On successful verification**: Delete all previous unverified records for that phone/user combination.

2. **Periodic cleanup job** (optional, if needed for DB hygiene):
   ```python
   # Management command: python manage.py cleanup_expired_otps
   from datetime import timedelta

   threshold = timezone.now() - timedelta(hours=24)
   PhoneOTPRecord.objects.filter(
       created_at__lt=threshold,
       is_verified=False
   ).delete()
   ```

### No Cascade Issues

- `PhoneOTPRecord` has `on_delete=CASCADE` for user FK
- If user is deleted, their OTP records are automatically deleted
- No other models reference `PhoneOTPRecord`
