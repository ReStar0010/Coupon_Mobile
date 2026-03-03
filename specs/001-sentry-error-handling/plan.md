# Implementation Plan: Sentry Error Boundaries and Exception Capture

**Branch**: `001-sentry-error-handling` | **Date**: 2026-03-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-sentry-error-handling/spec.md`

## Summary

Add granular `Sentry.ErrorBoundary` wrappers at screen-level (Collection, EasyUse, Statistics) and widget-level (MapComponent, QRClaimScanner, DailyDrawModal) in Mobile-Frontend, and screen-level boundaries in Mobile-Merchant-Frontend (CouponList, CouponDetail, Profile) plus a widget boundary for LocationPicker. Replace the two existing custom `ErrorBoundary` component usages with `Sentry.ErrorBoundary` and delete the now-redundant custom component. Add `Sentry.captureException()` to 10 try-catch blocks in Mobile-Frontend that silently swallow unexpected failures, and audit + augment qualifying blocks in Mobile-Merchant-Frontend. Both frontends already have `Sentry.init` + `Sentry.wrap` at root level — this plan adds granular monitoring below that last-resort boundary.

## Technical Context

**Language/Version**: TypeScript (strict mode), React Native via Expo ~54.0.32
**Primary Dependencies**: `@sentry/react-native` v7.2.0 — already installed in both frontends; re-exports `Sentry.ErrorBoundary` (from `@sentry/react`), `captureException`, `withScope`
**Storage**: N/A — frontend-only observability changes
**Testing**: `npm run typecheck`, `npm run lint`; manual verification via deliberate render errors (no automated boundary tests — see Constitution Check)
**Target Platform**: iOS / Android (Expo managed workflow)
**Project Type**: Mobile — two separate apps: `Mobile-Frontend` and `Mobile-Merchant-Frontend`
**Performance Goals**: Error boundaries are transparent to rendering performance until triggered; zero overhead in the happy path
**Constraints**: No new npm dependencies. Must not remove or alter existing `console.error`/`console.warn` calls. Must not double-report (no `captureException` after re-throw; no `captureException` in boundary `onError`). Root `Sentry.wrap` remains unchanged.
**Scale/Scope**: 10 `captureException` additions + 6 new screen boundaries + 4 new widget boundaries in Mobile-Frontend; 3 screen boundaries + 1 widget boundary + captureException audit in Merchant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — all gates still pass.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Mobile-First | Fallback UIs designed for touch (full-screen CTA buttons, inline widget placeholder); offline connectivity errors remain classified as expected | ✅ PASS |
| II. API-Driven & Type-Safe | No new API endpoints; no API contracts changed; TypeScript strict mode maintained; all new components have typed interfaces | ✅ PASS |
| III. Quality Assurance | No backend changes — no backend tests required. Frontend: manual E2E verification via deliberate throw injection (per spec's "Independent Test" descriptions). `console.error` calls preserved — no logging regression. | ✅ PASS |

**Quality Assurance note**: The constitution's "bug fixes MUST include regression tests" applies to bug fixes, not new observability/instrumentation features. Automated unit tests for React error boundaries require deliberate `throw` injection which is inherently a development-time activity; the spec explicitly describes "Independent Test" as manual trigger verification. This is standard practice for error boundary coverage.

## Project Structure

### Documentation (this feature)

```text
specs/001-sentry-error-handling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── error-boundary-interface.md  # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code

```text
Mobile-Frontend/
├── app/
│   ├── _layout.tsx                                         # MODIFY — captureException in OTA non-timeout catch
│   ├── components/
│   │   ├── ErrorBoundary.tsx                               # DELETE — replaced by Sentry.ErrorBoundary
│   │   ├── ScreenErrorFallback.tsx                         # NEW — full-screen fallback component
│   │   ├── WidgetErrorFallback.tsx                         # NEW — inline widget fallback component
│   │   ├── MapComponent.tsx                                # MODIFY — widget Sentry.ErrorBoundary
│   │   ├── QRClaimScanner.tsx                              # MODIFY — widget Sentry.ErrorBoundary
│   │   ├── PageHeader.tsx                                  # MODIFY — captureException for AsyncStorage
│   │   └── providers/
│   │       └── DismissedStoresProvider.tsx                 # MODIFY — captureException x2 for AsyncStorage
│   └── (tabs)/
│       ├── collection/
│       │   ├── index.tsx                                   # MODIFY — replace ErrorBoundary → Sentry.ErrorBoundary
│       │   ├── components/
│       │   │   └── DailyDrawModal.tsx                      # MODIFY — widget Sentry.ErrorBoundary
│       │   ├── hooks/
│       │   │   └── useDailyDraw.ts                         # MODIFY — captureException in swallowed catch
│       │   └── utils/
│       │       └── couponUtils.ts                          # MODIFY — captureException for clipboard
│       ├── easyuse/
│       │   ├── index.tsx                                   # MODIFY — add screen Sentry.ErrorBoundary
│       │   └── [id]/
│       │       └── index.tsx                               # MODIFY — captureException x2 (analytics + maps)
│       └── statistics/
│           ├── index.tsx                                   # MODIFY — replace ErrorBoundary + captureException
│           └── history/
│               └── index.tsx                               # MODIFY — captureException for AsyncStorage

Mobile-Merchant-Frontend/
├── app/
│   ├── components/
│   │   ├── ScreenErrorFallback.tsx                         # NEW — same interface as Mobile-Frontend
│   │   ├── WidgetErrorFallback.tsx                         # NEW — same interface as Mobile-Frontend
│   │   └── LocationPicker.tsx                              # MODIFY — widget Sentry.ErrorBoundary
│   └── (coupons)/
│       ├── index.tsx                                       # MODIFY — screen Sentry.ErrorBoundary
│       └── [id].tsx                                        # MODIFY — screen Sentry.ErrorBoundary
│   └── (profile)/
│       └── index.tsx                                       # MODIFY — screen Sentry.ErrorBoundary
│   [all try-catch files]                                   # MODIFY — captureException audit during impl
```

