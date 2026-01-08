# Feature Specification: Unified Redemption QR Code

**Feature Branch**: `001-unified-redemption-qr`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "現狀 (As-Is)： 目前商家進行核銷時，必須先點擊特定的優惠券，進入內頁後生成該優惠券的專屬 QR Code 供消費者掃描。目標 (To-Be)： 請重構核銷流程，改為「統一入口」模式。已經有在Merchant-Mobile-Frontend實作前端按鈕，但還未實現後端邏輯。交互邏輯： 當按下此按鈕時，顯示一個統一的核銷 QR Code。掃描行為： 用戶端（消費者）掃描此統一條碼後，即觸發原本的核銷驗證邏輯。廢棄與保留 (Deprecation & Retention)：停用： 請停用原本「點進特定優惠券才能核銷」的舊流程。保留： 後端的核銷驗證邏輯（API 呼叫與驗證機制）保持不變，僅改變觸發入口與條碼生成的參數源（從單一券改為統一識別）。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Merchant Generates Unified Redemption QR Code (Priority: P1)

A merchant wants to redeem coupons for customers without having to navigate to each individual coupon page. They access the unified redemption button on the coupon list page, which displays a single QR code that works for all their active coupons.

**Why this priority**: This is the core functionality that enables the unified redemption flow. Without this, merchants cannot use the new workflow.

**Independent Test**: Can be fully tested by a merchant logging in, navigating to the coupon list page, clicking the unified redemption button, and verifying that a QR code is displayed in a modal. This delivers immediate value by showing merchants they can access redemption without navigating to individual coupon pages.

**Acceptance Scenarios**:

1. **Given** a merchant is logged in and viewing the coupon list page, **When** they click the unified redemption button (條碼核銷), **Then** a new unified redemption code is generated, and a modal appears displaying a QR code containing the newly generated code
2. **Given** the QR code modal is displayed, **When** the merchant closes the modal, **Then** the modal closes and they return to the coupon list page
3. **Given** a merchant has no active coupons, **When** they click the unified redemption button, **Then** the QR code is still displayed (as it identifies the merchant, not specific coupons)

---

### User Story 2 - Consumer Scans Unified QR Code and Selects Coupon (Priority: P1)

A consumer scans the unified QR code displayed by a merchant. The consumer app recognizes the merchant identifier and presents the consumer with a list of their available coupons from that merchant, allowing them to select which coupon to redeem.

**Why this priority**: This completes the redemption flow from the consumer perspective. Without this, consumers cannot use the unified QR code to redeem coupons.

**Independent Test**: Can be fully tested by a consumer scanning the unified QR code, verifying that their available coupons for that merchant are displayed, and selecting a coupon to proceed with redemption. This delivers value by allowing consumers to redeem coupons without the merchant needing to navigate to specific coupon pages.

**Acceptance Scenarios**:

1. **Given** a consumer has the app open and scans a unified QR code from a merchant, **When** the QR code is successfully scanned, **Then** the consumer is presented with a list of their available coupons from that merchant
2. **Given** a consumer is viewing their available coupons for a merchant, **When** they select a coupon, **Then** the redemption code from the scanned QR code is auto-filled in the redemption form, the consumer can edit it if needed, and upon submission the system validates the unified redemption code at merchant/store level, then proceeds with standard coupon redemption validation (ownership, expiration, redemption status) and completes the redemption if all validations pass
3. **Given** a consumer has no available coupons for a merchant, **When** they scan the unified QR code, **Then** they see a message indicating they have no coupons available for redemption from this merchant
4. **Given** a consumer scans an invalid or unrecognized QR code, **When** the scan completes, **Then** they see an appropriate error message

---

### User Story 3 - Deprecate Individual Coupon Redemption Entry (Priority: P2)

The old workflow where merchants must navigate to individual coupon pages to generate redemption QR codes is disabled, ensuring all redemption flows use the unified entry point.

**Why this priority**: This ensures consistency and prevents confusion between old and new workflows. However, it can be implemented after the new flow is working, so it's lower priority than the core functionality.

**Independent Test**: Can be fully tested by attempting to access the individual coupon redemption page (if it still exists in the UI) and verifying that it either redirects to the unified flow or is no longer accessible. This delivers value by ensuring a single, consistent redemption workflow.

**Acceptance Scenarios**:

1. **Given** a merchant is viewing a specific coupon detail page, **When** they attempt to access the individual redemption QR code generation (if such a button/link exists), **Then** the QR code generation feature is no longer available, but phone number functionality for sending/consolidating coupons remains accessible
2. **Given** the old individual coupon redemption flow is deprecated, **When** merchants use the unified redemption button, **Then** they can still successfully redeem coupons using the unified QR code

