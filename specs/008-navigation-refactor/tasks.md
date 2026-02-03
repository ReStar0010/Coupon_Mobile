# Tasks: Navigation Refactor with Expo Router Tabs

**Input**: Design documents from `/specs/008-navigation-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Not requested - manual testing as defined in quickstart.md verification checklist.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Mobile Frontend**: `Mobile-Frontend/app/`
- **Components**: `Mobile-Frontend/app/components/`
- **Navigation**: `Mobile-Frontend/app/(tabs)/`, `Mobile-Frontend/app/(auth)/`, `Mobile-Frontend/app/options-menu/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and foundational layout files for new navigation architecture

- [X] T001 Create `(tabs)` directory structure in Mobile-Frontend/app/(tabs)/ with subdirectories: easyuse/, collection/, statistics/
- [X] T002 Create `(auth)` directory structure in Mobile-Frontend/app/(auth)/
- [X] T003 Create `options-menu` directory structure in Mobile-Frontend/app/options-menu/ with subdirectories: phone-settings/, blocked-merchants/, contact-us/, feedback/, help-support/, privacy-policy/, terms/, user-data/
- [X] T004 Create `navigation` components directory in Mobile-Frontend/app/components/navigation/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create all layout files that define the navigation structure. MUST be complete before any screen migration.

- [X] T005 Create root layout update plan: document all changes needed for Mobile-Frontend/app/_layout.tsx (providers, Stack screens for groups)
- [X] T006 Create tabs layout in Mobile-Frontend/app/(tabs)/_layout.tsx with Tabs component, screenOptions (colors, lazy, freezeOnBlur), and useSegments-based tab bar hiding
- [X] T007 [P] Create auth layout in Mobile-Frontend/app/(auth)/_layout.tsx with Stack navigator for login and reset-password screens
- [X] T008 [P] Create options-menu layout in Mobile-Frontend/app/options-menu/_layout.tsx with Stack navigator for all sub-screens
- [X] T009 [P] Create easyuse stack layout in Mobile-Frontend/app/(tabs)/easyuse/_layout.tsx for index, qr-claim, unified-redeem, and [id] routes
- [X] T010 [P] Create statistics stack layout in Mobile-Frontend/app/(tabs)/statistics/_layout.tsx for index and history routes
- [X] T011 Create TabLoadingSpinner component in Mobile-Frontend/app/components/navigation/TabLoadingSpinner.tsx with Tamagui Spinner

**Checkpoint**: All navigation layouts defined - screen migration can now begin

---

## Phase 3: User Story 1 - Seamless Tab Navigation (Priority: P1)

**Goal**: Enable native tab navigation between EasyUse, Collection, and Statistics with state preservation

**Independent Test**: Tap tab icons, verify each section loads, switch tabs and return to verify state (filters, scroll) is preserved

### Implementation for User Story 1

- [X] T012 [US1] Move Mobile-Frontend/app/EasyUse/index.tsx to Mobile-Frontend/app/(tabs)/easyuse/index.tsx, update relative imports
- [X] T013 [P] [US1] Move Mobile-Frontend/app/Collection/index.tsx to Mobile-Frontend/app/(tabs)/collection/index.tsx, update relative imports
- [X] T014 [P] [US1] Move Mobile-Frontend/app/Statistics/index.tsx to Mobile-Frontend/app/(tabs)/statistics/index.tsx, update relative imports
- [X] T015 [US1] Move Mobile-Frontend/app/EasyUse/qr-claim.tsx to Mobile-Frontend/app/(tabs)/easyuse/qr-claim.tsx, update imports
- [X] T016 [US1] Move Mobile-Frontend/app/EasyUse/unified-redeem/ directory to Mobile-Frontend/app/(tabs)/easyuse/unified-redeem/, update imports in all files
- [X] T017 [US1] Move Mobile-Frontend/app/EasyUse/[id]/ directory to Mobile-Frontend/app/(tabs)/easyuse/[id]/, update imports in all files
- [X] T018 [P] [US1] Move Mobile-Frontend/app/Collection/components/ to Mobile-Frontend/app/(tabs)/collection/components/, update imports
- [X] T019 [P] [US1] Move Mobile-Frontend/app/Collection/hooks/ to Mobile-Frontend/app/(tabs)/collection/hooks/, update imports
- [X] T020 [P] [US1] Move Mobile-Frontend/app/Collection/utils/ to Mobile-Frontend/app/(tabs)/collection/utils/, update imports
- [X] T021 [P] [US1] Move Mobile-Frontend/app/Collection/Gift.tsx to Mobile-Frontend/app/(tabs)/collection/Gift.tsx, update imports
- [X] T022 [P] [US1] Move Mobile-Frontend/app/Statistics/components/ to Mobile-Frontend/app/(tabs)/statistics/components/, update imports
- [X] T023 [P] [US1] Move Mobile-Frontend/app/Statistics/hooks/ to Mobile-Frontend/app/(tabs)/statistics/hooks/, update imports
- [X] T024 [US1] Move Mobile-Frontend/app/Statistics/History/ to Mobile-Frontend/app/(tabs)/statistics/history/, update imports (lowercase)
- [X] T025 [US1] Remove TabsFooter import and usage from Mobile-Frontend/app/(tabs)/easyuse/index.tsx
- [X] T026 [P] [US1] Remove TabsFooter import and usage from Mobile-Frontend/app/(tabs)/collection/index.tsx
- [X] T027 [P] [US1] Remove TabsFooter import and usage from Mobile-Frontend/app/(tabs)/statistics/index.tsx
- [X] T028 [US1] Update root layout Mobile-Frontend/app/_layout.tsx to include Stack.Screen for (tabs) group

