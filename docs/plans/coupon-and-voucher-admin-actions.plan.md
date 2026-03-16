# Coupon and Platform Voucher Admin Actions Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Django admin so operators can manage both **coupons** and **platform vouchers** (CouPro money vouchers) with richer filters, safe bulk actions, assignment workflows, and share/public-pool controls.

**Scope:** Coupon admin, **platform voucher admin**, and **activity/game management** (progress-tracker rules: sharing light, referral light).

---

## Activity / game rules (from recent commits and code)

The app runs an activity with two progress-based rewards:

| Metric | Rule | Reward | Stored on |
|--------|------|--------|-----------|
| **Sharing light (Metric 2)** | Every **3** redemptions (user redeems any exclusive coupon, or someone else redeems a coupon they owned) | **$10** platform voucher per 3 | `StudentProfile.sharing_progress_count` (0..2), `sharing_rewards_earned` |
| **Referral light (Metric 3)** | When a new user’s **first** exclusive coupon or voucher redemption came from a coupon/voucher you gave them | 1st referral → **$5** voucher; 2nd+ → **$10** voucher | `StudentProfile.referral_progress_count` |

Reward vouchers are created via `grant_reward_voucher()` / `apply_referral_reward()` with `acquisition_method='reward'` and `batch_name='Sharing Reward'` or `'Referral Reward'`. Thresholds (3, 2) and amounts (10, 5, 10) are currently hardcoded in [`Backend/api/views/coupon_views.py`](Backend/api/views/coupon_views.py) and [`Backend/api/utils.py`](Backend/api/utils.py). Progress can be recomputed from redemption history with `python manage.py recompute_progress`.

---

## Current Baseline

- **Coupons:** [`Backend/api/admin.py`](Backend/api/admin.py) — `CouponAdmin` (filters: coupon_type, usage_per_day, acquisition_method, dates; action: `mark_as_expired`). `CouponTemplateAdmin` has `deactivate_templates` / `activate_templates`.
- **Platform vouchers:** Same file — `PlatformVoucherAdmin` already has custom changelist template, **batch-issue** and **participating-stores** custom views. List filters: `acquisition_method`, `currency_code`, `created_at`. No bulk actions; no derived-state filters (expired, redeemed, assigned, public-pool).
- **Game/activity:** `StudentProfileAdmin` shows `sharing_progress_count`, `sharing_rewards_earned`, `referral_progress_count` in readonly fieldsets only; no list_display, no filters, no way to see “who’s close to reward” or to manage/recompute progress from the panel.

---

## Part A: Coupon Admin (unchanged intent from original plan)

1. **Derived filters for Coupon:** expired / active, redeemed / not redeemed, has holder / unassigned, pending phone, public-pool state, store/merchant (e.g. `store__owner`). Use `SimpleListFilter` + annotations where needed.
2. **Coupon list display:** Add merchant/store owner, assignment state, share/public-pool summary, redeemed status.
3. **Coupon bulk actions:** Keep `mark_as_expired`; add safe actions (e.g. cancel pending public share, mark unassigned where valid). Guard: only exclusive coupons; skip redeemed.
4. **Coupon assignment:** Custom action → intermediate form → assign selected coupons to a **registered user** (set `current_holder`, clear `pending_phone_number`, etc.; skip ineligible rows).
5. **CouponShareRequest admin:** Richer filters/display; optional bulk cancel for pending public shares.
6. **Tests:** Admin filters, assignment eligibility, share state transitions for coupons.

---

## Part B: Platform Voucher Admin (new)

Panel should include operations for **platform vouchers** (money vouchers delivered by CouPro) in line with the coupon improvements.

### B1. PlatformVoucher list filters

**File:** [`Backend/api/admin.py`](Backend/api/admin.py) — `PlatformVoucherAdmin`

Add `SimpleListFilter` (or equivalent) for:

