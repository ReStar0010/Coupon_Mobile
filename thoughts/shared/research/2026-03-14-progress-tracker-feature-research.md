---
date: 2026-03-14T00:00:00+08:00
researcher: Claude
git_commit: c89c99a
branch: dev
repository: Coupon_Mobile
topic: "Progress Tracker Feature — Three Metrics to Replace Statistics Progress Ring"
tags: [research, codebase, statistics, progress-tracking, redemptions, sharing, vouchers, rewards]
status: complete
last_updated: 2026-03-14
last_updated_by: Claude
last_updated_note: "Added follow-up research: clarified design decisions and voucher sharing UI gap"
---

# Research: Progress Tracker Feature — Codebase State

**Date**: 2026-03-14
**Git Commit**: c89c99a
**Branch**: dev
**Repository**: Coupon_Mobile

## Research Question

We are building a new feature with three progress trackers to replace the current Mobile-Frontend statistics page's progress ring. This research documents the existing codebase state for all relevant models, views, components, and data flows that the feature will interact with.

The three metrics:
1. **Total exclusive coupon + money voucher redemptions** for the user
2. **Sharing light system** — progress toward earning money vouchers through sharing/redeeming shared coupons (N=3 lights)
3. **New user referral light system** — progress toward earning vouchers by bringing in new users (N=2 lights)

## Summary

The codebase has all the foundational models needed:
- `CouponRedemption` tracks exclusive coupon redemptions per user with a unique constraint
- `PlatformVoucherRedemption` tracks voucher redemptions (one per voucher)
- `CouponShareRequest` and `PlatformVoucherShareRequest` track sharing chains with `from_user`, `to_user`, `is_public`, and `status`
- The `Coupon` model tracks `original_owner`, `current_holder`, `last_holder`, and `acquisition_method`
- The current Statistics page uses a savings-goal progress ring that is unrelated to the proposed metrics

**What does NOT exist yet:**
- No "light system" / progress tracker model
- No reward-granting logic tied to sharing or referrals
- No API endpoint to compute sharing progress or referral progress
- No concept of "first exclusive coupon redemption by a new user" tracking

## Detailed Findings

### 1. Current Statistics Page (Mobile-Frontend)

**Files:**
- `Mobile-Frontend/app/(tabs)/statistics/index.tsx` (362 lines) — Main page
- `Mobile-Frontend/app/(tabs)/statistics/_layout.tsx` (11 lines) — Stack layout
- `Mobile-Frontend/app/(tabs)/statistics/components/CircularProgress.tsx` (75 lines) — SVG progress ring
- `Mobile-Frontend/app/(tabs)/statistics/components/StatisticsChart.tsx` (124 lines) — Wraps CircularProgress
- `Mobile-Frontend/app/(tabs)/statistics/components/StatCard.tsx` (61 lines) — Metric cards
- `Mobile-Frontend/app/(tabs)/statistics/components/GoalCard.tsx` (121 lines) — Linear progress bar
- `Mobile-Frontend/app/(tabs)/statistics/components/GoalModal.tsx` (202 lines) — Goal setting modal
- `Mobile-Frontend/app/(tabs)/statistics/components/StatisticsToast.tsx` (99 lines) — Toast notifications

**Current Metrics Displayed:**
- Circular progress ring showing savings goal progress (monthly savings vs target)
- "酷胖使用張數" — coupons used count (all types, not just exclusive)
- "節省總金額 (元)" — total savings amount
- Transaction history (recent 2 items)

**CircularProgress Component Props:**
- `progress`: number (0-100)
- `size`: number (default 200)
- `strokeWidth`: number (default 12)
- `progressColor`: string (default '#FFAD31')
- `backgroundColor`: string (default '#E5E5E5')
- `centerContent`: React.ReactNode

