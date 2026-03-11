# Feature Specification: Sentry Error Monitoring Integration (Mobile Frontend)

**Feature Branch**: `001-sentry-integration`
**Created**: 2026-02-26
**Status**: Draft
**Input**: User description: "I have setup a sentry project to monitor Mobile-Frontend, I need you to add code at necessary places."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Automatic Crash & Error Capture (Priority: P1)

When the mobile app experiences an unhandled error or crash, the development team needs it automatically reported to the monitoring dashboard — including what the user was doing at the time — so they can identify, reproduce, and fix the issue quickly.

**Why this priority**: Without automatic error capture, production bugs go undetected until users report them manually. This is the foundation of all monitoring value and must work before anything else.

**Independent Test**: Can be fully tested by deliberately triggering an unhandled exception in the production build and verifying it appears in the Sentry dashboard with a stack trace within 60 seconds.

**Acceptance Scenarios**:

1. **Given** the app is running in production, **When** an unhandled JavaScript exception occurs, **Then** a complete error report (stack trace, device info, app version) is sent to the monitoring service automatically.
2. **Given** the app is running in production, **When** a React rendering error occurs (e.g., component crashes), **Then** the error is captured and a fallback UI is displayed to the user rather than a blank screen.
3. **Given** the app is in development mode, **When** an error occurs, **Then** the error is NOT sent to the monitoring service (to avoid polluting production data with dev noise).

---

### User Story 2 - Navigation Breadcrumbs & Context (Priority: P2)

When reviewing an error report, the development team needs to see the navigation history (which screens the user visited) and key user actions leading up to the crash, so they can reproduce the issue and understand the root cause.

**Why this priority**: A stack trace alone is often insufficient to reproduce bugs. Navigation context transforms an isolated error into a reproducible scenario, dramatically reducing investigation time.

**Independent Test**: Can be fully tested by navigating through multiple screens, triggering an error, and verifying the Sentry dashboard shows the screen visit history as breadcrumbs on that error.

**Acceptance Scenarios**:

1. **Given** a user navigates through multiple screens before an error occurs, **When** the error is reported, **Then** the error report includes an ordered list of recently visited screens as breadcrumbs.
2. **Given** a user performs key actions (login, coupon redemption attempt) before an error, **When** the error is reported, **Then** significant user actions are recorded as breadcrumbs alongside navigation events.

---

### User Story 3 - User Identity on Error Reports (Priority: P3)

When a logged-in user experiences an error, the development team needs the user's identity (non-sensitive identifier) attached to the error report so they can assess the impact scope and proactively reach out if needed.

**Why this priority**: Knowing which users are affected by an error helps prioritize fixes (high-value users vs. isolated cases) and enables proactive communication. Lower priority because errors are still captured without this context.

**Independent Test**: Can be fully tested by logging in as a known test user, triggering an error, and verifying the Sentry dashboard shows the test user's ID (not password or token) on the error report.

**Acceptance Scenarios**:

1. **Given** a user is logged in, **When** an error occurs, **Then** the error report includes the user's unique identifier (e.g., user ID or username) but NOT passwords, tokens, or other credentials.
2. **Given** a user is NOT logged in (guest), **When** an error occurs, **Then** the error report is captured without user identity information (anonymous report).
3. **Given** a user logs out, **When** a subsequent error occurs, **Then** the error report does not carry over the previous user's identity.

---

### User Story 4 - Significant Handled Error Reporting (Priority: P4)

When the app encounters an error it can partially recover from (e.g., a failed API call displayed to the user as "something went wrong"), the development team needs those significant failures also reported — not just fatal crashes — so recurring non-fatal issues can be tracked and fixed.

