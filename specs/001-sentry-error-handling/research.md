# Research: Sentry Error Boundaries and Exception Capture

**Feature**: 001-sentry-error-handling
**Date**: 2026-03-02

## 1. Sentry.ErrorBoundary API (React Native)

**Decision**: Use `Sentry.ErrorBoundary` from `@sentry/react-native` v7.2.0 — already installed.
**Rationale**: Re-exports from `@sentry/react`; provides `beforeCapture`, `fallback`, `onError`, and `showDialog` props; automatically calls `captureException` on caught render errors with no additional configuration.

### Props used in this feature

```typescript
<Sentry.ErrorBoundary
  fallback={({ error, componentStack, resetError }) => (
    <FallbackComponent error={error} resetError={resetError} />
  )}
  beforeCapture={(scope, error, componentStack) => {
    scope.setTag('boundary', 'collection-screen');
    scope.setTag('boundary_type', 'screen');
  }}
  onError={(error, componentStack, eventId) => {
    // called AFTER Sentry has already captured — do NOT call captureException here
  }}
>
  {children}
</Sentry.ErrorBoundary>
```

**Key behavior**: `Sentry.ErrorBoundary` calls `captureException` automatically. `beforeCapture` runs before capture and sets scope tags. `onError` runs after capture. The `fallback` prop accepts either a ReactNode or a render function receiving `{ error, componentStack, resetError, eventId }`.

**Alternatives considered**:
- Custom class component with `componentDidCatch` calling `captureException` manually — rejected because `Sentry.ErrorBoundary` is the canonical approach and handles scope tagging cleanly.
- `Sentry.withErrorBoundary` HOC — viable but wrapping in JSX is more explicit and readable.

---

## 2. Reportable vs. Expected: Classification Criteria

**Decision**: An exception is reportable (warrants `captureException`) if ALL of these apply:
1. The exception is not anticipated by the feature spec (not 401, not user input error, not known timeout variant)
2. The app continues without user notification — a "silent failure" where the underlying cause warrants investigation
3. The catch block currently swallows the error with only a `console.error`

**NOT reportable — expected control flow**:
- HTTP 401 → token refresh or auth redirect (AuthOrchestrator handles globally)
- HTTP 404 on share tokens or coupon IDs → normal "not found" app states
- HTTP 403 on gift claims → normal permission denial states
- `isCancel(err)` from Axios — deliberate AbortController cancel
- `UPDATE_CHECK_TIMEOUT` error message — explicitly handled timeout variant
- QR JSON parse failure — malformed user input (scanning wrong QR code)
- Location permission denied — user choice
- `Share.share()` rejection — user cancelled native share dialog
- Any validation error from the backend API (expected, surfaced to user)
- `Unknown` errors in `devError()` utility — already normalized

**Reportable — unexpected failures** (add `captureException`):

| Block | File | Reason |
|-------|------|--------|
| OTA update: non-timeout catch branch | `app/_layout.tsx` | Unexpected OTA system failure |
| Check last draw date swallowed silently | `app/(tabs)/collection/hooks/useDailyDraw.ts` | AsyncStorage/API failure with no state update or user feedback |
| Copy to clipboard failure | `app/(tabs)/collection/utils/couponUtils.ts` | Platform Clipboard API failure — user not notified |
| Load dismissed stores failure | `app/components/providers/DismissedStoresProvider.tsx` | AsyncStorage read failure — state inconsistency possible |
| Save dismissed stores failure | `app/components/providers/DismissedStoresProvider.tsx` | AsyncStorage write failure — persistent state lost |
| AsyncStorage coupon history save | `app/(tabs)/statistics/history/index.tsx` | Storage persistence failure — silent |
| Promise.all refresh failure swallowed | `app/(tabs)/statistics/index.tsx` | Multi-fetch refresh failure — only loading state cleared |
| AsyncStorage options menu source write | `app/components/PageHeader.tsx` | Storage write failure — silent |
| Analytics track view failure | `app/(tabs)/easyuse/[id]/index.tsx` | Analytics endpoint failure — silent (low severity but still tracked) |
| Linking.openURL maps failure | `app/(tabs)/easyuse/[id]/index.tsx` | Navigation failure — user tapped maps button with no result |

