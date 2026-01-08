# Quickstart: Unified Redemption QR Code

**Feature**: Unified Redemption QR Code  
**Date**: 2025-01-27  
**Phase**: 1 - Design & Contracts

## Overview

This feature enables merchants to generate a single unified QR code that works for all their coupons, instead of requiring navigation to individual coupon pages. When consumers scan the unified QR code, they see their available coupons for that merchant and can select one to redeem.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Merchant App  │         │   Backend API    │         │  Consumer App   │
│                 │         │                  │         │                 │
│ 1. Click Button │────────▶│ 2. Generate Code │         │                 │
│                 │         │    (Store.unified│         │                 │
│ 3. Display QR   │◀────────│     _redeem_code)│         │                 │
│                 │         │                  │         │                 │
│                 │         │                  │         │ 4. Scan QR Code │
│                 │         │                  │◀────────│                 │
│                 │         │                  │         │                 │
│                 │         │ 5. Validate Code │────────▶│ 6. Show Coupons │
│                 │         │    + Get Coupons│         │                 │
│                 │         │                  │         │                 │
│                 │         │                  │         │ 7. Select Coupon │
│                 │         │                  │         │    + Redeem     │
│                 │         │ 8. Validate Both│◀────────│                 │
│                 │         │    Codes + Redeem│         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

## Key Components

### Backend Changes

1. **Store Model** (`Backend/api/models.py`)
   - Add `unified_redeem_code` field (CharField, max_length=6, nullable)

2. **New API Endpoints** (`Backend/api/views/`)
   - `POST /api/merchant/unified-redemption/generate/` - Generate unified code
   - `GET /api/unified-redemption/{code}/` - Validate code and get coupons
   - `POST /api/redeem/{coupon_id}/` - Modified to accept unified codes

3. **Serializers** (`Backend/api/serializers.py`)
   - Add unified redemption serializers for request/response validation

### Frontend Changes

1. **Merchant App** (`Mobile-Merchant-Frontend/`)
   - Unified redemption button already exists (per spec)
   - Connect button to new generation endpoint
   - Display QR code in existing modal component

2. **Consumer App** (`Mobile-Frontend/`)
   - Modify QR scanner to handle unified codes
   - Add coupon selection screen after scanning
   - Integrate with unified redemption validation

## Data Flow

### Merchant Flow

1. Merchant clicks "條碼核銷" (unified redemption) button
2. Frontend calls `POST /api/merchant/unified-redemption/generate/`
3. Backend generates 6-digit code, updates `Store.unified_redeem_code`
4. Backend returns code to frontend
5. Frontend displays QR code in modal with the code

### Consumer Flow

1. Consumer scans unified QR code
2. Frontend extracts 6-digit code from QR data
3. Frontend calls `GET /api/unified-redemption/{code}/`
4. Backend validates code matches a store's `unified_redeem_code`
5. Backend returns store info + consumer's available coupons
6. Frontend displays coupon selection screen
7. Consumer selects a coupon
8. Frontend calls `POST /api/redeem/{coupon_id}/` with unified code
9. Backend validates unified code at store level
10. Backend validates coupon (ownership, expiration, redemption status)
11. Backend creates `CouponRedemption` record
12. Frontend shows success message

## API Usage Examples

### Generate Unified Redemption Code

```bash
# Merchant generates unified code
curl -X POST http://localhost:8000/api/merchant/unified-redemption/generate/ \
  -H "Cookie: access_token=<jwt_token>" \
  -H "Content-Type: application/json"

# Response:
{
  "unified_redeem_code": "123456",
  "store_id": 1,
  "store_name": "Coffee Shop"
}
```

### Validate Code and Get Coupons

```bash
# Consumer scans code "123456"
curl -X GET http://localhost:8000/api/unified-redemption/123456/ \
  -H "Cookie: access_token=<jwt_token>"

# Response:
{
  "store": {
    "id": 1,
    "name": "Coffee Shop",
    "address": "123 Main St"
  },
  "available_coupons": [
    {
      "id": 1,
      "coupon_name": "Buy 1 Get 1 Free",
      "coupon_detail": "Get one free item",
      "coupon_type": "exclusive",
      "store_name": "Coffee Shop",
      "expiry_date": "2025-12-31T23:59:59Z",
      "estimated_savings": 50.00,
      "is_redeemed": false
    }
  ]
}
```

### Redeem Coupon with Unified Code

```bash
# Consumer redeems coupon with unified code
curl -X POST http://localhost:8000/api/redeem/1/ \
  -H "Cookie: access_token=<jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "redeem_code": "123456"
  }'

# Response:
{
  "message": "優惠券兌換成功",
  "coupon_name": "Buy 1 Get 1 Free",
  "redeemed_at": "2025-01-27T10:30:00Z"
}
```

## Testing Checklist

### Merchant Flow
- [ ] Merchant can generate unified redemption code
- [ ] QR code displays correctly in modal
- [ ] Code regenerates on each button click
- [ ] Modal closes and returns to coupon list

### Consumer Flow
- [ ] Consumer can scan unified QR code
- [ ] Consumer sees available coupons for merchant
- [ ] Consumer can select a coupon
- [ ] Redemption code is auto-filled from scan
- [ ] Consumer can edit redemption code if needed
- [ ] Redemption succeeds with valid unified code
- [ ] Redemption fails with invalid unified code
- [ ] Consumer sees error if no coupons available

### Edge Cases
- [ ] Merchant with no store shows appropriate error
- [ ] Invalid QR code shows error message
- [ ] Consumer with no coupons sees appropriate message
- [ ] Expired/inactive coupons are filtered out
- [ ] Already redeemed coupons are filtered out
- [ ] Concurrent redemptions handled correctly

## Migration Steps

1. **Database Migration**
   ```bash
   cd Backend
   source .venv/bin/activate  # or .venv/Scripts/activate on Windows
   python manage.py makemigrations api
   python manage.py migrate
   ```

2. **Backend Implementation**
   - Add `unified_redeem_code` field to Store model
   - Create new API endpoints
   - Modify existing redemption endpoint
   - Add serializers

3. **Frontend Implementation**
   - Connect merchant button to generation endpoint
   - Update consumer QR scanner for unified codes
   - Add coupon selection screen
   - Integrate with redemption flow

4. **Testing**
   - Unit tests for code generation
   - Integration tests for redemption flow
   - End-to-end tests for merchant and consumer flows

5. **Deprecation**
   - Remove QR code from individual coupon pages
   - Keep phone number functionality
   - Update documentation

## Dependencies

- **Backend**: Django 5.2, Django REST Framework, djangorestframework-simplejwt
- **Frontend**: Expo, React Native, expo-camera, Tamagui
- **Database**: SQLite (dev), PostgreSQL (prod)

## Performance Targets

- Unified QR code generation: < 2 seconds (SC-001)
- Consumer scan to coupon list: < 3 seconds (SC-002)
- 95% success rate for QR code scans (SC-003)
- API response time: < 200ms p95

## Security Considerations

- Unified codes are regenerated frequently (on each button click)
- Codes are validated at store level before coupon validation
- Consumer authentication required for coupon list and redemption
- Merchant authentication required for code generation
- Existing coupon validation rules remain unchanged
