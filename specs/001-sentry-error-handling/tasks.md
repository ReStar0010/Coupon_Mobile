# Tasks: Sentry Error Boundaries and Exception Capture

**Input**: Design documents from `/specs/001-sentry-error-handling/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/error-boundary-interface.md ✅, quickstart.md ✅

**Tests**: No automated tests required — per plan.md Constitution Check, manual E2E verification via deliberate `throw` injection is the standard approach for error boundary coverage. Run `npm run typecheck` and `npm run lint` in each app after implementation.

**Organization**: Tasks grouped by user story to enable independent implementation and testing. Frontend-only changes; no backend involved. Both apps already have `@sentry/react-native` v7.2.0 installed with `Sentry.init()` and `Sentry.wrap()` at root — no new packages needed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

## Path Conventions

- `Mobile-Frontend/app/` — Consumer app (Expo managed workflow)
- `Mobile-Merchant-Frontend/app/` — Merchant app (Expo managed workflow)
- No backend changes in this feature

---

## Phase 1: Setup (Shared Fallback Components)

**Purpose**: Create the new shared UI components that US1 (screen boundaries) and US2 (widget boundaries) depend on. No new npm packages — `@sentry/react-native` v7.2.0 is already installed with `Sentry.init()` and `Sentry.wrap()` configured at root in both apps.

- [ ] T001 Create full-screen fallback component in Mobile-Frontend/app/components/ScreenErrorFallback.tsx (flex=1 centered layout, 發生錯誤，請稍後再試 message, primary 重新載入 button → resetError(), secondary 返回 button → router.back(), Tamagui primitives only per contracts/error-boundary-interface.md, no context or screen imports)
- [ ] T002 [P] Create compact inline fallback component in Mobile-Frontend/app/components/WidgetErrorFallback.tsx (width=100%, minHeight prop defaulting to 120, #f5f5f5 background, 1px #e0e0e0 border, borderRadius 8, centered message prop in fontSize 13 #999999, no retry button per FR-010)
- [ ] T003 [P] Create sheet-filling modal fallback component in Mobile-Frontend/app/components/ModalErrorFallback.tsx (flex=1 centered, 抽獎功能暫時無法使用 message, single 關閉 button → calls onDismiss() which invokes resetError() to reset boundary, no router.back() navigation per data-model.md)
- [ ] T004 [P] Create full-screen fallback component in Mobile-Merchant-Frontend/app/components/ScreenErrorFallback.tsx (same interface and behavior as T001 per contracts/error-boundary-interface.md)
- [ ] T005 [P] Create compact inline fallback component in Mobile-Merchant-Frontend/app/components/WidgetErrorFallback.tsx (same interface and behavior as T002)

**Checkpoint**: Shared fallback components created — US1, US2, and US3 can all begin in parallel.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No additional foundational tasks required for this feature. `@sentry/react-native` v7.2.0 is already installed in both frontends with `Sentry.init()` and `Sentry.wrap()` configured at root. All three user stories can proceed as soon as Phase 1 is complete.

**⚠️ CRITICAL**: Phase 1 must complete before US1 and US2 can begin. US3 (`captureException` additions require only existing Sentry imports — no fallback components needed) can also start once Phase 1 is complete, or in parallel with US1/US2.

**Checkpoint**: Foundation ready — all three user stories can now begin.

---

## Phase 3: User Story 1 - Graceful Fallback on Screen Crash (Priority: P1) 🎯 MVP

**Goal**: Wrap all major screens in both apps with `Sentry.ErrorBoundary` so that a render error in a single screen shows a full-screen fallback with recovery actions (重新載入 + 返回), instead of crashing the entire app. Replace the two existing custom `ErrorBoundary` usages and delete the obsolete component.

**Independent Test**: Add `throw new Error('test-boundary')` inside the Collection screen return statement → navigate to the Collection tab → confirm full-screen fallback appears with 重新載入 and 返回 buttons → tab bar remains functional → other tabs are navigable → Sentry dashboard shows exactly one event tagged `boundary: collection-screen`, `boundary_type: screen`.

### Implementation for User Story 1

- [ ] T006 [P] [US1] Replace custom `<ErrorBoundary>` import and usage with `<Sentry.ErrorBoundary fallback={({error, componentStack, resetError}) => <ScreenErrorFallback .../>} beforeCapture={(scope) => { scope.setTag('boundary', 'collection-screen'); scope.setTag('boundary_type', 'screen'); }}>` in Mobile-Frontend/app/(tabs)/collection/index.tsx
- [ ] T007 [P] [US1] Add `<Sentry.ErrorBoundary>` screen boundary (tag: easyuse-screen, boundary_type: screen) wrapping the entire return value in Mobile-Frontend/app/(tabs)/easyuse/index.tsx (no existing ErrorBoundary to replace — this is a new addition)
- [ ] T008 [P] [US1] Replace custom `<ErrorBoundary>` import and usage with `<Sentry.ErrorBoundary>` screen boundary (tag: statistics-screen, boundary_type: screen) in Mobile-Frontend/app/(tabs)/statistics/index.tsx
- [ ] T009 [US1] Delete Mobile-Frontend/app/components/ErrorBoundary.tsx after T006 and T008 have replaced all its usages (verify zero remaining imports before deleting)
- [ ] T010 [P] [US1] Add `<Sentry.ErrorBoundary>` screen boundary (tag: coupon-list-screen, boundary_type: screen) wrapping the return value in Mobile-Merchant-Frontend/app/(coupons)/index.tsx
- [ ] T011 [P] [US1] Add `<Sentry.ErrorBoundary>` screen boundary (tag: coupon-detail-screen, boundary_type: screen) wrapping the return value in Mobile-Merchant-Frontend/app/(coupons)/[id].tsx
- [ ] T012 [P] [US1] Add `<Sentry.ErrorBoundary>` screen boundary (tag: profile-screen, boundary_type: screen) wrapping the return value in Mobile-Merchant-Frontend/app/(profile)/index.tsx
- [ ] T013 [P] [US1] Add `<Sentry.ErrorBoundary>` screen boundary (tag: qr-claim-screen, boundary_type: screen) wrapping the return value in Mobile-Frontend/app/(tabs)/easyuse/qr-claim.tsx (per spec.md FR-001 and Clarifications; covers the dedicated full-screen camera route; QRClaimScanner.tsx rendered inside it requires no additional boundary per FR-001a)

**Checkpoint**: All 7 major screens protected (4 Mobile-Frontend + 3 Merchant). Render errors on any listed screen now show ScreenErrorFallback instead of crashing the entire app. Custom ErrorBoundary.tsx deleted.

---

## Phase 4: User Story 2 - Graceful Fallback on Widget Crash (Priority: P2)

**Goal**: Add `Sentry.ErrorBoundary` widget-level boundaries to embedded sub-components (Map, Daily Draw Modal, Location Picker) so that a single crashing widget shows a compact inline error placeholder without taking down its parent screen. Note: QRClaimScanner is excluded per spec.md FR-001a — it is covered by the qr-claim-screen boundary (T013).

**Independent Test**: Add `throw new Error('test-map')` near the top of the MapComponent return → navigate to the EasyUse tab → confirm only the map area shows the inline fallback ("地圖暫時無法顯示") → the rest of the EasyUse screen (coupon list, search bar) renders normally → Sentry dashboard shows exactly one event tagged `boundary: map-widget`, `boundary_type: widget`.

### Implementation for User Story 2

- [ ] T014 [P] [US2] Add `<Sentry.ErrorBoundary>` widget boundary (tag: map-widget, boundary_type: widget) around the MapView block inside Mobile-Frontend/app/components/MapComponent.tsx (fallback: static ReactNode `<WidgetErrorFallback message="地圖暫時無法顯示" minHeight={200} />` per contracts widget contract — no render function needed)
- [ ] T015 [P] [US2] Add `<Sentry.ErrorBoundary>` widget boundary (tag: daily-draw-widget, boundary_type: widget) around the Sheet children inside Mobile-Frontend/app/(tabs)/collection/components/DailyDrawModal.tsx (fallback: render function `({ resetError }) => <ModalErrorFallback onDismiss={resetError} />` — render function required here because onDismiss needs resetError; no router.back())
- [ ] T016 [US2] Add `<Sentry.ErrorBoundary>` widget boundary (tag: location-picker-widget, boundary_type: widget) around the location picker component block inside Mobile-Merchant-Frontend/app/components/LocationPicker.tsx (fallback: `<WidgetErrorFallback message="位置選擇器暫時無法使用" />`)

**Checkpoint**: All 3 identified widgets protected (2 Mobile-Frontend + 1 Merchant). A crashing widget now shows an inline placeholder without affecting the surrounding screen.

---

## Phase 5: User Story 3 - Unexpected API and Runtime Failures Are Tracked (Priority: P3)

**Goal**: Add `Sentry.captureException()` to all qualifying try-catch blocks in both apps that currently swallow unexpected failures silently. Expected control-flow catches (401 auth, validation, user cancellation, known timeouts, `isCancel(err)`) are explicitly excluded per FR-006 and research.md §2.

**Independent Test**: Add `throw new Error('test-storage')` inside the `AsyncStorage.getItem` call in DismissedStoresProvider → launch the app → confirm the app continues running (existing graceful handling unchanged) → confirm Sentry dashboard shows exactly one event for the storage failure.

### Implementation for User Story 3 — Mobile-Frontend (10 captureException additions)

- [ ] T017 [P] [US3] Add `Sentry.captureException(error, { data: { context: 'OTA update non-timeout failure' } })` after the existing console.error in the non-timeout catch branch only in Mobile-Frontend/app/_layout.tsx (the UPDATE_CHECK_TIMEOUT branch is expected — do NOT add captureException there per FR-006)
- [ ] T018 [P] [US3] Add `Sentry.captureException(error, { data: { context: 'useDailyDraw.checkLastDrawDate' } })` after the existing console.error in the swallowed catch block in Mobile-Frontend/app/(tabs)/collection/hooks/useDailyDraw.ts
- [ ] T019 [P] [US3] Add `Sentry.captureException(error, { data: { context: 'couponUtils.copyToClipboard' } })` after the existing console.error in the Clipboard.setString failure catch in Mobile-Frontend/app/(tabs)/collection/utils/couponUtils.ts
- [ ] T020 [P] [US3] Add `Sentry.captureException()` to both the AsyncStorage.getItem failure catch (context: 'DismissedStoresProvider.loadDismissedStores') and the AsyncStorage.setItem failure catch (context: 'DismissedStoresProvider.saveDismissedStores') in Mobile-Frontend/app/components/providers/DismissedStoresProvider.tsx — 2 separate blocks, each after its existing console.error
- [ ] T021 [P] [US3] Add `Sentry.captureException(error, { data: { context: 'history.saveCouponHistory' } })` after the existing console.error in the AsyncStorage.setItem coupon history failure catch in Mobile-Frontend/app/(tabs)/statistics/history/index.tsx
- [ ] T022 [P] [US3] Add `Sentry.captureException(error, { data: { context: 'statistics.refreshData' } })` after the existing console.error in the Promise.all refresh failure catch in Mobile-Frontend/app/(tabs)/statistics/index.tsx
- [ ] T023 [P] [US3] Add `Sentry.captureException(error, { data: { context: 'PageHeader.saveOptionsMenuSource' } })` after the existing console.error in the AsyncStorage.setItem options menu source failure catch in Mobile-Frontend/app/components/PageHeader.tsx
- [ ] T024 [P] [US3] Add `Sentry.captureException()` to both the analytics trackTemplateView POST failure catch (context: 'easyuse.trackTemplateView') and the Linking.openURL maps navigation failure catch (context: 'easyuse.openMapsNavigation') in Mobile-Frontend/app/(tabs)/easyuse/[id]/index.tsx — 2 separate blocks, each after its existing console.error (per FR-006a: trackTemplateView is reportable as it feeds merchant-facing behavioral analytics)

### Implementation for User Story 3 — Mobile-Merchant-Frontend (comprehensive audit)

- [ ] T025a [US3] Discover all try-catch blocks in Mobile-Merchant-Frontend: read every `.ts` and `.tsx` file under Mobile-Merchant-Frontend/app/, list each try-catch block with its file path and a one-line description of the caught operation, then classify each as reportable or expected per the criteria in research.md §2 — output a structured table of (file path, caught operation, classification: reportable/expected, reason) before proceeding to T025
- [ ] T025 [US3] Using the classification table produced by T025a, add `Sentry.captureException(error, { data: { context: '...' } })` after existing console.error calls in every block classified as reportable — exclude: HTTP 401/auth redirect, HTTP 404/403 expected states, isCancel(err) Axios cancels, UPDATE_CHECK_TIMEOUT, QR JSON.parse failures, location permission denied, Share.share() rejection, backend validation errors surfaced to the user (depends on T025a)

**Checkpoint**: All unexpected silent failures in both apps now reported to Sentry. Expected control-flow catches remain silent per FR-006. Zero existing console.error calls removed per FR-007.

---

## Phase 6: Polish & Verification

**Purpose**: Validate TypeScript correctness, lint compliance, and end-to-end acceptance criteria across both apps.

- [ ] T026 [P] Run `cd Mobile-Frontend && npm run lint && npm run typecheck` and fix any type errors or lint violations introduced by the boundary wrappers and captureException additions
- [ ] T027 [P] Run `cd Mobile-Merchant-Frontend && npm run lint && npm run typecheck` and fix any type errors or lint violations
- [ ] T028 Execute all 6 verification scenarios from quickstart.md in order: (1) screen boundary full-screen fallback — SC-001, (2) widget boundary inline fallback — SC-002, (3) captureException unexpected failure reporting — SC-003, (4) expected control-flow catch generates no event — SC-004, (5) console.error calls preserved alongside captureException — SC-005, (6) single error occurrence generates exactly one Sentry event — SC-006

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: N/A — no additional foundational tasks; Phase 1 creates all shared infrastructure
- **User Stories (Phase 3–5)**: All depend on Phase 1 completion
  - US1 (Phase 3): Requires T001 and T004 (ScreenErrorFallback in both apps)
  - US2 (Phase 4): Requires T001–T005 (all fallback components); T015 specifically requires T003 (ModalErrorFallback)
  - US3 (Phase 5): Requires only the existing `@sentry/react-native` import — no new components; can start immediately after Phase 1 (or even in parallel with Phase 1 since captureException changes are independent)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: T009 (delete ErrorBoundary.tsx) depends on T006 AND T008 completing first. All other US1 tasks are independent of each other.
- **User Story 2 (P2)**: T015 depends on T003 (ModalErrorFallback). T014 and T016 depend only on their respective WidgetErrorFallback components (T002 or T005). All are independent of US1.
- **User Story 3 (P3)**: Fully independent of US1 and US2. T017–T024 are all independent of each other (different files). T025a (discovery) must complete before T025 (audit); T025 depends on T025a.

### Within Each User Story

- All [P]-marked tasks within a story can run simultaneously (each modifies a different file)
- T009 is the only blocking dependency within US1: wait for T006 and T008, then delete
- T025a (discovery) must precede T025 (audit); T025a produces the classification table that T025 acts on

---

## Parallel Example: User Story 1 (Screen Boundaries)

```bash
# All 7 screen boundary tasks can run simultaneously once Phase 1 is complete:
Task T006: Mobile-Frontend/app/(tabs)/collection/index.tsx
Task T007: Mobile-Frontend/app/(tabs)/easyuse/index.tsx
Task T008: Mobile-Frontend/app/(tabs)/statistics/index.tsx
Task T010: Mobile-Merchant-Frontend/app/(coupons)/index.tsx
Task T011: Mobile-Merchant-Frontend/app/(coupons)/[id].tsx
Task T012: Mobile-Merchant-Frontend/app/(profile)/index.tsx
Task T013: Mobile-Frontend/app/(tabs)/easyuse/qr-claim.tsx

