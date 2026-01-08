# Feature Specification: Analytics Count View

**Feature Branch**: `004-analytics-count-view`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "我想要針對圖片上的頁面新增一個新功能，你可以看到目前的數據都是以percentage作為表示方法，我想要請你新增一個按鈕，可以進到一個頁面，頁面一樣是顯示數據，只是這些數據變成用張數顯示：留客率->留客數, 陌生獲客率->陌生獲客數, 核銷率->核銷數, 流動率->流動數, 流動核銷率->流動核銷數。"

## Clarifications

### Session 2025-01-27

- Q: How should count data be obtained - backend API returns count fields, frontend calculates from rates using denominators, or frontend reverse-calculates from rates? → A: Backend API returns count fields (e.g., `retention_count`, `stranger_acquisition_count`) alongside existing rate fields
- Q: Where should the button to navigate to count view be placed and what should it look like? → A: Toggle switch positioned above the date toggle switch (time range selector) but below the page title
- Q: How should navigation to count view be implemented - new route/page, same page with state toggle, or modal/overlay? → A: New route/page (separate URL path, e.g., `/template-analytics-count/:id`)
- Q: What label/text should the toggle switch display? → A: "張數" / "百分比" (Count / Percentage)
- Q: How should trend chart count data be provided - backend includes count values in trend daily_data, frontend calculates from percentages, or separate count trend structures? → A: Backend includes count values in trend daily_data arrays (e.g., `trends.retention_rate.daily_data` contains count values for count view)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Statistics as Counts (Priority: P1)

A merchant viewing their coupon template analytics page wants to see the same metrics displayed as absolute counts (張數) instead of percentages. They tap a button on the statistics page to navigate to a new view that shows:
- 留客數 (Retention Count) instead of 留客率 (Retention Rate)
- 陌生獲客數 (Stranger Acquisition Count) instead of 陌生獲客率 (Stranger Acquisition Rate)
- 核銷數 (Redemption Count) instead of 核銷率 (Redemption Rate)
- 流動數 (Circulation Count) instead of 流動率 (Circulation Rate)
- 流動核銷數 (Circulation Redemption Count) instead of 流動核銷率 (Circulation Redemption Rate)

**Why this priority**: This is the core functionality - enabling merchants to view statistics in count format provides concrete numbers that complement the percentage view, helping them understand actual volumes of customer actions.

**Independent Test**: Can be fully tested by navigating to the template analytics page, tapping the count view button, and verifying all five metrics display as counts with appropriate labels. The page should maintain the same time range selector functionality and display format consistency.

**Acceptance Scenarios**:

1. **Given** a merchant is viewing the template analytics page with percentage-based metrics displayed, **When** they toggle the switch (positioned above the date selector, below the page title) to view counts, **Then** they are navigated to a new page showing the same metrics as counts (張數) with updated labels
2. **Given** a merchant is on the count view page, **When** they select a different time range (近3天, 近7天, 近30天, 近90天), **Then** the count values update to reflect the selected time period
3. **Given** a merchant is viewing count metrics, **When** the data shows zero counts, **Then** the display shows "0" clearly without errors
4. **Given** a merchant is on the count view page, **When** they navigate back, **Then** they return to the percentage view page

---

### User Story 2 - Consistent Page Layout and Navigation (Priority: P2)

A merchant expects the count view page to have the same layout, styling, and navigation patterns as the percentage view page for consistency and ease of use.

**Why this priority**: Maintaining UI consistency reduces cognitive load and ensures merchants can easily switch between views without learning new interface patterns.

**Independent Test**: Can be tested by comparing the count view page layout with the percentage view page - both should have the same header, time range selector, metric card layout, and trend chart section structure.

**Acceptance Scenarios**:

1. **Given** a merchant is on the count view page, **When** they view the page layout, **Then** it matches the percentage view page structure (title, time range buttons, metric cards grid, trend chart section)
2. **Given** a merchant is on the count view page, **When** they view the trend chart section, **Then** it displays the selected metric's trend data with count values instead of percentages
3. **Given** a merchant is on the count view page, **When** they interact with metric cards, **Then** the selected metric's trend chart updates accordingly, similar to the percentage view

---

### Edge Cases

