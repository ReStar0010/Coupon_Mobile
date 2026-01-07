# Tasks: Phone OTP Verification

**Input**: Design documents from `/specs/002-phone-otp-verification/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included as required by Constitution (III. Quality Assurance - authentication flows require integration tests).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `Backend/api/` for Django REST Framework
- **Frontend**: `Mobile-Frontend/app/` for Expo/React Native
- **Tests**: `Backend/tests/` for backend tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure SMS service

- [ ] T001 Install Twilio dependency in Backend/requirements.txt
- [ ] T002 [P] Add SMS_DEV_MODE setting to Backend/Backend/settings.py
- [ ] T003 [P] Add Twilio environment variables to Backend/Backend/deployment_settings.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create PhoneOTPRecord model in Backend/api/models.py
- [ ] T005 Create database migration for PhoneOTPRecord
- [ ] T006 [P] Create SMSService class in Backend/api/services/sms_service.py
- [ ] T007 [P] Add PhoneOTPSerializer to Backend/api/serializers.py
- [ ] T008 Add OTP URL routes to Backend/api/urls.py
- [ ] T009 [P] Copy TypeScript types from contracts/phone-otp-types.ts to Mobile-Frontend/app/services/phoneOtpAPI.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - New User Registers Phone Number (Priority: P1) 🎯 MVP

**Goal**: Users can link their phone number via OTP verification and automatically receive pending coupons

**Independent Test**: Create user, enter phone, receive OTP via SMS (dev mode: console), enter code, verify phone saved and coupons claimed

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Contract test for POST /phone-otp/send/ in Backend/tests/test_phone_otp.py
- [ ] T011 [P] [US1] Contract test for POST /phone-otp/verify/ in Backend/tests/test_phone_otp.py
- [ ] T012 [P] [US1] Integration test for coupon auto-claim on verification in Backend/tests/test_phone_otp.py

### Implementation for User Story 1

- [ ] T013 [US1] Implement send_otp view in Backend/api/views/phone_otp.py
- [ ] T014 [US1] Implement verify_otp view in Backend/api/views/phone_otp.py
- [ ] T015 [US1] Implement pending coupon claim logic in verify_otp (transfers coupons with pending_phone_number)
- [ ] T016 [P] [US1] Create OTPInput component in Mobile-Frontend/app/components/OTPInput.tsx
- [ ] T017 [P] [US1] Create sendOtp API function in Mobile-Frontend/app/services/phoneOtpAPI.ts
- [ ] T018 [P] [US1] Create verifyOtp API function in Mobile-Frontend/app/services/phoneOtpAPI.ts
- [ ] T019 [US1] Create OTPRequestScreen in Mobile-Frontend/app/OptionsMenu/PhoneSettings/OTPRequestScreen.tsx
- [ ] T020 [US1] Create OTPVerifyScreen in Mobile-Frontend/app/OptionsMenu/PhoneSettings/OTPVerifyScreen.tsx
- [ ] T021 [US1] Update PhoneSettings index to route through OTP flow in Mobile-Frontend/app/OptionsMenu/PhoneSettings/index.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Prevent Phone Number Theft (Priority: P1)

**Goal**: Block direct phone updates; only allow phone changes via verified OTP flow

**Independent Test**: Attempt PUT /api/user/phone/ - should return 405; attempt to verify phone registered to another user - should fail

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T022 [P] [US2] Test that PUT /api/user/phone/ returns 405 in Backend/tests/test_user_profile.py
- [ ] T023 [P] [US2] Test that DELETE /api/user/phone/ returns 405 in Backend/tests/test_user_profile.py
- [ ] T024 [P] [US2] Test that OTP send fails if phone belongs to another user in Backend/tests/test_phone_otp.py

### Implementation for User Story 2

- [ ] T025 [US2] Modify PUT handler in Backend/api/views/user_profile.py to return 405 with OTP redirect
- [ ] T026 [US2] Modify DELETE handler in Backend/api/views/user_profile.py to return 405 (FR-017)
- [ ] T027 [US2] Add phone uniqueness check in send_otp view (reject if phone belongs to different user)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - User Changes Phone Number (Priority: P2)

**Goal**: Existing users can change to a new phone number via OTP; old phone's unclaimed coupons transfer to user

**Independent Test**: User with phone A verifies phone B; old phone A's pending coupons transfer, new phone B's coupons also claimed

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T028 [P] [US3] Test old phone coupon transfer on phone change in Backend/tests/test_phone_otp.py
- [ ] T029 [P] [US3] Test new phone coupon claim on phone change in Backend/tests/test_phone_otp.py

### Implementation for User Story 3

- [ ] T030 [US3] Add old phone coupon transfer logic in verify_otp (coupons follow the person) in Backend/api/views/phone_otp.py
- [ ] T031 [US3] Return old_phone_coupons_transferred count in verify response

**Checkpoint**: At this point, User Stories 1-3 should all work independently

---

## Phase 6: User Story 4 - OTP Resend with Cooldown (Priority: P2)

**Goal**: Users can request a new OTP after 60-second cooldown

**Independent Test**: Request OTP, wait 60s, request again - should succeed; request within 60s - should fail

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T032 [P] [US4] Test cooldown rejection within 60 seconds in Backend/tests/test_phone_otp.py
- [ ] T033 [P] [US4] Test successful resend after cooldown in Backend/tests/test_phone_otp.py

### Implementation for User Story 4

- [ ] T034 [US4] Add cooldown countdown timer to OTPVerifyScreen in Mobile-Frontend/app/OptionsMenu/PhoneSettings/OTPVerifyScreen.tsx
- [ ] T035 [US4] Implement resend button with cooldown state in OTPVerifyScreen

**Checkpoint**: At this point, User Stories 1-4 should all work independently

---

## Phase 7: User Story 5 - Rate Limiting Protection (Priority: P3)

**Goal**: Prevent abuse via hourly request limits and verification attempt limits

**Independent Test**: Send 3 OTPs in 1 hour - 4th should fail; enter wrong code 5 times - 6th should fail

### Tests for User Story 5 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T036 [P] [US5] Test hourly rate limit (3 OTPs/hour) in Backend/tests/test_phone_otp.py
- [ ] T037 [P] [US5] Test max attempts limit (5 attempts/OTP) in Backend/tests/test_phone_otp.py
- [ ] T038 [P] [US5] Test OTP expiration after 10 minutes in Backend/tests/test_phone_otp.py

### Implementation for User Story 5

- [ ] T039 [US5] Implement can_send_otp rate limiting check in PhoneOTPRecord model methods
- [ ] T040 [US5] Implement can_attempt verification limit check in PhoneOTPRecord model methods
- [ ] T041 [US5] Add attempts_remaining to verify error response in Backend/api/views/phone_otp.py
- [ ] T042 [US5] Display attempts remaining in OTPVerifyScreen error state

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, validation, and final touches

- [ ] T043 [P] Clean up old unverified OTP records after successful verification
- [ ] T044 [P] Add logging for SMS send/verify operations in sms_service.py
- [ ] T045 Run all tests: python manage.py test api.tests.test_phone_otp
- [ ] T046 Run quickstart.md validation (test full flow manually)
- [ ] T047 Update CLAUDE.md if any additional patterns discovered

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1, can proceed in parallel
  - US3 and US4 are both P2, can proceed in parallel after P1 stories
  - US5 is P3, can proceed after P2 stories
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Core OTP send/verify flow
- **User Story 2 (P1)**: Can start after Foundational - Blocks direct phone updates
- **User Story 3 (P2)**: Depends on US1 verify_otp implementation - Adds phone change logic
- **User Story 4 (P2)**: Depends on US1 OTPVerifyScreen - Adds cooldown timer
- **User Story 5 (P3)**: Depends on US1 - Adds rate limiting enforcement

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend before frontend (API must exist for frontend to call)
- Models/services before views
- Views before frontend screens
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003 can run in parallel (different settings files)
- T006, T007, T009 can run in parallel (different files)
- All test tasks (T010-T012, T022-T024, etc.) can run in parallel within phase
- T016, T017, T018 can run in parallel (different frontend files)
- US1 and US2 can run in parallel (both P1, different concerns)

---

## Parallel Example: Phase 2 Foundation

```bash
# After T004, T005 complete, launch these together:
Task: "Create SMSService class in Backend/api/services/sms_service.py"
Task: "Add PhoneOTPSerializer to Backend/api/serializers.py"
Task: "Copy TypeScript types to Mobile-Frontend/app/services/phoneOtpAPI.ts"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 tests together:
Task: "Contract test for POST /phone-otp/send/"
Task: "Contract test for POST /phone-otp/verify/"
Task: "Integration test for coupon auto-claim on verification"
```

## Parallel Example: User Story 1 Frontend

```bash
# After backend API complete, launch these together:
Task: "Create OTPInput component"
Task: "Create sendOtp API function"
Task: "Create verifyOtp API function"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (core OTP flow)
4. Complete Phase 4: User Story 2 (security - block direct updates)
5. **STOP and VALIDATE**: Test OTP flow end-to-end, confirm direct updates blocked
6. Deploy/demo if ready - MVP achieved

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + 2 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 3 → Phone change with coupon transfer → Deploy/Demo
4. Add User Story 4 → Resend with cooldown UI → Deploy/Demo
5. Add User Story 5 → Full rate limiting → Deploy/Demo (Feature Complete)

---

## Task Summary

| Phase | Story | Tasks | Parallel Tasks |
|-------|-------|-------|----------------|
| Phase 1: Setup | - | 3 | 2 |
| Phase 2: Foundational | - | 6 | 3 |
| Phase 3: US1 - Register Phone | P1 | 12 | 6 |
| Phase 4: US2 - Prevent Theft | P1 | 6 | 3 |
| Phase 5: US3 - Change Phone | P2 | 4 | 2 |
| Phase 6: US4 - Resend Cooldown | P2 | 4 | 2 |
| Phase 7: US5 - Rate Limiting | P3 | 7 | 3 |
| Phase 8: Polish | - | 5 | 2 |
| **Total** | - | **47** | **23** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- SMS_DEV_MODE=True logs OTP to console for development testing
