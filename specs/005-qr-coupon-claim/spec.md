# Feature Specification: QR Code Coupon Claim

**Feature Branch**: `005-qr-coupon-claim`  
**Created**: 2026-01-27  
**Status**: Draft  
**Input**: User description: "請協助實作「優惠券發放與領取」功能，涉及商家端與用戶端的修改：1. 商家端 (Merchant App) - 優惠券詳情頁：在商家進入「專屬優惠 (Collections)」的單張優惠券詳情頁後，請新增發券方式：(QR Code 發券)：自動生成該張優惠券的專屬 QR Code。邏輯：該 QR Code 需包含此優惠券的 ID (Coupon ID)。2. 用戶端 (User App) - 掃碼領券功能：UI 入口：請在螢幕底部新增一個「掃描領券」按鈕（樣式請參考商家端的掃碼按鈕設計，保持一致性）。交互邏輯：1. 點擊按鈕開啟相機掃描。2. 掃描商家提供的上述 QR Code。3. 解析 QR Code 中的 Coupon ID 並呼叫領券 API (Claim Coupon Endpoint)。4. 成功後顯示「獲得優惠券」的提示。注意：此功能為「領取優惠券」，請與「核銷優惠券」的邏輯區分開來。"

## Clarifications

### Session 2026-01-27

- Q: What acquisition method value should be used for QR code-claimed coupons? → A: `'qr_claim'` (add to ACQUISITION_METHOD_CHOICES)
- Q: When are QR codes valid for claiming? → A: QR codes are only valid while the merchant has the QR code display open. Once the merchant closes/navigates away from the QR code display, the QR code becomes invalid and users cannot claim coupons using it.
- Q: What format should QR codes use to encode template ID and session token? → A: JSON object format (e.g., `{"template_id": 123, "session_token": "abc123"}`)
- Q: How should session tokens be generated and validated? → A: Backend generates unique token when merchant requests QR code, stores active sessions in database/cache, validates token on claim request
- Q: Can users claim multiple coupons from the same template via QR code? → A: Yes, users can claim multiple coupons from the same template (subject to template quantity availability). No one-per-user limit enforced for QR code claims.
- Q: How should the frontend notify the backend when QR code session should be invalidated? → A: Frontend calls backend API endpoint when QR code component unmounts or merchant navigates away

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Merchant Generates QR Code for Coupon Template (Priority: P1)

A merchant wants to generate a QR code for a specific coupon template in their Collections (專屬優惠) so customers can scan it to claim the coupon. The merchant navigates to the coupon detail page and sees a QR code generation option. When activated, a QR code is displayed containing the coupon template ID and a time-limited session token. The QR code is only valid while the merchant keeps the QR code display open; once the merchant navigates away or closes the display, the QR code becomes invalid and users cannot claim coupons using it.

**Why this priority**: This is the foundational merchant-side functionality that enables the QR code claim flow. Without QR code generation, customers cannot scan to claim coupons.

**Independent Test**: Can be fully tested by having a merchant navigate to a coupon detail page and generate a QR code, then verifying the QR code contains the correct template ID. Delivers value by providing a convenient distribution method for coupons.

**Acceptance Scenarios**:

1. **Given** a merchant viewing a coupon template detail page in Collections, **When** they access the QR code generation feature, **Then** a QR code is displayed containing the coupon template ID.
2. **Given** a merchant viewing an active coupon template, **When** the QR code is generated, **Then** the QR code is scannable and contains valid template identification data.
3. **Given** a merchant viewing a coupon template with zero remaining quantity, **When** they generate a QR code, **Then** the QR code is still generated but users scanning it will receive an appropriate error message when attempting to claim.
4. **Given** a merchant generates a QR code, **When** they view it, **Then** the QR code is clearly visible for customers to scan while the display remains open.
5. **Given** a merchant has generated a QR code, **When** they navigate away from or close the QR code display, **Then** the QR code becomes invalid and users scanning it will receive an error message.

---

### User Story 2 - User Scans QR Code to Claim Coupon (Priority: P1)

A user wants to claim a coupon by scanning a QR code provided by a merchant. The user opens the scan feature from the bottom navigation, points their camera at the merchant's QR code, and the system automatically claims the coupon and adds it to their collection. A success message confirms the claim.

**Why this priority**: This is the core user-facing functionality that delivers the primary value - convenient coupon claiming through QR code scanning. This completes the merchant-to-user flow.