**Checkpoint**: Tab navigation functional - users can switch between EasyUse, Collection, Statistics with state preservation

---

## Phase 4: User Story 2 - Options Menu Access (Priority: P1)

**Goal**: Enable consistent Options Menu access from any screen via top-right header button

**Independent Test**: Navigate to any screen, tap Options button in header, verify menu opens and back navigation works through hierarchy

### Implementation for User Story 2

- [X] T029 [US2] Move Mobile-Frontend/app/OptionsMenu/index.tsx to Mobile-Frontend/app/options-menu/index.tsx, update imports
- [X] T030 [P] [US2] Move Mobile-Frontend/app/OptionsMenu/PhoneSettings/ to Mobile-Frontend/app/options-menu/phone-settings/, update imports (lowercase)
- [X] T031 [P] [US2] Move Mobile-Frontend/app/OptionsMenu/BlockedMerchants/ to Mobile-Frontend/app/options-menu/blocked-merchants/, update imports
- [X] T032 [P] [US2] Move Mobile-Frontend/app/OptionsMenu/ContactUs/ to Mobile-Frontend/app/options-menu/contact-us/, update imports
- [X] T033 [P] [US2] Move Mobile-Frontend/app/OptionsMenu/FeedBack/ to Mobile-Frontend/app/options-menu/feedback/, update imports
- [X] T034 [P] [US2] Move Mobile-Frontend/app/OptionsMenu/HelpSupport/ to Mobile-Frontend/app/options-menu/help-support/, update imports
- [X] T035 [P] [US2] Move Mobile-Frontend/app/OptionsMenu/PrivacyPolicy/ to Mobile-Frontend/app/options-menu/privacy-policy/, update imports
- [X] T036 [P] [US2] Move Mobile-Frontend/app/OptionsMenu/Terms/ to Mobile-Frontend/app/options-menu/terms/, update imports
- [X] T037 [P] [US2] Move Mobile-Frontend/app/OptionsMenu/UserData/ to Mobile-Frontend/app/options-menu/user-data/, update imports
- [X] T038 [US2] Update Mobile-Frontend/app/components/shared/AppHeader.tsx to add Options button with router.push('/options-menu')
- [X] T039 [US2] Update root layout Mobile-Frontend/app/_layout.tsx to include Stack.Screen for options-menu group
- [X] T040 [US2] Update all OptionsMenu navigation calls to use new paths (e.g., /options-menu/phone-settings)

**Checkpoint**: Options Menu accessible from any screen with proper back navigation

---

## Phase 5: User Story 3 - Lazy Loading (Priority: P2)

**Goal**: Implement lazy loading for tab screens to reduce initial load time

**Independent Test**: Cold start app, verify only EasyUse loads initially. Tap Collection tab, see loading spinner then content.

### Implementation for User Story 3

- [X] T041 [US3] Add lazy: true to all Tabs.Screen options in Mobile-Frontend/app/(tabs)/_layout.tsx
- [X] T042 [US3] Wrap Mobile-Frontend/app/(tabs)/easyuse/index.tsx content with Suspense and TabLoadingSpinner fallback
- [X] T043 [P] [US3] Wrap Mobile-Frontend/app/(tabs)/collection/index.tsx content with Suspense and TabLoadingSpinner fallback
- [X] T044 [P] [US3] Wrap Mobile-Frontend/app/(tabs)/statistics/index.tsx content with Suspense and TabLoadingSpinner fallback

**Checkpoint**: Lazy loading functional - tabs load on first visit with spinner fallback

---

## Phase 6: User Story 4 - Consistent Navigation Patterns (Priority: P2)

**Goal**: Ensure consistent back navigation and hierarchical navigation behavior throughout the app

**Independent Test**: Navigate through complex paths (Tab -> Detail -> Options -> Settings -> back), verify each back returns to expected screen

### Implementation for User Story 4