- **Expired vs active** — `expiry_date` &lt;= now vs &gt; now.
- **Redeemed vs not redeemed** — existence of `PlatformVoucherRedemption` for the voucher.
- **Has holder vs unassigned** — `current_holder` is null vs not (e.g. “在公共池”).
- **Batch** — filter by `batch_name` (exact or “has batch” vs “no batch”) if useful for operations.
- **Start/expiry date** — consider `date_hierarchy` on `expiry_date` in addition to `created_at` if not already present.

Keep existing: `acquisition_method`, `currency_code`, `created_at`.

### B2. PlatformVoucher list display

- Keep existing columns; ensure **is_redeemed_display** is efficient (e.g. avoid N+1 via annotation or `get_queryset` optimization).
- Optionally add: expiry status (expired / X days left), “in public pool” indicator (pending public `PlatformVoucherShareRequest`).

### B3. PlatformVoucher bulk actions

**File:** [`Backend/api/admin.py`](Backend/api/admin.py) — `PlatformVoucherAdmin`

Add actions such as:

- **Mark selected as expired** — set `expiry_date = timezone.now()` for selected vouchers that are not yet redeemed (skip redeemed; message count).
- **Assign selected to user** — redirect to intermediate form to pick a registered user; set `current_holder` (and optionally `original_owner`/`last_holder`) for eligible vouchers; clear any conflicting share state if business rules allow. Skip redeemed and optionally skip already-assigned.
- **Cancel pending public share** — for selected vouchers that have a pending public `PlatformVoucherShareRequest`, cancel that request and optionally set voucher back to `from_user` as holder. Message success/skip.

Eligibility rules: do not change redeemed vouchers; do not create states the app does not expect.

### B4. PlatformVoucherShareRequest admin

**File:** [`Backend/api/admin.py`](Backend/api/admin.py) — `PlatformVoucherShareRequestAdmin`

- **Filters:** Already has `status`, `is_public`, `created_at`. Add if useful: voucher batch, from_user.
- **Bulk action:** e.g. **Cancel selected (pending) share requests** — set status to `cancelled` (if model supports) or equivalent; ensure voucher holder is consistent.
- **Display:** Ensure voucher `redeem_code` and batch are visible for quick identification.

### B5. PlatformVoucherRedemption admin

- Keep list_filter/search_fields; optional: add filter by store or by date range for reporting.
- No destructive actions needed; read-only or minimal edits only.

### B6. Voucher admin tests

- Add or extend tests: voucher list filters (expired, redeemed, assigned), bulk “mark expired” and “assign to user” with eligibility (skip redeemed), cancel pending public share.

---

## Part C: Activity / game management panel

Design the panel so operators can manage the game (sharing light, referral light) more conveniently: view progress, find reward vouchers, fix drift.

### C1. StudentProfile admin — game progress in list and filters

**File:** [`Backend/api/admin.py`](Backend/api/admin.py) — `StudentProfileAdmin`

- **List display:** Add columns for `sharing_progress_count`, `sharing_rewards_earned`, `referral_progress_count` (and optionally “next reward” summary, e.g. “1/3 to $10”).
- **List filters:** Add `SimpleListFilter` (or choices) for:
  - Sharing progress band (e.g. 0, 1, 2 “lights” toward next $10).
  - Has earned sharing reward (`sharing_rewards_earned` &gt; 0).
  - Referral count (0, 1, 2+).
- **Search:** Keep existing; optionally allow search by progress if needed.
- **Bulk action:** “Recompute progress for selected users” — for selected `StudentProfile` users, run the same logic as `recompute_progress` (recompute from `CouponRedemption` / `PlatformVoucherRedemption` and update the three counters). Optionally link to a custom admin page that runs full `recompute_progress` for all users (or expose a button that calls the management command).

### C2. PlatformVoucher — reward vouchers visibility

**File:** [`Backend/api/admin.py`](Backend/api/admin.py) — `PlatformVoucherAdmin`