---

### Edge Cases

- **Merchant with no store**: If a merchant has no store associated with their account, the unified QR code generation MUST return an error response with HTTP status 400 (Bad Request), error code "NO_STORE", and error message (e.g., "無法生成統一條碼：商家尚未設定店鋪資訊"). The response format MUST follow the standard API error structure: `{"error": {"code": "NO_STORE", "message": "無法生成統一條碼：商家尚未設定店鋪資訊"}}`. The system MUST validate store existence before generating unified redemption codes.
- How does the system handle a consumer scanning a unified QR code when they have multiple coupons from the same merchant? (All eligible coupons should be displayed)
- What happens when a consumer scans the unified QR code but has already redeemed all their coupons from that merchant? (Show appropriate message)
- How does the system handle expired or inactive coupons when displaying available coupons to consumers? (Only show active, non-expired coupons)
- What happens if a merchant's store information is incomplete or invalid? (QR code generation should handle gracefully or show error)
- How does the system handle network errors when generating or scanning the unified QR code? (Show appropriate error messages)
- What happens when a consumer scans the unified QR code but is not logged in? (Redirect to login, then return to redemption flow)
- How does the system handle concurrent redemptions when multiple consumers scan the same unified QR code? (Each consumer sees their own available coupons)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a new unified redemption code and corresponding QR code each time the merchant clicks the unified redemption button (code regeneration on each button press)
- **FR-002**: System MUST display the unified QR code in a modal overlay when the merchant activates the unified redemption button
- **FR-003**: System MUST encode a unified redemption code (6-digit numeric string format, e.g., "123456") in the unified QR code that identifies the merchant/store and works for all coupons from that merchant. The code format is 6-digit numeric only (0-9 digits).
- **FR-004**: System MUST allow consumers to scan the unified QR code using the consumer mobile app
- **FR-005**: System MUST identify the merchant/store from the scanned unified QR code
- **FR-006**: System MUST retrieve and display all available (active, non-expired, not yet redeemed) coupons that the consumer holds from the identified merchant
- **FR-007**: System MUST allow consumers to select a specific coupon from their available coupons for redemption
- **FR-016**: System MUST auto-fill the redemption code from the scanned unified QR code into the redemption form when consumer selects a coupon, and allow the consumer to edit the code if needed
- **FR-008**: System MUST validate the unified redemption code at the merchant/store level to authenticate the merchant identity when a consumer scans the unified QR code (validates that the code matches the store's unified_redeem_code)
- **FR-009**: System MUST trigger the existing redemption validation logic when a consumer selects a coupon for redemption via the unified QR code flow (after unified code validation passes). The unified code validation (FR-008) must complete successfully before coupon-level validation begins.
- **FR-015**: System MUST preserve all existing coupon-level validation rules (coupon ownership, redemption status, expiration, etc.) when processing redemptions initiated through the unified QR code - the unified code validation is separate from and precedes coupon-level validation
- **FR-010**: System MUST disable or remove the ability for merchants to generate individual coupon-specific redemption QR codes from coupon detail pages
- **FR-017**: System MUST preserve the phone number functionality on individual coupon detail pages, as it is used for sending/consolidating coupons to users (not for redemption), not for generating redemption QR codes
- **FR-011**: System MUST handle cases where a consumer has no available coupons for a merchant (display appropriate message)
- **FR-012**: System MUST handle cases where the scanned QR code is invalid or unrecognized (display appropriate error message)
- **FR-013**: System MUST require merchant authentication before generating the unified QR code
- **FR-014**: System MUST require consumer authentication before displaying available coupons or processing redemption

### Key Entities *(include if feature involves data)*

- **Unified Redemption QR Code**: A QR code that contains a unified redemption code (string format, similar to individual coupon redemption codes) that identifies the merchant/store and works for all coupons from that merchant. The QR code format follows the same design pattern as individual coupon redemption QR codes, but the redemption code is merchant/store-level rather than coupon-specific.

- **Unified Redemption Code**: A redemption code string (6-digit numeric format, e.g., "123456") that is generated and managed at the merchant/store level. This code is encoded in the unified QR code and can be used to redeem any of the consumer's available coupons from that merchant. The code uses the same numeric format as individual coupon redemption codes but applies to all coupons from the merchant rather than a single coupon template.

- **Available Coupons List**: The collection of coupons that a consumer holds from a specific merchant that are eligible for redemption (active, not expired, not yet redeemed). This list is displayed to consumers after they scan the unified QR code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Merchants can generate and display the unified redemption QR code within 2 seconds of clicking the unified redemption button. Measurement boundaries: Start = button click event, End = QR code fully rendered in modal (includes network latency for API call, code generation, QR code rendering, and modal display animation). Target: 95th percentile response time ≤ 2 seconds.
- **SC-002**: Consumers can successfully scan the unified QR code and view their available coupons within 3 seconds of scanning. Measurement boundaries: Start = QR code scan completion (camera recognizes code), End = available coupons list fully displayed on screen (includes API call to validate code and retrieve coupons, data processing, and UI rendering). Target: 95th percentile response time ≤ 3 seconds.
- **SC-003**: 95% of unified QR code scans result in successful merchant identification and coupon list display (measured as percentage of successful API responses from GET /api/unified-redemption/{code}/)
- **SC-004**: Redemption success rate through the unified QR code flow matches or exceeds the redemption success rate of the previous individual coupon flow (baseline: measure redemption success rate from existing flow over 30-day period before implementation, then compare post-implementation)
- **SC-005**: Merchants report reduced time to initiate redemption process by at least 50% compared to navigating to individual coupon pages (measured as: time from coupon list page to QR code display in unified flow vs. time from coupon list page → coupon detail page → QR code display in old flow)
- **SC-006**: Zero instances of consumers being able to redeem coupons they do not own or that are not eligible for redemption (maintains existing security validation)
- **SC-007**: All redemption transactions initiated through unified QR code flow are successfully recorded and logged in the system

## Clarifications

### Session 2025-01-27

- Q: What format should the unified QR code use to encode the merchant/store identifier? → A: The unified QR code uses the same format as the old individual coupon redemption design - a redemption code string (6-digit numeric code, digits 0-9 only). The difference is that the old design generated a redemption code per coupon template, while the unified design generates a single redemption code that works for all coupons from that merchant/store.
- Q: How should the unified redemption code be validated when a consumer selects a specific coupon? → A: Unified code validates at merchant/store level (proves merchant identity), then consumer selects coupon and redemption proceeds with standard coupon validation (ownership, expiration, redemption status, etc.). The unified code does not need to match individual coupon template codes.
- Q: When should the unified redemption code be regenerated/refreshed? → A: Regenerate each time merchant clicks the unified redemption button (matches old design pattern where code changes when redemption page is accessed).
- Q: After a consumer scans the unified QR code and selects a coupon, do they still need to manually enter the redemption code, or is it automatically used from the scan? → A: Redemption code is auto-filled from scan, consumer can edit if needed (improves UX while maintaining flexibility for corrections).
- Q: Should the entire coupon detail redemption page be removed/disabled, or only the QR code generation part? → A: Remove only the QR code generation from individual coupon pages. The phone number section on individual coupon pages is for sending/consolidating coupons to users (not for redemption), so this functionality should be preserved.

## Assumptions

- The unified redemption button UI component already exists in the Merchant-Mobile-Frontend (as stated in requirements)
- The QR code modal component already exists and can display QR codes (observed in codebase)
- Each merchant has exactly one store associated with their account (based on codebase structure)
- The consumer app has QR code scanning capabilities
- The existing redemption validation API endpoints can be reused without modification (only the entry point and QR code generation changes)
- The unified QR code contains a redemption code string (6-digit numeric format, digits 0-9 only) that is merchant/store-level rather than coupon-specific
- Consumers may have multiple coupons from the same merchant, and all eligible coupons should be displayed for selection
- The unified redemption code is generated and managed at the merchant/store level, not per individual coupon template

## Dependencies

- Merchant-Mobile-Frontend: Unified redemption button and QR code modal components (already implemented per requirements)
- Backend API: Endpoint to generate or retrieve merchant/store identifier for QR code encoding (may need to be created or may use existing merchant profile/store endpoints)
- Consumer Mobile App: QR code scanning functionality and ability to parse merchant identifier from scanned QR code
- Consumer Mobile App: API endpoint or logic to retrieve consumer's available coupons for a specific merchant
- Existing redemption validation APIs: Must remain functional and be callable from the new unified flow

## Out of Scope

- Changes to the core redemption validation logic (this remains unchanged per requirements)
- Modifications to coupon data models or redemption record structures
- Changes to how redemption codes are generated or validated (only the entry point changes)
- Changes to phone number functionality on individual coupon pages (this is for coupon distribution, not redemption)
- Consumer app UI redesign (only the flow entry point changes)
- Support for multiple stores per merchant (assumes one store per merchant)
- Batch redemption of multiple coupons in a single transaction
- Offline QR code generation or scanning capabilities