**API Endpoints Used:**
- `GET /api/user-statistics/` — returns coupons_used_count, total_savings, monthly_savings, goal fields
- `GET /api/completed-goals/` — archived completed goals
- `GET /api/coupon-history/` — redemption history
- `POST /api/set-savings-goal/`, `/reset-savings-goal/`, `/add-completed-goal/`

**Data Hook:** `useStatisticsData` manages all state, fetching, and goal CRUD operations.

### 2. Current Statistics Page (Web-Frontend, for reference)

**Files:**
- `Web-Frontend/src/app/Statistics/page.tsx` (125 lines)
- `Web-Frontend/src/app/Statistics/components/StatisticsContent.tsx` (101 lines)
- `Web-Frontend/src/app/Statistics/components/LargeWidget.tsx` (356 lines) — SVG progress ring (220px, 12px stroke, #1db954 green)
- `Web-Frontend/src/app/Statistics/components/SmallWidget.tsx` (34 lines)
- `Web-Frontend/src/app/Statistics/components/SavingsGoalModal.tsx` (170 lines)
- `Web-Frontend/src/app/Statistics/components/CouponHistoryList.tsx` (110 lines)
- `Web-Frontend/src/app/Statistics/hooks/useStatisticsData.ts` (214 lines)

Same API endpoints and data structure as Mobile-Frontend. Uses same savings-goal progress ring concept.

### 3. Backend Models — Redemptions

**CouponRedemption** (`Backend/api/models.py:432-460`):
- `coupon` → FK to Coupon (CASCADE)
- `user` → FK to User (CASCADE), related_name='coupon_redemptions'
- `redeemed_at` → DateTimeField
- `savings_amount` → DecimalField, nullable
- `lat`, `lng` → FloatField, nullable
- `coupon_type` → CharField (denormalized from Coupon)
- **Constraint:** UniqueConstraint on (coupon, user) when coupon_type='exclusive'

**PlatformVoucherRedemption** (`Backend/api/models.py:555-571`):
- `voucher` → OneToOneField to PlatformVoucher (one redemption per voucher)
- `user` → FK to User, related_name='platform_voucher_redemptions'
- `store` → FK to Store
- `redeemed_at` → DateTimeField
- `amount_used` → DecimalField

### 4. Backend Models — Coupons & Vouchers

**Coupon** (`Backend/api/models.py:344-430`):
- `coupon_type` → 'store' or 'exclusive'
- `original_owner` → FK to User (first owner)
- `last_holder` → FK to User (previous holder)
- `current_holder` → FK to User (current owner, None if in public pool)
- `acquisition_method` → 'draw', 'consolidate', 'transfer', 'public_pool', 'qr_claim'
- Methods: `is_redeemed()`, `get_redemption_count()`, `get_unique_users_count()`

**PlatformVoucher** (`Backend/api/models.py:526-552`):
- `face_value` → DecimalField
- `current_holder`, `original_owner`, `last_holder` → FK to User
- `acquisition_method` → 'platform_issue', 'transfer', 'public_pool'

### 5. Backend Models — Sharing

**CouponShareRequest** (`Backend/api/models.py:477-512`):
- `coupon` → FK to Coupon
- `from_user` → FK to User (sharer)
- `to_user` → FK to User, nullable (recipient, null for public pool)
- `token` → CharField(64), unique
- `status` → 'pending', 'accepted', 'declined', 'cancelled'
- `is_public` → BooleanField
- `created_at`, `responded_at` → DateTimeField

**PlatformVoucherShareRequest** (`Backend/api/models.py:574-608`):
- Same structure as CouponShareRequest but for vouchers

### 6. Sharing Flow — Chain of Custody

**Private share:**
1. User A calls `POST /api/coupon/<id>/share/` → CouponShareRequest created (from_user=A, status=pending)
2. User B calls `POST /api/coupon/share/<token>/accept/` → coupon.current_holder=B, last_holder=A, acquisition_method='transfer'

**Public pool share:**
1. User A calls `POST /api/coupon/<id>/share-public/` → coupon.current_holder=None immediately
2. Any User B calls accept → coupon.current_holder=B, last_holder=A, acquisition_method='public_pool'

### 7. How to Query Each Proposed Metric

**Metric 1 — Total exclusive coupon + voucher redemptions for a user:**
```python
# Exclusive coupon redemptions
CouponRedemption.objects.filter(user=user, coupon_type='exclusive').count()

# Platform voucher redemptions
PlatformVoucherRedemption.objects.filter(user=user).count()

# Total = sum of both
```

**Metric 2 — Sharing light system (O counter):**

The light turns off (O += 1) when:
- (a) User is the FIRST person to get an exclusive coupon/voucher, shares it, and the final recipient redeems it
- (b) User redeems an exclusive coupon/voucher that came from someone else's sharing

For (a), query pattern:
```python
# Coupons where user is original_owner AND coupon was shared AND redeemed by someone else
# Find CouponShareRequests where from_user=user (or chain originates from user)
# AND the coupon has a CouponRedemption by a different user
coupons_originated = Coupon.objects.filter(
    original_owner=user, coupon_type='exclusive'
)
# For each, check if there's an accepted share AND a redemption by the final holder
```

For (b), query pattern:
```python
# Coupons where user redeemed BUT user is NOT the original_owner
CouponRedemption.objects.filter(
    user=user, coupon_type='exclusive'
).exclude(coupon__original_owner=user)
# Plus same for PlatformVoucherRedemption
```

**Metric 3 — New user referral (O counter):**
```python
# For each user B, find their FIRST exclusive coupon or voucher redemption
# If that coupon/voucher's source (via share chain) is user A, then A gets +1

# First exclusive redemption per user:
first_redemption = CouponRedemption.objects.filter(
    user=user_b, coupon_type='exclusive'
).order_by('redeemed_at').first()

# Check if source is user A:
# coupon.original_owner == user_a OR
# CouponShareRequest(coupon=coupon, from_user=user_a, status='accepted')
```

### 8. Existing Reward/Voucher Generation

**CouponTemplate.generate_coupon()** (`Backend/api/models.py:261-291`):
- Generates exclusive coupons from templates
- Decrements remaining_quantity
- No automated reward-granting based on user actions

**PlatformVoucher creation:**
- No automated generation method exists
- Created externally (admin/batch)
- No logic to auto-issue vouchers as rewards

**Key gap:** There is no existing mechanism to automatically grant PlatformVouchers as rewards. This will need to be built for the light system rewards ($5 and $10 vouchers).

## Code References

- `Backend/api/models.py:344-430` — Coupon model with ownership chain
- `Backend/api/models.py:432-460` — CouponRedemption model
- `Backend/api/models.py:477-512` — CouponShareRequest model
- `Backend/api/models.py:526-552` — PlatformVoucher model
- `Backend/api/models.py:555-571` — PlatformVoucherRedemption model
- `Backend/api/models.py:574-608` — PlatformVoucherShareRequest model
- `Backend/api/views/sharing_views.py:304-381` — accept_share_request (ownership transfer)
- `Backend/api/views/user_profile.py:18-59` — user_statistics endpoint
- `Mobile-Frontend/app/(tabs)/statistics/index.tsx` — Statistics page
- `Mobile-Frontend/app/(tabs)/statistics/components/CircularProgress.tsx` — Current progress ring

## Architecture Documentation

### Ownership Tracking Pattern
All exclusive coupons and platform vouchers use a three-field ownership chain: `original_owner`, `last_holder`, `current_holder`. Combined with `acquisition_method`, this provides full provenance tracking.

### Share Request Pattern
Both coupon and voucher sharing use the same pattern: a ShareRequest model with `from_user`, `to_user`, `token`, `status`, `is_public`. Race conditions are handled with `select_for_update()` + `transaction.atomic()`.

### Statistics Architecture
Current statistics are savings-goal focused (monthly savings progress toward a user-defined target). The proposed metrics represent a fundamentally different concept (activity-based progress with automated rewards).

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-03-12-store-coupon-redeemed-still-on-easy-use.md` — Documents CouponRedemption model behavior and the easy-use page flow
- `thoughts/shared/research/2026-03-12-collection-accepted-coupon-not-showing.md` — Documents sharing flow and collection page filtering logic

## Clarified Design Decisions

1. **Voucher reward mechanism:** Use `acquisition_method='platform_issue'` — vouchers are created via `PlatformVoucher.objects.create()` with the existing `platform_issue` method, same as admin batch-issue but triggered programmatically. Consider adding a new `'reward'` value to distinguish system-granted rewards from admin-issued ones.
2. **"First person" definition:** `original_owner` is sufficient to identify the first person who got an exclusive coupon. No need to trace the full share chain.
3. **Voucher sharing for light systems:**
   - **Light system 1 (N=3, sharing progress):** Only exclusive coupons count. Voucher sharing does NOT count.
   - **Light system 2 (N=2, new user referrals):** Both exclusive coupon AND voucher first-ever redemptions count.
   - **Metric 1 (total redemptions):** Both exclusive coupon and voucher redemptions count.
4. **"New user" definition:** A user making their first-ever exclusive coupon OR platform voucher redemption. Not based on account creation date.
5. **Storage approach:** Denormalized with event-driven updates. Store `sharing_progress_count` and `referral_progress_count` on StudentProfile. Update at event time (redemption, share acceptance). Add a management command to recompute as safety net. This matches the existing pattern where StudentProfile stores `coupons_used_count`, `total_savings`, `monthly_savings`.
6. **Web-Frontend:** No — only Mobile-Frontend gets the three progress trackers.

## Follow-up Research: Voucher Creation & Sharing UI Gap

### PlatformVoucher Creation Path

PlatformVouchers are created via Django admin batch-issue (`Backend/api/admin.py:582-626`):
- Admin form at `/admin/api/platformvoucher/batch-issue/`
- Creates up to 1000 vouchers with `acquisition_method='platform_issue'`
- Fields: batch_name, face_value, quantity, expiry_date, original_owner (optional)
- Uses `generate_platform_voucher_redeem_code()` from `Backend/api/utils.py:67-93`

For the reward system, the same `PlatformVoucher.objects.create()` call can be used programmatically with a new `acquisition_method='reward'` to distinguish from admin-issued vouchers.

### Platform Voucher Sharing: Backend Complete, Frontend Missing

**Backend — Fully implemented** (`Backend/api/views/platform_voucher_views.py`):
- `POST /api/platform-voucher/<id>/share/` — private share (lines 111-137)
- `POST /api/platform-voucher/<id>/share-public/` — public pool (lines 186-214)
- `GET /api/platform-voucher/share/<token>/` — get share info (lines 140-152)
- `POST /api/platform-voucher/share/<token>/accept/` — accept share (lines 155-183)
- `GET /api/my-public-voucher-shares/` — list public shares (lines 217-236)
- All endpoints wired in `Backend/Backend/urls.py:129-137`

**Mobile Frontend — No share UI:**
- `Mobile-Frontend/app/(tabs)/collection/voucher/[id].tsx` — detail page only has "到店核銷" (redeem) button, no share option
- `Mobile-Frontend/app/utils/authAPI.ts:771-789` — only has `list()`, `detail()`, `redeem()` — no share API functions
- No ShareModal or share flow for platform vouchers
- The existing `ShareModal` component is coupon-only

**Web Frontend — No platform voucher support at all.**

## Final Decisions

1. **New `acquisition_method='reward'`:** Yes — add `'reward'` to PlatformVoucher's `ACQUISITION_METHOD_PLATFORM` choices to distinguish system-granted rewards from admin batch-issues.
2. **Voucher share UI:** Build as part of this feature — add share button/modal to platform voucher detail page and add share API functions to `authAPI.ts`.
