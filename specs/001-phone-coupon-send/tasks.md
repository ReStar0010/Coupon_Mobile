---
description: "Task list for phone-based coupon send feature implementation"
---

# Tasks: Phone-Based Coupon Send

**Input**: Design documents from `/specs/001-phone-coupon-send/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Tests are not included in this implementation as they were not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `Backend/api/` for models, serializers, views
- **User App**: `Mobile-Frontend/app/` for screens, `Mobile-Frontend/app/utils/` for API
- **Merchant App**: `Mobile-Merchant-Frontend/app/` for screens, `Mobile-Merchant-Frontend/utils/` for API

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema changes

- [x] T001 Add `pending_phone_number` field to Coupon model in Backend/api/models.py
- [x] T002 Generate Django migration for Coupon model changes using `python manage.py makemigrations api --name add_coupon_pending_phone_number`
- [x] T003 Apply database migration using `python manage.py migrate`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities and validation logic that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create phone validation utility functions in Backend/api/utils.py (validate_phone_number, mask_phone_number)
- [x] T005 [P] Create pending coupon assignment helper function in Backend/api/views/user_profile.py (assign_pending_coupons)
- [x] T006 [P] Add URL routes for user phone endpoints in Backend/Backend/urls.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - User Registers Phone Number (Priority: P1) 🎯 MVP

**Goal**: Enable users to register their mobile phone number in the user-side app so merchants can send them personalized coupons

**Independent Test**: User can navigate to phone settings, enter a valid phone number (09XXXXXXXX), save it, and see it displayed (masked) in their profile. Invalid formats are rejected with error messages. Duplicate phone numbers are rejected.

### Implementation for User Story 1

- [x] T007 [P] [US1] Create GET /api/user/phone/ endpoint in Backend/api/views/user_profile.py
- [x] T008 [P] [US1] Create PUT /api/user/phone/ endpoint with phone validation and uniqueness check in Backend/api/views/user_profile.py
- [x] T009 [P] [US1] Create DELETE /api/user/phone/ endpoint in Backend/api/views/user_profile.py
- [x] T010 [US1] Integrate pending coupon assignment into PUT /api/user/phone/ endpoint
- [x] T011 [P] [US1] Create PhoneSettings screen component in Mobile-Frontend/app/OptionsMenu/PhoneSettings/index.tsx
- [x] T012 [P] [US1] Add phone API methods (getUserPhone, updateUserPhone, deleteUserPhone) in Mobile-Frontend/app/utils/authAPI.ts
- [x] T013 [US1] Add navigation menu item for phone settings in Mobile-Frontend/app/OptionsMenu/index.tsx

**Checkpoint**: Users can register and manage phone numbers. Pending coupon assignment is functional.

---

## Phase 4: User Story 2 - Merchant Sends Coupon via Phone Number (Priority: P1) 🎯 MVP

**Goal**: Enable merchants to send coupons directly to customers using their phone number, supporting both registered and unregistered users

**Independent Test**: Merchant can enter a registered user's phone number and send a coupon. The coupon appears in the user's collection with acquisition method "consolidate". Merchant can also send to unregistered phone, creating a pending coupon. Template quantity decrements correctly.

### Implementation for User Story 2

- [x] T014 [US2] Update merchant_consolidate_coupon permission from AllowAny to IsAuthenticated in Backend/api/views/merchant_coupon.py
- [x] T015 [US2] Add merchant store ownership validation to merchant_consolidate_coupon in Backend/api/views/merchant_coupon.py
- [x] T016 [US2] Extend merchant_consolidate_coupon to handle registered users (existing flow) in Backend/api/views/merchant_coupon.py
- [x] T017 [US2] Add pending coupon creation logic for unregistered phones in merchant_consolidate_coupon in Backend/api/views/merchant_coupon.py
- [x] T018 [US2] Update response format to include recipient_status (registered/pending) in Backend/api/views/merchant_coupon.py
- [x] T019 [P] [US2] Add consolidateCoupon API method to merchantAPI in Mobile-Merchant-Frontend/utils/api.ts
- [x] T020 [US2] Add "Send Coupon" functionality to coupon detail screen in Mobile-Merchant-Frontend/app/(coupons)/[id].tsx

**Checkpoint**: Merchants can send coupons via phone number to both registered and unregistered users. Template quantity management works correctly.

---

## Phase 5: User Story 5 - User Claims Pending Coupons on Phone Registration (Priority: P2)

**Goal**: Automatically assign pending coupons to users when they register the associated phone number

**Independent Test**: Merchant sends coupon to unregistered phone number. Later, a new user registers with that phone number. The pending coupon automatically appears in their collection. Expired pending coupons are not assigned.

### Implementation for User Story 5

- [x] T021 [US5] Add expiry date filter to pending coupon query in assign_pending_coupons function in Backend/api/views/user_profile.py
- [x] T022 [US5] Add logging for pending coupon assignment in Backend/api/views/user_profile.py
- [x] T023 [US5] Add pending_coupons_claimed count to PUT /api/user/phone/ response in Backend/api/views/user_profile.py
- [x] T024 [US5] Update PhoneSettings screen to display pending coupons claimed alert in Mobile-Frontend/app/OptionsMenu/PhoneSettings/index.tsx

**Checkpoint**: Pending coupons are automatically assigned when users register phone numbers. Users receive confirmation of claimed coupons.

---

## Phase 6: User Story 3 - User Receives and Views Sent Coupon (Priority: P2)

**Goal**: Users can view coupons sent to them by merchants and identify them by acquisition method

**Independent Test**: After merchant sends a coupon, user checks their exclusive coupon collection and sees the new coupon with acquisition method displayed as "電話歸戶" (phone consolidation).

### Implementation for User Story 3

- [x] T025 [US3] Verify acquisition_method='consolidate' is set correctly for phone-sent coupons in Backend/api/views/merchant_coupon.py
- [x] T026 [US3] Verify coupon display shows acquisition method in user's collection views in Mobile-Frontend (confirm existing functionality works)

**Checkpoint**: Users can identify phone-sent coupons by their acquisition method. Coupon details are displayed correctly.

---

## Phase 7: User Story 4 - User Updates Phone Number (Priority: P3)

**Goal**: Enable users to change their registered phone number with proper validation

**Independent Test**: User with existing phone number can update to a new valid phone number. The new number is stored and displayed masked. Attempting to use another user's phone number shows an error. Old number is replaced by new number.

### Implementation for User Story 4

- [x] T027 [US4] Add phone number update validation (uniqueness check excluding current user) in PUT /api/user/phone/ in Backend/api/views/user_profile.py (verify existing implementation)
- [x] T028 [US4] Add update confirmation message in PhoneSettings screen in Mobile-Frontend/app/OptionsMenu/PhoneSettings/index.tsx (verify existing implementation)

**Checkpoint**: Users can update their phone numbers with proper validation. All user stories are now complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and validations that affect multiple user stories

- [x] T029 [P] Verify all phone numbers are normalized (spaces/dashes removed) before storage across all endpoints
- [x] T030 [P] Verify error messages are user-friendly and consistent across backend endpoints
- [x] T031 [P] Add input validation feedback in real-time for phone input fields in Mobile-Frontend
- [x] T032 Verify template quantity decrements correctly for both registered and pending coupons
- [x] T033 Run manual test scenarios from quickstart.md to validate complete feature flow
- [ ] T034 [P] Update API documentation (Swagger/Redoc) with new endpoints (Optional documentation task)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - **US1 (Phase 3)**: Can start after Foundational - No dependencies on other stories
  - **US2 (Phase 4)**: Can start after Foundational - Independent of US1
  - **US5 (Phase 5)**: Depends on US1 (needs PUT /api/user/phone/ endpoint) and US2 (needs pending coupon creation)
  - **US3 (Phase 6)**: Can start after US2 (needs coupons to be sent first)
  - **US4 (Phase 7)**: Depends on US1 (extends phone registration functionality)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Setup (Phase 1) → Foundational (Phase 2) → US1 (Phase 3) ┐
                                        → US2 (Phase 4) ┼→ US5 (Phase 5) → US3 (Phase 6)
                                                        ↓
                                                      US4 (Phase 7) → Polish (Phase 8)
```

