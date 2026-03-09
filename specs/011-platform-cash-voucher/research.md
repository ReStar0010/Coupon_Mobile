# Research: Platform Cash Voucher (011)

**Feature**: 011-platform-cash-voucher  
**Date**: 2026-03-09

## 1. Store participation for platform voucher redemption

**Decision**: Only stores explicitly marked as participating (e.g. store-level boolean `accepts_platform_vouchers`) may accept platform voucher redemptions. Redemption validation must check this flag after resolving the store by 6-digit code.

**Rationale**: Spec clarification chose Option B: explicit participation. Enables rollout and per-store control without changing behaviour for stores that do not opt in.

**Alternatives considered**: (A) Any store with a unified_redeem_code could accept — rejected per spec. (B) Explicit flag — chosen.

---

## 2. Alignment with existing coupon share flow

**Decision**: Reuse the same patterns as CouponShareRequest: token-based share link, `is_public` for public pool, `transaction` + `select_for_update()` on accept to avoid double assignment, status `pending`/`accepted`/`declined`. No share token expiry; creator cannot cancel a pending share.

**Rationale**: Spec and clarify session: token no expiry, creator cannot cancel, anyone with link can accept (private). Matches existing `sharing_views` (share_coupon, share_coupon_public, get_share_request, accept_share_request, get_my_public_shares) so implementation stays consistent and testable.

**Alternatives considered**: Different share lifecycle (expiring tokens, creator cancel) — rejected per clarifications.

---

## 3. Redemption amount and one-time use

**Decision**: One redemption per platform voucher; redemption is for the full face value only. `amount_used` on PlatformVoucherRedemption equals the voucher’s face value. No partial redemption or balance tracking.

**Rationale**: Spec clarification: full face value only (Option A). Simplifies validation and data model.

**Alternatives considered**: Partial use / multiple redemptions — rejected per spec.

---

## 4. Unified redemption response shape

**Decision**: Extend the existing `validate_unified_redemption_code` response with a new key `available_platform_vouchers`: list of objects for vouchers where `current_holder == request.user`, not expired, and no PlatformVoucherRedemption exists. When the submitted code maps to a store, include only vouchers that can be redeemed at that store (store must have `accepts_platform_vouchers=True`). Structure fields aligned with `available_coupons` (e.g. id, face_value, redeem_code, expiry_date, batch_name) so the client can render one combined list or two lists with the same shape.

**Rationale**: Spec FR-009 and SC-002; existing endpoint returns `store` and `available_coupons`; adding a parallel list keeps the contract backward-compatible and allows one screen to show both.

**Alternatives considered**: Separate endpoint for platform vouchers only — rejected; spec requires same screen to show both.

---

## 5. Consumer redeem vs merchant redeem

**Decision**: Consumer redemption: POST with voucher id and store 6-digit code (or equivalent), same UX as store coupons. Optional merchant redeem: POST with voucher id and consumer identifier (e.g. phone); resolve store via `get_merchant_store(request.user)`, verify consumer is current holder, create PlatformVoucherRedemption for that store. Both paths create exactly one PlatformVoucherRedemption per voucher; amount_used = face value.

**Rationale**: Spec FR-004 (consumer flow) and FR-011 (optional merchant redeem). Reuse `get_merchant_store` from merchant_coupon/merchant_profile for consistency.

**Alternatives considered**: Merchant-only redeem — rejected; spec requires consumer flow aligned with store coupons.
