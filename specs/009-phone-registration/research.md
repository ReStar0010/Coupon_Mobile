# Research: Phone-Based Registration Flow

**Feature**: 009-phone-registration | **Date**: 2026-02-05

## Research Tasks

### R1: Unauthenticated OTP for Registration

**Context**: The existing `send_otp` and `verify_otp` endpoints in `phone_otp.py` require `IsAuthenticated` permission because they're designed for phone-change operations by logged-in users. Registration OTP must work **before** the user has an account or token.

**Decision**: Create separate unauthenticated endpoints for registration OTP.

**Rationale**:
- The existing authenticated endpoints tie OTP records to `request.user`, which doesn't exist during registration.
- Mixing authenticated and unauthenticated logic in the same endpoint adds complexity and security risk.
- Separate endpoints allow different rate-limiting strategies (IP-based for unauthenticated vs user-based for authenticated).

**Alternatives Considered**:
1. **Add `AllowAny` permission to existing endpoints with conditional logic** — Rejected because it complicates the view with auth-state branching and weakens security boundaries.
2. **Two-step registration (create unverified account first, then verify)** — Rejected per spec FR-003: "System MUST create the user account only after successful OTP verification." Creating the account before OTP would leave unverified accounts in the database.

**Implementation**:
- `POST /api/register/send-otp/` — AllowAny, accepts phone_number, creates PhoneOTPRecord with `purpose='registration'`
- `POST /api/register/verify-otp/` — AllowAny, accepts phone_number + otp_code + password, verifies OTP then creates User+StudentProfile, returns JWT tokens

---

### R2: Django User Model Username Strategy

**Context**: Django's default User model requires a `username` field. Currently, the registration flow sets `username = email`. With phone-based registration, email is no longer available at registration time.

**Decision**: Set `username = phone_number` for phone-registered users.

**Rationale**:
- Phone numbers are unique per spec (FR-010), satisfying Django's unique constraint on username.
- The username field is not displayed in the app UI — it's only used internally by Django.
- This is the simplest approach that requires no custom User model or AbstractBaseUser migration.

**Alternatives Considered**:
1. **Generate UUID as username** — Rejected because it breaks the existing pattern where username serves as the human-readable login identifier, and complicates admin lookup.
2. **Custom User model with phone as primary identifier** — Rejected because it requires a complex migration of the existing User table (existing email-based users have username=email). Too much risk for the current scope.
3. **Set username = f"phone_{phone_number}"** — Rejected; unnecessary prefix adds no value since phone numbers are already unique and distinguishable from email addresses.

---

### R3: Phone Verification Tracking on StudentProfile

**Context**: `StudentProfile.verified` currently tracks **email** verification status. The login view checks `verified=True` before allowing login. With phone-based registration, we need to track phone verification separately.

**Decision**: Add a `phone_verified` boolean field to StudentProfile. Keep the existing `verified` field for email.

**Rationale**:
- Phone-registered users will have `phone_verified=True` (set after OTP success) and `verified=False` (no email yet).
- Email-registered users will have `verified=True` (existing) and `phone_verified=False` (no phone yet).
- The login view will check `phone_verified OR verified` depending on the login method used.
- This preserves backward compatibility — no existing data is altered.

**Alternatives Considered**:
1. **Repurpose `verified` to mean "any verification"** — Rejected because it loses the ability to distinguish which method was verified, and could break existing email-verification checks.
2. **Add a `verification_method` enum field** — Rejected because a user could eventually verify both phone and email. Boolean flags are simpler and support both states simultaneously.

---

### R4: Registration Flow — Account Creation Timing

**Context**: Spec FR-003 states "System MUST create the user account only after successful OTP verification." This means we cannot create the User record when the registration form is submitted — only after OTP verification succeeds.

**Decision**: Store phone_number and hashed password temporarily during OTP verification, then create User+StudentProfile on successful OTP verify.

**Rationale**:
- The `verify_registration_otp` endpoint receives phone_number, otp_code, and password.
- On successful OTP match: create User (username=phone_number), hash and set password, create StudentProfile with phone_number and phone_verified=True.
- No temporary storage needed — the password is sent with the verify request, keeping the flow stateless.