- [X] T045 [US4] Move Mobile-Frontend/app/Login/ to Mobile-Frontend/app/(auth)/login/, update component to single login.tsx file structure
- [X] T046 [P] [US4] Move Mobile-Frontend/app/ResetPassword/ to Mobile-Frontend/app/(auth)/reset-password/, update to single file structure
- [X] T047 [US4] Update root layout Mobile-Frontend/app/_layout.tsx to include Stack.Screen for (auth) group
- [X] T048 [US4] Update Mobile-Frontend/app/index.tsx auth redirect to use /(tabs)/easyuse and /(auth)/login paths
- [X] T049 [US4] Update Mobile-Frontend/app/components/providers/AuthOrchestrator.tsx navigation paths to new structure
- [X] T050 [US4] Search and replace all router.push('/EasyUse') calls with router.push('/(tabs)/easyuse')
- [X] T051 [P] [US4] Search and replace all router.push('/Collection') calls with router.push('/(tabs)/collection')
- [X] T052 [P] [US4] Search and replace all router.push('/Statistics') calls with router.push('/(tabs)/statistics')
- [X] T053 [US4] Search and replace all router.push('/Login') calls with router.push('/(auth)/login')
- [X] T054 [US4] Search and replace all router.replace paths to use new route structure

**Checkpoint**: All navigation paths updated and consistent

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Clean up old files, verify all navigation works, final optimizations

- [ ] T055 Delete deprecated Mobile-Frontend/app/components/TabsFooter.tsx (can be deleted after testing)
- [ ] T056 Delete empty Mobile-Frontend/app/EasyUse/ directory after verifying all files moved (backup exists)
- [ ] T057 [P] Delete empty Mobile-Frontend/app/Collection/ directory after verifying all files moved (backup exists)
- [ ] T058 [P] Delete empty Mobile-Frontend/app/Statistics/ directory after verifying all files moved (backup exists)
- [ ] T059 [P] Delete empty Mobile-Frontend/app/OptionsMenu/ directory after verifying all files moved (backup exists)
- [ ] T060 [P] Delete empty Mobile-Frontend/app/Login/ directory after verifying all files moved (backup exists)
- [ ] T061 [P] Delete empty Mobile-Frontend/app/ResetPassword/ directory after verifying all files moved (backup exists)
- [X] T062 Run TypeScript type check: npx tsc --noEmit in Mobile-Frontend/ (有一些 className 錯誤需要修復)
- [ ] T063 Run linter: npm run lint in Mobile-Frontend/ and fix any errors (應在測試後執行)
- [ ] T064 Test deep links: coupro://easyuse, coupro://collection, coupro://statistics, coupro://options-menu (需要實際測試)
- [ ] T065 Run quickstart.md verification checklist (all 12 items) (需要實際測試)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T006 tabs layout must exist before screens can be moved)
- **User Story 2 (Phase 4)**: Depends on Foundational (T008 options-menu layout) - can run parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 completion (tab screens must be in place before wrapping with Suspense)
- **User Story 4 (Phase 6)**: Depends on US1 and US2 (navigation paths must exist before updating calls)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Can run parallel with US1
- **User Story 3 (P2)**: Depends on US1 (tab screens must be moved first)
- **User Story 4 (P2)**: Depends on US1 and US2 (all routes must exist before updating navigation calls)

### Within Each User Story

- Move/create files before updating imports
- Update imports in moved files immediately after move
- Remove old component usage after new structure is in place

### Parallel Opportunities

- **Phase 2**: T007, T008, T009, T010 can all run in parallel (different layout files)
- **Phase 3 (US1)**: T013, T014 parallel; T018-T023 parallel; T026, T027 parallel with T025
- **Phase 4 (US2)**: T030-T037 all parallel (different option screens)
- **Phase 5 (US3)**: T043, T044 parallel
- **Phase 6 (US4)**: T046 parallel with T045; T051, T052 parallel with T050
- **Phase 7**: T057-T061 all parallel (different directories to delete)

---

## Parallel Example: User Story 2 (Options Menu Migration)

```bash
# Launch all option screen moves together:
Task: "Move PhoneSettings/ to options-menu/phone-settings/"
Task: "Move BlockedMerchants/ to options-menu/blocked-merchants/"
Task: "Move ContactUs/ to options-menu/contact-us/"
Task: "Move FeedBack/ to options-menu/feedback/"
Task: "Move HelpSupport/ to options-menu/help-support/"
Task: "Move PrivacyPolicy/ to options-menu/privacy-policy/"
Task: "Move Terms/ to options-menu/terms/"
Task: "Move UserData/ to options-menu/user-data/"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Tab Navigation)
4. Complete Phase 4: User Story 2 (Options Menu)
5. **STOP and VALIDATE**: Test tab switching and Options Menu access
6. Basic app navigation should be fully functional at this point

### Incremental Delivery

1. Setup + Foundational → Navigation structure ready
2. Add User Story 1 → Test tab switching → Functional tabs (MVP!)
3. Add User Story 2 → Test Options Menu → Complete navigation structure
4. Add User Story 3 → Test lazy loading → Performance improvement
5. Add User Story 4 → Test all paths → Full consistency
6. Polish → Clean up → Production ready

### Single Developer Strategy

1. Complete Setup + Foundational first
2. Work through User Stories in priority order (1 → 2 → 3 → 4)
3. Test each story independently before moving to next
4. Final Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify app compiles after each major file move
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: editing same file from multiple tasks simultaneously
