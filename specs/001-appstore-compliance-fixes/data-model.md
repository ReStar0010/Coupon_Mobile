# Data Model: App Store Compliance Fixes

**Feature**: 001-appstore-compliance-fixes
**Date**: 2026-01-15

## Overview

This feature requires modifications to existing models and minimal new entities. The primary focus is on account deletion with data anonymization to preserve coupon validity.

## Entity Changes

### 1. Store (Existing Model - Modification)

**File**: `Backend/api/models.py`

No schema changes required. During deletion, fields will be anonymized:

| Field                 | Current           | After Anonymization        |
| --------------------- | ----------------- | -------------------------- |
| `name`                | "張三茶飲店"      | "已刪除的商家"             |
| `address`             | "台北市信義區..." | "" (empty string)          |
| `lat`                 | 25.0330           | null                       |
| `lng`                 | 121.5654          | null                       |
| `image_url`           | "https://..."     | null                       |
| `unified_redeem_code` | "ABC123"          | null                       |
| `owner_id`            | 42                | null (after User deletion) |

**Note**: `owner` is a ForeignKey to User with `on_delete=models.CASCADE`. To preserve the Store record, we must either:

1. Set `owner` to null before User deletion (requires schema change to allow null)
2. OR keep the anonymized User record (defeats the purpose)

**Recommended**: Change `owner` field to `on_delete=models.SET_NULL, null=True, blank=True`

```python
# Current
owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_stores')

# Proposed
owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_stores')
```

---

### 2. MerchantProfile (Existing Model - Modification)

**File**: `Backend/api/models.py`

Similar to Store, the ForeignKey must allow null to preserve the record for audit purposes.

**Current Schema**:

```python
class MerchantProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='merchant_profile')
    phone = models.CharField(max_length=20)
    contact_person = models.CharField(max_length=100)
    contact_info = models.CharField(max_length=100)
```

**Option A**: Anonymize and keep profile

- Change `user` to `on_delete=models.SET_NULL, null=True, blank=True`
- Clear `phone`, `contact_person`, `contact_info` before User deletion

**Option B**: Let profile cascade delete (Recommended)

- MerchantProfile contains only PII, no business-critical data
- Let it CASCADE delete with User
- This is simpler and meets compliance requirements

**Decision**: Option B - allow CASCADE delete for MerchantProfile

---

### 3. AccountDeletionLog (New Model - Optional)

**Purpose**: Audit trail for account deletions (recommended for compliance)

```python
class AccountDeletionLog(models.Model):
    """Tracks account deletion events for audit purposes."""

    # Reference to deleted user (store email/id before deletion)
    deleted_user_email = models.EmailField()
    deleted_user_id = models.IntegerField()

    # Deletion metadata
    deleted_at = models.DateTimeField(auto_now_add=True)
    deletion_reason = models.CharField(max_length=255, default='user_requested')

    # What was preserved
    stores_anonymized = models.IntegerField(default=0)
    coupons_preserved = models.IntegerField(default=0)

    # Network failure handling
    initiated_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    retry_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'account_deletion_log'
        ordering = ['-deleted_at']
```

**Note**: This model is optional but recommended for:

- Regulatory compliance (audit trail)
- Debugging failed deletions
- Handling network failures with retry

---

## Relationships Diagram

```
User (MERCHANT - to be deleted)
├── MerchantProfile (CASCADE → deleted)
├── owned_stores (SET_NULL → preserved, anonymized)
│   ├── CouponTemplate (preserved)
│   │   └── Coupon (preserved, redeemable)
│   ├── QRCodeSession (CASCADE → deleted)
│   └── unified_redeem_code (cleared)
├── qr_sessions (CASCADE → deleted)
├── qr_claims (CASCADE → deleted)
├── coupon_redemptions (CASCADE → deleted)
├── sent_share_requests (CASCADE → deleted)
├── completed_goals (CASCADE → deleted)
└── PasswordResetProfile (CASCADE → deleted)

Coupon (preserved)
├── original_owner (STUDENT - NOT affected, kept as-is)
├── last_holder (STUDENT - NOT affected, kept as-is)
├── current_holder (STUDENT - NOT affected, kept as-is)
└── store (SET_NULL on Store.owner, store preserved)
```