---

## 3. Widget-Level Boundary Scope

**Decision**: Widget boundaries wrap only the outermost JSX block of the widget subcomponent that contains third-party or complex rendering.

**Mobile-Frontend widget boundaries identified**:

| Widget | File | What the boundary wraps |
|--------|------|------------------------|
| Map | `app/components/MapComponent.tsx` | The `MapView` + overlay block |
| QR Scanner | `app/components/QRClaimScanner.tsx` | The `CameraView` block |
| Daily Draw Modal | `app/(tabs)/collection/components/DailyDrawModal.tsx` | The `Sheet` children |

**Mobile-Merchant-Frontend widget boundaries identified**:

| Widget | File | What the boundary wraps |
|--------|------|------------------------|
| Location Picker | `app/components/LocationPicker.tsx` | The map/location picker component block |

**Fallback for widgets**: Compact inline placeholder — short localized text (e.g., "地圖暫時無法顯示") with no action button. Dimensions approximate the widget's area via `flex` and `minHeight`.

---

## 4. Screen-Level Boundary Placement

**Decision**: Wrap the entire return value of each screen component inside `Sentry.ErrorBoundary`.

**Mobile-Frontend — screens**:

| Screen | File | Existing boundary | Action |
|--------|------|-------------------|--------|
| Collection | `app/(tabs)/collection/index.tsx` | Custom `ErrorBoundary` | Replace with `Sentry.ErrorBoundary` |
| Statistics | `app/(tabs)/statistics/index.tsx` | Custom `ErrorBoundary` | Replace with `Sentry.ErrorBoundary` |
| EasyUse | `app/(tabs)/easyuse/index.tsx` | None | Add `Sentry.ErrorBoundary` |

**Mobile-Merchant-Frontend — screens**:

| Screen | File | Action |
|--------|------|--------|
| Coupon List | `app/(coupons)/index.tsx` | Add `Sentry.ErrorBoundary` |
| Coupon Detail | `app/(coupons)/[id].tsx` | Add `Sentry.ErrorBoundary` |
| Profile | `app/(profile)/index.tsx` | Add `Sentry.ErrorBoundary` |

---

## 5. Custom ErrorBoundary.tsx Retirement

**Decision**: The custom `ErrorBoundary.tsx` (`app/components/ErrorBoundary.tsx`) is deleted. Its two usages in `collection/index.tsx` and `statistics/index.tsx` are replaced with `Sentry.ErrorBoundary`.

**Rationale**: `Sentry.ErrorBoundary` provides identical fallback rendering capability plus automatic Sentry capture. Maintaining a parallel custom implementation creates inconsistency — errors caught by it are not reported to Sentry.

**Alternative considered**: Extend the custom `ErrorBoundary` to call `captureException` in `componentDidCatch` — rejected because it duplicates what `Sentry.ErrorBoundary` already does and adds an unnecessary intermediate layer.

---

## 6. Double-Reporting Prevention Rules

**Decision**: The following rules are enforced to prevent a single error from being reported twice:

1. **Never call `captureException` in a catch block that re-throws** — the same error must not be both explicitly captured and then propagated upward to be captured again.
2. **Never call `captureException` inside a `Sentry.ErrorBoundary`'s `onError` callback** — the boundary already called it via `captureException` automatically; `onError` fires after capture.
3. **Never add `captureException` to catch blocks inside component render logic** — any synchronous throw in render is caught by the wrapping `Sentry.ErrorBoundary` automatically.
4. **The OTA catch in `_layout.tsx`**: the non-timeout branch gets `captureException`; the error is NOT re-thrown, so no double-report risk exists.

---

## 7. Merchant Frontend Scope

**Decision**: Apply the same error boundary and `captureException` patterns to `Mobile-Merchant-Frontend`.

**Rationale**: Both apps use `Sentry.wrap` at root level. Both have identical silent-failure patterns in their try-catch blocks. The spec's US3 ("unexpected API and runtime failures are tracked") applies to both apps.

**Merchant-specific audit**: 22 files with try-catch blocks. Expected control flow (401, validation) follows the same patterns as Mobile-Frontend. The same reportable/expected classification criteria apply.