**Independent Test**: Can be fully tested by having a user scan a valid QR code and verifying the coupon appears in their collection with a success notification. Delivers immediate value for customer engagement.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the main screen, **When** they tap the "Scan to Claim Coupon" button and scan a valid QR code, **Then** the coupon is claimed and added to their exclusive coupon collection, and a success message is displayed.
2. **Given** a user scanning a QR code, **When** the QR code contains an invalid or non-existent template ID, **Then** an error message is displayed explaining the QR code is invalid.
3. **Given** a user scanning a QR code, **When** the template has zero remaining quantity, **Then** an error message indicates the coupon is no longer available.
4. **Given** a user scanning a QR code, **When** they have already claimed a coupon from this template and the template has remaining quantity, **Then** they can successfully claim another coupon from the same template.
5. **Given** a user who is not logged in, **When** they attempt to scan a QR code, **Then** they are prompted to log in before proceeding with the claim.
6. **Given** a user scanning a QR code, **When** the merchant has closed the QR code display (making the QR code invalid), **Then** an error message indicates the QR code is no longer valid.

---

### User Story 3 - User Views Claimed Coupon in Collection (Priority: P2)

A user who has successfully claimed a coupon via QR code can view the newly received coupon in their exclusive coupon collection. The coupon displays the acquisition method as "QR code claim" so the user knows how they obtained it.

**Why this priority**: This completes the user journey by confirming receipt and provides transparency about how the coupon was obtained. It enables users to verify successful claims.

**Independent Test**: Can be tested by checking the user's coupon collection after scanning a QR code, verifying the coupon appears with correct details and acquisition method labeled appropriately.

**Acceptance Scenarios**:

1. **Given** a user who has claimed a coupon via QR code, **When** they view their exclusive coupon collection, **Then** the new coupon is visible with all details.
2. **Given** a user viewing a coupon claimed via QR code, **When** they view the coupon details, **Then** the acquisition method is displayed as "QR code claim" (stored as `'qr_claim'` in the database).
3. **Given** a user with multiple coupons from different sources, **When** they view their collection, **Then** they can distinguish coupons by their acquisition method.

---

### Edge Cases

- What happens when a user scans a QR code for a template that has expired? → Handled by FR-018: System validates template expiry_date and returns error message "優惠券已過期"
- How does the system handle scanning a QR code when the camera permission is denied? → Handled by T036: System displays user-friendly message with instructions to enable camera permission in device settings, scanner UI is disabled until permission granted
- What happens if the QR code format is corrupted or contains unexpected data? → Handled by T032: System validates JSON format and required fields, displays error message "無效的 QR Code 格式，請掃描正確的優惠券 QR Code" for invalid format or "QR Code 缺少必要資訊" for missing fields
- How does the system handle network errors during the claim process? → Handled by T033 and T035: Frontend implements retry logic (up to 2 retries with exponential backoff for 5xx/timeout errors), displays "無法連線，請檢查網路後重試" message after retries exhausted
- What happens when multiple users scan the same QR code simultaneously and only one coupon remains?
- How does the system handle scanning a QR code for a template that belongs to a different store (if cross-store restrictions apply)? → Handled by T028: Backend validates merchant ownership of template's store, returns 403 error with message "Unauthorized template access" (backend) / "無權限存取此優惠券" (frontend)
- What happens when a user scans a QR code while already on a different screen or in a different app state? → Handled by T030: Scanner component implements duplicate-scan prevention, disables scanner after successful scan, requires manual reopening for next scan, prevents processing same QR code multiple times within 2 seconds
- What happens when a user scans a QR code after the merchant has closed the QR code display?
- How does the system handle session token expiration or invalidation?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow merchants to generate a QR code for any coupon template in their Collections detail page.
- **FR-001a**: System MUST generate a unique session token on the backend when a merchant requests a QR code for a template.
- **FR-001b**: System MUST store active QR code sessions (template ID, session token, merchant, creation time) in database or cache for validation.
- **FR-002**: System MUST encode the coupon template ID and the generated session token in the QR code as a JSON object (e.g., `{"template_id": 123, "session_token": "abc123"}`) that can be reliably parsed by the user app.
- **FR-003**: System MUST display the generated QR code clearly on the merchant's coupon detail page while the display remains open. QR code MUST be at least 280x280 pixels in size and readable at a distance of 30cm to ensure reliable scanning by user devices.
- **FR-003a**: System MUST invalidate the QR code session in storage when the merchant navigates away from or closes the QR code display. Frontend MUST call backend API endpoint on component unmount/navigation to invalidate the session.
- **FR-004**: System MUST provide a "Scan to Claim Coupon" button in the user app's main interface (bottom navigation area).
- **FR-005**: System MUST open the device camera when the user taps the scan button, requesting camera permissions if not already granted.
- **FR-006**: System MUST parse the QR code JSON content to extract the coupon template ID and session token when scanned.
- **FR-007**: System MUST validate that the extracted template ID exists and is active before processing the claim.
- **FR-007a**: System MUST validate that the QR code session token exists in active sessions storage and is still valid before processing the claim.
- **FR-008**: System MUST check that the template has remaining quantity available before allowing the claim.
- **FR-009**: System MUST require user authentication before processing a QR code claim.
- **FR-010**: System MUST create a new coupon instance from the template and assign it to the claiming user when a valid QR code is scanned.
- **FR-011**: System MUST set the coupon's acquisition method to `'qr_claim'` to indicate it was claimed via QR code.
- **FR-012**: System MUST display a success message to the user after a successful claim operation.
- **FR-013**: System MUST display appropriate error messages when claim operations fail. Specific error messages MUST be:
  - Invalid QR code format: "無效的 QR Code 格式，請掃描正確的優惠券 QR Code" (frontend) or "Invalid QR code format" (backend)
  - Expired/invalid session token: "QR Code 已過期，請商家重新生成" (frontend) or "QR code session expired or invalid" (backend)
  - Template out of stock: "優惠券已領取完畢" (frontend) or "Coupon template out of stock" (backend)
  - Template expired: "優惠券已過期" (frontend) or "Coupon template expired" (backend)
  - Template not found: "找不到優惠券" (frontend) or "Template not found" (backend)
  - Cross-store access attempt: "無權限存取此優惠券" (frontend) or "Unauthorized template access" (backend)
  - Network errors: "無法連線，請檢查網路後重試" (frontend) or appropriate HTTP status codes (backend)
