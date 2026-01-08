# Data Model: Analytics Count View

**Feature**: 004-analytics-count-view  
**Date**: 2025-01-27

## Overview

This feature extends the existing template analytics data model by adding count fields alongside rate fields. No new database entities are required - count values are derived from existing data already used in rate calculations.

## Entities

### Template Analytics Count Data

**Description**: Represents absolute count values for merchant statistics, corresponding to the numerators of rate calculations.

**Fields**:
- `retention_count` (integer): Number of consolidate redemptions (留客數)
- `stranger_acquisition_count` (integer): Number of non-consolidate redemptions (陌生獲客數)
- `redemption_count` (integer): Total number of redemptions (核銷數)
- `circulation_count` (integer): Number of transfer + public_pool coupons (流動數)
- `circulation_redemption_count` (integer): Number of transfer + public_pool redemptions (流動核銷數)

**Relationships**:
- Derived from existing `Coupon` and `CouponRedemption` models
- Calculated from same data sources as corresponding rate fields
- No foreign key relationships (computed values)

**Validation Rules**:
- All count values must be non-negative integers (>= 0)
- Count values cannot exceed total quantity for redemption-related counts
- Count values are calculated from filtered querysets based on time range

**State Transitions**: N/A (computed values, no state)

---

### Time Range Selection

**Description**: Represents the selected time period that filters count data displayed on the page.

**Fields**:
- `days` (integer): Time range in days (3, 7, 30, or 90)

**Validation Rules**:
- Must be one of: 3, 7, 30, or 90
- Default: 30 days
- Invalid values default to 30

**State Transitions**: N/A (user selection parameter)

---

### Metric Selection

**Description**: Represents the currently selected metric whose trend chart is displayed.

**Fields**:
- `selectedMetric` (string): One of the metric types (e.g., 'retention_rate', 'retention_count')

**Validation Rules**:
- Must be a valid metric type for the template type
- Store templates: Only 'exposure_count', 'conversion_rate'
- Exclusive templates: All metrics available

**State Transitions**: N/A (UI state only)

---

## API Response Structure

### Extended Analytics Response

The existing `get_template_analytics` endpoint response is extended with count fields:

```typescript
interface AnalyticsData {
  // Existing rate fields
  exposure_count?: number;
  conversion_rate?: number;
  retention_rate?: number;
  stranger_acquisition_rate?: number;
  circulation_rate?: number;
  circulation_redemption_rate?: number;
  redemption_rate?: number;
  
  // New count fields
  retention_count?: number;
  stranger_acquisition_count?: number;
  redemption_count?: number;
  circulation_count?: number;
  circulation_redemption_count?: number;
  
  // Trend data (existing structure, contains count values in daily_data)
  trends?: {
    exposure_count?: TrendData;
    conversion_rate?: TrendData;
    retention_rate?: TrendData;
    stranger_acquisition_rate?: TrendData;
    circulation_rate?: TrendData;
    circulation_redemption_rate?: TrendData;
    redemption_rate?: TrendData;
  };
}

interface TrendData {
  current: number;
  average: number;
  daily_data: Array<{
    date: string;  // ISO 8601 format
    value: number | null;  // Rate value for percentage view, count value for count view
  }>;
}
```

## Data Flow

1. **Backend Calculation**:
   - Count values are calculated from existing database queries
   - Same querysets used for rate calculations provide count numerators
   - Count values included in API response alongside rates

2. **Frontend Display**:
   - Count view page receives same API response as percentage view
   - Frontend selects count fields instead of rate fields for display
   - Trend charts use count values from `daily_data` arrays

3. **Time Range Filtering**:
   - Backend filters data by time range (days parameter)
   - Count values reflect filtered time period
   - Trend data shows daily counts within selected range

## Count Calculation Details

### Retention Count (留客數)
- **Source**: `consolidate_redemption_count`
- **Calculation**: Count of exclusive redemptions where `acquisition_method='consolidate'`
- **Formula**: Already calculated in backend as numerator of `retention_rate`

### Stranger Acquisition Count (陌生獲客數)
- **Source**: `non_consolidate_redemption_count`
- **Calculation**: Count of exclusive redemptions where `acquisition_method != 'consolidate'`
- **Formula**: Already calculated in backend as numerator of `stranger_acquisition_rate`

### Redemption Count (核銷數)
- **Source**: `exclusive_redemptions_count`
- **Calculation**: Total count of exclusive coupon redemptions
- **Formula**: Already calculated in backend

### Circulation Count (流動數)
- **Source**: `transfer_count`
- **Calculation**: Count of coupons where `acquisition_method IN ['transfer', 'public_pool']`
- **Formula**: Already calculated in backend as numerator of `circulation_rate`

### Circulation Redemption Count (流動核銷數)
- **Source**: `transfer_redemption_count`
- **Calculation**: Count of redemptions where `acquisition_method IN ['transfer', 'public_pool']`
- **Formula**: Already calculated in backend as numerator of `circulation_redemption_rate`

## Template Type Variations

### Store Templates (EasyUse)
- **Available Counts**: `exposure_count` only
- **Note**: Conversion count not explicitly tracked (conversion_rate uses total redemptions)

### Exclusive Templates
- **Available Counts**: All five count metrics
- **All metrics**: retention_count, stranger_acquisition_count, redemption_count, circulation_count, circulation_redemption_count

## Data Consistency

- Count values are always consistent with rate calculations
- Count values are the numerators of their corresponding rates
- Zero counts are valid and should display as "0"
- Null/undefined counts indicate insufficient data and display as "數據不足"