- **User Story 1 (P1)**: Foundational → Can start immediately after Phase 2
- **User Story 2 (P1)**: Foundational → Can start immediately after Phase 2 (parallel with US1)
- **User Story 5 (P2)**: US1 + US2 → Requires phone registration and pending coupon creation
- **User Story 3 (P2)**: US2 → Requires coupon sending to be functional
- **User Story 4 (P3)**: US1 → Extends phone registration functionality

### Within Each User Story

- Backend endpoints before frontend API methods
- API methods before UI components
- Core functionality before integration and validation
- Validation before user feedback messages

### Parallel Opportunities

- **Phase 1**: All setup tasks can run sequentially (database migration dependencies)
- **Phase 2**: Tasks T004, T005, T006 can all run in parallel
- **Phase 3 (US1)**: Tasks T007, T008, T009, T011, T012 can run in parallel; T010, T013 have dependencies
- **Phase 4 (US2)**: Task T019 can run in parallel with backend changes; T020 depends on T019
- **Phase 8**: Tasks T029, T030, T031, T034 can run in parallel
- **User Stories**: After Phase 2, US1 and US2 can be developed in parallel by different team members

---

## Parallel Example: User Story 1 (Phone Registration)

```bash
# Launch backend endpoints in parallel:
Task: "Create GET /api/user/phone/ endpoint in Backend/api/views/user_profile.py"
Task: "Create PUT /api/user/phone/ endpoint in Backend/api/views/user_profile.py"
Task: "Create DELETE /api/user/phone/ endpoint in Backend/api/views/user_profile.py"

# Launch frontend components in parallel:
Task: "Create PhoneSettings screen in Mobile-Frontend/app/OptionsMenu/PhoneSettings/index.tsx"
Task: "Add phone API methods in Mobile-Frontend/app/utils/authAPI.ts"
```

