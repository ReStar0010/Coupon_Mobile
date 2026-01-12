# Quickstart: QR Code Coupon Claim

**Feature**: QR Code Coupon Claim  
**Date**: 2026-01-27

## Overview

This feature enables merchants to generate QR codes for coupon templates, and users to scan these QR codes to claim coupons. QR codes are only valid while the merchant keeps the display open.

## Architecture

- **Backend**: Django REST API endpoints for session management and claim processing
- **Merchant Frontend**: QR code generation and display component
- **User Frontend**: QR code scanner component and navigation button

## Setup

### Backend Setup

1. **Activate virtual environment**:
   ```bash
   cd Backend
   source .venv/bin/activate  # Unix/macOS
   # or
   .venv\Scripts\activate  # Windows
   ```

2. **Create and run migrations**:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

3. **Add new acquisition method**:
   - Edit `Backend/api/models.py`
   - Add `'qr_claim'` to `Coupon.ACQUISITION_METHOD_CHOICES`

4. **Start development server**:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

**Merchant App**:
```bash
cd Mobile-Merchant-Frontend
npm install  # If needed
npm start
```

**User App**:
```bash
cd Mobile-Frontend
npm install  # If needed
npm start
```

## API Endpoints

### 1. Generate QR Code Session

**Endpoint**: `POST /api/merchant/qr-session/generate/`

**Request**:
```json
{
  "template_id": 123
}
```

**Response** (201):
```json
{
  "session_id": 456,
  "template_id": 123,
  "session_token": "550e8400-e29b-41d4-a716-446655440000",
  "qr_code_data": "{\"template_id\": 123, \"session_token\": \"550e8400-e29b-41d4-a716-446655440000\"}",
  "message": "QR code session created successfully"
}
```

### 2. Invalidate QR Code Session

**Endpoint**: `POST /api/merchant/qr-session/{session_id}/invalidate/`

**Response** (200):
```json
{
  "message": "QR code session invalidated successfully",
  "session_id": 456
}
```

### 3. Claim Coupon via QR Code

**Endpoint**: `POST /api/qr-claim/claim/`

**Request**:
```json
{
  "template_id": 123,
  "session_token": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** (201):
```json
{
  "message": "Coupon claimed successfully",
  "coupon_id": 789,
  "coupon_name": "20% Off Coffee",
  "template_id": 123,
  "remaining_quantity": 5,
  "acquisition_method": "qr_claim"
}
```

## Usage Flow

### Merchant Flow

1. **Navigate to coupon template detail page** in Collections (專屬優惠)
2. **Tap "Generate QR Code" button**
3. **Backend creates session** and returns `template_id` and `session_token`
4. **Frontend generates QR code** with JSON: `{"template_id": X, "session_token": "..."}`
5. **QR code displayed** in modal/component
6. **When merchant closes display**, frontend calls invalidation endpoint

### User Flow

1. **Tap "Scan to Claim Coupon" button** in main screen (bottom navigation)
2. **Camera opens** (request permission if needed)
3. **User scans QR code**
4. **Frontend parses JSON** from scanned data
5. **Frontend calls claim endpoint** with `template_id` and `session_token`
6. **Backend validates**:
   - Session token exists and is active
   - Template exists and is active
   - Template has remaining quantity
   - User is authenticated
7. **Backend creates coupon** with `acquisition_method='qr_claim'`
8. **Frontend shows success message**: "獲得優惠券"

## Testing

### Backend Tests

```bash
cd Backend
source .venv/bin/activate
python manage.py test api.tests.test_qr_claim
```

**Test Cases**:
- Generate QR code session for valid template
- Generate QR code session for invalid template (not owned, out of stock)
- Invalidate active session
- Claim coupon with valid session token
- Claim coupon with invalid/expired session token
- Claim coupon when template out of stock
- Race condition: multiple users claim last coupon simultaneously

### Frontend Tests

**Merchant App**:
- QR code generation displays correctly
- QR code contains correct JSON data
- Session invalidation called on component unmount

**User App**:
- Scan button opens camera
- QR code scanning parses JSON correctly
- Claim API called with correct data
- Success message displayed on claim
- Error messages displayed for invalid QR codes

## Key Files

### Backend

- `Backend/api/models.py`: `QRCodeSession` model, `Coupon.ACQUISITION_METHOD_CHOICES` update
- `Backend/api/views/qr_claim.py`: New view file with three endpoints
- `Backend/api/serializers.py`: Serializers for QR code session and claim requests
- `Backend/api/migrations/XXXX_add_qrcode_session.py`: Database migration

### Merchant Frontend

- `Mobile-Merchant-Frontend/app/(coupons)/[id]/qr-code.tsx`: QR code generation component
- `Mobile-Merchant-Frontend/app/(coupons)/components/QRCode.tsx`: Existing QR code display component (reused)

### User Frontend

- `Mobile-Frontend/app/components/QRClaimScanner.tsx`: QR code scanner component
- `Mobile-Frontend/app/index.tsx`: Add "Scan to Claim Coupon" button
- `Mobile-Frontend/app/utils/authAPI.ts`: Add `claimCouponViaQR()` function

## Error Handling

### Common Errors

1. **"QR code session expired"**: Merchant closed QR code display
2. **"Coupon template out of stock"**: No remaining quantity
3. **"Invalid QR code format"**: QR code doesn't contain valid JSON
4. **"Template not found"**: Template ID doesn't exist
5. **"Unauthorized"**: User not logged in

### Error Response Format

```json
{
  "error": "Error message here"
}
```

## Security Considerations

1. **Session tokens**: UUID4 format, unique per session
2. **Authentication**: All endpoints require user authentication
3. **Authorization**: Merchants can only generate sessions for their own templates
4. **Session invalidation**: Explicit invalidation prevents QR code reuse
5. **Race conditions**: Atomic database operations prevent double-claiming

## Performance Considerations

1. **QR code generation**: < 1s (URL-based service, no backend processing)
2. **Session creation**: < 100ms (simple database insert)
3. **Claim operation**: < 500ms (atomic update, coupon creation)
4. **Session invalidation**: < 100ms (simple database update)

## Next Steps

1. Implement backend endpoints (see `data-model.md` for schema)
2. Implement merchant frontend QR code component
3. Implement user frontend scanner component
4. Add tests for all endpoints and components
5. Test end-to-end flow with real devices
