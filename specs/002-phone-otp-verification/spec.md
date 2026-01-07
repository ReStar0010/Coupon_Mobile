# Feature Specification: Phone OTP Verification

**Feature Branch**: `002-phone-otp-verification`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "Add SMS OTP verification via Twilio before saving any phone number to prevent coupon theft. Users can currently change phone numbers freely, allowing theft of pending coupons meant for others."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New User Registers Phone Number (Priority: P1)

A new user wants to link their phone number to their account to receive coupons. They enter their phone number, receive a verification code via SMS, and enter it to confirm ownership. Upon successful verification, their phone number is saved and any pending coupons sent to that number are automatically claimed.

**Why this priority**: This is the core functionality that enables secure phone number registration. Without this, users cannot safely claim coupons, and the coupon theft vulnerability remains open.

**Independent Test**: Can be fully tested by creating a new user account, entering a phone number, receiving the OTP via SMS, entering the code, and verifying the phone is saved to the profile.

**Acceptance Scenarios**:

1. **Given** a logged-in user without a phone number, **When** they enter a valid Taiwan mobile number (09XXXXXXXX format) and tap "Send OTP", **Then** they receive a 6-digit verification code via SMS within 30 seconds
2. **Given** a user has received an OTP, **When** they enter the correct 6-digit code within 10 minutes, **Then** their phone number is saved to their profile and they see a success confirmation
3. **Given** a user successfully verifies their phone number, **When** there are pending coupons assigned to that phone number, **Then** those coupons are automatically transferred to the user's account

---

### User Story 2 - Prevent Phone Number Theft (Priority: P1)

A malicious user attempts to change their phone number to someone else's number to steal their pending coupons. The system prevents this by requiring OTP verification for any phone number change, ensuring only the legitimate phone owner can claim associated coupons.

**Why this priority**: This directly addresses the security vulnerability. Without this protection, users can arbitrarily change phone numbers and claim others' coupons.

**Independent Test**: Can be tested by attempting to save a phone number without OTP verification and confirming the system blocks direct phone updates.

**Acceptance Scenarios**:

1. **Given** a user attempts to update their phone number directly (bypassing OTP flow), **When** they submit the request, **Then** the system rejects the update and directs them to use the OTP verification process
2. **Given** a phone number is already verified and linked to another user, **When** a different user attempts to verify the same phone number, **Then** the system rejects the OTP request with an appropriate message

---

### User Story 3 - User Changes Phone Number (Priority: P2)

An existing user wants to update their phone number to a new one. They must go through the same OTP verification process to prove ownership of the new number before the change takes effect.

**Why this priority**: Important for users who change phones or carriers, but less critical than initial registration and security protection.

**Independent Test**: Can be tested by having a user with an existing verified phone number attempt to change to a new number through the OTP process.

**Acceptance Scenarios**:

1. **Given** a user with an existing verified phone number, **When** they initiate a phone number change, **Then** the system requires OTP verification for the new number
2. **Given** a user successfully verifies a new phone number, **When** the verification completes, **Then** the old phone number is replaced with the new verified number
3. **Given** a user had unclaimed coupons sent to their old phone number, **When** they successfully verify a new phone number, **Then** those unclaimed coupons are transferred to their account (coupons follow the person)

---

### User Story 4 - OTP Resend with Cooldown (Priority: P2)

A user who didn't receive the OTP or whose code expired needs to request a new one. The system allows resending after a cooldown period to prevent abuse.

**Why this priority**: Improves user experience for legitimate users who encounter SMS delivery issues.

**Independent Test**: Can be tested by requesting an OTP, waiting for the cooldown period, and confirming a new OTP can be requested.

**Acceptance Scenarios**:

1. **Given** a user has requested an OTP, **When** less than 60 seconds have passed, **Then** the resend button is disabled and shows remaining cooldown time
2. **Given** a user has requested an OTP, **When** 60 seconds have passed, **Then** the user can tap "Resend" to receive a new code

---

### User Story 5 - Rate Limiting Protection (Priority: P3)

The system prevents abuse by limiting the number of OTP requests per phone number and the number of verification attempts per OTP.

**Why this priority**: Security hardening that prevents brute-force attacks but doesn't block core functionality.

**Independent Test**: Can be tested by making multiple OTP requests in succession and confirming rate limits are enforced.

**Acceptance Scenarios**:

1. **Given** a user has requested 3 OTPs for the same phone number within 1 hour, **When** they attempt a 4th request, **Then** the system rejects the request and shows a "try again later" message
2. **Given** a user has entered 5 incorrect OTP codes, **When** they attempt a 6th entry, **Then** the system invalidates the OTP and requires requesting a new code
3. **Given** an OTP was sent 10 minutes ago, **When** the user attempts to verify, **Then** the system rejects the code as expired