---

## Parallel Example: User Story 2 (Merchant Send Coupon)

```bash
# Backend and frontend can work in parallel after merchant_consolidate_coupon is ready:
Task: "Add consolidateCoupon API method in Mobile-Merchant-Frontend/utils/api.ts"
# Then:
Task: "Add Send Coupon functionality to coupon detail screen in Mobile-Merchant-Frontend/app/(coupons)/[id].tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Phone Registration)
4. Complete Phase 4: User Story 2 (Merchant Send Coupon)
5. **STOP and VALIDATE**: Test complete phone-based coupon flow
6. Deploy/demo MVP with core functionality

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + User Story 2 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 5 (Pending Coupons) → Test independently → Deploy/Demo
4. Add User Story 3 (Display Verification) → Test independently → Deploy/Demo
5. Add User Story 4 (Update Phone) → Test independently → Deploy/Demo
6. Complete Phase 8 (Polish) → Final validation → Production release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (Phases 1-2)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (Phase 3) - User phone registration
   - **Developer B**: User Story 2 (Phase 4) - Merchant send coupon
3. After US1 & US2 complete:
   - **Developer A**: User Story 5 (Phase 5) - Pending coupon assignment
   - **Developer B**: User Story 3 (Phase 6) - Display verification
4. Final sequential:
   - User Story 4 (Phase 7) - Phone update
   - Polish (Phase 8) - Final improvements

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Security Note**: T014 changes authentication from AllowAny to IsAuthenticated - this is a critical security fix
- **Database Note**: Run migrations (T002-T003) before deploying new backend code
- **Data Integrity**: Pending phone cleanup happens automatically when coupons are assigned (T010)
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
