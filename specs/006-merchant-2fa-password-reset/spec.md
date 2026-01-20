# Feature Specification: Merchant 2FA Email Verification and Password Reset

**Feature Branch**: `006-merchant-2fa-password-reset`
**Created**: 2026-01-15
**Status**: Draft
**Input**: User description: "The current register feature for Mobile-Merchant-Frontend doesn't support 2FA, add this feature by using Resend as the mailing service provider, the setting is already setup since this feature is supported in Mobile-Frontend, you can investigate in Backend to find out. Additionally, add a password reset feature that also support mailing confirmation in the login page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Merchant Email Verification During Registration (Priority: P1)

As a new merchant, I want to verify my email address during registration so that my account is secured and I can prove ownership of the email address.

**Why this priority**: Email verification is the core security feature that prevents unauthorized account creation and ensures merchants can be contacted reliably. This is the primary request and must be implemented first.

**Independent Test**: Can be fully tested by registering a new merchant account and completing email verification. Delivers immediate value by securing merchant accounts.

**Acceptance Scenarios**:

1. **Given** a new user fills out the merchant registration form with valid information, **When** they submit the form, **Then** the system creates an unverified account and sends a verification email to the provided address
2. **Given** a merchant has just registered and received a verification email, **When** they click the verification link within the email, **Then** their account is marked as verified and they see a success confirmation
3. **Given** a merchant has registered but not verified their email, **When** they attempt to log in, **Then** the system displays a message indicating email verification is required before login
4. **Given** a merchant clicks a verification link, **When** the link has already been used, **Then** the system displays a message that the email is already verified

---

### User Story 2 - Password Reset with Email Confirmation (Priority: P2)

As a merchant who has forgotten my password, I want to reset it using email confirmation so that I can regain access to my account securely.

**Why this priority**: Password reset is essential for account recovery and reduces support burden. It builds on the email infrastructure established in P1 and is critical for user retention.

**Independent Test**: Can be fully tested by requesting a password reset and completing the flow. Delivers value by enabling account recovery without support intervention.

**Acceptance Scenarios**:

1. **Given** a merchant is on the login page, **When** they click "Forgot Password", **Then** they are presented with a form to enter their email address
2. **Given** a merchant enters a valid registered email address, **When** they submit the password reset request, **Then** the system sends a password reset email with a secure link
3. **Given** a merchant receives a password reset email, **When** they click the reset link within the validity period, **Then** they are presented with a form to enter a new password
4. **Given** a merchant enters and confirms a new valid password, **When** they submit the form, **Then** their password is updated and they receive confirmation they can now log in
5. **Given** a merchant enters an unregistered email, **When** they submit the password reset request, **Then** the system displays a generic message (to prevent email enumeration) and does not reveal whether the email exists

---

### User Story 3 - Resend Verification Email (Priority: P3)

As a merchant who did not receive or lost my verification email, I want to request a new verification email so that I can complete the registration process.

**Why this priority**: This is a supporting feature that improves user experience when the primary verification flow encounters issues. Reduces support tickets.

**Independent Test**: Can be fully tested by attempting to resend verification email for an unverified account. Delivers value by enabling self-service recovery of stuck registrations.

**Acceptance Scenarios**:

1. **Given** a merchant with an unverified account attempts to log in, **When** they see the verification required message, **Then** they have an option to request a new verification email
2. **Given** a merchant requests a new verification email, **When** the request is submitted, **Then** a new verification email is sent and any previous verification links are invalidated
3. **Given** a merchant has recently requested a verification email, **When** they request another within a short period, **Then** the system applies rate limiting and informs them to wait

---

### Edge Cases

- What happens when a verification link expires? The system displays a clear message that the link has expired and offers option to request a new one
- What happens when a password reset link expires (after 24 hours)? The system displays an expiration message and prompts the user to request a new reset link
- How does system handle multiple rapid password reset requests? Rate limiting prevents abuse while still allowing legitimate retry after a reasonable delay
- What happens if a merchant tries to verify with a malformed or tampered token? The system displays an invalid token error and offers to resend verification
- What happens if the email service is temporarily unavailable? The system displays a friendly error asking the user to try again later

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST send a verification email to merchants upon successful registration
- **FR-002**: System MUST prevent merchant login until email verification is completed
- **FR-003**: System MUST provide a verification link that confirms email ownership when clicked
- **FR-004**: System MUST mark merchant accounts as verified after successful email verification
- **FR-005**: System MUST display clear feedback when verification succeeds or fails
- **FR-006**: System MUST provide a "Forgot Password" option on the merchant login page
- **FR-007**: System MUST send password reset emails with secure, time-limited links
- **FR-008**: System MUST allow merchants to set a new password via the reset link
- **FR-009**: System MUST invalidate password reset links after use or expiration
- **FR-010**: System MUST allow merchants to request new verification emails for unverified accounts
- **FR-011**: System MUST apply rate limiting to prevent abuse of email-sending features
- **FR-012**: System MUST NOT reveal whether an email exists when processing password reset requests (prevent enumeration)
- **FR-013**: System MUST display all user-facing messages in Chinese (consistent with existing app)
- **FR-014**: Deep links MUST follow the format `coupromerchant://verify-email?token={token}` for email verification and `coupromerchant://reset-password?token={token}` for password reset

### Key Entities

- **Merchant Account**: Represents a merchant user with verification status tracking (verified/unverified), email address, and authentication credentials
- **Email Verification Token**: A unique, single-use token with 24-hour validity associated with a merchant account for email verification purposes. Stored in existing token table with user_type field to distinguish from consumer tokens.
- **Password Reset Token**: A unique, time-limited (24-hour validity) token for secure password reset operations. Stored in existing token table with user_type field to distinguish from consumer tokens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Merchants can complete registration and email verification flow within 5 minutes of starting registration
- **SC-002**: 95% of verification emails are delivered successfully to merchant inboxes
- **SC-003**: Merchants can complete password reset flow within 3 minutes of initiating request
- **SC-004**: Zero unauthorized account access occurs due to bypassed verification
- **SC-005**: Support tickets related to merchant account access are reduced by providing self-service recovery options
- **SC-006**: All email-based flows (verification, password reset) complete without errors for users with valid email addresses

## Clarifications

### Session 2026-01-16

- Q: How should the mobile app handle verification and password reset links? → A: Deep link to app (link opens Mobile-Merchant-Frontend directly)
- Q: Should merchant tokens be stored in existing tables or separate merchant-specific tables? → A: Reuse existing tables with user_type field to distinguish merchant vs consumer tokens
- Q: How long should email verification tokens remain valid? → A: 24 hours (same as password reset tokens)

## Assumptions

- Verification and password reset email links use deep linking to open the Mobile-Merchant-Frontend app directly, where token handling and UI flows occur natively
- The existing Resend email service configuration in the backend is functional and can be reused for merchant emails
- The existing email template design patterns from the student verification flow can be adapted for merchant communications
- The existing password reset infrastructure in the backend supports merchant accounts or can be extended
- Chinese language is required for all user-facing messages (consistent with existing Mobile-Merchant-Frontend)
- The verification and password reset link formats follow existing patterns in the codebase
- 24-hour expiration for password reset tokens is acceptable (consistent with existing implementation)
- Rate limiting threshold is 3 requests per hour per email (consistent with plan.md)