- What happens when a metric has zero count? The system should display "0" clearly without errors or placeholder text
- How does the system handle time ranges with no data? The count view should display "0" for all metrics and show an empty or flat trend chart
- What happens when navigating to count view for a store template (EasyUse)? The count view should only show metrics available for store templates (exposure count, conversion count if applicable)
- How does the system handle very large count numbers? Numbers should be formatted with appropriate thousand separators for readability
- What happens if the API fails to load count data? The system should display an appropriate error message and allow retry, consistent with the percentage view error handling

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a toggle switch on the template analytics page labeled "張數" / "百分比" (Count / Percentage) that navigates to a count view page via a new route (separate URL path), positioned above the date toggle switch (time range selector) but below the page title
- **FR-002**: System MUST display 留客數 (Retention Count) as an absolute number instead of 留客率 (Retention Rate) percentage on the count view page
- **FR-003**: System MUST display 陌生獲客數 (Stranger Acquisition Count) as an absolute number instead of 陌生獲客率 (Stranger Acquisition Rate) percentage on the count view page
- **FR-004**: System MUST display 核銷數 (Redemption Count) as an absolute number instead of 核銷率 (Redemption Rate) percentage on the count view page
- **FR-005**: System MUST display 流動數 (Circulation Count) as an absolute number instead of 流動率 (Circulation Rate) percentage on the count view page
- **FR-006**: System MUST display 流動核銷數 (Circulation Redemption Count) as an absolute number instead of 流動核銷率 (Circulation Redemption Rate) percentage on the count view page
- **FR-007**: System MUST maintain the same time range selector functionality (近3天, 近7天, 近30天, 近90天) on the count view page
- **FR-008**: System MUST update count values based on the selected time range
- **FR-009**: System MUST display count values with appropriate number formatting (thousand separators) for readability
- **FR-010**: System MUST maintain the same metric card layout and styling as the percentage view page
- **FR-011**: System MUST display trend charts for selected metrics using count values instead of percentage values
- **FR-012**: System MUST allow merchants to select different metrics on the count view page to update the trend chart accordingly
- **FR-013**: System MUST handle zero count values gracefully by displaying "0" without errors
- **FR-014**: System MUST provide navigation back to the percentage view page from the count view page (via browser back button or explicit back navigation control)
- **FR-018**: System MUST implement the count view as a separate route/page with its own URL path (e.g., `/template-analytics-count/:id`)
- **FR-015**: System MUST only show count metrics that are applicable to the template type (exclusive templates show all metrics, store templates show only applicable metrics)
- **FR-016**: Backend API MUST return count fields (`retention_count`, `stranger_acquisition_count`, `redemption_count`, `circulation_count`, `circulation_redemption_count`) alongside existing rate fields in the template analytics response
- **FR-017**: Backend API MUST include count values in trend daily_data arrays for each metric (e.g., `trends.retention_rate.daily_data` contains count values when accessed for count view), allowing trend charts to display accurate count values over time

### Key Entities *(include if feature involves data)*

- **Template Analytics Count Data**: Represents the absolute count values for merchant statistics, including retention count, stranger acquisition count, redemption count, circulation count, and circulation redemption count. Each count corresponds to the numerator of its respective rate calculation. Count data is provided by the backend API as separate fields alongside rate fields, ensuring accuracy and avoiding calculation errors.

- **Time Range Selection**: Represents the selected time period (3, 7, 30, or 90 days) that filters the count data displayed on the page.

- **Metric Selection**: Represents the currently selected metric whose trend chart is displayed, allowing merchants to view historical count trends for specific metrics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Merchants can navigate from the percentage view to the count view page in one tap, with navigation completing in under 1 second
- **SC-002**: All five count metrics (留客數, 陌生獲客數, 核銷數, 流動數, 流動核銷數) display correctly with accurate values matching the underlying data calculations
- **SC-003**: Count values update correctly when merchants change the time range selector, with data loading completing within 2 seconds
- **SC-004**: Count values are formatted with thousand separators for numbers over 1,000, ensuring readability for large values
- **SC-005**: The count view page maintains visual consistency with the percentage view page, with 95% of layout elements matching in position and styling
- **SC-006**: Trend charts display count values accurately, with y-axis labels showing appropriate numeric scales instead of percentages
- **SC-007**: Zero count values display as "0" without errors or placeholder messages, maintaining a consistent user experience
- **SC-008**: Merchants can successfully navigate back to the percentage view from the count view page, preserving the selected time range and metric context
