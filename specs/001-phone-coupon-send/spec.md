# Feature Specification: Phone-Based Coupon Send

**Feature Branch**: `001-phone-coupon-send`
**Created**: 2026-01-05
**Status**: Draft
**Input**: User description: "Add a feature that allows the user to enter their mobile phone number in the user side app. This allows the merchant side app to send coupons to specific users using this phone number. The merchant side already has a field to enter the phone number which is at Mobile-Merchant-Frontend/app/(coupons)/[id].tsx page, research the api and models to let the merchant enter the user's phone number and directly send the coupons to his/her coupon collection page."

## Clarifications

### Session 2026-01-05

- Q: How should phone numbers be masked when displayed in the user's profile? → A: Show first 4 and last 2 digits (e.g., `0912****78`) - balanced privacy/recognition for Taiwan format.
- Note: User profile/settings page confirmed at `Mobile-Frontend/app/OptionsMenu/index.tsx`.
- Note: The `consolidate-coupon` API currently uses `AllowAny` permission - must be changed to `IsAuthenticated` (merchant only) for security.
- Note: Merchants can send coupons to unregistered phone numbers; coupons are stored as "pending" and auto-assigned when the user registers that phone number.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Registers Phone Number (Priority: P1)

A user wants to register their mobile phone number in the user-side app so that merchants can send them personalized coupons directly. The user navigates to their profile settings, enters their phone number, and saves it. The phone number is validated and stored, making the user discoverable by merchants for coupon distribution.

**Why this priority**: This is the foundational requirement - without users having registered phone numbers, merchants cannot send them coupons. This enables the entire phone-based coupon distribution flow.

**Independent Test**: Can be fully tested by having a user register a phone number and verifying it appears in their profile. Delivers value by preparing the user to receive direct coupons.

**Acceptance Scenarios**:

1. **Given** a logged-in user without a registered phone number, **When** they navigate to profile settings and enter a valid phone number, **Then** the phone number is saved and displayed in their profile.
2. **Given** a logged-in user, **When** they enter an invalid phone number format, **Then** an error message is displayed and the phone number is not saved.
3. **Given** a logged-in user, **When** they enter a phone number already registered by another user, **Then** an error message indicates the phone number is already in use.
4. **Given** a logged-in user with a registered phone number, **When** they view their profile, **Then** their phone number is displayed (partially masked for privacy).

---

### User Story 2 - Merchant Sends Coupon via Phone Number (Priority: P1)

A merchant wants to send a specific coupon directly to a customer using their phone number. On the coupon redemption page, the merchant enters the customer's phone number and confirms the send action. The coupon is immediately added to the customer's coupon collection page.

**Why this priority**: This is the core merchant-side functionality that delivers the primary business value - targeted coupon distribution to specific customers.

**Independent Test**: Can be fully tested by having a merchant enter a phone number and send a coupon, then verifying the coupon appears in the target user's collection. Delivers immediate value for customer engagement.

**Acceptance Scenarios**:

1. **Given** a merchant on the coupon detail page with a valid coupon template, **When** they enter a registered phone number and confirm send, **Then** the coupon is added to the user's exclusive coupon collection.
2. **Given** a merchant on the coupon detail page, **When** they enter a phone number not yet registered in the system, **Then** the coupon is created as "pending" and associated with that phone number for future claim.
3. **Given** a merchant with a coupon template with zero remaining quantity, **When** they attempt to send a coupon, **Then** an error message indicates no coupons are available.
4. **Given** a merchant sending a coupon successfully, **When** the operation completes, **Then** the template's remaining quantity is decremented by one.

---

### User Story 3 - User Receives and Views Sent Coupon (Priority: P2)

A user who has been sent a coupon by a merchant can view the newly received coupon in their exclusive coupon collection. The coupon displays the acquisition method as "phone consolidation" so the user knows it was sent directly to them.

**Why this priority**: This completes the user journey by confirming receipt and provides transparency about how the coupon was obtained.

**Independent Test**: Can be tested by checking the user's coupon collection after a merchant sends a coupon, verifying the coupon appears with correct details and acquisition method.

**Acceptance Scenarios**:

1. **Given** a user who has been sent a coupon via phone number, **When** they view their exclusive coupon collection, **Then** the new coupon is visible with all details.
2. **Given** a user viewing a coupon received via phone consolidation, **When** they view the coupon details, **Then** the acquisition method is displayed as "phone consolidation" or equivalent label.
3. **Given** a user with multiple coupons from different sources, **When** they view their collection, **Then** they can distinguish coupons by their acquisition method.

---

### User Story 4 - User Updates Phone Number (Priority: P3)

A user wants to change their registered phone number. They navigate to profile settings, enter a new phone number, and save. The old number is replaced, and the new number becomes active for receiving coupons.

**Why this priority**: Provides flexibility for users whose phone numbers change, but is not critical for initial feature launch.

**Independent Test**: Can be tested by updating a phone number and verifying the new number is stored and the old number is no longer associated with the account.

**Acceptance Scenarios**:

1. **Given** a logged-in user with an existing phone number, **When** they update to a new valid phone number, **Then** the new phone number replaces the old one.
2. **Given** a user updating their phone number, **When** the new number is already registered by another user, **Then** an error is displayed and the original number is retained.

