# Tasks: Merchant 2FA Email Verification and Password Reset

**Input**: Design documents from `/specs/006-merchant-2fa-password-reset/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/merchant-auth-api.yaml, quickstart.md

**Tests**: Not explicitly requested in the feature specification. Manual E2E testing outlined in quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `Backend/api/` for models, views, serializers
- **Frontend**: `Mobile-Merchant-Frontend/app/` for screens, `Mobile-Merchant-Frontend/utils/` for utilities

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and model updates required by all user stories

- [X] T001 Add verification fields to MerchantProfile model in Backend/api/models.py
- [X] T002 Add helper methods (is_verification_token_valid, can_send_verification_email, generate_verification_token, verify_email) to MerchantProfile in Backend/api/models.py (NOTE: Consider reusing `generate_password_reset_token` and `is_token_valid` patterns from Backend/api/auth.py for consistency)
- [X] T003 Run database migrations (makemigrations && migrate)
- [X] T004 [P] Create merchant verification email function (send_merchant_verification_email) in Backend/api/views/authentication.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core email infrastructure and URL routing that MUST be complete before user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Add URL routes for new merchant endpoints in Backend/Backend/urls.py
- [X] T006 [P] Add TypeScript interfaces for verification/reset API responses in Mobile-Merchant-Frontend/utils/api.ts
- [X] T007 [P] Add authAPI helper functions (verifyEmail, resendVerification, resetPassword) in Mobile-Merchant-Frontend/utils/api.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Merchant Email Verification During Registration (Priority: P1)

**Goal**: New merchants must verify their email during registration before they can log in

**Independent Test**: Register a new merchant account, receive verification email, click link, verify account is marked verified, then successfully log in

### Implementation for User Story 1

- [X] T008 [US1] Update merchant register view to generate verification token and send email in Backend/api/views/authentication.py
- [X] T009 [US1] Update register response to include verification_required flag in Backend/api/views/authentication.py
- [X] T010 [US1] Add verify_merchant_email endpoint (GET /api/merchant/verify-email/) in Backend/api/views/authentication.py
- [X] T011 [US1] Update login view to check MerchantProfile.verified and return 403 with email_not_verified error in Backend/api/views/authentication.py
- [X] T012 [P] [US1] Create verify-email.tsx deep link handler screen in Mobile-Merchant-Frontend/app/(auth)/verify-email.tsx
- [ ] T013 [P] [US1] Update register.tsx to show verification pending message after successful registration in Mobile-Merchant-Frontend/app/(auth)/register.tsx
- [X] T014 [US1] Update login.tsx to handle email_not_verified error and show resend option in Mobile-Merchant-Frontend/app/(auth)/login.tsx

**Checkpoint**: User Story 1 complete - merchants can register, receive verification email, verify via deep link, and log in after verification

---

## Phase 4: User Story 2 - Password Reset with Email Confirmation (Priority: P2)

**Goal**: Merchants who forgot their password can reset it via email confirmation

**Independent Test**: Click "Forgot Password" on login, enter email, receive reset email, click link, set new password, log in with new password

### Implementation for User Story 2

- [ ] T015 [US2] Update send_password_reset_email function to use coupromerchant:// deep link scheme for merchant users in Backend/api/views/authentication.py
- [ ] T016 [US2] Update forgot_password view to detect merchant user type, send correct deep link, and verify rate limiting (3 requests/hour per email) in Backend/api/views/authentication.py
- [X] T017 [P] [US2] Create reset-password.tsx deep link handler screen in Mobile-Merchant-Frontend/app/(auth)/reset-password.tsx
- [ ] T018 [US2] Verify forgot-password.tsx exists and works correctly for merchants in Mobile-Merchant-Frontend/app/(auth)/forgot-password.tsx

**Checkpoint**: User Story 2 complete - merchants can request and complete password reset flow independently

---

## Phase 5: User Story 3 - Resend Verification Email (Priority: P3)

**Goal**: Merchants who did not receive verification email can request a new one with rate limiting

**Independent Test**: Attempt login with unverified account, click resend option, receive new verification email, verify rate limiting works

### Implementation for User Story 3

- [X] T019 [US3] Add resend_merchant_verification endpoint (POST /api/merchant/resend-verification/) with rate limiting in Backend/api/views/authentication.py
- [X] T020 [US3] Add resend verification button and modal to login.tsx unverified state handling in Mobile-Merchant-Frontend/app/(auth)/login.tsx
- [X] T021 [US3] Handle rate limit error (429) and display wait time to user in Mobile-Merchant-Frontend/app/(auth)/login.tsx

**Checkpoint**: User Story 3 complete - merchants can resend verification emails with proper rate limiting feedback

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and edge case handling

- [ ] T022 [P] Handle expired token error in verify-email.tsx with option to resend in Mobile-Merchant-Frontend/app/(auth)/verify-email.tsx
- [ ] T023 [P] Handle expired token error in reset-password.tsx with option to request new reset in Mobile-Merchant-Frontend/app/(auth)/reset-password.tsx
- [ ] T024 Add email service error handling (Resend API failures) with user-friendly messages in Backend/api/views/authentication.py
- [ ] T024a [P] Add integration tests for merchant verification flow (success, expired token, already verified) in Backend/api/tests/test_merchant_auth.py
- [ ] T024b [P] Add integration tests for merchant password reset flow (success, expired token, invalid email) in Backend/api/tests/test_merchant_auth.py
- [ ] T024c Validate endpoint schemas against contracts/merchant-auth-api.yaml (contract test)
- [ ] T025 Run manual E2E testing per quickstart.md test checklist
- [ ] T026 Verify Chinese UI text for all user-facing messages in frontend screens

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T004) - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Phase 2
  - User Story 2 (P2): Can start after Phase 2 (independent of US1)
  - User Story 3 (P3): Depends on US1 login unverified handling (T014)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Depends on US1 (T014) because resend option is shown in login unverified state

### Within Each User Story

- Backend endpoints before frontend screens
- API functions (Phase 2) must exist before frontend can call them
- Core implementation before error handling polish

### Parallel Opportunities

- T004 (email function) can run in parallel with T001-T003
- T006 and T007 can run in parallel (different concerns in same file)
- T012 and T013 can run in parallel (different screens)
- T017 and T018 can run in parallel (different screens)
- T022 and T023 can run in parallel (different screens)
- User Story 1 and User Story 2 can run in parallel after Foundational phase

---

## Parallel Example: Phase 2

```bash
# After T005 completes, launch frontend tasks together:
Task: "Add TypeScript interfaces in Mobile-Merchant-Frontend/utils/api.ts"
Task: "Add authAPI helper functions in Mobile-Merchant-Frontend/utils/api.ts"
```

## Parallel Example: User Story 1 Frontend

```bash
# After backend tasks T008-T011 complete, launch frontend screens together:
Task: "Create verify-email.tsx in Mobile-Merchant-Frontend/app/(auth)/verify-email.tsx"
Task: "Update register.tsx in Mobile-Merchant-Frontend/app/(auth)/register.tsx"
# Then sequentially:
Task: "Update login.tsx in Mobile-Merchant-Frontend/app/(auth)/login.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T007)
3. Complete Phase 3: User Story 1 (T008-T014)
4. **STOP and VALIDATE**: Test registration → verification → login flow
5. Deploy/demo if ready - merchants can now securely register with email verification

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP: secure registration)
3. Add User Story 2 → Test independently → Deploy (password recovery)
4. Add User Story 3 → Test independently → Deploy (improved UX for verification issues)
5. Polish phase → Final validation → Production release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (registration verification)
   - Developer B: User Story 2 (password reset)
3. User Story 3 starts after US1 login handling complete
4. Polish phase: Both developers handle edge cases

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing infrastructure (Resend, PasswordResetProfile) is reused per research.md decisions
- All user-facing text must be in Chinese per FR-013
- Deep link scheme: `coupromerchant://` (already configured in app.json)
