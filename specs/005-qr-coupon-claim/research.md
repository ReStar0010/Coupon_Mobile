# Research: QR Code Coupon Claim

**Feature**: QR Code Coupon Claim  
**Date**: 2026-01-27  
**Status**: Complete

## Research Questions & Decisions

### 1. QR Code Format and Encoding

**Question**: What format should QR codes use to encode template ID and session token?

**Decision**: JSON object format (e.g., `{"template_id": 123, "session_token": "abc123"}`)

**Rationale**:
- JSON is human-readable and easy to parse in both frontend and backend
- Existing QR code scanning infrastructure in Mobile-Frontend already extracts string data
- JSON parsing is straightforward with `JSON.parse()` in TypeScript
- Allows for future extensibility (can add more fields without breaking existing scans)

**Alternatives Considered**:
- URL-encoded format: Rejected - adds unnecessary complexity, JSON is cleaner
- Plain text with delimiter (e.g., "123|abc123"): Rejected - less structured, harder to extend
- Base64-encoded JSON: Rejected - unnecessary encoding layer, JSON is already compact

**Implementation**: Generate QR code containing JSON string, parse in user app before sending to backend.

---

### 2. Session Token Generation and Validation

**Question**: How should session tokens be generated and validated?

**Decision**: Backend generates unique token when merchant requests QR code, stores active sessions in database, validates token on claim request.

**Rationale**:
- Database storage provides persistence and allows querying active sessions
- Unique token generation ensures no collisions (use UUID or similar)
- Database allows easy cleanup of expired/invalidated sessions
- Matches existing pattern of storing session-like data (e.g., password reset tokens)

**Alternatives Considered**:
- In-memory cache (Redis): Rejected - adds infrastructure dependency, database is sufficient for current scale
- JWT tokens: Rejected - overkill for short-lived sessions, adds complexity
- Simple incrementing counter: Rejected - not secure, predictable

**Implementation**: 
- Generate UUID4 token on backend when merchant requests QR code
- Store in `QRCodeSession` model with template_id, merchant, creation_time, is_active
- Validate token exists and is_active=True on claim request
- Invalidate session when merchant closes QR code display

---

### 3. QR Code Session Lifecycle

**Question**: When are QR codes valid for claiming, and how should invalidation work?

**Decision**: QR codes are only valid while the merchant has the QR code display open. Once the merchant closes/navigates away, the QR code becomes invalid.

**Rationale**:
- Provides security: prevents QR code reuse after merchant stops sharing
- Matches user expectation: QR code is "live" only while displayed
- Simple lifecycle: active when displayed, invalid when closed
- Frontend can call invalidation API on component unmount

**Alternatives Considered**:
- Time-based expiration (e.g., 5 minutes): Rejected - adds complexity, display-based invalidation is clearer
- Manual expiration only: Rejected - automatic invalidation on close is better UX
- Never expire: Rejected - security risk, QR codes could be reused indefinitely

**Implementation**:
- Frontend calls `POST /api/merchant/qr-session/<session_id>/invalidate/` when QR code component unmounts
- Backend sets `is_active=False` on session
- Claim endpoint checks `is_active=True` before processing

---

### 4. Acquisition Method Value

**Question**: What acquisition method value should be used for QR code-claimed coupons?

**Decision**: `'qr_claim'` (add to ACQUISITION_METHOD_CHOICES)

**Rationale**:
- Follows existing pattern: `'draw'`, `'consolidate'`, `'transfer'`, `'public_pool'`
- Descriptive and clear: indicates coupon was claimed via QR code
- Allows analytics and filtering by acquisition method
- Consistent with existing codebase conventions

**Alternatives Considered**:
- Reuse `'consolidate'`: Rejected - semantically different (consolidate is phone-based)
- Use generic `'scan'`: Rejected - too generic, `'qr_claim'` is more specific

**Implementation**: Add `'qr_claim'` to `Coupon.ACQUISITION_METHOD_CHOICES` in models.py, create migration.

---

### 5. Multiple Claims from Same Template

**Question**: Can users claim multiple coupons from the same template via QR code?

**Decision**: Yes, users can claim multiple coupons from the same template (subject to template quantity availability). No one-per-user limit enforced for QR code claims.

**Rationale**:
- Matches spec requirement: "users can claim multiple coupons from the same template"
- Allows merchants to distribute multiple coupons to same customer
- Template quantity limit already prevents over-claiming
- Simpler logic: no need to track per-user claim history

**Alternatives Considered**:
- One-per-user limit: Rejected - violates spec requirement, limits merchant flexibility
- Daily limit: Rejected - adds complexity, not required by spec

**Implementation**: No additional checks needed beyond template quantity validation.

---

### 6. QR Code Generation Library

**Question**: What library should be used for QR code generation in the merchant app?