**Why this priority**: Many production issues are non-fatal (app doesn't crash) but indicate degraded experience. Without capturing these, high-frequency recoverable failures go unnoticed.

**Independent Test**: Can be fully tested by simulating an API failure, verifying the app shows a user-friendly error message, and confirming the failure also appears in the Sentry dashboard as a captured exception.

**Acceptance Scenarios**:

1. **Given** the app encounters a network or API error that it handles gracefully, **When** showing the user an error message, **Then** the underlying error is also reported to the monitoring service with relevant context.
2. **Given** an error is deliberately handled and reported, **When** viewing the Sentry dashboard, **Then** handled errors are distinguishable from fatal crashes (e.g., different severity level).

---

### Edge Cases

- What happens when the device is offline at the moment an error occurs? The monitoring service client should queue the error and send it when connectivity is restored.
- What happens if the error monitoring initialization itself fails? The app must still launch and function normally — monitoring is non-critical to app operation.
- What if an error occurs during the app startup sequence before monitoring is initialized? Startup errors should still be captured; initialization must happen as early as possible in the app lifecycle.
- How does the system prevent sensitive data (auth tokens, passwords, phone numbers) from appearing in error payloads? Monitoring must only attach non-sensitive identifiers and scrub or exclude sensitive fields.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST automatically capture all unhandled JavaScript exceptions and native crashes in production builds and transmit them to the configured monitoring project.
- **FR-002**: The system MUST render a graceful fallback UI (instead of a blank/frozen screen) when a rendering error occurs in any part of the app.
- **FR-003**: The system MUST record navigation events (screen transitions) as breadcrumbs attached to subsequent error reports.
- **FR-004**: The system MUST attach the logged-in user's unique identifier to error reports when a user is authenticated, and clear that association on logout.
- **FR-005**: The system MUST NOT include passwords, authentication tokens, or other credentials in any error report payload.
- **FR-006**: The system MUST provide a mechanism for the codebase to manually report significant handled errors (non-fatal failures) with contextual metadata.
- **FR-007**: The system MUST initialize the error monitoring client as early as possible in the application startup sequence, before any user-facing screens load.
- **FR-008**: The system MUST suppress error transmission when the app is running in a local development environment to prevent development noise in the monitoring dashboard.
- **FR-009**: The system MUST continue to operate normally (launch, navigate, serve users) even if the error monitoring initialization fails.
- **FR-010**: The system MUST queue error reports when the device is offline and transmit them when connectivity is restored.

### Key Entities

- **Error Report**: A record of a captured error including stack trace, app version, device/OS information, user identity (if authenticated), breadcrumb history, and severity level.
- **Breadcrumb**: A timestamped record of a user action or navigation event that preceded an error, used to reconstruct the sequence of events leading to the failure.
- **User Context**: A non-sensitive identifier (user ID) associated with the authenticated session, attached to error reports to identify affected users.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of unhandled errors occurring in production builds appear in the monitoring dashboard within 60 seconds of occurrence.
- **SC-002**: Every error report includes at least the last 5 navigation events as breadcrumbs, enabling the team to reproduce 90% of reported errors without additional user input.
- **SC-003**: Zero error reports contain passwords, authentication tokens, phone numbers, or other credentials — verifiable by security review of sample reports.
- **SC-004**: The app startup time increases by no more than 200ms due to monitoring initialization, maintaining a smooth launch experience.
- **SC-005**: The development team can identify which authenticated user was affected for 100% of errors that occurred during an authenticated session.
- **SC-006**: Non-fatal handled errors that affect the user experience (e.g., failed data loads) are captured and visible separately from crashes, enabling tracking of recurring soft failures.

## EAS / CI Builds (Android Release)

When building Android release (e.g. `gradlew :app:bundleRelease` or EAS Build), the Sentry Gradle plugin runs a task that uploads source maps. That task **requires** `SENTRY_AUTH_TOKEN`. If the token is not set (e.g. in EAS secrets), the build fails with:

```text
error: Auth token is required for this request. Please run `sentry-cli login` and try again!
```

**Fix**: Set `SENTRY_DISABLE_AUTO_UPLOAD=true` in the build environment (e.g. in `eas.json` under each profile’s `env`) so the upload task is skipped and the build succeeds. Error reporting in the app still works; only source map upload is disabled.

To **enable** source map upload later: add `SENTRY_AUTH_TOKEN` as an EAS secret and remove or set `SENTRY_DISABLE_AUTO_UPLOAD` to `false`.

## Assumptions

- The Sentry project has already been created and a valid DSN (connection string) is available for configuration.
- The monitoring tool is compatible with Expo-managed React Native workflow.
- Error monitoring applies to the Mobile-Frontend only; the Mobile-Merchant-Frontend and Backend are out of scope for this feature.
- Development/local builds will have monitoring disabled; staging and production builds will have it enabled.
- Performance monitoring (transaction tracing, slow renders) is out of scope for this initial integration — error capture is the sole focus.
- The app uses standard Expo/React Native navigation patterns that the monitoring client can instrument automatically.
