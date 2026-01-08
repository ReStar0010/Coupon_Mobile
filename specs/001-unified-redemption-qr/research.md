# Research: Unified Redemption QR Code

**Feature**: Unified Redemption QR Code  
**Date**: 2025-01-27  
**Phase**: 0 - Research & Clarification

## Research Questions & Findings

### 1. Unified Redemption Code Storage & Management

**Question**: How should unified redemption codes be stored and managed at the merchant/store level?

**Decision**: Store unified redemption code directly on the `Store` model as a nullable field, similar to how `CouponTemplate` has `template_redeem_code`.

**Rationale**: 
- Each merchant has exactly one store (per spec assumptions)
- Store model already exists and is linked to merchant authentication
- No need for separate model - reduces complexity
- Code regeneration updates single field on Store instance
- Matches existing pattern where `CouponTemplate.template_redeem_code` stores template-level codes

**Alternatives Considered**:
- Separate `UnifiedRedemptionCode` model: Rejected - adds unnecessary complexity for single code per store
- Store in session/cache: Rejected - codes need persistence for validation across requests
- Store in MerchantProfile: Rejected - Store is the correct domain entity (codes identify store, not merchant account)

**Implementation**: Add `unified_redeem_code` field to `Store` model (CharField, max_length=6, nullable).

---

### 2. Unified Redemption Code Format & Generation

**Question**: What format should unified redemption codes use, and how should they be generated?

**Decision**: Use 6-digit numeric codes (same format as individual coupon redemption codes), generated using similar algorithm to existing frontend code generation.

**Rationale**:
- Consistency with existing `template_redeem_code` format (6-digit numeric)
- Matches consumer expectations from current redemption flow
- Existing frontend QR code generation in `Mobile-Merchant-Frontend/app/(coupons)/[id].tsx` uses 6-digit format
- Simple validation logic (string comparison)

**Alternatives Considered**:
- UUID-based codes: Rejected - too long for QR code scanning, not user-friendly
- Alphanumeric codes: Rejected - numeric is simpler and matches existing pattern
- Encrypted merchant ID: Rejected - codes need to be regeneratable, encryption adds complexity

**Implementation**: Generate codes using timestamp + random number combination (similar to existing `generateRandomCode` function), ensure uniqueness per store.

---

### 3. Unified Code Validation Flow

**Question**: How should unified redemption code validation integrate with existing coupon redemption validation?

**Decision**: Two-stage validation: (1) Validate unified code at merchant/store level, (2) Validate selected coupon using existing redemption logic.

**Rationale**:
- Unified code proves merchant identity (authentication)
- Coupon validation ensures ownership, expiration, redemption status (authorization)
- Separation of concerns: merchant authentication vs coupon eligibility
- Existing redemption API (`/redeem/{id}/`) can be reused after unified code validation

**Alternatives Considered**:
- Single combined validation: Rejected - violates requirement to preserve existing validation logic
- Unified code replaces coupon code: Rejected - spec requires coupon-level validation to remain unchanged

**Implementation**: 
- New endpoint: `POST /api/merchant/unified-redemption/validate/` - validates unified code, returns store info
- Consumer selects coupon, then calls existing `POST /api/redeem/{coupon_id}/` with unified code as `redeem_code` parameter
- Backend validates unified code matches store's current code before proceeding with coupon validation

---

### 4. QR Code Encoding Format

**Question**: What format should the unified QR code use to encode the redemption code?

**Decision**: Encode the 6-digit redemption code as plain text string in the QR code, same format as individual coupon QR codes.

**Rationale**:
- Consumer app already scans QR codes and extracts string data (see `Mobile-Frontend/app/EasyUse/[id]/redeem/index.tsx`)
- No format change needed - existing QR code scanning logic works
- Simple and consistent with current implementation
- QR code library (expo-camera) handles text encoding automatically

**Alternatives Considered**:
- JSON-encoded data with merchant ID: Rejected - adds parsing complexity, plain code is sufficient
- URL-encoded format: Rejected - unnecessary, code alone identifies merchant via store lookup

**Implementation**: Generate QR code containing only the 6-digit code string, consumer app scans and uses code to identify merchant.

---

### 5. Code Regeneration & Expiration

**Question**: When should unified redemption codes be regenerated, and should they expire?

**Decision**: Regenerate code on each merchant button click (per FR-001), no expiration required.

