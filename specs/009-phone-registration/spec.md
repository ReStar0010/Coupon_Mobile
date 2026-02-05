# Feature Specification: Phone-Based Registration Flow

**Feature Branch**: `009-phone-registration`
**Created**: 2026-02-05
**Status**: Draft
**Input**: User description: "Swap registration default from email+password to phone+password, keep 2FA via phone OTP, make email optional. Reuse existing phone settings OTP flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register with Phone Number and Password (Priority: P1)

A new user opens the app and registers an account using their phone number (Taiwan mobile format 09XXXXXXXX) and a password. After entering their phone number and password, the system sends an SMS OTP code to the provided phone number. The user enters the 6-digit OTP code to verify their phone number and complete registration. Upon successful verification, the user is logged in and redirected to the main app.

**Why this priority**: This is the core change — replacing email-based registration with phone-based registration. Without this, the feature has no value.

**Independent Test**: Can be fully tested by creating a new account with a phone number and password, verifying via OTP, and confirming the user can access the app.

**Acceptance Scenarios**:

1. **Given** the user is on the registration screen, **When** they enter a valid phone number (09XXXXXXXX) and password, **Then** the system sends an SMS OTP to that phone number and navigates to the OTP verification screen.
2. **Given** the user has received an OTP, **When** they enter the correct 6-digit code within the expiration window, **Then** their account is created, they are logged in, and redirected to the main app.
3. **Given** the user enters an invalid phone number format, **When** they attempt to register, **Then** the system displays a validation error message and does not send an OTP.
4. **Given** a phone number is already registered, **When** a new user attempts to register with that number, **Then** the system displays an appropriate error message.
5. **Given** the user enters an incorrect OTP, **When** they submit the code, **Then** the system shows an error with remaining attempts and allows retry.

---

### User Story 2 - Log In with Phone Number and Password (Priority: P1)

An existing user opens the app and logs in using their phone number and password instead of email. The login form now shows a phone number input field instead of email.

**Why this priority**: Login must match the new registration method — users who register with a phone number need to log in with it.

**Independent Test**: Can be tested by logging in with a previously registered phone number and password, verifying successful authentication and redirection to the main app.

**Acceptance Scenarios**:

1. **Given** a registered user is on the login screen, **When** they enter their phone number and correct password, **Then** they are authenticated and redirected to the main app.
2. **Given** a user enters an incorrect password, **When** they attempt to log in, **Then** the system displays an appropriate error message.
3. **Given** a phone number is not registered, **When** a user attempts to log in with it, **Then** the system displays an error message.

---

### User Story 3 - Add Email as Optional Information (Priority: P2)

After registration, a logged-in user can optionally add their email address through a settings screen (mirroring the existing phone settings page pattern). This email can be used for account recovery and receiving notifications.

**Why this priority**: Email is demoted from required to optional. Users should still be able to add it for recovery purposes, but it is not needed for the core registration/login flow.

**Independent Test**: Can be tested by navigating to the email settings screen after login, entering an email, verifying it, and confirming it is saved to the user's profile.

**Acceptance Scenarios**:

1. **Given** a logged-in user navigates to email settings, **When** they enter a valid email address, **Then** the system sends a verification email and displays a confirmation message.
2. **Given** the user receives the verification email, **When** they click the verification link, **Then** the email is verified and linked to their account.
3. **Given** the user has not added an email, **When** they view their profile settings, **Then** the email field shows "尚未設定" (not yet set).

---

### User Story 4 - Forgot Password Flow via Phone OTP (Priority: P2)

A user who forgot their password can reset it using their phone number. Instead of receiving a password reset email, the user enters their phone number, receives an OTP, verifies it, and then sets a new password.

**Why this priority**: Password recovery must work with the new phone-based system. Users no longer have email as a guaranteed identifier.

**Independent Test**: Can be tested by requesting a password reset with a registered phone number, verifying via OTP, setting a new password, and logging in with it.

**Acceptance Scenarios**:

1. **Given** a user is on the forgot password screen, **When** they enter their registered phone number, **Then** an OTP is sent to that number.
2. **Given** the user enters the correct OTP, **When** they submit a new password, **Then** the password is updated and the user can log in with the new password.
3. **Given** a phone number is not registered, **When** a user attempts password reset, **Then** the system displays an appropriate error message.

---