- **Filters:** Ensure `acquisition_method` includes `reward`; add a filter or preset for “Reward vouchers only” (e.g. `batch_name` in `['Sharing Reward', 'Referral Reward']` or `acquisition_method='reward'`).
- **List display:** Already shows `batch_name` and `acquisition_method`; keep so admins can see “Sharing Reward” / “Referral Reward” at a glance.
- Optional: add `date_hierarchy` on `created_at` (if not already) to review reward issuance over time.

### C3. Custom admin view: activity overview (optional)

**File:** [`Backend/api/admin.py`](Backend/api/admin.py) and a template (e.g. under `Backend/templates/admin/`)

- Add a custom admin view (e.g. under `StudentProfile` or a dedicated “Activity” app) that shows:
  - Count of users at each sharing progress (0, 1, 2) and count who have earned at least one sharing reward.
  - Count of users at referral 0, 1, 2+.
  - Total reward vouchers granted (count of `PlatformVoucher` with `acquisition_method='reward'`, optionally by batch_name and date range).
- Link from the changelist or index (e.g. “Activity overview”) so operators can quickly see game health.

### C4. Game admin tests

- Tests: StudentProfile list filters for progress fields; “recompute for selected” updates counts correctly; reward vouchers are filterable by acquisition_method/batch_name.

---

## Implementation order (combined)

1. **Coupon:** Derived filters + list_display improvements + safe bulk actions + assignment workflow + share-request controls + tests.
2. **Platform voucher:** Derived filters + list_display (redeemed/expiry/public-pool) + bulk actions (mark expired, assign to user, cancel pending public share) + share-request admin tweaks + reward-voucher filters + tests.
3. **Activity/game:** StudentProfile game columns + filters + “recompute for selected” (and optional activity overview view) + tests.

---

## Key files

| Area              | File |
|-------------------|------|
| All admin config  | [`Backend/api/admin.py`](Backend/api/admin.py) |
| Coupon/Voucher models | [`Backend/api/models.py`](Backend/api/models.py) |
| Voucher views (semantics) | [`Backend/api/views/platform_voucher_views.py`](Backend/api/views/platform_voucher_views.py) |
| Game rules / progress     | [`Backend/api/views/coupon_views.py`](Backend/api/views/coupon_views.py) (redemption), [`Backend/api/utils.py`](Backend/api/utils.py) (`grant_reward_voucher`, `apply_referral_reward`), [`Backend/api/management/commands/recompute_progress.py`](Backend/api/management/commands/recompute_progress.py) |
| Tests             | `Backend/api/tests/` (e.g. `test_admin_*.py` or new `test_coupon_admin.py` / `test_platform_voucher_admin.py`) |

---

## Todos (for execution)

- [ ] **coupon-derived-filters** — Add derived coupon admin filters (expired, redeemed, assigned, pending-phone, public-pool, merchant/store).
- [ ] **coupon-admin-actions** — Coupon + CouponShareRequest safe bulk actions and assignment workflow (registered user).
- [ ] **coupon-admin-tests** — Tests for coupon filters, assignment, share state.
- [ ] **voucher-filters-display** — PlatformVoucher admin: derived filters (expired, redeemed, has holder, batch) and list_display improvements.
- [ ] **voucher-bulk-actions** — PlatformVoucher bulk actions: mark as expired, assign to user, cancel pending public share.
- [ ] **voucher-share-admin** — PlatformVoucherShareRequest admin: filters/bulk cancel and display tweaks.
- [ ] **voucher-admin-tests** — Tests for voucher admin filters and bulk actions.
- [ ] **game-studentprofile-admin** — StudentProfile: add game progress to list_display, list_filter (sharing band, referral count, has earned reward), and bulk action “Recompute progress for selected”.
- [ ] **game-reward-vouchers** — PlatformVoucher: ensure reward vouchers are easy to find (filter by acquisition_method / batch_name “Sharing Reward” / “Referral Reward”).
- [ ] **game-activity-overview** — (Optional) Custom admin view “Activity overview” with progress bands and reward voucher counts.
- [ ] **game-admin-tests** — Tests for game progress filters and recompute action.