# After T006 and T008 complete:
Task T009: Delete Mobile-Frontend/app/components/ErrorBoundary.tsx
```

## Parallel Example: User Story 3 (captureException — Mobile-Frontend)

```bash
# All 8 Mobile-Frontend captureException tasks can run simultaneously:
Task T017: Mobile-Frontend/app/_layout.tsx
Task T018: Mobile-Frontend/app/(tabs)/collection/hooks/useDailyDraw.ts
Task T019: Mobile-Frontend/app/(tabs)/collection/utils/couponUtils.ts
Task T020: Mobile-Frontend/app/components/providers/DismissedStoresProvider.tsx
Task T021: Mobile-Frontend/app/(tabs)/statistics/history/index.tsx
Task T022: Mobile-Frontend/app/(tabs)/statistics/index.tsx
Task T023: Mobile-Frontend/app/components/PageHeader.tsx
Task T024: Mobile-Frontend/app/(tabs)/easyuse/[id]/index.tsx

# T025a and T025 are sequential (discovery must precede audit):
Task T025a: Mobile-Merchant-Frontend — read all .ts/.tsx files, list and classify every try-catch block
Task T025: Mobile-Merchant-Frontend — add captureException to qualifying blocks (depends on T025a)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Create 5 shared fallback components (T001–T005)
2. Complete Phase 3 US1: Add screen-level boundaries to all 7 screens + delete ErrorBoundary.tsx (T006–T013, then T009)
3. **STOP and VALIDATE**: Trigger render error on Collection screen → confirm ScreenErrorFallback appears → confirm tab bar remains functional → confirm Sentry event tagged correctly
4. Deploy/demo: App no longer crash-exits on isolated screen render errors (SC-001)

