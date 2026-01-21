# Data Model: UGC Compliance for Apple Guideline 1.2

**Feature**: 007-ugc-compliance
**Date**: 2026-01-21
**Status**: Complete

## Overview

This document defines the data models required for implementing Apple Guideline 1.2 UGC compliance. All models extend the existing `Backend/api/models.py` file.

---

## Entity Relationship Diagram

```
┌─────────────────────┐     ┌─────────────────────┐
│    User (Django)    │     │   ContentType       │
│                     │     │   (Django built-in) │
└─────────────────────┘     └─────────────────────┘
         │                           │
         │                           │
    ┌────┴────────┬─────────────┬────┴────────┐
    │             │             │             │
    ▼             ▼             ▼             ▼
┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Blocked  │  │ Content  │  │  EULA    │  │Moderation│
│Merchant │  │ Report   │  │Acceptance│  │ Action   │
└─────────┘  └──────────┘  └──────────┘  └──────────┘
    │             │              │             │
    │             │              │             │
    ▼             ▼              │             │
┌─────────┐  ┌──────────┐       │             │
│  Store  │  │Violation │◄──────┘             │
│         │  │ Record   │◄────────────────────┘
└─────────┘  └──────────┘
```

---

## Models

### 1. ContentReport

Stores consumer reports of inappropriate merchant content (coupons, store profiles).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | AutoField | PK | Primary key |
| `reporter` | ForeignKey(User) | NOT NULL, CASCADE | Consumer who submitted the report |
| `content_type` | ForeignKey(ContentType) | NOT NULL, CASCADE | Django ContentType for generic relation |
| `object_id` | PositiveIntegerField | NOT NULL, indexed | ID of the reported content |
| `reason` | CharField(20) | NOT NULL, choices | Report reason category |
| `details` | TextField | blank=True | Optional additional details |
| `status` | CharField(20) | NOT NULL, default='pending' | Report processing status |
| `created_at` | DateTimeField | auto_now_add | When report was submitted |
| `reviewed_at` | DateTimeField | null=True | When report was reviewed |
| `reviewed_by` | ForeignKey(User) | null=True, SET_NULL | Admin who reviewed |

**Choices:**

```python
REPORT_REASONS = [
    ('inappropriate', '不當內容'),      # Inappropriate content
    ('misleading', '誤導資訊'),         # Misleading information
    ('illegal', '違法商品'),            # Illegal goods
    ('spam', '垃圾訊息'),               # Spam
    ('other', '其他'),                  # Other
]

REPORT_STATUS = [
    ('pending', '待審核'),              # Pending
    ('reviewed', '已審核'),             # Reviewed (action taken)
    ('dismissed', '已駁回'),            # Dismissed (no action)
]
```

**Indexes:**
- `(reporter, content_type, object_id)` - Duplicate prevention lookup
- `(status, created_at)` - Moderation queue ordering
- `created_at` - Escalation alert queries

**Constraints:**
- Unique constraint on `(reporter, content_type, object_id)` per 24-hour window (enforced at application level)

**Relationships:**
- Generic foreign key to `Coupon` or `Store` via `content_type` + `object_id`
- Foreign key to `User` as reporter
- Foreign key to `User` as reviewer (nullable)

---

### 2. BlockedMerchant

Stores consumer block lists for filtering merchant content.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | AutoField | PK | Primary key |
| `user` | ForeignKey(User) | NOT NULL, CASCADE | Consumer who blocked |
| `store` | ForeignKey(Store) | NOT NULL, CASCADE | Blocked merchant store |
| `created_at` | DateTimeField | auto_now_add | When block was created |

**Indexes:**
- `(user, store)` - Unique together, lookup optimization
- `user` - Block list retrieval for filtering

**Constraints:**
- `unique_together = ['user', 'store']` - Prevent duplicate blocks