- **FR-018**: System MUST validate that the template's expiry_date is in the future (or null) before processing a QR code claim. If the template has expired, the system MUST return an error message indicating the coupon template has expired.
- **FR-014**: System MUST decrement the template's remaining quantity by one after a successful claim.
- **FR-015**: System MUST display claimed coupons in the user's exclusive coupon collection with the correct acquisition method label.
- **FR-016**: System MUST handle race conditions when multiple users attempt to claim the last available coupon simultaneously.
- **FR-017**: System MUST distinguish QR code claim functionality from coupon redemption functionality in both UI and backend logic.

### Key Entities *(include if feature involves data)*

- **Coupon Template**: Represents the template that merchants create and generate QR codes for. Contains template ID, remaining quantity, and active status.
- **QR Code Session**: Server-side record tracking active QR code generation sessions. Contains template ID, unique session token, associated merchant, creation timestamp, and active status. Stored in database or cache.
- **QR Code**: Encoded representation containing the coupon template ID and a session token, generated by the merchant app and scanned by the user app. Valid only while the corresponding QR Code Session is active in backend storage.
- **Coupon Instance**: Individual coupon created from a template when a user successfully claims via QR code. Contains reference to template, assigned user, and acquisition method.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully claim a coupon by scanning a QR code in under 5 seconds from button tap to success confirmation.
- **SC-002**: QR code generation completes and displays within 1 second of merchant activation.
- **SC-003**: 95% of valid QR code scans result in successful coupon claims (excluding cases where template is out of stock or expired).
- **SC-004**: System correctly handles 100% of invalid QR code formats with appropriate error messages (no crashes or undefined behavior).
- **SC-005**: Users can distinguish QR code-claimed coupons from other acquisition methods in their collection view.
- **SC-006**: Merchants can generate and share QR codes for all active coupon templates without errors.

## Assumptions

- QR codes will encode template IDs and session tokens as JSON objects (e.g., `{"template_id": 123, "session_token": "abc123"}`).
- The claim API endpoint will be similar to existing consolidate_coupon but triggered by template ID and session token from QR code rather than phone number.
- QR codes are only valid while the merchant has the QR code display open; closing the display invalidates the session.
- One QR code scan results in one coupon claim (one-to-one relationship).
- Users can claim multiple coupons from the same template via QR code if quantity allows (no one-per-user limit enforced for QR code claims).
- QR codes are generated on-demand when merchants view the detail page and include a time-limited session token. Each merchant request for a QR code creates a new session (even for the same template), generating a new unique session token. Merchants can generate multiple QR code sessions for the same template simultaneously, each with its own independent validity period.
- The scan button UI will match the style of existing scan buttons in the merchant app for consistency.
- Camera permissions follow standard mobile app patterns (request on first use, handle denial gracefully).
- Network connectivity is required for claim operations (no offline claim capability).
- The feature applies to "exclusive" (專屬優惠) coupon types in Collections, not "store" (隨取及用) coupons.

## Dependencies

- Existing coupon template management system (merchant can view template details).
- Existing user authentication system (users must be logged in to claim).
- Existing coupon collection system (claimed coupons appear in user's exclusive collection).
- Camera and QR code scanning libraries in the mobile app framework.
- Backend API endpoint for processing QR code-based coupon claims.
- Backend API endpoint for invalidating QR code sessions (called by frontend on component unmount/navigation).
- Backend session storage system (database or cache) for tracking active QR code sessions.

## Out of Scope

- QR code printing or physical distribution mechanisms (merchants handle this externally).
- Batch QR code generation for multiple templates.
- QR code printing or saving for later use (QR codes are only valid while merchant display is open).
- Analytics tracking for QR code scans (may be added in future iterations).
- Custom QR code styling or branding (uses standard QR code format).
- Offline QR code scanning with deferred claim processing.
