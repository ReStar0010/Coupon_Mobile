# Research: Coupon Date-Range and Cost Analytics

**Feature**: 009-coupon-date-cost-analytics  
**Date**: 2026-02-16

## 1. Store timezone for "today" (今日成本)

**Decision**: Use an optional `Store` timezone field (IANA string, e.g. `Asia/Taipei`); if not set, fall back to Django `settings.TIME_ZONE` or default `Asia/Taipei`. "Today" is the calendar day in that timezone.

**Rationale**: Spec requires "today" to be the calendar day in the store's configured timezone. Store model currently has no timezone; Django stores datetimes in UTC and uses `timezone.localtime()` with the active timezone. Adding an optional field keeps backward compatibility and allows per-store bookkeeping alignment.

**Alternatives considered**:
- Device timezone: Rejected; spec chose store timezone for consistency and 總帳.
- Server-only (no Store field): Using only Django TIME_ZONE is simpler but does not satisfy "store's configured timezone" when multiple regions exist; optional Store field is low cost and future-proof.

---

## 2. Currency/unit for cost display

**Decision**: Add an optional `Store.currency_code` (e.g. `TWD`, `NT$` or display label); if not set, display cost as number only (no unit). System may default to `TWD` in backend for display when store has no currency set, and document that behavior.

**Rationale**: Spec says show currency when "store (or system) has a configured currency." Existing codebase uses TWD (e.g. `average_order_value` "in TWD"). Optional store-level currency allows future multi-currency; when absent, show number only per spec.

**Alternatives considered**:
- Always show TWD: Rejected; spec says "when configured" and "otherwise show number only."
- No store field, system default only: Acceptable; implementation can use a single system default (e.g. TWD) for "configured" when Store.currency_code is null, and still show the number with optional label from settings.

---

## 3. Date range API shape (template analytics)

**Decision**: Add query parameters `date_from` and `date_to` (ISO 8601 date, e.g. `YYYY-MM-DD`) to the template analytics endpoint. Deprecate or keep `days` as optional fallback for backward compatibility; if both provided, `date_from`/`date_to` take precedence. Validate: end ≥ start, range ≤ 730 days, end date ≤ "today" (store timezone).

**Rationale**: Arbitrary calendar range is required. REST convention for date range is two query params; ISO date keeps timezone handling on the server (today and range limits evaluated in store timezone).

**Alternatives considered**:
- Single `range` enum: Rejected; spec requires arbitrary start/end.
- Request body: Rejected for GET; query params are standard for filter ranges.

---

## 4. Today's cost endpoint

**Decision**: Extend the existing merchant statistics endpoint (`get_merchant_statistics`) to include `today_cost` (decimal) and optional `today_cost_currency` (or rely on store currency in profile). Alternatively add a dedicated lightweight endpoint for 今日成本 if profile payload must stay minimal; preference is extend existing statistics response so one call serves the profile page.

**Rationale**: Merchant profile/settings page already calls `get_merchant_statistics`; adding `today_cost` (and optionally currency) avoids an extra request and keeps 今日成本 with other merchant stats.

**Alternatives considered**:
- New endpoint `/api/merchant/today-cost/`: Possible but adds round-trip; extending statistics is simpler unless statistics response is already too large.

---

## 5. Date range filtering and trend days

**Decision**: For template analytics, compute all metrics (exposure, redemptions, conversion, date-range cost) by filtering on `redeemed_at` / `timestamp` within `[date_from 00:00:00, date_to 23:59:59.999999]` in the store's timezone (or server timezone if store timezone not set). Trend `daily_data` includes one entry per calendar day in the range (in the same timezone). Use `timezone.make_aware(datetime.combine(date, time))` with the chosen timezone for boundary consistency.

**Rationale**: Aligns with existing analytics logic (time_threshold); daily breakdown must use the same "day" definition as the store for bookkeeping consistency.

**Alternatives considered**:
- UTC-only boundaries: Rejected; "today" and range must be in store timezone per spec.