---

### User Story 5 - User Claims Pending Coupons on Phone Registration (Priority: P2)

A user registers their phone number and discovers that a merchant has already sent them coupons before they registered. Upon saving their phone number, the system automatically assigns any pending coupons associated with that phone number to their collection.

**Why this priority**: This enables merchants to pre-send coupons to customers before they install the app, increasing customer acquisition and engagement.

**Independent Test**: Can be tested by having a merchant send a coupon to an unregistered phone number, then having a new user register with that phone number and verifying the coupon appears in their collection.

**Acceptance Scenarios**:

1. **Given** a merchant has sent a coupon to an unregistered phone number, **When** a user registers that phone number, **Then** the pending coupon is automatically added to their exclusive coupon collection.
2. **Given** multiple pending coupons exist for a phone number, **When** a user registers that phone number, **Then** all pending coupons are claimed and appear in their collection.
3. **Given** a pending coupon has expired before the user registers, **When** a user registers that phone number, **Then** the expired coupon is not added to their collection (or marked as expired).

---

### Edge Cases

- What happens when a merchant sends a coupon to their own phone number? The system allows this (merchants can be users too).
- How does the system handle phone numbers with different formats (with/without country code, spaces, dashes)? Phone numbers are normalized (digits only) before storage and comparison.
- What happens if a user deletes their phone number after receiving coupons? Previously received coupons remain in their collection; only future sends are affected.
- What happens if the merchant's coupon template expires while trying to send? The send fails with an appropriate expiration error.
- What happens if a user tries to register without providing a phone number? Phone number registration is optional; users can still use other features without it.
- What happens to pending coupons if no user ever registers with that phone number? Pending coupons remain in the system until they expire; expired pending coupons are cleaned up during normal expiration processes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to add a phone number to their profile via the user-side app.
- **FR-002**: System MUST validate phone number format before saving (Taiwan mobile format: 10 digits starting with "09").
- **FR-003**: System MUST enforce unique phone numbers across all user accounts.
- **FR-004**: System MUST allow merchants to send coupons to users by entering the recipient's phone number.
- **FR-005**: System MUST look up users by phone number when merchants attempt to send coupons.
- **FR-006**: System MUST create an exclusive coupon for the target user when a merchant sends via phone number (if user exists).
- **FR-007**: System MUST set the acquisition method to "consolidate" for phone-sent coupons.
- **FR-008**: System MUST decrement the coupon template's remaining quantity when a coupon is sent.
- **FR-009**: System MUST allow merchants to send coupons to unregistered phone numbers by creating a "pending" coupon associated with that phone number.
- **FR-010**: System MUST automatically assign pending coupons to a user when they register the associated phone number.
- **FR-011**: System MUST display the user's phone number masked as first 4 + last 2 digits (e.g., `0912****78`) in their profile settings.
- **FR-012**: System MUST allow users to update their registered phone number.
- **FR-013**: System MUST display the acquisition method on coupons in the user's collection.
- **FR-014**: System MUST restrict the consolidate-coupon API endpoint to authenticated merchants only (security fix required).
- **FR-015**: System MUST skip expired pending coupons when assigning to a newly registered phone number.

### Key Entities

- **StudentProfile**: Extended to include phone_number field (unique, optional). Represents the user's profile with contact information for coupon delivery.
- **Coupon**: Individual coupon instance with acquisition_method indicating how the user received it (draw, consolidate, transfer, public_pool). Extended with `pending_phone_number` field to store the target phone number when the user doesn't exist yet (null when assigned to a user).
- **CouponTemplate**: Blueprint for coupons with remaining_quantity tracking. Used by merchants to send individual coupons.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can register a phone number in under 30 seconds from profile settings.
- **SC-002**: Merchants can send a coupon to a user via phone number in under 15 seconds.
- **SC-003**: Sent coupons appear in the recipient's collection within 5 seconds of sending.
- **SC-004**: 100% of phone-sent coupons display the correct acquisition method in user's collection.
- **SC-005**: Phone number validation prevents 100% of invalid format submissions.
- **SC-006**: Users can identify phone-sent coupons by acquisition method labeling.
- **SC-007**: 100% of pending coupons are automatically assigned when a user registers the associated phone number.
- **SC-008**: Merchants receive confirmation when sending coupons to both registered and unregistered phone numbers.

## Assumptions

- Phone numbers follow Taiwan mobile format: 10 digits starting with "09" (e.g., 0912345678).
- The existing `consolidate-coupon` backend endpoint can be reused for merchant-to-user coupon sending (requires permission fix from `AllowAny` to `IsAuthenticated`).
- The user-side app has a profile/settings page at `Mobile-Frontend/app/OptionsMenu/index.tsx` where phone number input can be added.
- The merchant-side app's phone number input field at `Mobile-Merchant-Frontend/app/(coupons)/[id].tsx` will be connected to the consolidate functionality.
- Users must be logged in to register a phone number.
- Merchants must be logged in and own the coupon template to send coupons.
- The StudentProfile model already has a phone_number field defined (based on codebase research).
