# Feature Specification: Sentry Error Boundaries and Exception Capture

**Feature Branch**: `001-sentry-error-handling`
**Created**: 2026-03-02
**Status**: Draft
**Scope**: Both `Mobile-Frontend` and `Mobile-Merchant-Frontend`
**Input**: User description: "Task 1 — Error Boundaries: Research the official Sentry React Native documentation to identify which components/screens warrant an Error Boundary. Apply Sentry.ErrorBoundary accordingly, and design an appropriate fallback UI for each boundary (the fallback scope and complexity should match the boundary level — full-screen vs. widget). Task 2 — Exception Capture in try-catch: Research the official Sentry documentation to identify what constitutes a 'reportable' error (unexpected failures vs. expected/handled control flow). Audit the existing try-catch blocks in the codebase, and add Sentry.captureException() to those that qualify — without removing existing console.error calls."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Graceful Fallback on Screen Crash (Priority: P1)

A user is navigating the app and a rendering error occurs inside a major screen (e.g. the Collection screen, EasyUse screen, or Statistics screen). Instead of the whole app crashing and closing, only the affected screen displays a user-friendly error message with an option to recover or go back. The rest of the app remains functional.

**Why this priority**: Preventing full-app crashes for isolated screen failures is the highest-impact improvement to user experience. Without screen-level boundaries, any rendering error crashes the entire session.

**Independent Test**: Can be fully tested by triggering a deliberate render error on the Collection screen and confirming a fallback message appears in place of the screen content, while the tab bar and other tabs remain usable.

**Acceptance Scenarios**:

1. **Given** the app is running normally, **When** a rendering error occurs inside the Collection, EasyUse, Statistics, or QR Claim screen, **Then** the affected screen displays a friendly fallback message with two recovery actions — "重新載入" (reload) and "返回" (go back) — without closing the entire app.
2. **Given** a screen-level fallback is displayed, **When** the user taps "重新載入", **Then** the app re-renders the screen; **When** the user taps "返回", **Then** the app navigates to the previous screen.
3. **Given** a screen-level error occurs, **When** the fallback is shown, **Then** the error is recorded in the error monitoring system with context indicating which screen it occurred in.

---

### User Story 2 - Graceful Fallback on Widget Crash (Priority: P2)

A user is interacting with a specific interactive widget within a screen — such as the Daily Draw modal or the Map component — and a rendering error occurs. Instead of the entire screen crashing, only that widget area displays an appropriate error state (compact inline for map; sheet-filling with dismiss for Daily Draw modal). The rest of the screen remains fully usable. Note: the QR Scanner renders as a dedicated full-screen route and is covered by a screen-level boundary, not a widget boundary.

**Why this priority**: Widget-level isolation prevents a single misbehaving sub-component from taking down an entire screen, which would otherwise force a full screen-level recovery.

**Independent Test**: Can be fully tested by triggering a deliberate error in the Map widget and confirming the map area shows an inline error placeholder while the rest of the screen (e.g. coupon details) continues to render.

**Acceptance Scenarios**:

1. **Given** a user is on a screen with an embedded widget (map or daily draw modal), **When** that widget encounters a rendering error, **Then** the widget area shows an appropriate error state — compact inline for the map; sheet-filling with a dismiss button for the daily draw modal — without affecting the rest of the screen.
2. **Given** a widget fallback is shown, **When** the error is recorded, **Then** the monitoring entry includes context identifying the specific widget that failed.

---

### User Story 3 - Unexpected API and Runtime Failures Are Tracked (Priority: P3)

A developer reviews the error monitoring dashboard and can see unexpected runtime failures that were caught inside try-catch blocks — for example, an OTA update check failing for reasons other than a known timeout, or a coupon data fetch returning a malformed response. These failures are visible in the dashboard with full context, even though the app handled them gracefully without crashing.

**Why this priority**: Without explicit capture of these handled-but-unexpected failures, they are silent — the app appears healthy while underlying issues go undetected. This is lower priority than crash prevention but critical for long-term stability.

**Independent Test**: Can be fully tested by simulating a malformed API response in the coupon fetch flow and confirming the error appears in the monitoring dashboard, while the app continues to display its existing error state to the user (no behavior change).

**Acceptance Scenarios**:

