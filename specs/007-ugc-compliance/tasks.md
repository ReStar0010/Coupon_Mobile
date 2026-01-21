# Tasks: UGC Compliance for Apple Guideline 1.2

**Input**: Design documents from `/specs/007-ugc-compliance/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `Backend/api/` (Django REST Framework)
- **Consumer Frontend**: `Mobile-Frontend/app/` (Expo/React Native)
- **Merchant Frontend**: `Mobile-Merchant-Frontend/app/` (Expo/React Native)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, models, and basic structure

- [X] T001 Add UGC compliance model imports and choice constants to Backend/api/models.py
- [X] T002 Create ContentReport model in Backend/api/models.py
- [X] T003 Create BlockedMerchant model in Backend/api/models.py
- [X] T004 Create EULAAcceptance model in Backend/api/models.py
- [X] T005 Create ModerationAction model in Backend/api/models.py
- [X] T006 Create ViolationRecord model in Backend/api/models.py
- [X] T007 Add violation tracking fields to MerchantProfile model in Backend/api/models.py
- [X] T008 Create and apply database migrations for UGC compliance models
- [X] T009 [P] Register new models in Backend/api/admin.py for Django admin access
- [X] T010 [P] Add UGC compliance settings/constants to Backend/Backend/settings.py (CURRENT_EULA_VERSION, thresholds)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core serializers and services that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T011 Create ContentReportSerializer and ContentReportCreateSerializer in Backend/api/serializers.py
- [X] T012 [P] Create BlockedMerchantSerializer in Backend/api/serializers.py
- [X] T013 [P] Create EULAAcceptSerializer and EULAStatusSerializer in Backend/api/serializers.py
- [X] T014 [P] Create ModerationActionSerializer in Backend/api/serializers.py
- [X] T015 [P] Create ViolationRecordSerializer in Backend/api/serializers.py
- [X] T016 Create moderation_service.py in Backend/api/services/ with check_escalations and record_violation functions
- [X] T017 [P] Create static EULA content file at Backend/static/eula_zh.txt
- [X] T018 [P] Create static content guidelines file at Backend/static/guidelines_zh.txt
- [X] T019 [P] Create static privacy policy file at Backend/static/privacy_zh.txt

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Consumer Reports Inappropriate Merchant Content (Priority: P1)

**Goal**: Allow consumers to report inappropriate coupon/store content with reason categories

**Independent Test**: Consumer opens any merchant store page or coupon, taps "Report" button, selects a reason, and submits. Confirmation message shown; duplicate within 24h prevented.

### Backend Implementation for User Story 1

- [X] T020 [P] [US1] Create content_moderation.py view module at Backend/api/views/content_moderation.py
- [X] T021 [US1] Implement ReportContentView (POST) for submitting reports in Backend/api/views/content_moderation.py
- [X] T022 [US1] Implement ReportStatusView (GET) to check if user reported content in Backend/api/views/content_moderation.py
- [X] T023 [US1] Implement UserReportsView (GET) to list user's submitted reports in Backend/api/views/content_moderation.py
- [X] T024 [US1] Add duplicate report prevention logic (24-hour window) in ReportContentView
- [X] T025 [US1] Register content report URL routes in Backend/Backend/urls.py

### Frontend Implementation for User Story 1

- [X] T026 [P] [US1] Create contentReportAPI.ts service in Mobile-Frontend/app/services/contentReportAPI.ts
- [X] T027 [P] [US1] Create TypeScript interfaces for report request/response in Mobile-Frontend/app/services/contentReportAPI.ts
- [X] T028 [US1] Create ReportModal.tsx component in Mobile-Frontend/app/components/ReportModal.tsx
- [X] T029 [US1] Implement reason selection radio buttons with Chinese labels in ReportModal.tsx
- [X] T030 [US1] Add optional details text input field to ReportModal.tsx
- [X] T031 [US1] Create ReportButton.tsx reusable component in Mobile-Frontend/app/components/ReportButton.tsx
- [X] T032 [US1] Integrate ReportButton into coupon detail screen (EasyUse/[id] area)
- [X] T033 [US1] Integrate ReportButton into store profile screen (N/A - coupon detail page serves as store view)
- [X] T034 [US1] Add "already reported" indicator when user has reported content (already implemented in ReportButton component)

**Checkpoint**: User Story 1 complete - consumers can report content with reason categories

---

## Phase 4: User Story 2 - Consumer Blocks a Merchant (Priority: P1)

**Goal**: Allow consumers to block merchants so their content is hidden from feed/search

**Independent Test**: Consumer views merchant profile, taps "Block Merchant," confirms, and verifies merchant content no longer appears in feed or search results.

### Backend Implementation for User Story 2

- [X] T035 [P] [US2] Implement BlockMerchantView (POST) in Backend/api/views/content_moderation.py
- [X] T036 [P] [US2] Implement UnblockMerchantView (DELETE) in Backend/api/views/content_moderation.py
- [X] T037 [US2] Implement BlockedMerchantsListView (GET) in Backend/api/views/content_moderation.py
- [X] T038 [US2] Implement BlockStatusView (GET) to check if merchant is blocked in Backend/api/views/content_moderation.py
- [X] T039 [US2] Add blocked merchant filtering to coupon list query views
- [X] T040 [US2] Add blocked merchant filtering to store search query views
- [X] T041 [US2] Register block merchant URL routes in Backend/Backend/urls.py

### Frontend Implementation for User Story 2

- [X] T042 [P] [US2] Create blockListAPI.ts service in Mobile-Frontend/app/services/blockListAPI.ts
- [X] T043 [P] [US2] Create TypeScript interfaces for block request/response in blockListAPI.ts
- [X] T044 [US2] Create BlockedMerchantsProvider.tsx context in Mobile-Frontend/app/components/providers/BlockedMerchantsProvider.tsx
- [X] T045 [US2] Implement fetchBlockedStoreIds on mount in BlockedMerchantsProvider
- [X] T046 [US2] Add block/unblock methods to BlockedMerchantsProvider context
- [X] T047 [US2] Create BlockedMerchants screen at Mobile-Frontend/app/OptionsMenu/BlockedMerchants/index.tsx
- [X] T048 [US2] Implement blocked merchants list with unblock buttons in BlockedMerchants screen
- [X] T049 [US2] Add "Block Merchant" button to store profile screen
- [X] T050 [US2] Implement block confirmation dialog
- [X] T051 [US2] Add BlockedMerchants navigation item to OptionsMenu/Settings

**Checkpoint**: User Story 2 complete - consumers can block/unblock merchants and content is filtered

---

## Phase 5: User Story 3 - Merchant Accepts EULA Before First Upload (Priority: P1)

**Goal**: Require merchants to accept EULA before uploading content; re-prompt on version updates

**Independent Test**: New merchant attempts to upload an image, is presented with EULA/content guidelines, checks "I Agree," and then successfully uploads. Subsequent uploads proceed without prompt.

### Backend Implementation for User Story 3

- [X] T052 [P] [US3] Create eula_acceptance.py view module at Backend/api/views/eula_acceptance.py
- [X] T053 [US3] Implement EULAStatusView (GET) to check acceptance status in Backend/api/views/eula_acceptance.py
- [X] T054 [US3] Implement EULAAcceptView (POST) to record acceptance in Backend/api/views/eula_acceptance.py
- [X] T055 [US3] Implement EULAContentView (GET) to retrieve EULA text in Backend/api/views/eula_acceptance.py
- [X] T056 [US3] Add EULA acceptance check to existing merchant upload endpoints
- [X] T057 [US3] Register EULA URL routes in Backend/Backend/urls.py

### Frontend Implementation for User Story 3

- [X] T058 [P] [US3] Create eulaAPI.ts service in Mobile-Merchant-Frontend/services/eulaAPI.ts
- [X] T059 [P] [US3] Create TypeScript interfaces for EULA request/response in eulaAPI.ts
- [X] T060 [US3] Create EULAModal.tsx component in Mobile-Merchant-Frontend/app/components/EULAModal.tsx
- [X] T061 [US3] Implement scroll-to-bottom detection to enable "I Agree" checkbox in EULAModal
- [X] T062 [US3] Display content guidelines within EULA modal
- [X] T063 [US3] Add EULA acceptance check hook/wrapper for upload screens
- [X] T064 [US3] Integrate EULA gate into store logo upload flow
- [X] T065 [US3] Integrate EULA gate into coupon image upload flow

**Checkpoint**: User Story 3 complete - merchants must accept EULA before first upload

---

## Phase 6: User Story 4 - Administrator Reviews Reported Content (Priority: P2)

**Goal**: Admin moderation dashboard with queue, actions, and 24-hour SLA escalation

**Independent Test**: Admin logs into moderation dashboard, views queue of reported content with timestamps, processes a report by taking an action (approve/remove/suspend).

### Backend Implementation for User Story 4

- [X] T066 [P] [US4] Create admin_moderation.py view module at Backend/api/views/admin_moderation.py
- [X] T067 [US4] Implement ModerationQueueView (GET) with filtering/sorting in Backend/api/views/admin_moderation.py
- [X] T068 [US4] Implement ReportDetailView (GET) for single report details in Backend/api/views/admin_moderation.py
- [X] T069 [US4] Implement ModerationActionView (POST) for approve/remove/suspend actions in Backend/api/views/admin_moderation.py
- [X] T070 [US4] Implement content hiding logic when admin removes content
- [X] T071 [US4] Implement violation recording when content is removed
- [X] T072 [US4] Implement suspension flag logic when violation count reaches 10
- [X] T073 [US4] Implement EscalatedReportsView (GET) for reports past 20h threshold
- [X] T074 [US4] Implement MerchantViolationsView (GET) for merchant history
- [X] T075 [US4] Implement ModerationStatsView (GET) for dashboard overview
- [X] T076 [US4] Register admin moderation URL routes in Backend/Backend/urls.py
- [X] T077 [US4] Create escalation email notification using Resend API in moderation_service.py
- [X] T078 [US4] Create cleanup_old_reports management command at Backend/api/management/commands/cleanup_old_reports.py
- [X] T079 [US4] Create check_escalations management command at Backend/api/management/commands/check_escalations.py
- [X] T080 [US4] Implement merchant notification when content is removed

**Checkpoint**: User Story 4 complete - admins can moderate reports with full audit trail

---

## Phase 7: User Story 5 - Consumer Accesses Support and Privacy Information (Priority: P2)

**Goal**: Accessible support contact info and privacy policy (available without login)

**Independent Test**: User (logged in or not) navigates to Help/Support section and verifies contact methods and privacy policy are accessible within 2 taps.

### Backend Implementation for User Story 5

- [X] T081 [P] [US5] Implement ContentGuidelinesView (GET, no auth) in Backend/api/views/eula_acceptance.py
- [X] T082 [P] [US5] Implement PrivacyPolicyView (GET, no auth) in Backend/api/views/eula_acceptance.py
- [X] T083 [US5] Register public legal routes (no auth required) in Backend/Backend/urls.py

### Frontend Implementation for User Story 5

- [X] T084 [P] [US5] Create HelpSupport screen at Mobile-Frontend/app/OptionsMenu/HelpSupport/index.tsx
- [X] T085 [US5] Display support email and support URL in HelpSupport screen
- [X] T086 [P] [US5] Create PrivacyPolicy screen at Mobile-Frontend/app/OptionsMenu/PrivacyPolicy/index.tsx
- [X] T087 [US5] Fetch and display privacy policy content in PrivacyPolicy screen
- [X] T088 [US5] Add PrivacyPolicy link to login screen (accessible without auth)
- [X] T089 [US5] Add HelpSupport and PrivacyPolicy navigation items to OptionsMenu/Settings
- [X] T090 [US5] Add Help/Support link to store profile screen

**Checkpoint**: User Story 5 complete - privacy policy and support info accessible within 2 taps

---

## Phase 8: User Story 6 - Merchant Views Content Guidelines and Penalties (Priority: P3)

**Goal**: Merchants can review content guidelines and penalty information anytime

**Independent Test**: Merchant navigates to Settings > Content Guidelines and verifies clear prohibited content list and penalty information are displayed.

### Frontend Implementation for User Story 6

- [X] T091 [P] [US6] Create ContentGuidelines screen at Mobile-Merchant-Frontend/app/OptionsMenu/ContentGuidelines/index.tsx
- [X] T092 [US6] Fetch and display prohibited content categories with examples
- [X] T093 [US6] Display penalty tiers (content removal, account suspension thresholds)
- [X] T094 [US6] Add ContentGuidelines link within EULA modal
- [X] T095 [US6] Add ContentGuidelines navigation item to merchant Settings menu

**Checkpoint**: User Story 6 complete - merchants can view guidelines and penalties anytime

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T096 [P] Verify all Chinese UI text is consistent across screens
- [X] T097 [P] Add loading states and error handling to all new API calls
- [X] T098 Ensure blocked merchant filtering applied to all coupon/store list endpoints
- [X] T099 [P] Add success toast messages for report submission, block/unblock actions
- [X] T100 Run quickstart.md verification checklist
- [X] T101 [P] Add TypeScript strict mode compliance check for new frontend files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1, US2, US3 are P1 (MVP core) - can proceed in parallel after Phase 2
  - US4, US5 are P2 - can proceed after Phase 2, may start after US1 for context
  - US6 is P3 - lowest priority, can start after Phase 2
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - standalone
- **User Story 2 (P1)**: No dependencies on other stories - standalone
- **User Story 3 (P1)**: No dependencies on other stories - standalone (merchant app)
- **User Story 4 (P2)**: Benefits from US1 being complete (reports to moderate)
- **User Story 5 (P2)**: No dependencies on other stories - standalone
- **User Story 6 (P3)**: Shares content with US3 EULA - can integrate

### Within Each User Story

- Backend before frontend (APIs must exist)
- Views/serializers before URL routes
- Core functionality before integration points
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks with shared model file done sequentially; T009, T010 can run in parallel
- Foundational serializers (T012-T015) can run in parallel after T011
- Static content files (T017-T019) can run in parallel
- After Phase 2: US1, US2, US3 backend can start in parallel
- Frontend tasks marked [P] within same story can run in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# After T011 (ContentReportSerializer) completes:
# Launch these in parallel:
Task: T012 BlockedMerchantSerializer
Task: T013 EULAAcceptSerializer
Task: T014 ModerationActionSerializer
Task: T015 ViolationRecordSerializer

# Launch static files in parallel:
Task: T017 EULA content file
Task: T018 Guidelines content file
Task: T019 Privacy policy file
```

