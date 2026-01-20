# Tasks: App Store Compliance Fixes

**Input**: Design documents from `/specs/001-appstore-compliance-fixes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/account-deletion.yaml

**Tests**: This feature requires integration tests for the account deletion critical path.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Mobile-Merchant-Frontend**: React Native/Expo app (frontend)
- **Backend**: Django REST Framework API (backend)
- Paths reference existing repository structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and environment setup

- [X] T001 Activate Python virtual environment in Backend/.venv
- [X] T002 [P] Verify expo-image-picker ~17.0.10 is installed in Mobile-Merchant-Frontend/package.json
- [X] T003 [P] Verify react-native Linking API is available (built-in, no installation needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema changes that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Modify Store.owner field in Backend/api/models.py to allow null (change on_delete from CASCADE to SET_NULL, add null=True, blank=True)
- [X] T005 Create Django migration for Store.owner field change: `python manage.py makemigrations api --name account_deletion_support`
- [X] T006 Apply migration: `python manage.py migrate`
- [X] T007 [P] Create AccountDeletionLog model in Backend/api/models.py with fields: deleted_user_email, deleted_user_id, deleted_at, deletion_reason, stores_anonymized, coupons_preserved, initiated_at, completed_at, status, retry_count
- [X] T008 Create Django migration for AccountDeletionLog model: `python manage.py makemigrations api`
- [X] T009 Apply AccountDeletionLog migration: `python manage.py migrate`

**Checkpoint**: Database schema ready for account deletion - user story implementation can now begin

---

## Phase 3: User Story 1 - Clear Photo Library Permission Understanding (Priority: P1) 🎯 MVP

**Goal**: Update photo library permission purpose string to comply with Apple App Store Guideline 5.1.1, providing clear explanation of why photo access is needed

**Independent Test**: Fresh install the app on iOS device/simulator, navigate to profile edit or coupon creation, trigger photo library permission prompt, and verify the dialog displays: "CouPro 需要存取您的照片,以便讓您上傳商店標誌、商品圖片或優惠券圖片至您的商家資料。"

### Implementation for User Story 1

- [X] T010 [US1] Add expo-image-picker plugin configuration to Mobile-Merchant-Frontend/app.json with photosPermission property set to "CouPro 需要存取您的照片,以便讓您上傳商店標誌、商品圖片或優惠券圖片至您的商家資料。"
- [X] T011 [P] [US1] Create PermissionDeniedModal component in Mobile-Merchant-Frontend/app/components/ui/PermissionDeniedModal.tsx with openSettings functionality using Linking.openSettings()
- [X] T012 [US1] Integrate PermissionDeniedModal into photo upload flows in Mobile-Merchant-Frontend/app/(profile)/edit.tsx to detect permission denial and show modal
- [X] T013 [US1] Integrate PermissionDeniedModal into photo upload flows in Mobile-Merchant-Frontend/app/(coupons)/create.tsx or edit.tsx (if exists) to detect permission denial and show modal
- [ ] T014 [US1] Rebuild native app with new permission string: `npx expo prebuild --clean` in Mobile-Merchant-Frontend/

**Checkpoint**: Photo library permission displays clear purpose string, denied permission shows settings link dialog

---

## Phase 4: User Story 2 - Account Deletion Access (Priority: P1)

**Goal**: Implement complete in-app account deletion flow for merchants, including password verification, data warnings, coupon preservation via anonymization, and proper cleanup

**Independent Test**: Create test merchant account, add stores and coupons, navigate to account settings, complete deletion flow with password verification, verify account cannot log in, merchant data is anonymized in preserved stores, and active coupons remain redeemable

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [P] [US2] Create test_account_deletion.py in Backend/api/tests/ with test cases for: password verification, pre-delete check with active coupons, successful deletion with store anonymization, deletion with multiple stores, invalid password rejection, network failure with pending status
- [X] T016 [P] [US2] Test that AccountDeletionLog is created with correct status transitions
- [X] T017 [P] [US2] Test that deleted user cannot log in and can re-register with same email
- [X] T018 [US2] Run tests to verify they FAIL before implementation: `python manage.py test api.tests.test_account_deletion`

### Implementation for User Story 2 - Backend

- [X] T019 [P] [US2] Create AccountDeletionSerializer in Backend/api/serializers.py with fields: password (write_only, required), acknowledgments (list of strings, required)
- [X] T020 [P] [US2] Create PreDeleteCheckSerializer in Backend/api/serializers.py for response with: can_delete (bool), warnings (list), data_summary (object with active_coupons_count, stores_count, total_redemptions, pending_transactions)
- [X] T021 [US2] Create pre_delete_check view function in Backend/api/views/account_deletion.py that counts active coupons, stores, redemptions, and returns warnings based on contracts/account-deletion.yaml schema
- [X] T022 [US2] Create delete_account view function in Backend/api/views/account_deletion.py implementing: password verification with check_password(), store anonymization (name→"已刪除的商家", clear address/lat/lng/image_url/unified_redeem_code, set owner to null), AccountDeletionLog creation, User deletion, token blacklist
- [X] T023 [US2] Create get_deletion_status view function in Backend/api/views/account_deletion.py to check AccountDeletionLog for pending/completed/failed status
- [X] T024 [US2] Add URL routes in Backend/Backend/urls.py for: api/merchant/account/pre-delete-check/ (GET), api/merchant/account/delete/ (POST), api/merchant/account/deletion-status/ (GET)
- [X] T025 [US2] Add permission check to all account deletion views: require IsAuthenticated and merchant role verification
- [X] T026 [US2] Implement token blacklist in delete_account view: delete all OutstandingToken records for the user before User deletion

### Implementation for User Story 2 - Frontend

- [X] T027 [P] [US2] Create TypeScript interfaces in Mobile-Merchant-Frontend/utils/api.ts for: PreDeleteCheckResponse, DeletionWarning, DeleteAccountRequest, DeleteAccountResponse, DeletionStatusResponse (matching contracts/account-deletion.yaml schemas)
- [X] T028 [P] [US2] Add API functions in Mobile-Merchant-Frontend/utils/api.ts: preDeleteCheck() (GET), deleteAccount(password, acknowledgments) (POST), getDeletionStatus() (GET)
- [X] T029 [US2] Create delete-account.tsx screen in Mobile-Merchant-Frontend/app/(profile)/ with multi-step flow: Step 1 - load warnings from preDeleteCheck, Step 2 - display warnings with acknowledgment checkboxes, Step 3 - password entry input, Step 4 - final confirmation dialog, Step 5 - success message and logout
- [X] T030 [US2] Add "刪除帳號" button to profile settings screen in Mobile-Merchant-Frontend/app/(profile)/index.tsx that navigates to delete-account route
- [X] T031 [US2] Implement error handling in delete-account.tsx for: invalid password (show "密碼錯誤" error), network failure (mark pending, show "帳號刪除進行中..." status), missing acknowledgments (disable submit button)
- [X] T032 [US2] Implement logout and navigation after successful deletion in delete-account.tsx: clear auth tokens, redirect to login screen
- [ ] T033 [US2] Add retry mechanism on app reconnection: check getDeletionStatus() on app resume, if status is "pending", automatically retry deletion and show progress indicator

### Integration & Verification for User Story 2

- [X] T034 [US2] Run all account deletion tests to verify they pass: `python manage.py test api.tests.test_account_deletion`
- [X] T035 [US2] Manual test: Create test merchant with stores and active coupons, complete deletion flow, verify stores show "已刪除的商家", coupons remain redeemable, cannot log in with deleted account
- [X] T036 [US2] Manual test: Verify deleted email can be used to register new account
- [X] T037 [US2] Manual test: Test network failure scenario (enable airplane mode mid-deletion), verify pending status shows and retry works on reconnection

**Checkpoint**: Complete account deletion flow working end-to-end with password verification, data anonymization, and network failure handling

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [X] T038 [P] Run full backend test suite: `python manage.py test`
- [ ] T039 [P] Run TypeScript type check: `cd Mobile-Merchant-Frontend && npm run typecheck` (if available)
- [ ] T040 Perform full manual test on iOS device following quickstart.md testing checklist
- [ ] T041 Verify permission string appears correctly in iOS Settings app under CouPro permissions
- [ ] T042 [P] Document any environment-specific configuration in quickstart.md (if needed)
- [ ] T043 Commit all changes with conventional commit messages: feat(ios): add photo library permission purpose string, feat(account): implement merchant account deletion

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion, but independent of User Story 2
- **User Story 2 (Phase 4)**: Depends on Foundational completion, but independent of User Story 1
- **Polish (Phase 5)**: Depends on both User Stories 1 and 2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Completely independent, frontend-only
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Requires backend + frontend work

### Within Each User Story

**User Story 1**:
- T010 must complete before T014 (rebuild)
- T011 is independent, can run parallel with T010
- T012, T013 depend on T011 (component must exist)

**User Story 2**:
- Tests (T015-T018) MUST be written FIRST and FAIL
- Backend tasks (T019-T026) can mostly run in parallel within dependencies:
  - Serializers (T019, T020) before views (T021, T022, T023)
  - Views before URL routes (T024)
- Frontend tasks (T027-T033) dependencies:
  - Type interfaces (T027) before API functions (T028)
  - API functions before screen implementation (T029-T033)
  - Screen components can be built incrementally
- Integration tests (T034-T037) run after all implementation complete

### Parallel Opportunities

- **Phase 1**: All tasks marked [P] (T002, T003) can run in parallel
- **Phase 2**: Tasks T007-T009 (AccountDeletionLog) can run in parallel with T004-T006 (Store.owner change) if using separate migration files
- **User Story 1**: T011 can run parallel with T010
- **User Story 2 Tests**: T015, T016, T017 can all run in parallel
- **User Story 2 Backend**: T019, T020 can run in parallel (different serializers)
- **User Story 2 Frontend**: T027, T028 can run in parallel (types + API functions)
- **Phase 5**: T038, T039, T042 can all run in parallel
- **Between User Stories**: User Story 1 (Phase 3) and User Story 2 (Phase 4) can be worked on in parallel by different team members after Phase 2 completes

---

## Parallel Example: User Story 2 Backend

```bash
# Write all tests together FIRST (ensure they FAIL):
Task T015: "Create test_account_deletion.py with test cases"
Task T016: "Test AccountDeletionLog creation"
Task T017: "Test deleted user cannot log in"

