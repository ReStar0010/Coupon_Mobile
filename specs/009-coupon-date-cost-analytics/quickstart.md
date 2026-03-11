# Quick Start: Coupon Date-Range and Cost Analytics

**Feature**: 009-coupon-date-cost-analytics  
**Date**: 2026-02-16

## Overview

Implement arbitrary date-range selection for template analytics, date-range cost (此區間成本) for exclusive templates, and today's cost (今日成本) on the merchant profile. Backend adds `date_from`/`date_to` and validation; extends responses with cost fields. Frontend adds date picker and cost display.

## Implementation Checklist

### Backend

1. **Store model (optional)**  
   - Add `Store.timezone` (CharField, optional, IANA e.g. `Asia/Taipei`) and `Store.currency_code` (CharField, optional).  
   - Migration; default/timezone fallback in code when null (e.g. `settings.TIME_ZONE` or `Asia/Taipei`).

2. **Template analytics** (`Backend/api/views/merchant_coupon.py` — `get_template_analytics`)  
   - Accept query params `date_from` and `date_to` (ISO YYYY-MM-DD).  
   - If both present: resolve store timezone; validate `date_to` ≤ today (store TZ), `date_to` ≥ `date_from`, range ≤ 730 days; return 400 with clear message on failure.  
   - Compute time bounds in store (or default) timezone for filtering `Log.timestamp` and `CouponRedemption.redeemed_at`.  
   - Replace or supplement `days`-based window when date range is provided.  
   - For exclusive templates only: compute `date_range_cost` = sum of `Coalesce(savings_amount, 0)` for redemptions in range; add `date_range_cost_currency` when store/system has currency.  
   - Include `date_range_cost` (and optional `date_range_cost_currency`) in response for exclusive templates; omit for store templates.  
   - Keep existing response fields; all metrics and trend daily_data scoped to the selected range.

3. **Merchant statistics** (`Backend/api/views/merchant_profile.py` — `get_merchant_statistics`)  
   - Compute "today" in store timezone (or default).  
   - Sum `Coalesce(CouponRedemption.savings_amount, 0)` for `coupon__store=store` and `redeemed_at` on that calendar day (single aggregate query).  
   - Add `today_cost` (decimal) and optional `today_cost_currency` to response.

4. **Contract tests**  
   - **Template analytics** (`Backend/tests/contract/test_template_analytics.py`):  
     - Request with `date_from` and `date_to`; assert 200 and all metrics + `date_range_cost` (exclusive).  
     - Request with `date_to` > today (store TZ) or range > 730 days; assert 400.  
     - Store template: assert no `date_range_cost` in response.  
   - **Merchant statistics** (`Backend/tests/contract/` or existing test file):  
     - Assert response includes `today_cost` (number ≥ 0) and optionally `today_cost_currency`.

### Frontend (Mobile-Merchant-Frontend)

1. **Template analytics screen** (`app/(coupons)/template-analytics/[id].tsx`)  
   - Add date range picker (start date, end date).  
   - Validate: start ≤ end, end ≤ today (use store TZ or device for "today" if not provided by API), range ≤ 730 days.  
   - Call `getTemplateAnalytics(templateId, { date_from, date_to })` when both selected.  
   - Show validation error (future end, range too long, start > end) from API or client.  
   - Optionally keep 近3/7/30/90 as shortcuts that set date_from/date_to.

2. **Template analytics — 此區間成本**  
   - For exclusive templates, display `date_range_cost` with label "此區間成本" (or "date-range cost").  
   - When `date_range_cost_currency` is present, show unit (e.g. "NT$" or "元").  
   - Do not show this block for store templates.

3. **Template analytics count view** (`app/template-analytics-count/[id].tsx`)  
   - Use same date range as percentage view; pass `date_from`/`date_to` to API.  
   - Show 此區間成本 for exclusive templates (same as above).

4. **Merchant profile** (`app/(profile)/index.tsx`)  
   - Add a MetricCard or row for "今日成本" using `statistics.today_cost`.  
   - When `today_cost_currency` is present, show unit.  
   - Format number (e.g. toLocaleString) and show 0 when zero.

5. **API client** (`utils/api.ts`)  
   - Extend `getTemplateAnalytics(id, options?)` to accept `{ date_from?, date_to?, days? }`.  
   - Add TypeScript types for response: `date_range_cost?`, `date_range_cost_currency?`.  
   - Extend merchant statistics response type: `today_cost`, `today_cost_currency?`.

## Key validation rules (backend)

| Rule | HTTP | Message (example) |
|------|------|-------------------|
| date_to > today (store TZ) | 400 | End date must be on or before today (store timezone). |
| date_to < date_from | 400 | End date must be on or after start date. |
| (date_to - date_from) > 730 days | 400 | Date range cannot exceed 730 days (2 years). |

## Contract tests (constitution)

- Add or extend contract tests under `Backend/tests/contract/` for:
  - Template analytics with `date_from`/`date_to` and `date_range_cost` (exclusive only).
  - Template analytics 400 for invalid range.
  - Merchant statistics response including `today_cost`.

Run full backend suite: `python manage.py test api tests` from `Backend/` with venv active.
