# Research: Analytics Count View

**Feature**: 004-analytics-count-view  
**Date**: 2025-01-27  
**Phase**: 0 - Outline & Research

## Research Tasks

### R1: Contract Test Implementation Pattern

**Task**: Research contract test patterns for Django REST Framework API endpoints

**Findings**:
- Django REST Framework uses `rest_framework.test.APITestCase` for API testing
- Contract tests validate request/response schemas, not business logic
- Should test response structure, field types, and presence of required fields
- Existing codebase uses pytest with DRF test client (see `Backend/tests/`)

**Decision**: Use pytest with `rest_framework.test.APIClient` to create contract tests in `Backend/tests/contract/test_template_analytics.py`

**Rationale**: 
- Aligns with existing test infrastructure
- Contract tests verify API schema compliance
- Tests should validate count fields are present in response for exclusive templates
- Tests should validate count fields are absent for store templates (only exposure_count available)

**Alternatives Considered**:
- Unit tests with mocks: Rejected - contract tests need real API responses
- Integration tests: Rejected - contract tests focus on schema, not full integration flow

---

### R2: Trend Data Count Values Implementation

**Task**: Clarify how count values are included in trend daily_data arrays

**Findings**:
- Current implementation: `daily_data` contains rate values (percentages) for rate metrics
- Requirement (FR-017): Backend must include count values in trend daily_data arrays
- Analysis: Backend already calculates count values (numerators) for rate calculations
- Implementation approach: Add count values to daily_data alongside rate values, OR use same daily_data with count values when accessed for count view

**Decision**: Backend includes count values in daily_data arrays. For count view, frontend uses count values from `trends[metric].daily_data` where `value` represents the count (not percentage). Backend calculates daily count values using same querysets as rate calculations.

**Rationale**:
- Count values are already calculated as numerators in rate calculations
- Daily count values can be derived from same daily querysets used for rate trends
- No additional database queries needed - reuse existing filtered querysets
- Maintains data consistency between rate and count views

**Alternatives Considered**:
- Separate count trend endpoints: Rejected - adds complexity, violates DRY principle
- Frontend calculation from rates: Rejected - loses accuracy, requires denominators
- Separate count fields in trends object: Rejected - violates existing structure, requires more changes

**Implementation Details**:
- For each metric's trend, calculate daily count values using same date filtering
- Store count values in `daily_data[].value` (same structure as rate trends)
- Frontend determines whether to display as count or rate based on view type
- Example: `retention_rate` trend's `daily_data` contains count values when accessed for count view

---

### R3: Number Formatting for Large Counts

**Task**: Determine number formatting approach for count values (thousand separators)

**Findings**:
- Requirement (FR-009): Count values must have thousand separators for readability
- JavaScript/TypeScript: `Number.toLocaleString()` provides locale-aware formatting
- React Native: `toLocaleString()` works on both iOS and Android
- Default locale: Use 'zh-TW' for Traditional Chinese formatting (matches app language)

**Decision**: Use `Number.toLocaleString('zh-TW')` for formatting count values in frontend

**Rationale**:
- Native JavaScript method, no additional dependencies
- Locale-aware formatting matches app language (Traditional Chinese)
- Handles large numbers automatically (e.g., 1234567 → "1,234,567")
- Consistent with percentage formatting already in use

**Alternatives Considered**:
- Custom formatting function: Rejected - unnecessary complexity, toLocaleString is standard
- Backend formatting: Rejected - formatting is presentation concern, should be in frontend
- Third-party library: Rejected - toLocaleString is sufficient, avoids dependency bloat

**Implementation Details**:
- Format count values when displaying in MetricCard component
- Format trend chart y-axis labels for count view
- Zero values display as "0" (no formatting needed)
- Null/undefined values display as "數據不足" (no formatting)

---

### R4: Navigation Pattern for Count View

**Task**: Confirm navigation implementation pattern (new route vs state toggle)

**Findings**:
- Requirement (FR-001, FR-018): Toggle switch navigates to new route/page
- Spec clarification: New route with separate URL path (e.g., `/template-analytics-count/:id`)
- Expo Router: File-based routing supports new route via new file
- Current pattern: `template-analytics.tsx` → new `template-analytics-count.tsx`

**Decision**: Create new route file `template-analytics-count.tsx` in `app/(coupons)/` directory

**Rationale**:
- Matches spec requirement for separate route/page
- Expo Router file-based routing makes this straightforward
- Allows direct URL access to count view
- Maintains browser history (back button works correctly)

**Alternatives Considered**:
- State toggle on same page: Rejected - violates FR-018 requirement
- Modal/overlay: Rejected - violates FR-018 requirement for separate route
- Query parameter: Rejected - spec requires separate URL path

---

### R5: Toggle Switch Component and Placement

**Task**: Determine toggle switch implementation and exact placement

**Findings**:
- Requirement (FR-001): Toggle switch labeled "張數" / "百分比" positioned above date toggle, below page title
- React Native: Use `Switch` component from `react-native` or Tamagui equivalent
- Current layout: Title → Time Range Selector → Metrics Grid → Trend Chart
- Placement: Between Title and Time Range Selector

**Decision**: Use Tamagui `Switch` component, positioned in XStack between title and time range selector

**Rationale**:
- Tamagui provides consistent styling with existing UI
- Switch component matches native mobile patterns
- Position matches spec requirement (above date toggle, below title)
- Navigation on toggle change (navigate to count view route)

**Alternatives Considered**:
- Button instead of switch: Rejected - switch better represents toggle between two views
- Custom toggle component: Rejected - Tamagui Switch is sufficient, maintains consistency

---

## Resolved Clarifications

All "NEEDS CLARIFICATION" items from Technical Context have been resolved:

1. ✅ **Contract Tests**: Use pytest with DRF APIClient in `Backend/tests/contract/`
2. ✅ **Trend Data Count Values**: Backend includes count values in daily_data arrays
3. ✅ **Number Formatting**: Use `toLocaleString('zh-TW')` in frontend
4. ✅ **Navigation Pattern**: New route file `template-analytics-count.tsx`
5. ✅ **Toggle Switch**: Tamagui Switch component, positioned between title and time range selector

## Open Questions

None - all implementation details clarified.

## Next Steps

Proceed to Phase 1: Design & Contracts
- Generate data-model.md (already exists, verify completeness)
- Generate API contracts in contracts/
- Generate quickstart.md
- Update agent context