**Decision**: Use existing URL-based QR code service (api.qrserver.com) via existing `QRCode` component.

**Rationale**:
- Already implemented in `Mobile-Merchant-Frontend/app/(coupons)/components/QRCode.tsx`
- No additional dependencies needed
- Works reliably across platforms
- Simple integration: just pass JSON string as value

**Alternatives Considered**:
- react-native-qrcode-svg: Rejected - adds dependency, existing solution works
- Backend generation: Rejected - adds API call overhead, client-side is faster
- expo-qrcode: Rejected - not available in Expo SDK, URL service is simpler

**Implementation**: Reuse existing `QRCode` component, pass JSON-encoded template_id and session_token.

---

### 7. QR Code Scanning Library

**Question**: What library should be used for QR code scanning in the user app?

**Decision**: Use existing `expo-camera` library (already in dependencies).

**Rationale**:
- Already installed: `expo-camera ~17.0.10` in package.json
- Already used in `Mobile-Frontend/app/EasyUse/[id]/redeem/index.tsx` for redemption scanning
- Native camera integration, reliable scanning
- No additional dependencies needed

**Alternatives Considered**:
- react-native-qrcode-scanner: Rejected - adds dependency, expo-camera is sufficient
- expo-barcode-scanner: Rejected - deprecated, expo-camera is the modern replacement

**Implementation**: Reuse existing camera scanning logic, parse JSON from scanned data.

---

### 8. Race Condition Handling

**Question**: How should the system handle race conditions when multiple users scan the same QR code simultaneously and only one coupon remains?

**Decision**: Use database-level atomic operations (F() expressions) to decrement remaining_quantity atomically, return error if quantity becomes negative.

**Rationale**:
- Database-level atomicity prevents race conditions
- Django's F() expressions ensure thread-safe decrements
- Clear error message when out of stock
- Matches existing pattern in `CouponTemplate.generate_coupon()`

**Alternatives Considered**:
- Application-level locking: Rejected - complex, database-level is more reliable
- Queue-based processing: Rejected - overkill for this use case
- Optimistic locking: Rejected - F() expressions are simpler and more reliable

**Implementation**: Use `CouponTemplate.objects.filter(id=template_id, remaining_quantity__gt=0).update(remaining_quantity=F('remaining_quantity') - 1)` with transaction.

---

### 9. Error Handling for Invalid QR Codes

**Question**: How should the system handle invalid QR code formats or corrupted data?

**Decision**: Try-catch JSON parsing, validate required fields exist, return user-friendly error messages.

**Rationale**:
- Graceful degradation: don't crash on invalid input
- Clear error messages help users understand what went wrong
- Matches existing error handling patterns in the codebase

**Alternatives Considered**:
- Silent failure: Rejected - poor UX, users need feedback
- Generic error: Rejected - specific errors are more helpful

**Implementation**: 
- Try-catch `JSON.parse()` in frontend
- Validate `template_id` and `session_token` exist in parsed object
- Backend validates token exists and is active
- Return specific error messages: "Invalid QR code format", "QR code session expired", etc.

---

### 10. Frontend-Backend Communication for Session Invalidation

**Question**: How should the frontend notify the backend when QR code session should be invalidated?

**Decision**: Frontend calls backend API endpoint when QR code component unmounts or merchant navigates away.

**Rationale**:
- Explicit invalidation ensures sessions are cleaned up promptly
- Component unmount is reliable trigger for "merchant closed display"
- Matches React lifecycle patterns
- Backend can handle cleanup if frontend call fails (optional: timeout-based cleanup)

**Alternatives Considered**:
- Timeout-based only: Rejected - less reliable, explicit invalidation is better
- WebSocket connection: Rejected - adds complexity, HTTP call is sufficient
- No invalidation: Rejected - security risk, QR codes would remain valid indefinitely

**Implementation**: 
- Add `useEffect` cleanup function in QR code component
- Call `POST /api/merchant/qr-session/<session_id>/invalidate/` on unmount
- Handle errors gracefully (log but don't block unmount)

---

## Technology Choices Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| QR Code Generation | URL-based service (api.qrserver.com) | Already implemented, no dependencies |
| QR Code Scanning | expo-camera | Already in dependencies, proven reliable |
| Session Storage | Django ORM (database) | Persistent, queryable, matches existing patterns |
| Token Generation | UUID4 | Unique, secure, standard |
| Session Invalidation | HTTP API call on component unmount | Explicit, reliable, simple |
| Race Condition Handling | Django F() expressions | Atomic, thread-safe, database-level |

## Dependencies

- **Backend**: No new dependencies (Django ORM sufficient)
- **Frontend**: No new dependencies (expo-camera and QRCode component already exist)

## Open Questions

None - all questions resolved.