**Alternatives Considered**:
1. **Store password hash in PhoneOTPRecord** — Rejected; mixes concerns and adds a sensitive field to the OTP table.
2. **Create User immediately, delete on OTP failure/expiry** — Rejected per FR-003 and creates cleanup complexity.
3. **Frontend stores password in memory, sends with verify request** — This IS the chosen approach. The password travels over HTTPS, same as current registration.

---

### R5: Login Endpoint — Phone vs Email Identifier

**Context**: The current login endpoint accepts `email` + `password` + `client_type`. The new flow needs to also accept `phone_number` as an identifier.

**Decision**: Modify the login endpoint to accept either `phone_number` or `email` (mutually exclusive), plus `password` and `client_type`.

**Rationale**:
- Single login endpoint with conditional lookup: if `phone_number` is provided, look up by StudentProfile.phone_number; if `email`, look up by User.email (existing logic).
- The frontend sends the appropriate field based on the login mode toggle.
- This avoids creating a separate `/api/login-phone/` endpoint, keeping the API surface small.

**Alternatives Considered**:
1. **Separate `/api/login-phone/` endpoint** — Rejected; unnecessary endpoint proliferation for what is fundamentally the same operation (credential validation).
2. **Single `identifier` field with auto-detection** — Rejected; ambiguous and error-prone (what if a phone number looks like something else?). Explicit field names are clearer.

---

### R6: Forgot Password — Phone OTP Flow

**Context**: The current forgot-password flow sends a reset link via email. Spec FR-007 requires phone OTP instead.

**Decision**: Create new phone-based forgot-password endpoints alongside the existing email-based ones.

**Rationale**:
- `POST /api/forgot-password/phone/send-otp/` — Sends OTP to registered phone number (AllowAny)
- `POST /api/forgot-password/phone/reset/` — Verifies OTP + sets new password (AllowAny)
- Keep existing email-based `/api/forgot-password/` and `/api/reset-password/` for backward compatibility
- Reuses PhoneOTPRecord with `purpose='password_reset'`

**Alternatives Considered**:
1. **Replace email forgot-password entirely** — Rejected; existing email users still need the email flow until they add a phone number.
2. **Single endpoint with conditional logic** — Rejected; the flows are different enough (email sends a link, phone sends OTP) that separate endpoints are cleaner.

---

### R7: Backward Compatibility Strategy

**Context**: Existing users registered with email must continue to work. Spec User Story 5 (P3) requires a login mode toggle.

**Decision**: The login screen defaults to phone mode. A "使用 Email 登入" link toggles to email mode. Both modes use the same `/api/login/` endpoint.

**Rationale**:
- Frontend toggle switches between phone_number and email input fields.
- Backend login view checks which field is provided and looks up accordingly.
- No migration of existing users needed — they simply use the email toggle.
- Registration screen only offers phone registration (new default). Email-registered users who need to register must already have accounts.

**Alternatives Considered**:
1. **Force existing users to add phone** — Rejected; breaks existing access and adds friction.
2. **Auto-detect identifier type** — Rejected per R5 reasoning.

---

### R8: PhoneOTPRecord Purpose Field

**Context**: The existing PhoneOTPRecord is used for phone-change verification (authenticated). Registration and forgot-password flows also need OTP records but have different security contexts.

**Decision**: Add a `purpose` CharField to PhoneOTPRecord with choices: `phone_change` (default/existing), `registration`, `password_reset`.

**Rationale**:
- Differentiates OTP records by use case for auditing and validation.
- The verify logic can check that the OTP's purpose matches the endpoint being called (e.g., a registration OTP cannot be used at the phone-change endpoint).
- Prevents cross-purpose OTP reuse attacks.

**Alternatives Considered**:
1. **Separate OTP tables per purpose** — Rejected; unnecessary duplication of identical schema.
2. **No purpose field, rely on endpoint logic** — Rejected; a leaked OTP code could be used at the wrong endpoint without purpose validation.
