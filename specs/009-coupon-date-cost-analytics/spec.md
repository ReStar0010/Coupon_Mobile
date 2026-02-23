# Feature Specification: Coupon Date-Range and Cost Analytics

**Feature Branch**: `009-coupon-date-cost-analytics`  
**Created**: 2026-02-16  
**Status**: Draft  
**Input**: User description: "Datepicker for coupon (template) analytics. When viewing a single coupon/template's statistics, the merchant can choose a date range (e.g. start and end date) and see all stats for that range (exposure, redemptions, conversion, etc.). Right now the API uses a fixed days (3/7/30/90), so this would mean either adding explicit date-from/date-to or mapping the datepicker to those windows. Date-range cost for Collection (exclusive) coupons. For 專屬優惠 / Collection (exclusive) templates, add a new statistic: total cost in the selected date range (sum of discount given = savings_amount over redemptions in that range). So in the template analytics screen for exclusive coupons, the merchant sees something like 此區間成本 or date-range cost next to redemption counts. 今日成本 on merchant settings page. On the merchant profile/settings page, show 今日成本 (today's cost): one number for how much discount we gave today across all coupons, so the merchant can quickly see it and record it at end of day into their 總帳. Overall goal: merchant can see cost for a chosen date range per coupon, and see today's total cost on the settings page for daily bookkeeping."

## Clarifications

### Session 2026-02-16

- Q: Should template analytics support an arbitrary calendar date range (start + end) or only preset windows (e.g. 3/7/30/90 days)? → A: Arbitrary calendar range — merchant picks start date and end date; stats and date-range cost are for that exact range.
- Q: Which timezone defines "today" for 今日成本? → A: Store timezone — "today" is the calendar day in the store's configured timezone (e.g. Asia/Taipei).
- Q: Maximum selectable date range for template analytics? → A: 730 days (2 years); show a clear message if the user picks a longer range.
- Q: When the user picks a range whose end date is in the future, what should happen? → A: Disallow — end date must be on or before "today" (store timezone); show validation error if the user picks a future end date.
- Q: Should date-range cost and 今日成本 display a currency or unit? → A: Show currency/unit when the store (or system) has a configured currency (e.g. "此區間成本 (NT$)" or "今日成本 1,234 元"); otherwise show number only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose Date Range for Template Analytics (Priority: P1)

A merchant viewing a single coupon template’s statistics wants to choose a custom date range (start and end date) and see all statistics for that range: exposure, redemptions, conversion, and any other existing metrics. The system today only offers fixed windows (e.g. last 3, 7, 30, or 90 days). The merchant should be able to select a range and see stats that match that range.

**Why this priority**: This is the foundation for date-scoped cost and comparisons; without a chosen range, per-coupon cost and daily bookkeeping do not align to the same time windows.

**Independent Test**: Can be tested by opening a template analytics screen, selecting a date range (e.g. start and end date), and verifying that all displayed statistics (exposure, redemptions, conversion, etc.) correspond to that range only.

**Acceptance Scenarios**:

1. **Given** a merchant is on the template analytics screen for a coupon template, **When** they select a start date and end date, **Then** all statistics (exposure, redemptions, conversion, and other existing metrics) are calculated and displayed for that date range only.
2. **Given** a merchant has selected a date range, **When** they change the range, **Then** the statistics update to reflect the new range.
3. **Given** the selected range has no activity, **When** the merchant views the screen, **Then** statistics show zero or empty values clearly without errors.
4. **Given** a merchant selects a range where start is after end (invalid), **When** they confirm, **Then** the system prevents the selection or shows a clear validation message.

---

### User Story 2 - Date-Range Cost for Exclusive (Collection) Templates (Priority: P2)

A merchant viewing analytics for a 專屬優惠 / Collection (exclusive) coupon template wants to see the total cost for the selected date range. “Cost” means the total discount given in that range: the sum of savings (e.g. savings_amount) over all redemptions in that range. This should appear on the template analytics screen for exclusive templates only, with a label such as “此區間成本” or “date-range cost,” next to or near redemption counts.

**Why this priority**: Enables per-coupon cost visibility for exclusive coupons, which is required for understanding cost by template and for 總帳.

**Independent Test**: Can be tested by opening template analytics for an exclusive template, selecting a date range, and verifying that a “date-range cost” (此區間成本) value is shown and equals the sum of discount given for redemptions in that range.

**Acceptance Scenarios**:

1. **Given** a merchant is viewing template analytics for an exclusive (Collection) template and has selected a date range, **When** they view the screen, **Then** a “此區間成本” (or equivalent “date-range cost”) statistic is displayed, and it equals the sum of discount given (savings_amount) for all redemptions in that range.
2. **Given** a merchant is viewing template analytics for a non-exclusive (e.g. store / EasyUse) template, **When** they view the screen, **Then** the date-range cost statistic is not shown (only for exclusive templates).
3. **Given** there are no redemptions in the selected range, **When** the merchant views date-range cost, **Then** the value is zero (or equivalent) and clearly displayed.
4. **Given** the date range changes, **When** the merchant updates the range, **Then** the date-range cost updates to match the new range.

---

### User Story 3 - Today’s Total Cost on Merchant Settings (Priority: P3)

A merchant wants to see a single number on their profile/settings page: “今日成本” (today’s cost)—the total discount given today across all their coupons. This allows them to quickly record it at end of day into their 總帳 (general ledger) for daily bookkeeping.

**Why this priority**: Supports daily bookkeeping without requiring the merchant to open each template or compute the total manually.

**Independent Test**: Can be tested by opening the merchant profile/settings page and verifying that “今日成本” is displayed and equals the sum of discount given (savings_amount) for all redemptions that occurred today for that merchant’s coupons.

