# Data Model: Platform Cash Voucher (011)

**Feature**: 011-platform-cash-voucher  
**Date**: 2026-03-09

## Overview

New entities: **PlatformVoucher**, **PlatformVoucherRedemption**, **PlatformVoucherShareRequest**. Existing **Store** gains an optional boolean to mark participation in platform voucher redemption. No changes to Coupon, CouponRedemption, or CouponShareRequest.

---

## Store (extension)

- **New field**: `accepts_platform_vouchers` — Boolean, default False. When True, the store is a valid redemption target for platform vouchers when the consumer submits this store’s 6-digit `unified_redeem_code`.
- **Validation**: Redemption logic must require `Store.accepts_platform_vouchers == True` in addition to matching the code.

---

## PlatformVoucher

| Attribute | Type | Constraints | Notes |
|-----------|------|-------------|--------|
| id | PK | — | Auto. |
| face_value | Decimal | max_digits=10, decimal_places=2, positive | Amount in currency. |
| currency_code | CharField | max_length=10, default='TWD' | e.g. TWD. |
| start_date | DateTimeField | — | Validity start. |
| expiry_date | DateTimeField | — | Validity end; redemption not allowed after. |
| current_holder | FK(User) | null=True, SET_NULL | Who holds the voucher now; null when in public pool. |
| original_owner | FK(User) | null=True, SET_NULL | First holder (e.g. platform issue). |
| last_holder | FK(User) | null=True, SET_NULL | Previous holder after transfer. |
| redeem_code | CharField | max_length=6, unique | Unique 6-char code identifying this voucher (not the store code). Format: recommend digits-only (same as store code) or alphanumeric; generator in utils must ensure uniqueness. |
| batch_name | CharField | max_length=255, blank=True | Optional batch label for admin. |
| acquisition_method | CharField | choices / max_length | e.g. platform_issue, transfer, public_pool. |
| created_at | DateTimeField | auto_now_add=True | Optional but recommended. |

**Rules**:
- One redemption per voucher (enforced by PlatformVoucherRedemption uniqueness).
- Redemption only when: current_holder == requester, now between start_date and expiry_date, no existing PlatformVoucherRedemption, and redemption store has `accepts_platform_vouchers=True`.
- `amount_used` in redemption = `face_value` (full face value only).

---

## PlatformVoucherRedemption

| Attribute | Type | Constraints | Notes |
|-----------|------|-------------|--------|
| id | PK | — | Auto. |
| voucher | FK(PlatformVoucher) | CASCADE, unique | One redemption per voucher. |
| user | FK(User) | CASCADE | Redeeming user (must be voucher.current_holder at time of redeem). |
| store | FK(Store) | CASCADE | Store where redeemed; must have accepts_platform_vouchers=True. |
| redeemed_at | DateTimeField | auto_now_add or set on create | Time of redemption. |
| amount_used | Decimal | max_digits=10, decimal_places=2 | Must equal voucher.face_value. |

**Constraints**:
- **UniqueConstraint** on `voucher` (one redemption per voucher).
- Application logic: only create when voucher is valid (holder, dates, no existing redemption) and store participates.

---

## PlatformVoucherShareRequest

| Attribute | Type | Constraints | Notes |
|-----------|------|-------------|--------|
| id | PK | — | Auto. |
| voucher | FK(PlatformVoucher) | CASCADE | Voucher being shared. |
| from_user | FK(User) | CASCADE | Creator of the share. |
| to_user | FK(User) | null=True, SET_NULL | Optional; spec says anyone with link can accept (no designated recipient). |
| token | CharField | max_length=64, unique | Share link token; no expiry. |
| status | CharField | choices: pending, accepted, declined | pending until accept/decline. |
| is_public | BooleanField | default=False | True = public pool share. |
| created_at | DateTimeField | default=timezone.now | When share was created. |
| responded_at | DateTimeField | null=True | When status changed from pending. |

**Rules**:
- Accept: transaction + select_for_update(token); only when status=='pending'; set voucher.current_holder = acceptor, last_holder = from_user, acquisition_method = 'transfer' or 'public_pool'; set share request status = 'accepted', to_user = acceptor, responded_at = now.
- Public pool: create with is_public=True; set voucher.current_holder = None when creating share.
- Creator cannot cancel; token valid until accepted or declined.
- **UniqueConstraint**: at most one pending public share per voucher (same pattern as CouponShareRequest: unique on voucher where is_public=True and status='pending').

---

## State transitions

**PlatformVoucher**:
- Issued (current_holder set or null if immediately to public pool).
- Held (current_holder set).
- In public pool (current_holder null, pending public share).
- Redeemed (has exactly one PlatformVoucherRedemption; no longer usable).

**PlatformVoucherShareRequest**:
- pending → accepted (one acceptor wins; race-safe).
- pending → declined (if product supports recipient decline).

---

## Indexes / queries

- PlatformVoucher: filter by current_holder, expiry_date, and absence of redemption for list/detail and validate response.
- PlatformVoucherRedemption: lookup by voucher (exists check).
- PlatformVoucherShareRequest: lookup by token (get share info, accept); filter by from_user + is_public for “my public shares”.
- Store: filter by unified_redeem_code and accepts_platform_vouchers for redemption validation.