**Structure Decision**: Mobile multi-app. All changes are confined to the two `app/` directories. No backend changes. No new packages.

## Complexity Tracking

> No constitution violations requiring justification.

---

## Phase 0: Research Findings

See `research.md` for full details.

**Key decisions**:
1. **`Sentry.ErrorBoundary`** — use directly from `@sentry/react-native`; already available at v7.2.0; provides `beforeCapture`, `fallback` (render function or node), `onError`. No version upgrade needed.
2. **Custom `ErrorBoundary.tsx` deleted** — its two usages (`collection/index.tsx`, `statistics/index.tsx`) are replaced. Maintaining a parallel boundary that silently swallows errors contradicts the monitoring goal.
3. **`beforeCapture` for tagging** — sets `boundary` (name) and `boundary_type` (`screen` or `widget`) Sentry scope tags on every boundary, enabling dashboard filtering per FR-004.
4. **Double-reporting prevention** — enforced by rule: never add `captureException` to a catch that re-throws; never call `captureException` in a boundary's `onError`; never add `captureException` inside render functions covered by a boundary.
5. **Merchant Frontend included** — same root-level `Sentry.wrap` exists; same patterns of silent failures; must be covered for complete monitoring.

---

## Phase 1: Design

See `data-model.md` for component hierarchy and state transitions.
See `contracts/error-boundary-interface.md` for typed component interfaces and usage contracts.
See `quickstart.md` for a fast implementation reference including code patterns and verification steps.

**Design summary**:

### New shared components (both frontends)

- `ScreenErrorFallback` — full-screen: localized message + 重新載入 (calls `resetError()`) + 返回 (calls `router.back()`); self-contained, no context dependencies
- `WidgetErrorFallback` — inline placeholder: `minHeight` prop matching widget approximate height, localized message, no action button (FR-010)

### Screen boundaries (Mobile-Frontend)

| Boundary name | File | Action |
|---------------|------|--------|
| `collection-screen` | `(tabs)/collection/index.tsx` | Replace `<ErrorBoundary>` |
| `easyuse-screen` | `(tabs)/easyuse/index.tsx` | Add new |
| `statistics-screen` | `(tabs)/statistics/index.tsx` | Replace `<ErrorBoundary>` |

### Widget boundaries (Mobile-Frontend)

| Boundary name | File | What is wrapped |
|---------------|------|-----------------|
| `map-widget` | `components/MapComponent.tsx` | MapView block |
| `qr-scanner-widget` | `components/QRClaimScanner.tsx` | CameraView block |
| `daily-draw-widget` | `(tabs)/collection/components/DailyDrawModal.tsx` | Sheet children |

### Screen boundaries (Mobile-Merchant-Frontend)

| Boundary name | File |
|---------------|------|
| `coupon-list-screen` | `(coupons)/index.tsx` |
| `coupon-detail-screen` | `(coupons)/[id].tsx` |
| `profile-screen` | `(profile)/index.tsx` |

### Widget boundaries (Mobile-Merchant-Frontend)

| Boundary name | File |
|---------------|------|
| `location-picker-widget` | `components/LocationPicker.tsx` |

### captureException additions (Mobile-Frontend — 10 blocks)

| File | Operation |
|------|-----------|
| `app/_layout.tsx` | OTA update non-timeout failure |
| `(tabs)/collection/hooks/useDailyDraw.ts` | Check last draw date swallowed |
| `(tabs)/collection/utils/couponUtils.ts` | Clipboard.setString failure |
| `components/providers/DismissedStoresProvider.tsx` | AsyncStorage getItem + setItem (2 blocks) |
| `(tabs)/statistics/history/index.tsx` | AsyncStorage setItem coupon history |
| `(tabs)/statistics/index.tsx` | Promise.all refresh failure |
| `components/PageHeader.tsx` | AsyncStorage setItem options menu source |
| `(tabs)/easyuse/[id]/index.tsx` | Analytics POST + Linking.openURL failure (2 blocks) |