---

## State Transitions

### Account Deletion States

```
[Active] ---(initiate deletion)---> [Pending Deletion]
                                          |
                           +--------------+---------------+
                           |                              |
                    (success)                       (network failure)
                           |                              |
                           v                              v
                     [Deleted]                   [Retry Pending]
                                                       |
                                            (retry on reconnection)
                                                       |
                                           +-----------+----------+
                                           |                      |
                                    (success)               (max retries)
                                           |                      |
                                           v                      v
                                     [Deleted]              [Failed]
```

**State Storage**:

- If using AccountDeletionLog: `status` field
- If not: User record remains until deletion completes (no intermediate state)

---

## Validation Rules

### Account Deletion Request

| Field          | Rule                                  | Error Message                 |
| -------------- | ------------------------------------- | ----------------------------- |
| `password`     | Required, must match user's password  | "密碼錯誤" (Invalid password) |
| `confirmation` | Must be string "DELETE" or equivalent | "請輸入確認文字"              |

### Pre-Deletion Checks

| Check                    | Action                                      |
| ------------------------ | ------------------------------------------- |
| User is merchant         | Required - only merchants can use this flow |
| User is authenticated    | Required - JWT token valid                  |
| Password verified        | Required - prevents unauthorized deletion   |
| Active coupons exist     | Warn user, proceed after acknowledgment     |
| Outstanding transactions | Warn user, proceed after acknowledgment     |

---

## Migration Plan

### Database Migration

```python
# migrations/XXXX_account_deletion_support.py

from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('api', 'previous_migration'),
    ]

    operations = [
        # 1. Change Store.owner to allow null (for anonymization)
        migrations.AlterField(
            model_name='store',
            name='owner',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='owned_stores',
                to='auth.user'
            ),
        ),

        # 2. Create AccountDeletionLog (optional)
        migrations.CreateModel(
            name='AccountDeletionLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('deleted_user_email', models.EmailField(max_length=254)),
                ('deleted_user_id', models.IntegerField()),
                ('deleted_at', models.DateTimeField(auto_now_add=True)),
                ('deletion_reason', models.CharField(default='user_requested', max_length=255)),
                ('stores_anonymized', models.IntegerField(default=0)),
                ('coupons_preserved', models.IntegerField(default=0)),
                ('initiated_at', models.DateTimeField()),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed')],
                    default='pending',
                    max_length=20
                )),
                ('retry_count', models.IntegerField(default=0)),
            ],
            options={
                'db_table': 'account_deletion_log',
                'ordering': ['-deleted_at'],
            },
        ),
    ]
```

---

## Frontend State

### Permission Denial State (Photo Library)

```typescript
interface PhotoPermissionState {
  status: "undetermined" | "granted" | "denied" | "limited";
  canAskAgain: boolean; // iOS only, always false after first denial
}
```

### Account Deletion State

```typescript
interface AccountDeletionState {
  stage:
    | "idle"
    | "confirming"
    | "password_entry"
    | "processing"
    | "complete"
    | "error";
  hasActiveCoupons: boolean;
  activeCoponCount: number;
  hasOutstandingTransactions: boolean;
  error?: string;
}
```

---

## Summary

| Model              | Action                             | Reason                                                             |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| User (Merchant)    | DELETE                             | Primary account deletion                                           |
| MerchantProfile    | CASCADE DELETE                     | Contains only PII                                                  |
| Store              | SET_NULL + Anonymize               | Preserve for valid coupons                                         |
| CouponTemplate     | Preserve                           | Required for coupon validity                                       |
| Coupon             | Preserve (NO CHANGES to owner FKs) | Student-owned, merchant deletion doesn't affect student references |
| AccountDeletionLog | CREATE (new)                       | Audit trail and retry handling                                     |

**Important Note**: Coupon's `original_owner`, `last_holder`, and `current_holder` fields reference **student users**, not the merchant being deleted. These fields should remain unchanged during merchant account deletion.
