# Tasks: Phone-Based Registration Flow

**Input**: Design documents from `/specs/009-phone-registration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required per constitution Principle III — authentication flows MUST have integration tests; API endpoints MUST have contract tests; migrations MUST be tested for rollback.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Model changes and migrations that underpin all user stories

- [X] T001 Add `phone_verified` BooleanField (default=False) to StudentProfile in `Backend/api/models.py`
- [X] T002 Add `purpose` CharField (choices: phone_change, registration, password_reset; default='phone_change') to PhoneOTPRecord in `Backend/api/models.py`
- [X] T003 Make `user` ForeignKey nullable (null=True, blank=True) on PhoneOTPRecord in `Backend/api/models.py`
- [X] T004 Run `python manage.py makemigrations && python manage.py migrate` to apply model changes
- [X] T005 Test migration rollback: verify `python manage.py migrate api <previous_migration>` reverses the phone_verified and purpose field additions without data loss in `Backend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Serializers, URL routing, and frontend API layer that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Add RegistrationOTPSendSerializer (phone_number) in `Backend/api/serializers.py`
- [ ] T007 [P] Add RegistrationOTPVerifySerializer (phone_number, otp_code, password) in `Backend/api/serializers.py`
- [ ] T008 [P] Add PhoneLoginSerializer (phone_number optional, email optional, password, client_type; validate exactly one identifier) in `Backend/api/serializers.py`
- [ ] T009 [P] Add PhoneForgotPasswordSerializer (phone_number) in `Backend/api/serializers.py`
- [ ] T010 [P] Add PhoneResetPasswordSerializer (phone_number, otp_code, new_password) in `Backend/api/serializers.py`
- [ ] T011 Add URL routes for registration OTP, phone login, and forgot-password endpoints in `Backend/Backend/urls.py`
- [ ] T012 [P] Add unauthenticated registration and forgot-password OTP API functions in `Mobile-Frontend/app/services/phoneOtpAPI.ts`
- [ ] T013 [P] Add new endpoints (register/send-otp, register/verify-otp, forgot-password/phone/*) to public endpoint list in `Mobile-Frontend/app/utils/authAPI.ts`
- [ ] T014 [P] Define TypeScript interfaces for all new/modified API request and response types (RegistrationOTPSendRequest/Response, RegistrationOTPVerifyRequest/Response, PhoneLoginRequest, ForgotPasswordPhoneSendRequest/Response, ForgotPasswordPhoneResetRequest/Response) in `Mobile-Frontend/app/services/phoneOtpAPI.ts` and `Mobile-Frontend/app/utils/authAPI.ts`

**Checkpoint**: Foundation ready — serializers, routes, frontend API functions, and TypeScript interfaces are in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Register with Phone Number and Password (Priority: P1) 🎯 MVP

**Goal**: New users register with phone (09XXXXXXXX) + password, verify via SMS OTP, and are auto-logged in with JWT tokens.

**Independent Test**: Create a new account with a phone number and password, verify via OTP, confirm the user can access the app.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T015 [P] [US1] Contract test for POST `/api/register/send-otp/` validating request/response schema (200, 400, 409, 429 responses per register-phone.yaml) in `Backend/tests/test_phone_otp.py`
- [ ] T016 [P] [US1] Contract test for POST `/api/register/verify-otp/` validating request/response schema (201, 400, 404, 410 responses per register-phone.yaml) in `Backend/tests/test_phone_otp.py`
- [ ] T017 [P] [US1] Integration test for registration success flow: send OTP → verify OTP → user created with phone_verified=True → JWT tokens returned in `Backend/tests/test_phone_otp.py`
- [ ] T018 [P] [US1] Integration test for registration failure cases: duplicate phone (409), invalid phone format (400), wrong OTP (400 with attempts_remaining), expired OTP (410), max attempts exceeded in `Backend/tests/test_phone_otp.py`

### Implementation for User Story 1

- [ ] T019 [US1] Update PhoneOTPRecord `can_send_otp()` and `create_otp()` methods to accept `purpose` parameter and allow `user=None` for registration; ensure rate limiting is scoped per purpose in `Backend/api/models.py`
- [ ] T020 [US1] Update OTP verification logic to check `purpose` matches the calling endpoint (cross-purpose prevention per register-otp.yaml business rules) in `Backend/api/models.py` or `Backend/api/views/phone_otp.py`
- [ ] T021 [US1] Add `send_registration_otp` view (AllowAny, validate phone not already registered via StudentProfile.phone_number, create PhoneOTPRecord with purpose='registration' and user=None, send SMS via existing SMSService, return response per register-phone.yaml contract) in `Backend/api/views/phone_otp.py`
- [ ] T022 [US1] Add `verify_registration_otp` view (AllowAny, verify OTP with purpose='registration', create User with username=phone_number, create StudentProfile with phone_verified=True and verified=False, return JWT tokens, status 201 per register-phone.yaml contract) in `Backend/api/views/phone_otp.py`
- [ ] T023 [US1] Update registration screen to show phone number + password form (replace email input with phone input, Taiwan 09XXXXXXXX format validation, Chinese error messages) in `Mobile-Frontend/app/(auth)/login.tsx` and `Mobile-Frontend/app/(auth)/login-components/LoginFormContainer.tsx`
- [ ] T024 [US1] Wire registration form submit to call `register/send-otp` API, then navigate to OTP verification screen with phone_number and password passed as params in `Mobile-Frontend/app/(auth)/login-components/LoginFormContainer.tsx`
- [ ] T025 [US1] Create or reuse OTP verification screen for registration flow (accepts phone_number + password params, calls `register/verify-otp` with phone_number + otp_code + password, stores JWT tokens on success, redirects to main app; reuse existing OTPInput component if available) in `Mobile-Frontend/app/(auth)/`

**Checkpoint**: User Story 1 fully functional — new users can register with phone + OTP and are logged in. Run T015–T018 tests to verify.

---

## Phase 4: User Story 2 — Log In with Phone Number and Password (Priority: P1)

**Goal**: Existing phone-registered users can log in with phone number + password. Login form defaults to phone input.

**Independent Test**: Log in with a previously registered phone number and password, verify successful authentication and redirection.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T026 [P] [US2] Contract test for POST `/api/login/` with phone_number field validating request/response schema (200, 400, 401, 404 responses per login.yaml) in `Backend/tests/test_phone_otp.py`
- [ ] T027 [P] [US2] Integration test for phone login: success (phone + password → JWT), wrong password (401), unregistered phone (404), phone_verified=False rejection in `Backend/tests/test_phone_otp.py`

### Implementation for User Story 2

- [ ] T028 [US2] Modify `login()` view to accept phone_number OR email (mutually exclusive via PhoneLoginSerializer validation), look up user by StudentProfile.phone_number when phone provided, check phone_verified=True, authenticate and return JWT tokens per login.yaml contract in `Backend/api/views/authentication.py`
- [ ] T029 [US2] Update login form to default to phone number + password input (replace email field with phone field as default state) in `Mobile-Frontend/app/(auth)/login.tsx` and `Mobile-Frontend/app/(auth)/login-components/LoginFormContainer.tsx`
- [ ] T030 [US2] Wire login form submit to call `/api/login/` with phone_number + password + client_type='user', handle success (store tokens, redirect) and error responses (Chinese messages) in `Mobile-Frontend/app/(auth)/login-components/LoginFormContainer.tsx`

**Checkpoint**: User Story 2 fully functional — phone-registered users can log in with phone + password. Run T026–T027 tests to verify.

---

## Phase 5: User Story 3 — Add Email as Optional Information (Priority: P2)

**Goal**: Logged-in users can optionally add/verify their email through a settings screen mirroring the existing phone settings pattern.

**Independent Test**: Navigate to email settings after login, enter an email, verify it, confirm it is saved to the user profile.

### Implementation for User Story 3

- [ ] T031 [P] [US3] Create `Mobile-Frontend/app/options-menu/email-settings/EmailSettings/index.tsx` mirroring the existing phone-settings UX (display current email or "尚未設定", form to enter email, trigger verification email send via existing backend email verification API)
- [ ] T032 [US3] Add email settings navigation entry to the options/settings menu so users can access the new email settings screen in `Mobile-Frontend/app/options-menu/`
- [ ] T033 [US3] Wire email settings screen to backend email verification API (send verification email, display confirmation message, handle errors with Chinese messages) in `Mobile-Frontend/app/options-menu/email-settings/EmailSettings/index.tsx`

**Checkpoint**: User Story 3 fully functional — users can optionally add and verify email from settings.

---

## Phase 6: User Story 4 — Forgot Password Flow via Phone OTP (Priority: P2)

**Goal**: Users reset their password using phone number + OTP instead of email link.

**Independent Test**: Request password reset with registered phone, verify via OTP, set new password, log in with it.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T034 [P] [US4] Contract test for POST `/api/forgot-password/phone/send-otp/` validating request/response schema (200, 400, 404, 429 responses per forgot-password-phone.yaml) in `Backend/tests/test_phone_otp.py`
- [ ] T035 [P] [US4] Contract test for POST `/api/forgot-password/phone/reset/` validating request/response schema (200, 400, 404, 410 responses per forgot-password-phone.yaml) in `Backend/tests/test_phone_otp.py`
- [ ] T036 [P] [US4] Integration test for password reset flow: send OTP → verify OTP → password changed → login with new password succeeds in `Backend/tests/test_phone_otp.py`

### Implementation for User Story 4

- [ ] T037 [US4] Add `send_password_reset_otp` view (AllowAny, verify phone is registered via StudentProfile.phone_number, create PhoneOTPRecord with purpose='password_reset' and user=matched_user, send SMS) per forgot-password-phone.yaml contract in `Backend/api/views/phone_otp.py`
- [ ] T038 [US4] Add `verify_password_reset_otp` view (AllowAny, verify OTP with purpose='password_reset', call User.set_password(new_password), save user) per forgot-password-phone.yaml contract in `Backend/api/views/phone_otp.py`
- [ ] T039 [US4] Update forgot-password screen to show phone number input instead of email, call `forgot-password/phone/send-otp`, navigate to OTP verify screen on success in `Mobile-Frontend/app/(auth)/`
- [ ] T040 [US4] Create password reset OTP verification + new password screen (verify OTP via `forgot-password/phone/reset`, show success message "密碼已重設成功", redirect to login) in `Mobile-Frontend/app/(auth)/`

**Checkpoint**: User Story 4 fully functional — users can reset password via phone OTP. Run T034–T036 tests to verify.

---

## Phase 7: User Story 5 — Backward Compatibility for Existing Email Users (Priority: P3)

**Goal**: Existing email-registered users can still log in. Login screen provides a toggle between phone and email modes.

**Independent Test**: Log in with an existing email-based account, confirm access is unaffected.

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T041 [P] [US5] Integration test for email login backward compatibility: existing email user logs in with email + password → JWT returned, verified=True check still applies in `Backend/tests/test_phone_otp.py`

### Implementation for User Story 5

- [ ] T042 [US5] Add "使用 Email 登入" / "使用手機登入" toggle link to login screen that switches between phone and email input modes in `Mobile-Frontend/app/(auth)/login.tsx` and `Mobile-Frontend/app/(auth)/login-components/LoginFormContainer.tsx`
- [ ] T043 [US5] When email mode is active, login form sends `email` + `password` + `client_type` to `/api/login/` (existing email login path) in `Mobile-Frontend/app/(auth)/login-components/LoginFormContainer.tsx`
- [ ] T044 [US5] Verify backend `login()` view handles email login path unchanged (look up User by email, check verified=True, return JWT tokens) — no code change expected, validate by running T041 in `Backend/api/views/authentication.py`

**Checkpoint**: User Story 5 fully functional — email users can still log in via toggle. Run T041 test to verify.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, security hardening, and end-to-end verification

- [ ] T045 [P] Ensure all user-facing messages use Chinese (繁體中文) per FR-011 across all modified frontend and backend files
- [ ] T046 [P] Verify Taiwan phone format validation (09XXXXXXXX, 10 digits) is enforced consistently in all serializers and frontend forms per FR-009
- [ ] T047 Verify existing phone-settings flow (`options-menu/phone-settings/`) still works for logged-in phone number changes per FR-012
- [ ] T048 Run quickstart.md validation: execute all curl commands and frontend test steps from `specs/009-phone-registration/quickstart.md`
- [ ] T049 Verify OTP cleanup on successful verification (delete unverified OTPs for same phone+purpose) per register-otp.yaml business rules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (model changes + migrations) — BLOCKS all user stories
- **User Stories (Phases 3–7)**: All depend on Phase 2 completion
  - US1 (Phase 3) and US2 (Phase 4): Both P1 — implement sequentially (US1 first, as US2's phone login depends on phone-registered users existing)
  - US3 (Phase 5) and US4 (Phase 6): Both P2 — can proceed in parallel after Phase 2
  - US5 (Phase 7): P3 — can proceed after Phase 2 (independent of US1–US4)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Register)**: Depends on Phase 2 only — no other story dependencies
- **US2 (Login)**: Depends on Phase 2. Shares backend login view modification with US5. Best implemented after US1 to test with real phone-registered users.
- **US3 (Email Settings)**: Depends on Phase 2 only — fully independent, different files
- **US4 (Forgot Password)**: Depends on Phase 2 only — fully independent, different files (but shares `phone_otp.py` with US1)
- **US5 (Email Login Toggle)**: Depends on Phase 2. Shares frontend login files with US2. Best implemented after US2 to layer toggle on top.

### Within Each User Story

- Tests FIRST — write and verify they FAIL before implementation
- Backend model utilities before views
- Backend views before frontend screens (frontend calls backend)
- Core implementation before integration/wiring
- Run tests after implementation to verify they PASS

### Parallel Opportunities

- T006–T010: All serializers can be written in parallel (same file but independent classes)
- T012, T013, T014: Frontend API functions and TypeScript interfaces can be written in parallel with backend serializers
- T015–T018: All US1 tests can be written in parallel
- T026–T027: All US2 tests can be written in parallel
- T034–T036: All US4 tests can be written in parallel
- US3 (Email Settings) can be implemented in parallel with US4 (Forgot Password) — different files entirely
- T045, T046: Polish tasks on different concerns can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is complete, within US1:

# Step 1 — Write tests in parallel (all [P]):
Task T015: "Contract test for /register/send-otp/"
Task T016: "Contract test for /register/verify-otp/"
Task T017: "Integration test for registration success"
Task T018: "Integration test for registration failures"
# Verify all tests FAIL

# Step 2 — Backend implementation (sequential):
Task T019: "Update PhoneOTPRecord methods for purpose param"
Task T020: "Add cross-purpose OTP validation"
Task T021: "Add send_registration_otp view"  # depends on T019, T020
Task T022: "Add verify_registration_otp view"  # depends on T019, T020

# Step 3 — Frontend (depends on backend being ready):
Task T023: "Update registration screen to phone form"
Task T024: "Wire registration form to send-otp API"
Task T025: "Create/reuse OTP verification screen for registration"

# Step 4 — Run tests T015-T018 again, verify all PASS
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (model changes + migration + rollback test)
2. Complete Phase 2: Foundational (serializers, URLs, frontend API functions, TypeScript interfaces)
3. Complete Phase 3: User Story 1 (tests → backend → frontend)
4. **STOP and VALIDATE**: Run T015–T018 tests + quickstart.md curl commands
5. Deploy/demo if ready — new users can register with phone

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Register) → Run tests → **MVP!** New users can register with phone
3. Add US2 (Login) → Run tests → Phone-registered users can log in
4. Add US3 (Email Settings) + US4 (Forgot Password) in parallel → Run tests → Optional email, phone-based password reset
5. Add US5 (Email Login Toggle) → Run tests → Backward compatibility for email users
6. Polish → Full validation → Release

### Suggested MVP Scope

**US1 (Register) + US2 (Login)** — both are P1 priority. Together they deliver a complete phone-based auth flow. US2 without US1 is untestable (no phone-registered users exist).

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 49 |
| **Phase 1 (Setup)** | 5 tasks |
| **Phase 2 (Foundational)** | 9 tasks |
| **US1 (Register) — P1** | 11 tasks (4 tests + 7 impl) |
| **US2 (Login) — P1** | 5 tasks (2 tests + 3 impl) |
| **US3 (Email Settings) — P2** | 3 tasks |
| **US4 (Forgot Password) — P2** | 7 tasks (3 tests + 4 impl) |
| **US5 (Email Toggle) — P3** | 4 tasks (1 test + 3 impl) |
| **Polish** | 5 tasks |
| **Test tasks** | 11 (1 migration + 4 US1 + 2 US2 + 3 US4 + 1 US5) |
| **Parallel opportunities** | Serializers (5), frontend API (3), US1 tests (4), US2 tests (2), US4 tests (3), US3‖US4, polish (2) |
| **MVP scope** | US1 + US2 (16 story tasks after foundation) |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Tests MUST be written and FAIL before implementation (TDD per constitution)
- Backend changes should be implemented and verified before frontend wiring
- All Chinese (繁體中文) UI text per FR-011
- SMS_DEV_MODE=True for local development (OTP codes in API response)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