**Relationships:**
- Foreign key to `User` (consumer)
- Foreign key to `Store` (merchant's store)

---

### 3. EULAAcceptance

Records merchant agreement to platform terms before content upload.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | AutoField | PK | Primary key |
| `merchant` | ForeignKey(User) | NOT NULL, CASCADE | Merchant who accepted |
| `version` | CharField(20) | NOT NULL | EULA version string (e.g., "1.0.0") |
| `accepted_at` | DateTimeField | auto_now_add | When acceptance occurred |
| `ip_address` | GenericIPAddressField | NOT NULL | IP address at acceptance |

**Indexes:**
- `(merchant, version)` - Unique together, acceptance lookup
- `merchant` - Latest acceptance lookup

**Constraints:**
- `unique_together = ['merchant', 'version']` - One acceptance per version per merchant

**Relationships:**
- Foreign key to `User` (merchant)

**Notes:**
- Current EULA version stored in settings/constants
- Upload endpoints check for matching version acceptance

---

### 4. ModerationAction

Audit log of administrator actions on reported content.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | AutoField | PK | Primary key |
| `report` | ForeignKey(ContentReport) | NOT NULL, CASCADE | Associated report |
| `admin` | ForeignKey(User) | NOT NULL, CASCADE | Admin who took action |
| `action` | CharField(20) | NOT NULL, choices | Action type taken |
| `notes` | TextField | blank=True | Admin notes/justification |
| `created_at` | DateTimeField | auto_now_add | When action was taken |

**Choices:**

```python
MODERATION_ACTIONS = [
    ('approve', '核准'),              # Approve (dismiss report)
    ('remove', '移除內容'),           # Remove content
    ('suspend', '暫停帳號'),          # Suspend merchant account
]
```

**Indexes:**
- `report` - Action history per report
- `admin` - Admin action audit trail
- `created_at` - Timeline queries

**Relationships:**
- Foreign key to `ContentReport`
- Foreign key to `User` (admin)

---

### 5. ViolationRecord

Tracks merchant content violations for suspension threshold.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | AutoField | PK | Primary key |
| `merchant` | ForeignKey(User) | NOT NULL, CASCADE | Merchant with violation |
| `report` | ForeignKey(ContentReport) | null=True, SET_NULL | Originating report |
| `action` | ForeignKey(ModerationAction) | null=True, SET_NULL | Action that created violation |
| `violation_type` | CharField(20) | NOT NULL, choices | Type of violation |
| `created_at` | DateTimeField | auto_now_add | When violation was recorded |
| `notes` | TextField | blank=True | Additional context |

**Choices:**

```python
VIOLATION_TYPES = [
    ('content_removed', '內容移除'),     # Content was removed
    ('account_suspended', '帳號暫停'),   # Account suspended
]
```

**Indexes:**
- `merchant` - Violation count per merchant
- `created_at` - Timeline queries

**Relationships:**
- Foreign key to `User` (merchant)
- Foreign key to `ContentReport` (nullable, SET_NULL)
- Foreign key to `ModerationAction` (nullable, SET_NULL)

---

### 6. MerchantProfile Extension

Add violation tracking field to existing `MerchantProfile` model.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `violation_count` | PositiveIntegerField | default=0 | Denormalized violation counter |
| `suspension_flagged` | BooleanField | default=False | Flagged for suspension review |
| `suspension_flagged_at` | DateTimeField | null=True | When flagged |

**Notes:**
- `violation_count` incremented when `ViolationRecord` created
- `suspension_flagged` set to `True` when `violation_count >= 10`
- Denormalization enables efficient threshold checks

---

### 7. ContentGuidelines (Configuration)

Not a database model - stored as versioned constant or static file.

| Setting | Value | Description |
|---------|-------|-------------|
| `CURRENT_EULA_VERSION` | "1.0.0" | Current EULA version string |
| `EULA_CONTENT_PATH` | "static/eula_zh.txt" | Path to EULA text file |
| `GUIDELINES_CONTENT_PATH` | "static/guidelines_zh.txt" | Path to guidelines text |
| `ESCALATION_HOURS_WARNING` | 20 | Hours before first escalation alert |
| `ESCALATION_HOURS_CRITICAL` | 24 | Hours before critical alert |
| `VIOLATION_SUSPENSION_THRESHOLD` | 10 | Violations before suspension flag |
| `REPORT_DUPLICATE_WINDOW_HOURS` | 24 | Hours before same user can re-report same content |
| `REPORT_RETENTION_DAYS` | 7 | Days to retain resolved reports |

---

## State Transitions

### ContentReport Status

```
                    ┌────────────────────────────────────────┐
                    │                                        │
                    ▼                                        │
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐  │
│ Created │───►│ pending │───►│ reviewed │    │dismissed │  │
└─────────┘    └─────────┘    └──────────┘    └──────────┘  │
                    │              │               │         │
                    │              └───────────────┴─────────┘
                    │                     │
                    ▼                     ▼
               [Admin reviews]    [Auto-cleanup after 7 days]
```

**Transitions:**
1. `pending` → `reviewed`: Admin takes action (remove/suspend)
2. `pending` → `dismissed`: Admin dismisses report as unfounded
3. `reviewed`/`dismissed` → [deleted]: Auto-cleanup after 7 days

### Merchant Suspension Flag

```
violation_count = 0  ──►  violation_count = 1  ──►  violation_count = 2
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
suspension_flagged = False     False                    False
        │                        │                        │
        │                        │                        ▼
        │                        │              violation_count = 10
        │                        │                        │
        │                        │                        ▼
        │                        │              suspension_flagged = True
        │                        │              suspension_flagged_at = now()
        │                        │                        │
        └────────────────────────┴────────────────────────┴──► [Admin review]
```

---

## Validation Rules

### ContentReport
- `reason` must be one of predefined choices
- `reporter` cannot be merchant who owns the content
- Duplicate prevention: No existing report from same user for same content within 24 hours

### BlockedMerchant
- `user` must be consumer (not merchant)
- `store` must exist and be active
- Cannot block own store (if user happens to be merchant with another account)

### EULAAcceptance
- `version` must be valid semver format
- `ip_address` must be valid IPv4 or IPv6
- Merchant can only have one acceptance per version

### ModerationAction
- `admin` must be staff user (`is_staff=True`)
- `action` must be one of predefined choices
- `report` status must be `pending` when action is created

### ViolationRecord
- `merchant` must be merchant user
- Either `report` or `action` should be non-null (traceable origin)

---

## Django Model Definitions

```python
# Backend/api/models.py additions

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

REPORT_REASONS = [
    ('inappropriate', '不當內容'),
    ('misleading', '誤導資訊'),
    ('illegal', '違法商品'),
    ('spam', '垃圾訊息'),
    ('other', '其他'),
]

REPORT_STATUS = [
    ('pending', '待審核'),
    ('reviewed', '已審核'),
    ('dismissed', '已駁回'),
]

MODERATION_ACTIONS = [
    ('approve', '核准'),
    ('remove', '移除內容'),
    ('suspend', '暫停帳號'),
]

VIOLATION_TYPES = [
    ('content_removed', '內容移除'),
    ('account_suspended', '帳號暫停'),
]


class ContentReport(models.Model):
    """Consumer report of merchant content (coupon or store)."""
    reporter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='content_reports'
    )
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE
    )
    object_id = models.PositiveIntegerField(db_index=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    reason = models.CharField(max_length=20, choices=REPORT_REASONS)
    details = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=REPORT_STATUS,
        default='pending',
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_reports'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['reporter', 'content_type', 'object_id']),
        ]

    def __str__(self) -> str:
        return f"Report #{self.id} - {self.get_reason_display()}"


class BlockedMerchant(models.Model):
    """Consumer's blocked merchant store."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='blocked_merchants'
    )
    store = models.ForeignKey(
        'Store',
        on_delete=models.CASCADE,
        related_name='blocked_by'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'store']
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.user.username} blocked {self.store.name}"


class EULAAcceptance(models.Model):
    """Record of merchant EULA acceptance."""
    merchant = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='eula_acceptances'
    )
    version = models.CharField(max_length=20)
    accepted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField()

    class Meta:
        unique_together = ['merchant', 'version']
        ordering = ['-accepted_at']

    def __str__(self) -> str:
        return f"{self.merchant.username} accepted EULA v{self.version}"


class ModerationAction(models.Model):
    """Admin action on reported content."""
    report = models.ForeignKey(
        ContentReport,
        on_delete=models.CASCADE,
        related_name='actions'
    )
    admin = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='moderation_actions'
    )
    action = models.CharField(max_length=20, choices=MODERATION_ACTIONS)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Action #{self.id} - {self.get_action_display()}"


class ViolationRecord(models.Model):
    """Merchant violation history for suspension tracking."""
    merchant = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='violations'
    )
    report = models.ForeignKey(
        ContentReport,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='violations'
    )
    action = models.ForeignKey(
        ModerationAction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='violations'
    )
    violation_type = models.CharField(max_length=20, choices=VIOLATION_TYPES)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Violation #{self.id} - {self.merchant.username}"
```

---

## MerchantProfile Extension

```python
# Add to existing MerchantProfile model in Backend/api/models.py

class MerchantProfile(models.Model):
    # ... existing fields ...

    # UGC Compliance fields
    violation_count = models.PositiveIntegerField(default=0)
    suspension_flagged = models.BooleanField(default=False)
    suspension_flagged_at = models.DateTimeField(null=True, blank=True)
```

---

## Migration Notes

1. Create migration for new models:
   ```bash
   python manage.py makemigrations api --name ugc_compliance_models
   ```

2. Migration should:
   - Create `ContentReport`, `BlockedMerchant`, `EULAAcceptance`, `ModerationAction`, `ViolationRecord` tables
   - Add `violation_count`, `suspension_flagged`, `suspension_flagged_at` to `MerchantProfile`
   - Create necessary indexes

3. Data migration considerations:
   - No existing data to migrate
   - All new fields have defaults, no data backfill needed
