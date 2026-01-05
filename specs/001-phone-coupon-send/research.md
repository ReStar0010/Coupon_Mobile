# Research: Phone-Based Coupon Send

**Date**: 2026-01-05
**Branch**: `001-phone-coupon-send`

## Research Summary

This document consolidates research findings for the phone-based coupon send feature. All technical unknowns have been resolved through codebase analysis.

---

## 1. Phone Number Storage & Validation

### Decision
Use the existing `StudentProfile.phone_number` field with Taiwan mobile format validation (10 digits starting with "09").

### Rationale
- `StudentProfile` model already has a `phone_number` field defined at `Backend/api/models.py:20`
- Field is `CharField(max_length=20, null=True, blank=True, unique=True)`
- Uniqueness constraint already enforced at database level
- Optional field allows users to use the app without phone registration

### Alternatives Considered
1. **Create separate PhoneNumber model**: Rejected - unnecessary complexity for single phone per user
2. **Store on User model directly**: Rejected - StudentProfile is the established extension pattern

### Implementation Notes
- Add validation regex: `^09\d{8}$` (Taiwan mobile format)
- Normalize phone numbers by stripping spaces/dashes before storage
- Display masked format: `0912****78` (first 4 + last 2 digits)

---

## 2. Pending Coupon Storage

### Decision
Add a `pending_phone_number` field to the existing `Coupon` model.

### Rationale
- Keeps coupon data together rather than creating separate pending coupon table
- Allows reuse of existing coupon generation logic in `CouponTemplate.generate_coupon()`
- Simple query: `Coupon.objects.filter(pending_phone_number=phone, current_holder__isnull=True)`
- Matches existing pattern where `current_holder=None` indicates unassigned coupon

### Alternatives Considered
1. **Separate PendingCoupon model**: Rejected - duplicates Coupon fields, requires migration logic
2. **JSON field with pending recipients**: Rejected - complicates queries and loses referential integrity
3. **CouponShareRequest modification**: Rejected - different semantic (share vs. direct send)

### Implementation Notes
- Add field: `pending_phone_number = CharField(max_length=20, null=True, blank=True, db_index=True)`
- Index for efficient lookup when user registers phone
- When user registers: query pending coupons, assign `current_holder`, clear `pending_phone_number`

---

## 3. Consolidate Coupon API Pattern

### Decision
Extend existing `merchant_consolidate_coupon` endpoint to handle both registered and unregistered phone numbers.

### Rationale
- Endpoint already exists at `Backend/api/views/merchant_coupon.py:29`
- Serializer already validates `template_id` and `phone_number`
- Current flow: lookup user -> generate coupon -> assign to user
- Extended flow: if user not found -> generate pending coupon with phone number

### Implementation Pattern
```python
# Existing (registered user)
try:
    user_profile = StudentProfile.objects.get(phone_number=phone_number)
    coupon = template.generate_coupon(user_profile.user)
    coupon.acquisition_method = 'consolidate'
    coupon.save()

# Extended (unregistered - new code path)
except StudentProfile.DoesNotExist:
    coupon = Coupon.objects.create(
        template=template,
        pending_phone_number=phone_number,
        acquisition_method='consolidate',
        # ... other fields from template
    )
```

### Security Fix Required
- Change `@permission_classes([AllowAny])` to `@permission_classes([IsAuthenticated])`
- Add merchant ownership validation (verify merchant owns the template's store)

---

## 4. Phone Number Assignment on Registration

### Decision
Hook into the existing user registration/profile update flow to assign pending coupons.

### Rationale
- Two entry points: (1) new user registration, (2) existing user adds phone number
- Both should trigger pending coupon assignment
- Existing `register` view at `Backend/api/views/authentication.py`

### Implementation Pattern
```python
def assign_pending_coupons(user, phone_number):
    """Assign all pending coupons for a phone number to the user."""
    pending_coupons = Coupon.objects.filter(
        pending_phone_number=phone_number,
        current_holder__isnull=True,
        expiry_date__gt=timezone.now()  # Skip expired
    )
    for coupon in pending_coupons:
        coupon.current_holder = user
        coupon.original_owner = user  # First holder
        coupon.pending_phone_number = None
        coupon.save()
    return pending_coupons.count()
```

### Call Sites
1. After successful phone number update in user profile endpoint
2. After registration if phone number is provided (future enhancement)

---

## 5. Frontend UI Patterns

### Decision
Follow existing Tamagui component patterns from the codebase.

### User App (Mobile-Frontend)
- Location: `app/OptionsMenu/PhoneSettings.tsx` (new file)
- Navigation: Add menu item in `app/OptionsMenu/index.tsx`
- Components: Use existing `Input`, `Button` from Tamagui
- API: Add methods to `app/utils/authAPI.ts`

### Merchant App (Mobile-Merchant-Frontend)
- Location: `app/(coupons)/[id].tsx` (modify existing)
- Current state: Phone input exists, calls `merchantAPI.redeem()` for redemption
- Needed: Add "Send Coupon" button that calls `merchantAPI.consolidateCoupon()`
- API method exists in pattern, add to `utils/api.ts`

### Existing Component Examples
```tsx
// From Mobile-Frontend/app/OptionsMenu/index.tsx
<ListItem
  icon={Phone}
  iconAfter={ChevronRight}
  onPress={handlePhoneSettings}>
  <ListItem.Text>Phone Number</ListItem.Text>
</ListItem>

// From Mobile-Merchant-Frontend/app/(coupons)/[id].tsx
<Input
  placeholder="Enter phone number"
  value={phoneNumber}
  onChangeText={setPhoneNumber}
  keyboardType="phone-pad"
/>
```

---

## 6. Error Handling Patterns

### Decision
Follow existing DRF error response patterns in the codebase.

### Existing Pattern (from `merchant_coupon.py`)
```python
return Response({
    'error': 'User with this phone number does not exist.'
}, status=status.HTTP_404_NOT_FOUND)
```

### New Error Cases
| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| Phone already registered by another user | 400 | "This phone number is already registered to another account" |
| Invalid phone format | 400 | "Invalid phone number format. Must be Taiwan mobile (09XXXXXXXX)" |
| Template not found/inactive | 404 | "Coupon template does not exist, is not active, or is out of stock" |
| Template out of stock | 400 | "No coupons available for this template" |
| Template expired | 400 | "This coupon template has expired" |

---

## 7. Data Migration Strategy

### Decision
Add new field via Django migration, no data backfill needed.

### Rationale
- `pending_phone_number` is a new optional field
- Existing coupons don't need this field (they already have holders)
- No breaking changes to existing data

### Migration Steps
1. Generate migration: `python manage.py makemigrations api`
2. Apply migration: `python manage.py migrate`
3. Field will be `NULL` for all existing coupons (correct behavior)

---

## 8. Acquisition Method Display

### Decision
Reuse existing acquisition method display in user coupon collection.

### Evidence
- `Coupon.ACQUISITION_METHOD_CHOICES` at `models.py:204` already includes `'consolidate': '電話歸戶'`
- Acquisition method already displayed in coupon detail views
- No UI changes needed for display - just ensure `acquisition_method='consolidate'` is set on new coupons

---

## Research Completion Checklist

- [x] Phone number storage location identified
- [x] Phone number validation pattern defined
- [x] Pending coupon storage mechanism designed
- [x] API extension pattern identified
- [x] Security fix requirement documented
- [x] Frontend component patterns identified
- [x] Error handling patterns documented
- [x] Migration strategy defined
- [x] Acquisition method display confirmed

**Status**: All research items resolved. Ready for Phase 1 design artifacts.
