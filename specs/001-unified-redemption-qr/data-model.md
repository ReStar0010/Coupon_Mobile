# Data Model: Unified Redemption QR Code

**Feature**: Unified Redemption QR Code  
**Date**: 2025-01-27  
**Phase**: 1 - Design & Contracts

## Entity Changes

### Store Model (Modified)

**Purpose**: Store unified redemption code at the merchant/store level.

**New Field**:
- `unified_redeem_code` (CharField, max_length=6, null=True, blank=True)
  - Stores the current unified redemption code for this store
  - Regenerated each time merchant clicks unified redemption button
  - Format: 6-digit numeric string (e.g., "123456")
  - Nullable to support stores without unified codes (backward compatibility)

**Existing Fields** (unchanged):
- `owner` (ForeignKey to User)
- `name`, `address`, `lat`, `lng`, etc.

**Relationships**:
- One Store has one `unified_redeem_code` (1:1)
- One Store has many CouponTemplates (1:N)
- One Store has many Coupons (1:N)

**Validation Rules**:
- Code must be 6 digits when set
- Code is optional (nullable) for backward compatibility
- Code format: numeric only (0-9)

**State Transitions**:
- Initial state: `unified_redeem_code = None`
- On merchant button click: Generate new 6-digit code → Update field
- On next button click: Generate new code → Replace previous value

---

## Existing Entities (No Changes)

### Coupon Model
- **Status**: No changes required
- **Usage**: Existing `redeem_code` field and validation logic remain unchanged
- **Note**: Unified redemption code validation happens before coupon validation

### CouponTemplate Model
- **Status**: No changes required
- **Usage**: `template_redeem_code` field remains for individual coupon redemption (deprecated but preserved)

### CouponRedemption Model
- **Status**: No changes required
- **Usage**: Records redemptions initiated through unified flow same as individual flow

### User, MerchantProfile, StudentProfile Models
- **Status**: No changes required
- **Usage**: Authentication and authorization remain unchanged

---

## Data Flow

### Unified Redemption Code Generation

```
Merchant clicks unified redemption button
  → Backend generates 6-digit code
  → Update Store.unified_redeem_code
  → Return code to frontend
  → Frontend displays QR code with code
```

### Unified Redemption Code Validation

```
Consumer scans QR code
  → Extract 6-digit code
  → Call GET /api/unified-redemption/{code}/
  → Backend validates code matches Store.unified_redeem_code
  → Backend returns store info + consumer's available coupons
  → Consumer selects coupon
  → Call POST /api/redeem/{coupon_id}/ with unified code
  → Backend validates unified code at store level
  → Backend validates coupon (ownership, expiration, redemption status)
  → Create CouponRedemption record
```

---

## Database Migration

**Migration File**: `00XX_add_unified_redeem_code_to_store.py`

**Changes**:
1. Add `unified_redeem_code` field to `Store` model
2. Field is nullable (no data migration needed)
3. No default value (starts as None)

**Rollback**: Remove field in reverse migration

---

## Validation Rules Summary

### Unified Redemption Code
- **Format**: 6-digit numeric string
- **Generation**: On-demand (each merchant button click)
- **Uniqueness**: Not required (codes can repeat across stores, validated per store)
- **Expiration**: None (regenerated on each click)

### Unified Redemption Flow
1. **Code Validation**: Code must match `Store.unified_redeem_code` for the store
2. **Coupon Selection**: Consumer must select from their available coupons for that store
3. **Coupon Validation**: Standard validation (ownership, expiration, redemption status)
4. **Redemption**: Create `CouponRedemption` record if all validations pass

---

## Edge Cases Handled

1. **No unified code set**: Store.unified_redeem_code is None
   - Solution: Generate code on first button click
   
2. **Invalid code scanned**: Code doesn't match any store's current code
   - Solution: Return 404/400 error, show error message to consumer
   
3. **Code regenerated during redemption**: Merchant regenerates code while consumer is redeeming
   - Solution: Code validation happens atomically, old code fails validation
   
4. **Consumer has no coupons**: No available coupons for the merchant
   - Solution: Return empty list, show "no coupons available" message
   
5. **Store doesn't exist**: Code matches but store is deleted/inactive
   - Solution: Return 404 error, handle gracefully

---

## Data Integrity

- **Referential Integrity**: `Store.unified_redeem_code` is a simple field, no foreign keys
- **Consistency**: Code is validated against store before use
- **Atomicity**: Code generation and redemption validation use database transactions
- **Isolation**: Concurrent redemptions see consistent code state (database-level locking)