---

### Edge Cases

- What happens when the user's phone cannot receive SMS (airplane mode, blocked number)?
  - User sees an error message and can retry later; system logs delivery failure
- What happens when the user enters an incorrectly formatted phone number?
  - Form validation prevents submission and shows format requirements (09XXXXXXXX)
- What happens when the user closes the app mid-verification?
  - OTP remains valid for 10 minutes; user can return and complete verification
- What happens when multiple users try to verify the same phone number simultaneously?
  - Only one can succeed; the second verification fails with "phone already registered" message
- What happens when SMS delivery fails?
  - System shows user-friendly error message (e.g., "SMS could not be sent. Please try again."), logs the failure with error details for debugging, and allows retry after cooldown period expires
- What happens when a user changes their phone number to a new one?
  - All pending coupons sent to the old phone number are immediately transferred to the user's account (coupons follow the person, not the number)
- Can a user remove their phone number without adding a new one?
  - No, once a phone number is verified, users must always have a verified phone number linked to their account
- What happens when a new user verifies a phone number that was previously linked to someone else?
  - The new user gains ownership of the phone number but does NOT receive any coupons that were sent to that number before (those were already transferred to the previous owner)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require OTP verification before saving or updating any phone number
- **FR-002**: System MUST send a 6-digit numeric verification code via SMS to the provided phone number
- **FR-003**: System MUST validate phone numbers match Taiwan mobile format (09XXXXXXXX)
- **FR-004**: System MUST expire OTP codes after 10 minutes
- **FR-005**: System MUST limit OTP verification attempts to 5 per code
- **FR-006**: System MUST limit OTP requests to 3 per phone number per hour
- **FR-007**: System MUST reject direct phone number updates that bypass OTP verification
- **FR-008**: System MUST prevent registering a phone number already linked to another user
- **FR-009**: System MUST automatically claim pending coupons when phone verification succeeds
- **FR-009a**: System MUST transfer unclaimed coupons from the old phone number to the user's account when they change to a new verified phone number (coupons follow the person, not the number)
- **FR-010**: System MUST provide a 60-second cooldown between OTP resend requests
- **FR-011**: System MUST display masked phone number on success (e.g., 09XX-XXX-XXX)
- **FR-012**: System MUST clean up old unverified OTP records after successful verification
- **FR-013**: System MUST provide fallback logging when SMS service is unavailable (development mode)
- **FR-014**: System MUST show a user-friendly error message when SMS delivery fails in production, log the failure for debugging, and allow retry after cooldown expires
- **FR-015**: System MUST transfer all pending coupons linked to a phone number to the user's account when they change their phone number (coupons follow the person)
- **FR-017**: System MUST NOT allow users to remove their verified phone number without replacing it with a new verified number
- **FR-016**: System MUST NOT transfer pending coupons to a new user who verifies a phone number previously linked to another user

### Key Entities

- **Phone OTP Record**: Represents a pending verification attempt; tracks phone number, verification code, creation time, attempt count, verification status, and associated user
- **User Profile**: Contains verified phone number field; only updated through successful OTP verification
- **Pending Coupon**: Coupons sent to a phone number before the recipient registered; automatically claimed on phone verification

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete phone verification (enter number, receive SMS, enter code) in under 2 minutes under normal conditions
- **SC-002**: 99% of OTP SMS messages are delivered within 30 seconds of request
- **SC-003**: Zero coupon theft incidents occur through phone number manipulation after feature deployment
- **SC-004**: 95% of legitimate users successfully verify their phone on first attempt
- **SC-005**: System correctly blocks 100% of attempts to bypass OTP verification
- **SC-006**: Rate limiting prevents abuse without blocking legitimate users (less than 1% false positive rate)

## Clarifications

### Session 2026-01-07

- Q: When a user changes their verified phone number, what happens to unclaimed coupons sent to their old number? → A: Transfer unclaimed coupons to the user's account (coupons follow the person, not the phone number)
- Q: If Twilio SMS delivery fails in production, what should the system do? → A: Show user-friendly error message, log the failure for debugging, and allow retry after cooldown
- Q: When a new user verifies a phone number previously linked to another user, should they receive pending coupons sent to that number? → A: No, coupons follow the person—when the original user unlinks their phone, pending coupons transfer to their account immediately
- Q: Can a user remove/unlink their verified phone number without replacing it with a new one? → A: No, once verified, users must always have a phone number linked to their account

## Assumptions

- Taiwan mobile phone format (09XXXXXXXX) is the only supported format
- SMS delivery infrastructure (Twilio) is available and configured
- Users have access to SMS on their registered phone
- The mobile app has network connectivity when initiating verification
- Pending coupons are linked by phone number before user registration