# Then create serializers in parallel:
Task T019: "Create AccountDeletionSerializer in serializers.py"
Task T020: "Create PreDeleteCheckSerializer in serializers.py"

# After serializers complete, create views (sequential due to complexity):
Task T021: "Create pre_delete_check view"
Task T022: "Create delete_account view"
Task T023: "Create get_deletion_status view"
```

---

## Implementation Strategy

### MVP First (Both User Stories Required)

Both User Story 1 and User Story 2 are P1 priority and required for App Store compliance. The MVP must include both:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Photo Permission)
4. Complete Phase 4: User Story 2 (Account Deletion)
5. Complete Phase 5: Polish & Validation
6. **VALIDATE**: Test both stories independently and together
7. Submit to App Store for review

### Parallel Team Strategy

With two developers:

1. Team completes Setup (Phase 1) together
2. Team completes Foundational (Phase 2) together
3. Once Foundational is done:
   - Developer A: User Story 1 (Photo Permission) - Frontend-only, faster
   - Developer B: User Story 2 (Account Deletion) - Backend + Frontend, more complex
4. Both stories integrate and validate together
5. Team completes Polish (Phase 5) together

### Single Developer Strategy

1. Complete Setup + Foundational (Phase 1 + 2)
2. Complete User Story 1 (Phase 3) - Faster, frontend-only
3. Complete User Story 2 (Phase 4) - More complex, backend + frontend
4. Complete Polish (Phase 5)
5. Each phase builds toward full compliance

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- User Story 1 is frontend-only and independent
- User Story 2 requires backend + frontend coordination
- Both stories are P1 and required for App Store submission
- Tests for US2 MUST be written first and verified to fail
- Permission string changes require native rebuild (cannot use OTA)
- Commit after each task or logical group with conventional commit format
- Stop at checkpoints to validate independently before proceeding

---

## Summary

- **Total Tasks**: 43
- **Setup Tasks**: 3
- **Foundational Tasks**: 6 (BLOCKS all user stories)
- **User Story 1 Tasks**: 5 (Photo Permission - Frontend)
- **User Story 2 Tasks**: 23 (Account Deletion - Backend + Frontend + Tests)
- **Polish Tasks**: 6
- **Parallel Opportunities**: 15 tasks marked [P]
- **Independent Test Criteria**: Both stories have clear acceptance criteria from spec.md
- **MVP Scope**: Both User Story 1 AND User Story 2 (both P1, both required for App Store)

