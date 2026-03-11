# Data Model: Coupon Date-Range and Cost Analytics

**Feature**: 009-coupon-date-cost-analytics  
**Date**: 2026-02-16

## Overview

This feature adds date-range selection (arbitrary start/end) for template analytics, date-range cost (此區間成本) for exclusive templates, and today's cost (今日成本) on the merchant profile. It extends existing APIs and may add optional Store fields for timezone and currency. No new core entities; cost is derived from existing `CouponRedemption.savings_amount`.

## Entities

### Date range (template analytics)

**Description**: The merchant-selected calendar range for template analytics. All metrics and date-range cost are scoped to this range.

**Fields**:
- `date_from` (date, ISO 8601 YYYY-MM-DD): Start date (inclusive).
- `date_to` (date, ISO 8601 YYYY-MM-DD): End date (inclusive).

**Validation rules**:
- `date_to` ≥ `date_from`.
- `date_to` ≤ "today" in the store's timezone (future end date disallowed).
- Range length ≤ 730 days (2 years); otherwise return 400 with clear message.

**Relationships**: Applied as filter to `Log.timestamp`, `CouponRedemption.redeemed_at` for the template (and store for "today").

---

### Date-range cost (此區間成本)

**Description**: For exclusive (Collection) templates only. Sum of discount given in the selected date range = sum of `CouponRedemption.savings_amount` for redemptions of that template in the range. Null/zero savings_amount treated as 0.

**Fields** (in API response):
- `date_range_cost` (decimal/string): Total cost in the selected range. Optional `date_range_cost_currency` when store/system has configured currency.

**Relationships**: Computed from `CouponRedemption` where `coupon__template=template`, `coupon__coupon_type='exclusive'`, `redeemed_at` in [date_from, date_to], sum of `savings_amount` (Coalesce 0).

**Validation**: Not shown for non-exclusive (store/EasyUse) templates.

---

### Today's cost (今日成本)

**Description**: Total discount given "today" across all coupons of the merchant. "Today" = calendar day in the store's configured timezone (or fallback to system/default, e.g. Asia/Taipei).

**Fields** (in API response):
- `today_cost` (decimal/string): Sum of `savings_amount` for all redemptions where `coupon__store=store` and `redeemed_at` falls on "today" in store timezone.
- `today_cost_currency` (string, optional): Display unit when store/system has configured currency.

**Relationships**: Computed from `CouponRedemption` filtered by store and by "today" in store timezone.

---

### Store (optional new fields)

**Description**: Optional fields to support store timezone and currency for this feature.

**Fields** (additions; existing Store unchanged otherwise):
- `timezone` (string, optional): IANA timezone name (e.g. `Asia/Taipei`). If null, use Django `TIME_ZONE` or default `Asia/Taipei` for "today" and range boundaries.
- `currency_code` (string, optional): Currency for cost display (e.g. `TWD`, `NT$`). If null, cost is shown as number only (or system default label per product decision).

**Validation**: If present, timezone must be valid for `zoneinfo`/`pytz`; currency_code is display-only.

---

## API request/response shapes

### Template analytics request

- **Path**: `GET /api/merchant/coupon-templates/{id}/analytics/`
- **Query**:
  - `date_from` (optional): ISO date YYYY-MM-DD. If provided with `date_to`, defines range.
  - `date_to` (optional): ISO date YYYY-MM-DD. If provided with `date_from`, defines range.
  - `days` (optional, backward compatibility): 3 | 7 | 30 | 90. Used when `date_from`/`date_to` not both provided.
- **Validation**: If both `date_from` and `date_to` provided: enforce range ≤ 730 days and `date_to` ≤ today (store TZ); else 400 with message.

### Template analytics response (additions)

- `date_range_cost` (number, optional): Present for exclusive templates only. Sum of savings_amount in range. Omitted for store templates.
- `date_range_cost_currency` (string, optional): When store/system has configured currency.

(Existing fields unchanged: exposure_count, conversion_rate, count fields, trends, etc.; all scoped to the selected date range when date_from/date_to are used.)

### Merchant statistics response (additions)

- `today_cost` (number): Total discount given today (store timezone). Decimal as string or number.
- `today_cost_currency` (string, optional): When store/system has configured currency.

(Existing: active_coupons, total_redemptions, total_views, total_templates, total_coupons_generated.)

---

## Data flow

1. **Template analytics**: Client sends `date_from` and `date_to` (or `days`). Server resolves "today" and range boundaries in store timezone; filters logs and redemptions by range; for exclusive template computes `date_range_cost`; returns all metrics + `date_range_cost` (exclusive only).
2. **今日成本**: Merchant statistics endpoint computes "today" in store timezone; sums `savings_amount` for redemptions of that store on that day; returns `today_cost` (and optional currency).
3. **Frontend**: Template analytics UI shows date picker and 此區間成本 (with optional unit). Profile UI shows 今日成本 (with optional unit). Validation errors (future end, range > 730 days) shown from API or client-side.

---

## Timezone handling

- **Server**: Store "today" = start of calendar day in store timezone to end of that day (inclusive). Use `zoneinfo` or `pytz` with `Store.timezone` or fallback. Range boundaries: `date_from` 00:00:00 and `date_to` 23:59:59.999999 in that timezone, converted to UTC for DB comparison if datetimes are stored in UTC.
- **Consistency**: Same timezone used for template analytics "today" validation and for 今日成本 so bookkeeping is consistent.
