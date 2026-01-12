# Data Model: QR Code Coupon Claim

**Feature**: QR Code Coupon Claim  
**Date**: 2026-01-27

## Entities

### QRCodeSession

Represents an active QR code generation session for a coupon template. Created when a merchant requests a QR code, invalidated when the merchant closes the QR code display.

**Fields**:
- `id` (PrimaryKey): Auto-incrementing integer
- `template` (ForeignKey → CouponTemplate): The coupon template this QR code is for
- `merchant` (ForeignKey → User): The merchant who generated this QR code (must be template's store owner)
- `session_token` (CharField, max_length=100, unique=True): Unique token encoded in QR code (UUID4 format)
- `created_at` (DateTimeField, auto_now_add=True): When the session was created
- `is_active` (BooleanField, default=True): Whether the session is still valid (set to False on invalidation)
- `invalidated_at` (DateTimeField, null=True, blank=True): When the session was invalidated (optional, for analytics)

**Relationships**:
- Many-to-One: `template` → `CouponTemplate` (one template can have multiple active sessions)
- Many-to-One: `merchant` → `User` (one merchant can have multiple active sessions)

**Validation Rules**:
- `session_token` must be unique across all sessions
- `merchant` must own the `template`'s store (enforced in view logic)
- `is_active` defaults to `True` on creation
- `template` must be active and have `remaining_quantity > 0` (enforced in view logic)

**State Transitions**:
1. **Created**: `is_active=True`, `invalidated_at=None`
2. **Invalidated**: `is_active=False`, `invalidated_at=now()`

**Indexes**:
- `session_token` (unique index for fast lookup on claim requests)
- `template_id` + `is_active` (composite index for querying active sessions per template)
- `merchant_id` + `is_active` (composite index for querying merchant's active sessions)

---

### CouponTemplate (Existing - Modified)

**New Behavior**:
- No schema changes, but QR code sessions reference this model
- `generate_coupon()` method already handles quantity decrement atomically

**Existing Fields** (relevant to this feature):
- `id`: Template identifier
- `store`: Store that owns this template
- `remaining_quantity`: Available coupons remaining
- `is_active`: Whether template is active
- `total_quantity`: Total coupons in this template

---

### Coupon (Existing - Modified)

**New Behavior**:
- `acquisition_method` field extended with new choice: `'qr_claim'`

**Schema Changes**:
- `ACQUISITION_METHOD_CHOICES` extended:
  ```python
  ACQUISITION_METHOD_CHOICES = [
      ('draw', '抽優惠券'),
      ('consolidate', '電話歸戶'),
      ('transfer', '私人轉讓'),
      ('public_pool', '公共池領取'),
      ('qr_claim', 'QR Code 領取'),  # NEW
  ]
  ```

**Existing Fields** (relevant to this feature):
- `id`: Coupon identifier
- `template`: Reference to CouponTemplate (nullable)
- `current_holder`: User who owns this coupon
- `acquisition_method`: How the coupon was acquired (now includes `'qr_claim'`)
- `coupon_type`: Must be `'exclusive'` for QR code claims

**Validation Rules**:
- QR code-claimed coupons must have `coupon_type='exclusive'`
- QR code-claimed coupons must have `acquisition_method='qr_claim'`
- QR code-claimed coupons must have `current_holder` set (user who claimed)

---

## Data Flow

### 1. QR Code Generation Flow

```
Merchant requests QR code
  → Backend creates QRCodeSession
  → Backend generates UUID4 session_token
  → Backend returns {template_id, session_token}
  → Frontend generates QR code with JSON: {"template_id": X, "session_token": "..."}
  → QR code displayed to merchant
```

### 2. QR Code Claim Flow

```
User scans QR code
  → Frontend parses JSON: {"template_id": X, "session_token": "..."}
  → Frontend calls POST /api/qr-claim/claim/ with {template_id, session_token}
  → Backend validates:
     - Session token exists and is_active=True
     - Template exists and is_active=True
     - Template has remaining_quantity > 0
     - User is authenticated
  → Backend atomically decrements template.remaining_quantity
  → Backend creates Coupon with acquisition_method='qr_claim'
  → Backend returns success response
  → Frontend shows success message
```

### 3. Session Invalidation Flow

```
Merchant closes QR code display
  → Frontend component unmounts
  → Frontend calls POST /api/merchant/qr-session/<session_id>/invalidate/
  → Backend sets QRCodeSession.is_active=False
  → Backend sets QRCodeSession.invalidated_at=now()
  → Future claim requests with this token fail validation
```

---

## Database Schema

### Migration: Add QRCodeSession Model

```python
# Migration: XXXX_add_qrcode_session.py

from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    dependencies = [
        ('api', 'XXXX_previous_migration'),
    ]

    operations = [
        migrations.CreateModel(
            name='QRCodeSession',
            fields=[
                ('id', models.AutoField(primary_key=True)),
                ('session_token', models.CharField(max_length=100, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('invalidated_at', models.DateTimeField(null=True, blank=True)),
                ('template', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='qr_sessions',
                    to='api.CouponTemplate'
                )),
                ('merchant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='qr_sessions',
                    to='auth.User'
                )),
            ],
            options={
                'db_table': 'api_qrcode_session',
                'indexes': [
                    models.Index(fields=['session_token'], name='qr_session_token_idx'),
                    models.Index(fields=['template', 'is_active'], name='qr_session_template_active_idx'),
                    models.Index(fields=['merchant', 'is_active'], name='qr_session_merchant_active_idx'),
                ],
            },
        ),
    ]
```

### Migration: Add 'qr_claim' to ACQUISITION_METHOD_CHOICES

```python
# Migration: XXXX_add_qr_claim_acquisition_method.py

from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('api', 'XXXX_add_qrcode_session'),
    ]

    operations = [
        # No schema change needed - just update choices in model
        # The CharField already supports any string value
        # Update is in models.py only
    ]
```

---

## Validation Rules Summary

| Entity | Field | Rule | Enforcement |
|--------|-------|------|--------------|
| QRCodeSession | session_token | Unique, UUID4 format | Database unique constraint, view validation |
| QRCodeSession | template | Must be active, remaining_quantity > 0 | View validation |
| QRCodeSession | merchant | Must own template's store | View validation |
| QRCodeSession | is_active | Default True, set False on invalidation | Model default, view logic |
| Coupon | acquisition_method | Must be 'qr_claim' for QR claims | View logic |
| Coupon | coupon_type | Must be 'exclusive' for QR claims | View logic |
| Coupon | current_holder | Must be set (authenticated user) | View logic |
| CouponTemplate | remaining_quantity | Must be > 0 before claim | Atomic F() expression |

---

## Query Patterns

### Active Sessions for Template
```python
QRCodeSession.objects.filter(
    template_id=template_id,
    is_active=True
)
```

### Validate Session Token
```python
QRCodeSession.objects.get(
    session_token=token,
    is_active=True
)
```

### Active Sessions for Merchant
```python
QRCodeSession.objects.filter(
    merchant=merchant,
    is_active=True
)
```

### Coupons Claimed via QR Code
```python
Coupon.objects.filter(
    acquisition_method='qr_claim',
    current_holder=user
)
```

---

## Edge Cases Handled

1. **Multiple active sessions per template**: Allowed - merchant can generate multiple QR codes
2. **Session invalidation race condition**: Backend checks `is_active=True` atomically
3. **Template quantity race condition**: Atomic F() expression prevents negative quantities
4. **Invalid session token**: Returns 404/400 error with clear message
5. **Expired/invalidated session**: Returns 400 error "QR code session expired"
6. **Template out of stock**: Returns 400 error "Coupon template out of stock"
7. **Unauthenticated user**: Returns 401 error (handled by IsAuthenticated permission)