### User Story 5 - Backward Compatibility for Existing Email Users (Priority: P3)

Existing users who registered with email can still log in using their email and password. The login screen provides a way to switch between phone and email login modes.

**Why this priority**: Prevents breaking existing user access. Lower priority because it is a transition concern, not the primary new flow.

**Independent Test**: Can be tested by logging in with an existing email-based account and confirming access is unaffected.

**Acceptance Scenarios**:

1. **Given** an existing user registered with email, **When** they switch to email login mode and enter their email and password, **Then** they are authenticated and redirected to the main app.
2. **Given** the login screen defaults to phone mode, **When** a user taps the "use email login" toggle, **Then** the form switches to email and password inputs.

---

### Edge Cases

- What happens when the user's phone number changes and they haven't added an email? They must use the existing phone settings OTP flow to update their number while logged in.
- What happens when OTP delivery fails (SMS not received)? The user can request a resend after the cooldown period (60 seconds), with a maximum of 3 requests per hour.
- What happens when the user enters the maximum number of wrong OTP attempts (5)? The OTP is invalidated and the user must request a new one.
- What happens during a network failure mid-OTP verification? The OTP remains valid until expiration (10 minutes), so the user can retry once connectivity is restored.
- What happens when a user starts registration but abandons before OTP verification? No account is created; the pending OTP expires after 10 minutes with no side effects.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Registration screen MUST accept phone number (Taiwan mobile format 09XXXXXXXX) and password as default registration fields.
- **FR-002**: System MUST send an SMS OTP to the provided phone number during registration for 2FA verification.
- **FR-003**: System MUST create the user account only after successful OTP verification.
- **FR-004**: Login screen MUST accept phone number and password as the default login method.
- **FR-005**: Login screen MUST provide a toggle to switch to email-based login for backward compatibility.
- **FR-006**: System MUST provide an optional email settings screen (mirroring the existing phone settings pattern) where logged-in users can add and verify their email.
- **FR-007**: Forgot password flow MUST work via phone number and OTP verification instead of email.
- **FR-008**: Registration OTP flow MUST reuse the existing OTP infrastructure (send/verify mechanisms, rate limiting, cooldown timers, expiration rules).
- **FR-009**: Phone number validation MUST enforce Taiwan mobile format (09XXXXXXXX, 10 digits).
- **FR-010**: System MUST prevent duplicate registration with the same phone number.
- **FR-011**: System MUST display all user-facing messages in Chinese (繁體中文), consistent with the existing app.
- **FR-012**: The existing phone settings screen (options-menu/phone-settings) MUST continue to function for users who want to change their phone number after registration.

### Key Entities

- **User Account**: Represents a registered user. Key attributes: phone number (required, unique), password (required), email (optional), verification status for phone and email.
- **OTP Verification**: Represents a pending verification. Key attributes: phone number, OTP code, expiration time, attempt count, purpose (registration, phone change, or password reset).
- **Email Verification**: Represents a pending email verification. Key attributes: email address, verification token, verification status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New users can complete registration (phone + password + OTP verification) in under 3 minutes.
- **SC-002**: 95% of registration OTP codes are received by the user within 30 seconds.
- **SC-003**: Users can log in with their phone number and password with the same reliability as the current email-based login.
- **SC-004**: Existing email-based users can still log in without disruption during the transition period.
- **SC-005**: The optional email addition flow has a similar user experience to the existing phone settings flow.
- **SC-006**: Password reset via phone OTP has a completion rate comparable to the current email-based password reset.

## Assumptions

- The existing backend OTP infrastructure (SMS delivery, rate limiting, cooldown, expiration) is sufficient for registration-time OTP and does not need architectural changes — only new endpoints or parameter support for the "registration" use case.
- The existing phone settings OTP UI components (OTPRequestScreen, OTPVerifyScreen, OTPInput) can be reused or adapted for the registration flow.
- Taiwan mobile phone format (09XXXXXXXX) remains the only supported format.
- The backend will need a new or modified registration endpoint that accepts phone number instead of email.
- The login endpoint will need to accept phone number as an alternative identifier to email.
- Existing users with email-only accounts will retain access and can optionally add a phone number through the existing phone settings flow.
- The "email settings" optional screen will follow the same UX pattern as the existing "phone settings" screen (display current value, verify via email link to add/change).