1. **Given** an unexpected failure occurs in an operation that is wrapped in a try-catch (e.g. an API call returns an unexpected error, or an OTA update fails with a non-timeout error), **When** the catch block executes, **Then** the failure is reported to the error monitoring system with the original error object and context.
2. **Given** an expected/handled flow occurs (e.g. 401 prompting a token refresh, a user submitting invalid input, or an auth redirect), **When** the catch block executes, **Then** no monitoring event is generated — these are not errors, they are normal control flow.
3. **Given** an existing `console.error` call is in a catch block, **When** monitoring capture is added to that same block, **Then** the `console.error` call is preserved alongside the new capture — existing logging behavior is unchanged.

---

### Edge Cases

- What happens when the root-level error boundary itself encounters an error? (Assumption: the root boundary is the last resort; its fallback must be minimal and self-contained with no dependencies.)
- How does the system avoid double-reporting when both a boundary and a try-catch catch the same error? (Each error must be reported exactly once — an exception must not be both explicitly captured and re-thrown to be captured again.)
- What happens when a widget fallback is visible but the user navigates away and back? (The boundary should reset when the component re-mounts.)
- How are expected network errors (e.g. device offline) classified? (Assumption: transient connectivity errors are expected/handled and should not be reported unless they represent an unexpected state.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Both `Mobile-Frontend` and `Mobile-Merchant-Frontend` MUST have screen-level `Sentry.ErrorBoundary` wrappers on their major screens. In Mobile-Frontend: Collection, EasyUse, Statistics, and QR Claim (`qr-claim.tsx` — a dedicated full-screen camera route). In Mobile-Merchant-Frontend: Coupon List, Coupon Detail, Profile. Auth screens (login, verify, reset-password) are explicitly excluded — they are covered by the root `Sentry.wrap` and contain no complex rendering logic warranting a granular boundary.
- **FR-001a**: Both apps MUST have widget-level `Sentry.ErrorBoundary` wrappers on contained sub-components that render embedded within a larger screen. In Mobile-Frontend: Map, Daily Draw Modal (uses Modal Fallback — see FR-010). In Mobile-Merchant-Frontend: Location Picker. Note: QR Scanner (`QRClaimScanner.tsx`) is excluded from widget boundaries — it renders as the sole content of the full-screen `qr-claim.tsx` route and is covered by that route's screen-level boundary instead.
- **FR-001b**: Both apps MUST have their qualifying try-catch blocks audited and augmented with `Sentry.captureException()`.
- **FR-002**: The full-screen fallback MUST include two recovery actions: a primary "重新載入" button that calls `resetError()` to re-render the screen, and a secondary "返回" button that calls `router.back()` to navigate to the previous screen.
- **FR-003**: The app MUST display a compact inline fallback when a rendering error occurs inside a contained widget (map, location picker) that is embedded within a larger screen, leaving the surrounding screen intact. The Daily Draw Modal uses a Modal Fallback (see FR-010). The QR Scanner is covered by a screen-level boundary on its dedicated route.
- **FR-004**: Each error boundary MUST tag errors with context identifying the screen section or widget where the error occurred, so that monitoring entries can be filtered by location.
- **FR-005**: Every try-catch block that handles an unexpected, non-recoverable, or unanticipated failure MUST report the exception to the error monitoring system.
- **FR-006**: Try-catch blocks that handle expected control flow (401 token refresh, user input validation failures, intentional auth redirects, known timeout scenarios) MUST NOT report to the error monitoring system.
- **FR-006a**: Template view tracking failures (`trackTemplateView`) MUST be treated as reportable exceptions. This endpoint feeds merchant-facing behavioral analytics — a silent failure means merchants receive incomplete data, which is a product integrity issue, not an acceptable background failure.
- **FR-007**: Adding exception capture to a try-catch block MUST NOT remove or alter any existing `console.error` or `console.warn` calls already present in that block.
- **FR-008**: Each error MUST be reported exactly once — the system MUST NOT both capture an exception in a catch block and re-throw it to be captured again by a boundary.
- **FR-009**: The root-level app wrapper (which already wraps the entire app) MUST remain in place and serve as the last-resort catch for any errors not caught by more granular boundaries.
- **FR-010**: Fallback UI complexity MUST be proportional to the boundary level: full-screen boundaries require a complete recovery screen (message + action button); widget-level boundaries require only a minimal inline indicator. Exception: the Daily Draw Modal boundary uses a sheet-filling fallback (message + dismiss/close button) because the Sheet occupies the user's full visual context when open — a compact inline indicator would be invisible and leave no escape path.

### Key Entities

- **Error Boundary**: A UI component wrapper that catches rendering errors within its subtree and renders a fallback UI instead of propagating the crash. Operates at screen level or widget level.
- **Full-Screen Fallback**: A complete screen-replacement UI shown when a screen-level boundary catches an error. Includes an error message and a recovery action.
- **Widget Fallback**: A compact inline UI element shown in place of a crashed widget. Does not affect surrounding screen content.
- **Modal Fallback**: A sheet-filling fallback used specifically for full-screen modal overlays (Daily Draw Modal). Fills the sheet content area with an error message and a dismiss button. Distinct from both Widget Fallback (too small for a full-screen sheet) and Full-Screen Fallback (no `router.back()` navigation — dismissing the sheet is the correct recovery).
- **Reportable Exception**: An unexpected, unanticipated failure caught in a try-catch block that represents a genuine problem requiring investigation (e.g. malformed API response, unexpected runtime error).
- **Expected Flow**: A caught exception that represents normal, anticipated application behavior (e.g. 401 triggering token refresh, validation failure, auth redirect). These are not reported to monitoring.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rendering error in any major screen section in either app results in a fallback UI being displayed rather than a full app crash — verifiable for 100% of identified screen-level boundaries across both Mobile-Frontend (Collection, EasyUse, Statistics, QR Claim) and Mobile-Merchant-Frontend (Coupon List, Coupon Detail, Profile).
- **SC-002**: A rendering error in any identified widget in either app results in only that widget's area showing an error state, with the rest of the screen remaining functional — verifiable for 100% of identified widget-level boundaries.
- **SC-003**: Every identified unexpected failure in a try-catch block in either app generates a corresponding entry in the error monitoring dashboard — zero silent unexpected failures among the audited catch blocks.
- **SC-004**: Zero expected/handled control-flow catch blocks (401 refresh, validation, auth redirect) generate monitoring events — confirmed by audit of each qualified catch block.
- **SC-005**: All existing `console.error` calls in augmented catch blocks remain present after the change — no logging behavior is removed.
- **SC-006**: No error appears more than once for a single occurrence — zero duplicate events for the same error instance in the monitoring dashboard.

## Assumptions

- The root-level app wrapper (`Sentry.wrap`) is already in place and intentionally left as-is; this feature adds granular boundaries below it, not a replacement.
- The decision of what constitutes "reportable" vs "expected" follows this principle: if the exception represents behavior the app has anticipated and recovered from without user impact, it is expected and not reportable.
- Transient connectivity/network errors that are handled gracefully are classified as expected unless they occur in a context where connectivity is assumed (e.g. a feature that cannot function offline).
- Tagging boundary errors with a section identifier is the standard approach when using multiple granular boundaries, enabling filtering in the monitoring dashboard.
- `captureException` calls and `Sentry.ErrorBoundary` instances are NOT guarded with `if (!__DEV__)`. The Sentry SDK's own default behaviour handles dev/prod separation. No per-call `__DEV__` boilerplate is added.

## Clarifications

### Session 2026-03-02

- Q: Should Mobile-Merchant-Frontend be in scope for this feature? → A: Yes — full scope: screen boundaries + captureException audit in Merchant Frontend
- Q: Should auth screens (login, verify, reset-password) have screen-level error boundaries? → A: No — covered by root Sentry.wrap; no granular boundaries needed
- Q: What recovery actions should the full-screen fallback include? → A: Both buttons — 重新載入 (resetError) and 返回 (router.back)
- Q: Should analytics tracking failures (trackTemplateView) be captured in Sentry? → A: Yes — this feeds merchant-facing behavioral analytics; silent failure is a product data integrity issue, not acceptable background noise
- Q: What fallback should the Daily Draw Modal boundary use? → A: Sheet-filling fallback — message + dismiss button sized to fill the sheet; no router.back() navigation
- Q: Is QRClaimScanner an embedded widget or a full-screen route? → A: Full-screen route — screen-level boundary on qr-claim.tsx; no widget boundary on QRClaimScanner component
- Q: Should captureException calls be suppressed in __DEV__ mode? → A: No — rely on Sentry SDK default behaviour; no per-call __DEV__ guards