### Incremental Delivery

1. Phase 1 (T001–T005) → Shared components ready
2. Phase 3 (T006–T013, T009) → Screen crash protection → Validate (SC-001) → **Deploy MVP**
3. Phase 4 (T014–T016) → Widget crash isolation → Validate (SC-002) → **Deploy**
4. Phase 5 (T017–T025) → Silent failure tracking → Validate (SC-003, SC-004, SC-005, SC-006) → **Deploy**
5. Phase 6 (T026–T028) → Full type/lint/E2E verification → **Done**

### Parallel Team Strategy

With multiple developers available after Phase 1:

- **Developer A**: US1 — screen boundaries (T006–T013, T009)
- **Developer B**: US2 — widget boundaries (T014–T016)
- **Developer C**: US3 Mobile-Frontend (T017–T024), then T025 Merchant audit

All three developers can work simultaneously; no cross-story file conflicts exist.

---

## Notes

- `[P]` tasks modify different files and have no inter-task dependencies — safe to parallelize
- `[Story]` label maps each implementation task to its user story for traceability and independent validation
- **Double-reporting prevention** (research.md §6): Never add `captureException` to catch blocks that re-throw; never call `captureException` in `onError` callbacks (boundary already captures automatically); never add `captureException` inside render functions covered by a wrapping boundary
- **Console.error preservation** (FR-007): `captureException` is always placed AFTER any existing `console.error` or `console.warn` call — never remove or alter existing logging
- **Expected flow exclusions** for T025 Merchant audit: skip HTTP 401/auth redirect, HTTP 404/403 expected states, `isCancel(err)` Axios cancels, `UPDATE_CHECK_TIMEOUT`, QR `JSON.parse` failures, location permission denied, `Share.share()` rejection, all backend validation errors surfaced to the user (see research.md §2 for the full classification table)
- **QR Scanner boundary resolved**: spec.md FR-001 + FR-001a + Clarifications are authoritative. T013 adds a screen boundary to `qr-claim.tsx`; `QRClaimScanner.tsx` receives no widget boundary (covered by its parent route's screen boundary per FR-001a). contracts/error-boundary-interface.md Boundary Registry has been updated accordingly.
- **`__DEV__` guards**: Do NOT add `if (!__DEV__)` guards around any `captureException` calls or `Sentry.ErrorBoundary` instances — rely on Sentry SDK's own dev/prod behaviour per spec.md Assumptions