**Acceptance Scenarios**:

1. **Given** a merchant is on their profile/settings page, **When** they view the page, **Then** “今日成本” (today’s cost) is displayed as one number, representing the total discount given today across all their coupons.
2. **Given** no redemptions occurred today, **When** the merchant views 今日成本, **Then** the value is zero (or equivalent) and clearly displayed.
3. **Given** the merchant returns to the settings page later the same day after new redemptions, **When** they view 今日成本, **Then** the value reflects all redemptions up to that moment for the current day (or the defined “today” window).
4. **Given** the merchant has multiple templates (exclusive and non-exclusive), **When** they view 今日成本, **Then** the total includes discount from all redemptions that have a savings amount, regardless of template type.

---

### Edge Cases

- What happens when the selected date range has an end date in the future? The system MUST disallow it: end date must be on or before "today" (store timezone) and MUST show a validation error if the user picks a future end date.
- What happens when the selected range spans more than 730 days (2 years)? The system MUST reject or cap the range at 730 days and show a clear message when the limit is exceeded.
- How does the system define "today" for 今日成本? "Today" is the calendar day in the store's configured timezone so it is unambiguous for bookkeeping.
- What happens when a redemption has no savings amount (null or zero)? Treat as zero for cost sums; do not exclude the redemption from counts if counts are shown.
- How does the system handle multiple templates and many redemptions when computing 今日成本? The result must still be a single correct total without undue delay.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow the merchant to select a date range (start date and end date) when viewing a single coupon template’s statistics, and MUST display all existing statistics (exposure, redemptions, conversion, and any other current metrics) for that range only.
- **FR-002**: System MUST support arbitrary calendar date-range selection (start date and end date chosen by the merchant); all displayed statistics and date-range cost MUST be calculated for that exact range. (Complements FR-001; emphasizes arbitrary range, no preset-only limitation.)
- **FR-003**: For 專屬優惠 / Collection (exclusive) templates only, system MUST display a “date-range cost” (此區間成本) statistic on the template analytics screen, defined as the sum of discount given (savings amount) over all redemptions in the selected date range.
- **FR-004**: System MUST NOT show the date-range cost statistic for non-exclusive (e.g. store / EasyUse) templates.
- **FR-005**: System MUST display “今日成本” (today’s cost) on the merchant profile/settings page, defined as the total discount given today across all coupons belonging to that merchant (sum of savings amount for all redemptions occurring “today”).
- **FR-006**: System MUST define “today” for 今日成本 in a consistent way as the calendar day in the store's configured timezone (e.g. Asia/Taipei) and MUST make this clear so merchants can rely on it for 總帳.
- **FR-007**: System MUST show zero (or equivalent) for date-range cost and 今日成本 when there are no redemptions in the range or no redemptions today, and MUST handle null or zero savings amount as zero in all cost sums.
- **FR-008**: When the merchant changes the selected date range on template analytics, system MUST update all statistics, including date-range cost for exclusive templates, to reflect the new range.
- **FR-009**: System MUST enforce a maximum selectable date range of 730 days (2 years) for template analytics and MUST show a clear message when the user selects a range longer than that.
- **FR-010**: System MUST disallow end dates after "today" (in the store's timezone) for template analytics date range; when the user selects a future end date, the system MUST show a validation error (or prevent selection).
- **FR-011**: System MUST display currency or unit for date-range cost and 今日成本 when the store (or system) has a configured currency (e.g. "此區間成本 (NT$)" or "今日成本 1,234 元"); when no currency is configured, display the numeric value only. (A system default currency may be used when the store has none—see research.md.)

### Key Entities

- **Coupon template**: The coupon/template for which analytics are shown; may be exclusive (專屬優惠 / Collection) or non-exclusive (e.g. store / EasyUse). Exclusive templates have a finite quantity and support a “discount given” (savings) notion per redemption.
- **Redemption**: A use of a coupon; may have an associated “savings amount” (discount given). Cost for a range is the sum of these amounts over redemptions in that range.
- **Date range**: A start and end date (or equivalent time window) chosen by the merchant for template analytics; all stats and date-range cost are scoped to this range.
- **Today’s cost**: A single aggregate: sum of discount given (savings amount) for all redemptions that occurred “today” for the merchant’s coupons, displayed on the merchant profile/settings page.

## Assumptions

- “Discount given” / cost is represented by the savings amount stored per redemption; no separate cost model is required for this feature.
- Exclusive (Collection) templates are those that support per-redemption savings and are the only ones that show date-range cost on template analytics; store/EasyUse templates do not show this metric.
- The existing template analytics screen and merchant profile/settings screen are the correct places to add date-range selection, date-range cost, and 今日成本.
- Date-range selection is arbitrary calendar range (start and end date); preset shortcuts (e.g. last 7 days) may be offered as convenience but the system must support any valid start/end within allowed bounds.
- “今日成本” is for informational and bookkeeping use; no approval or workflow is required for this number.
- Cost figures (此區間成本, 今日成本) show currency/unit when the store or system has a configured currency (system default may apply when store has none; see research.md); otherwise the number is shown without unit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Merchants can view template statistics for a chosen date range and see all metrics (exposure, redemptions, conversion, etc.) update to match that range.
- **SC-002**: Merchants viewing an exclusive template’s analytics see a date-range cost (此區間成本) that matches the sum of discount given for redemptions in the selected range.
- **SC-003**: Merchants see 今日成本 on the profile/settings page and can use that single number for daily 總帳 recording without opening each template.
- **SC-004**: Cost figures (date-range cost and 今日成本) are correct when compared to a manual sum of redemption savings in the same range or day.
- **SC-005**: Zero redemptions or zero savings in a range or day show as zero cost with no errors or confusing blanks.
