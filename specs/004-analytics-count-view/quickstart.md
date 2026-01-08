# Quick Start: Analytics Count View

**Feature**: 004-analytics-count-view  
**Date**: 2025-01-27

## Overview

This guide provides a quick reference for implementing the analytics count view feature. The feature adds a count view page that displays absolute count values (張數) instead of percentages for template analytics.

## Implementation Checklist

### Backend Changes

1. **Update `get_template_analytics` endpoint** (`Backend/api/views/merchant_coupon.py`)
   - Add count fields to response for exclusive templates:
     - `retention_count` = `consolidate_redemption_count` (already calculated)
     - `stranger_acquisition_count` = `non_consolidate_redemption_count` (already calculated)
     - `redemption_count` = `exclusive_redemptions_count` (already calculated)
     - `circulation_count` = `transfer_count` (already calculated)
     - `circulation_redemption_count` = `transfer_redemption_count` (already calculated)
   - Count values are already computed as numerators of rate calculations
   - No new database queries needed

2. **Update API documentation** (if using Swagger/OpenAPI)
   - Document new count fields in response schema
   - See `contracts/api.yaml` for OpenAPI specification

### Frontend Changes

1. **Update TypeScript interfaces** (`Mobile-Merchant-Frontend/utils/api.ts` or type definitions)
   ```typescript
   interface AnalyticsData {
     // ... existing fields ...
     retention_count?: number;
     stranger_acquisition_count?: number;
     redemption_count?: number;
     circulation_count?: number;
     circulation_redemption_count?: number;
   }
   ```

2. **Add toggle switch to percentage view** (`Mobile-Merchant-Frontend/app/(coupons)/template-analytics.tsx`)
   - Position: Above date toggle switch, below page title
   - Label: "張數" / "百分比"
   - Action: Navigate to count view page using `router.push('/template-analytics-count/:id')`

3. **Create count view page** (`Mobile-Merchant-Frontend/app/(coupons)/template-analytics-count.tsx`)
   - Copy structure from `template-analytics.tsx`
   - Display count fields instead of rate fields
   - Use `toLocaleString('zh-TW')` for number formatting
   - Update metric labels (e.g., "留客數" instead of "留客率")
   - Pass `isPercentage={false}` to `TrendChart` component
   - Use count values from `trends[metric].daily_data` for trend charts

4. **Update route configuration** (if needed)
   - Ensure Expo Router recognizes new route
   - Route path: `/template-analytics-count/:id`

## Key Implementation Details

### Count Field Mapping

| Count Field | Source Variable | Description |
|------------|----------------|------------|
| `retention_count` | `consolidate_redemption_count` | 留客數 |
| `stranger_acquisition_count` | `non_consolidate_redemption_count` | 陌生獲客數 |
| `redemption_count` | `exclusive_redemptions_count` | 核銷數 |
| `circulation_count` | `transfer_count` | 流動數 |
| `circulation_redemption_count` | `transfer_redemption_count` | 流動核銷數 |

### Number Formatting

```typescript
// Format count values
const displayValue = typeof value === 'number'
  ? value.toLocaleString('zh-TW')  // e.g., 1,234
  : value === null
    ? '數據不足'
    : value;
```

### Trend Chart Data

For count view, use the count values from `daily_data`:
- The `daily_data` array contains count values (not rates) for count metrics
- Pass `isPercentage={false}` to `TrendChart` component
- Y-axis will display numeric values instead of percentages

### Template Type Handling

```typescript
// Store templates (EasyUse) - only show exposure_count
if (isStoreTemplate) {
  // Only display exposure_count metric
}

// Exclusive templates - show all metrics
else {
  // Display all five count metrics:
  // retention_count, stranger_acquisition_count, redemption_count,
  // circulation_count, circulation_redemption_count
}
```

## Testing Checklist

### Backend Tests
- [ ] **Contract Tests** (REQUIRED per constitution): Add contract tests in `Backend/tests/contract/test_template_analytics.py` to validate API response schema with count fields
- [ ] API returns count fields for exclusive templates
- [ ] Count values match calculated numerators
- [ ] Store templates don't return exclusive-only count fields
- [ ] Time range filtering works correctly for count values
- [ ] Trend data contains count values in daily_data

### Frontend Tests
- [ ] Toggle switch appears in correct position
- [ ] Navigation to count view works
- [ ] Count values display correctly with formatting
- [ ] Zero counts display as "0"
- [ ] Trend charts show count values
- [ ] Time range selector updates count values
- [ ] Back navigation returns to percentage view
- [ ] Store templates show only applicable metrics

## API Example Response

```json
{
  "exposure_count": 1250,
  "conversion_rate": 0.45,
  "retention_rate": 0.72,
  "stranger_acquisition_rate": 0.28,
  "circulation_rate": 0.15,
  "circulation_redemption_rate": 0.60,
  "redemption_rate": 0.85,
  "retention_count": 180,
  "stranger_acquisition_count": 70,
  "redemption_count": 250,
  "circulation_count": 150,
  "circulation_redemption_count": 90,
  "trends": {
    "retention_rate": {
      "current": 0.72,
      "average": 0.68,
      "daily_data": [
        {"date": "2025-01-27", "value": 5},
        {"date": "2025-01-26", "value": 8},
        ...
      ]
    }
  }
}
```

## Common Issues & Solutions

### Issue: Count values are null or undefined
**Solution**: Ensure backend calculates and returns count fields. Check that template is exclusive type (not store).

### Issue: Trend chart shows percentages instead of counts
**Solution**: Pass `isPercentage={false}` to `TrendChart` component and use count values from `daily_data`.

### Issue: Navigation doesn't work
**Solution**: Verify route path matches Expo Router file structure. Check that `:id` parameter is passed correctly.

### Issue: Numbers not formatted with separators
**Solution**: Use `toLocaleString('zh-TW')` for all count values before display.

## Next Steps

1. Implement backend changes (add count fields to API response)
2. Update frontend TypeScript interfaces
3. Create count view page component
4. Add toggle switch to percentage view
5. Test navigation and data display
6. Verify formatting and edge cases (zero values, large numbers)
