# Data Model: Phone-Based Coupon Send

**Date**: 2026-01-05
**Branch**: `001-phone-coupon-send`

## Entity Overview

This feature modifies two existing entities and introduces no new tables.

```
┌─────────────────────────┐         ┌─────────────────────────┐
│     StudentProfile      │         │         Coupon          │
├─────────────────────────┤         ├─────────────────────────┤
│ user (FK -> User)       │         │ id (PK)                 │
│ phone_number (unique)   │◄───────►│ pending_phone_number    │
│ verified                │         │ current_holder (FK)     │
│ ...existing fields...   │         │ acquisition_method      │
└─────────────────────────┘         │ ...existing fields...   │
                                    └─────────────────────────┘
```

---

## Entity: StudentProfile (Modified)

**Location**: `Backend/api/models.py:16-56`

### Existing Field (No Changes Needed)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `phone_number` | `CharField(20)` | `null=True, blank=True, unique=True` | User's registered phone number |

### Validation Rules

| Rule | Regex/Logic | Error Message |
|------|-------------|---------------|
| Format | `^09\d{8}$` | "Invalid phone number format. Must be Taiwan mobile (09XXXXXXXX)" |
| Uniqueness | Database constraint | "This phone number is already registered to another account" |
| Normalization | Strip non-digits before save | N/A (silent normalization) |

### Display Format

```
Stored: 0912345678
Masked: 0912****78 (first 4 + last 2)
```

---

## Entity: Coupon (Modified)

**Location**: `Backend/api/models.py:169-245`

### New Field

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `pending_phone_number` | `CharField(20)` | `null=True, blank=True, db_index=True` | Phone number for pending (unclaimed) coupons |

### Field Relationships

```
Coupon States for Phone-Sent Coupons:

1. Sent to REGISTERED user:
   - current_holder = User
   - pending_phone_number = NULL
   - acquisition_method = 'consolidate'

2. Sent to UNREGISTERED phone:
   - current_holder = NULL
   - pending_phone_number = '0912345678'
   - acquisition_method = 'consolidate'

3. After user registers phone:
   - current_holder = User (newly assigned)
   - pending_phone_number = NULL (cleared)
   - acquisition_method = 'consolidate' (unchanged)
```

### State Transitions

```
                    ┌──────────────────┐
                    │   Template       │
                    │   (has quantity) │
                    └────────┬─────────┘
                             │
                    merchant sends via phone
                             │
           ┌─────────────────┴─────────────────┐
           │                                   │
    phone registered?                   phone not registered?
           │                                   │
           ▼                                   ▼
┌──────────────────┐                ┌──────────────────┐
│  Active Coupon   │                │  Pending Coupon  │
│                  │                │                  │
│ holder = User    │                │ holder = NULL    │
│ pending = NULL   │                │ pending = phone  │
└──────────────────┘                └────────┬─────────┘
                                             │
                                    user registers phone
                                             │
                                             ▼
                                   ┌──────────────────┐
                                   │  Active Coupon   │
                                   │                  │
                                   │ holder = User    │
                                   │ pending = NULL   │
                                   └──────────────────┘
```

### Existing Acquisition Methods

```python
ACQUISITION_METHOD_CHOICES = [
    ('draw', '抽優惠券'),           # From daily draw
    ('consolidate', '電話歸戶'),    # Via phone number (this feature)
    ('transfer', '私人轉讓'),       # Transferred from another user
    ('public_pool', '公共池領取'),  # Claimed from public sharing
]
```

---

## Migration Script

**File**: `Backend/api/migrations/XXXX_add_coupon_pending_phone_number.py`

```python
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0029_coupon_acquisition_method'),  # Adjust to latest migration
    ]

    operations = [
        migrations.AddField(
            model_name='coupon',
            name='pending_phone_number',
            field=models.CharField(
                max_length=20,
                null=True,
                blank=True,
                db_index=True,
                help_text='Phone number for pending (unclaimed) coupons sent to unregistered users'
            ),
        ),
    ]
```

---

## Query Patterns

### Get pending coupons for a phone number

```python
# When user registers/updates phone number
pending_coupons = Coupon.objects.filter(
    pending_phone_number=phone_number,
    current_holder__isnull=True,
    expiry_date__gt=timezone.now()
).select_related('template', 'store')
```

### Get user's phone number (masked)

```python
def mask_phone(phone: str) -> str:
    """Mask phone number: 0912345678 -> 0912****78"""
    if not phone or len(phone) < 6:
        return phone
    return f"{phone[:4]}{'*' * (len(phone) - 6)}{phone[-2:]}"
```

### Check phone uniqueness before save

```python
# In serializer validation
if StudentProfile.objects.filter(phone_number=phone).exclude(user=self.user).exists():
    raise ValidationError("This phone number is already registered to another account")
```

---

## Index Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| `api_studentprofile` | `phone_number` (unique) | Lookup user by phone for coupon sending |
| `api_coupon` | `pending_phone_number` | Find pending coupons for phone registration |

---

## Data Integrity Rules

1. **Phone number uniqueness**: Enforced at DB level via `unique=True` on StudentProfile.phone_number
2. **Pending phone cleanup**: When coupon is assigned, `pending_phone_number` MUST be set to NULL
3. **Expired pending coupons**: Excluded from assignment query; cleaned up via expiration batch job
4. **Template quantity**: Decremented on coupon creation (existing logic handles this)