**Rationale**:
- Matches existing pattern: individual coupon codes regenerate when redemption page is accessed
- No expiration needed: codes are short-lived (regenerated frequently)
- Security: Frequent regeneration limits window for code reuse
- Simplicity: No expiration tracking or cleanup logic required

**Alternatives Considered**:
- Time-based expiration (e.g., 5 minutes): Rejected - adds complexity, regeneration on click is sufficient
- Manual expiration only: Rejected - automatic regeneration on click is better UX
- Never regenerate: Rejected - violates FR-001 requirement

**Implementation**: Each time merchant clicks unified redemption button, generate new code and update `Store.unified_redeem_code` field.

---

### 6. Consumer Flow: Merchant Identification from QR Code

**Question**: How should the consumer app identify the merchant/store from a scanned unified QR code?

**Decision**: Backend lookup: consumer app sends scanned code to API endpoint that returns merchant/store information and available coupons.

**Rationale**:
- Code alone doesn't contain merchant info (just 6 digits)
- Backend has authority to validate code and return associated store
- Matches RESTful pattern: code is identifier, API returns resource
- Enables validation: invalid codes return error before showing coupon list

**Alternatives Considered**:
- Encode merchant ID in QR code: Rejected - violates requirement to use 6-digit code format
- Client-side merchant lookup table: Rejected - security risk, codes change frequently
- Decode merchant from code algorithm: Rejected - codes are random, not deterministic

**Implementation**: 
- New endpoint: `GET /api/unified-redemption/{code}/` - validates code, returns store info and consumer's available coupons
- Consumer app calls this after scanning, displays coupon list from response

---

### 7. Integration with Existing Redemption Endpoint

**Question**: How should the unified code be passed to the existing redemption endpoint?

**Decision**: Modify existing `POST /api/redeem/{coupon_id}/` to accept unified redemption code as alternative to coupon-specific code.

**Rationale**:
- Preserves existing endpoint (no breaking changes)
- Unified code can be validated alongside coupon code
- Backend checks: if unified code matches store's current code, proceed with coupon validation
- Maintains backward compatibility: coupon-specific codes still work

**Alternatives Considered**:
- Separate unified redemption endpoint: Rejected - duplicates validation logic, violates DRY principle
- Always require coupon-specific code: Rejected - violates requirement for unified flow

**Implementation**: 
- Extend `redeem_coupon` view to check if submitted code matches store's `unified_redeem_code`
- If unified code matches, validate at store level, then proceed with coupon validation
- If coupon-specific code matches, use existing validation logic

---

### 8. Deprecation of Individual Coupon QR Code Generation

**Question**: How should individual coupon QR code generation be disabled?

**Decision**: Remove QR code generation from individual coupon detail page, keep phone number functionality.

**Rationale**:
- FR-010 requires disabling individual coupon QR code generation
- FR-017 requires preserving phone number functionality (for sending/consolidating coupons)
- Frontend already has unified redemption button on coupon list page
- Backend endpoint `refresh_redeem_code` can remain (used by unified flow) or be deprecated

**Alternatives Considered**:
- Redirect to unified flow: Rejected - cleaner to remove feature entirely
- Hide UI but keep backend: Rejected - violates deprecation requirement
- Remove entire redemption page: Rejected - phone number functionality must be preserved

**Implementation**: 
- Remove QR code display and generation from `Mobile-Merchant-Frontend/app/(coupons)/[id].tsx`
- Keep phone number input and send coupon functionality
- Backend `refresh_redeem_code` endpoint can be repurposed for unified codes or deprecated

---

## Summary of Technical Decisions

1. **Storage**: Add `unified_redeem_code` field to `Store` model
2. **Format**: 6-digit numeric codes (same as existing redemption codes)
3. **Generation**: Timestamp + random algorithm, regenerate on each button click
4. **Validation**: Two-stage (unified code → coupon validation)
5. **QR Encoding**: Plain text string (6-digit code)
6. **Merchant Identification**: Backend API lookup from code
7. **Integration**: Extend existing redemption endpoint to accept unified codes
8. **Deprecation**: Remove QR code from individual coupon pages, keep phone functionality

## Open Questions Resolved

All technical unknowns from the specification have been resolved. The implementation approach:
- Maintains existing redemption validation logic (as required)
- Uses consistent patterns with existing codebase
- Follows constitution principles (mobile-first, type-safe, testable)
- Minimizes changes to existing code (additive changes preferred)
