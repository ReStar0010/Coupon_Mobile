# Data Model: Sentry Error Boundaries and Exception Capture

**Feature**: 001-sentry-error-handling

This feature introduces no new backend data models or API endpoints. The "model" here is the component hierarchy and the two new shared UI components.

---

## New Components

### ScreenErrorFallback

A full-screen replacement component rendered by a screen-level `Sentry.ErrorBoundary` when a render error is caught.

**Location**: `app/components/ScreenErrorFallback.tsx` (both Mobile-Frontend and Mobile-Merchant-Frontend)

**Props** (matching `Sentry.ErrorBoundary`'s render function signature):

```typescript
interface ScreenErrorFallbackProps {
  error: Error;
  componentStack: string | null;
  resetError: () => void;
  // eventId?: string; // available but not used in UI
}
```

**Behavior**:
- Full-screen centered layout (flex, justifyContent center)
- Localized error message in Chinese: "發生錯誤，請稍後再試"
- Primary CTA: "重新載入" — calls `resetError()`
- Secondary CTA: "返回" — calls `router.back()`
- MUST be self-contained — no context providers, no API calls, no imports from the feature screens
- MUST use only Tamagui primitives (View, Text, Button) — no Expo modules that could fail themselves

---

### WidgetErrorFallback

A compact inline component rendered by a widget-level `Sentry.ErrorBoundary` when a render error is caught in a sub-component. Used for embedded widgets (Map, QR Scanner, Location Picker) — not for full-screen modal overlays.

**Location**: `app/components/WidgetErrorFallback.tsx` (both frontends)

**Props**:

```typescript
interface WidgetErrorFallbackProps {
  message: string; // localized message
  minHeight?: number; // approximate height of replaced widget, default 120
}
```

**Behavior**:
- Inline placeholder box matching approximate widget dimensions via `minHeight`
- Background: light gray (`#f5f5f5`)
- Displays a centered localized message in a small font
- No retry/reset button (FR-010 — widget level requires only minimal inline indicator)
- Does NOT attempt to reset the boundary automatically

---

### ModalErrorFallback

A sheet-filling fallback rendered by the Daily Draw Modal boundary when the Sheet content crashes. Distinct from `WidgetErrorFallback` because the modal is the user's full visual context when open — a compact indicator would be invisible and provide no escape path.

**Location**: `app/components/ModalErrorFallback.tsx` (Mobile-Frontend only)

**Props**:

```typescript
interface ModalErrorFallbackProps {
  onDismiss: () => void; // calls resetError() and closes the sheet
}
```

**Behavior**:
- Fills the Sheet content area (`flex={1}`, centered)
- Displays a localized error message: "抽獎功能暫時無法使用"
- Single action button: "關閉" — calls `onDismiss()` which invokes `resetError()` to reset the boundary, allowing the Sheet to be re-opened cleanly
- No `router.back()` navigation (dismissing the sheet is the correct recovery, not leaving the screen)

---

## Component Hierarchy (Mobile-Frontend)

```
Sentry.wrap (root — existing, unchanged)
  └── Tab Navigator
      ├── Sentry.ErrorBoundary [boundary=collection-screen, type=screen]
      │   fallback: <ScreenErrorFallback />
      │   └── CollectionScreen (app/(tabs)/collection/index.tsx)
      │       └── Sentry.ErrorBoundary [boundary=daily-draw-widget, type=widget]
      │           fallback: <ModalErrorFallback onDismiss={resetError} />
      │           └── DailyDrawModal
      │
      ├── Sentry.ErrorBoundary [boundary=easyuse-screen, type=screen]
      │   fallback: <ScreenErrorFallback />
      │   └── EasyUseScreen (app/(tabs)/easyuse/index.tsx)
      │       └── Sentry.ErrorBoundary [boundary=map-widget, type=widget]
      │           fallback: <WidgetErrorFallback message="地圖暫時無法顯示" />
      │           └── MapComponent
      │
      ├── Sentry.ErrorBoundary [boundary=qr-claim-screen, type=screen]
      │   fallback: <ScreenErrorFallback />
      │   └── QRClaimScreen (app/(tabs)/easyuse/qr-claim.tsx)
      │       └── QRClaimScanner  ← no widget boundary; covered by parent screen boundary
      │
      └── Sentry.ErrorBoundary [boundary=statistics-screen, type=screen]
          fallback: <ScreenErrorFallback />
          └── StatisticsScreen (app/(tabs)/statistics/index.tsx)
```

## Component Hierarchy (Mobile-Merchant-Frontend)

```
Sentry.wrap (root — existing, unchanged)
  └── Stack Navigator
      ├── Sentry.ErrorBoundary [boundary=coupon-list-screen, type=screen]
      │   fallback: <ScreenErrorFallback />
      │   └── CouponListScreen (app/(coupons)/index.tsx)
      │
      ├── Sentry.ErrorBoundary [boundary=coupon-detail-screen, type=screen]
      │   fallback: <ScreenErrorFallback />
      │   └── CouponDetailScreen (app/(coupons)/[id].tsx)
      │       └── Sentry.ErrorBoundary [boundary=location-picker-widget, type=widget]
      │           fallback: <WidgetErrorFallback message="位置選擇器暫時無法使用" />
      │           └── LocationPicker
      │
      └── Sentry.ErrorBoundary [boundary=profile-screen, type=screen]
          fallback: <ScreenErrorFallback />
          └── ProfileScreen (app/(profile)/index.tsx)
```

---

## Scope Tags

Each `Sentry.ErrorBoundary` sets these tags via `beforeCapture`:

| Tag | Type | Values |
|-----|------|--------|
| `boundary` | string | `collection-screen`, `easyuse-screen`, `qr-claim-screen`, `statistics-screen`, `map-widget`, `daily-draw-widget`, `coupon-list-screen`, `coupon-detail-screen`, `profile-screen`, `location-picker-widget` |
| `boundary_type` | string | `screen` or `widget` |

---

## ErrorBoundary State Transitions

```
NORMAL ──[render throws]──► ERROR_CAUGHT
                              │
              ┌───────────────┼────────────────────┐
              ▼               ▼                    ▼
        user taps        user navigates       component
        resetError()     away & back          unmounts
              │               │                    │
              └──────────────►▼◄───────────────────┘
                           NORMAL
```

The boundary resets to NORMAL on `resetError()` call or when the component unmounts and remounts (e.g., tab navigation). This satisfies the edge case: "when a widget fallback is visible but the user navigates away and back, the boundary resets."

---

## captureException Additions (try-catch audit)

**Mobile-Frontend — blocks receiving `captureException`**:

| File | Operation | Classification |
|------|-----------|---------------|
| `app/_layout.tsx` | OTA update non-timeout failure | Unexpected system failure |
| `app/(tabs)/collection/hooks/useDailyDraw.ts` | Check last draw date AsyncStorage/API | Swallowed — no state update |
| `app/(tabs)/collection/utils/couponUtils.ts` | Clipboard.setString failure | Platform API failure, silent |
| `app/components/providers/DismissedStoresProvider.tsx` | AsyncStorage getItem | Storage read failure |
| `app/components/providers/DismissedStoresProvider.tsx` | AsyncStorage setItem | Storage write failure |
| `app/(tabs)/statistics/history/index.tsx` | AsyncStorage setItem coupon history | Storage persistence failure |
| `app/(tabs)/statistics/index.tsx` | Promise.all refresh failure | Multi-fetch failure swallowed |
| `app/components/PageHeader.tsx` | AsyncStorage setItem options menu source | Storage write failure |
| `app/(tabs)/easyuse/[id]/index.tsx` | Track template view analytics POST | Merchant-facing behavioral data — silent failure is a product integrity issue |
| `app/(tabs)/easyuse/[id]/index.tsx` | Linking.openURL maps navigation | Navigation failure, user unaware |

**Mobile-Merchant-Frontend — pending audit during implementation**:
Full audit of 22 try-catch blocks applying the same classification criteria (see `research.md` §2).