---

## Parallel Example: User Story 1 + 2 + 3 (After Phase 2)

```bash
# US1 Backend + US2 Backend + US3 Backend can start simultaneously:
Task: T020 [US1] Create content_moderation.py
Task: T035 [US2] Implement BlockMerchantView (in same file as T020, so sequential)
Task: T052 [US3] Create eula_acceptance.py (different file, parallel)

# US1 Frontend + US2 Frontend + US3 Frontend (once backend APIs ready):
Task: T026 [US1] contentReportAPI.ts
Task: T042 [US2] blockListAPI.ts
Task: T058 [US3] eulaAPI.ts (Merchant app, parallel)
```

---

## Implementation Strategy

### MVP First (P1 User Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Report mechanism)
4. Complete Phase 4: User Story 2 (Block merchants)
5. Complete Phase 5: User Story 3 (EULA acceptance)
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Deploy/demo if ready - this satisfies core Apple Guideline 1.2 requirements

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test → Deploy (Report mechanism live)
3. Add User Story 2 → Test → Deploy (Block feature live)
4. Add User Story 3 → Test → Deploy (EULA gate live) - **MVP Complete!**
5. Add User Story 4 → Test → Deploy (Admin moderation)
6. Add User Story 5 → Test → Deploy (Support/Privacy info)
7. Add User Story 6 → Test → Deploy (Guidelines for merchants)
8. Add Polish phase → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Consumer - Report)
   - Developer B: User Story 2 (Consumer - Block)
   - Developer C: User Story 3 (Merchant - EULA)
3. Stories complete and integrate independently
4. Developer A continues: User Story 4 (Admin)
5. Developer B continues: User Story 5 (Support/Privacy)
6. Developer C continues: User Story 6 (Guidelines)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Chinese UI text required for all user-facing messages
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Consumer app: Mobile-Frontend, Merchant app: Mobile-Merchant-Frontend
