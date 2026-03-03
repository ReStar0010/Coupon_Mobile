# Quickstart: Sentry Error Boundaries and Exception Capture

**Feature**: 001-sentry-error-handling | **Branch**: `001-sentry-error-handling`

---

## What This Feature Does

Adds granular error observability to both CouPro mobile apps:

1. **Screen-level boundaries** — `Sentry.ErrorBoundary` wrapping the three major tabs (Collection, EasyUse, Statistics) and three Merchant screens. When a render error occurs, a full-screen fallback is displayed instead of crashing the entire app.
2. **Widget-level boundaries** — `Sentry.ErrorBoundary` wrapping contained sub-components (Map, QR Scanner, Daily Draw Modal, Location Picker). When a widget crashes, only that widget area shows an inline error placeholder; the rest of the screen remains functional.
3. **Exception capture** — `Sentry.captureException` added to 10 try-catch blocks (Mobile-Frontend) and any qualifying blocks in Merchant that handle unexpected silent failures.

## Prerequisites (already in place — no action needed)

- `@sentry/react-native` v7.2.0 installed in both frontends
- `Sentry.init()` configured in both `app/_layout.tsx` files
- `Sentry.wrap()` already wraps the root component in both frontends
- **No new `npm install` required**

---

## Files Changed

### Mobile-Frontend

| File | Change Type | What Changes |
|------|-------------|-------------|
| `app/components/ErrorBoundary.tsx` | **DELETED** | Replaced by `Sentry.ErrorBoundary` everywhere |
| `app/components/ScreenErrorFallback.tsx` | **NEW** | Full-screen fallback UI for screen boundaries |
| `app/components/WidgetErrorFallback.tsx` | **NEW** | Compact inline fallback UI for widget boundaries |
| `app/(tabs)/collection/index.tsx` | **MODIFY** | Replace `<ErrorBoundary>` with `<Sentry.ErrorBoundary>` |
| `app/(tabs)/statistics/index.tsx` | **MODIFY** | Replace `<ErrorBoundary>` with `<Sentry.ErrorBoundary>` |
| `app/(tabs)/easyuse/index.tsx` | **MODIFY** | Add screen-level `<Sentry.ErrorBoundary>` wrapper |
| `app/components/MapComponent.tsx` | **MODIFY** | Add widget `<Sentry.ErrorBoundary>` around MapView |
| `app/components/QRClaimScanner.tsx` | **MODIFY** | Add widget `<Sentry.ErrorBoundary>` around CameraView |
| `app/(tabs)/collection/components/DailyDrawModal.tsx` | **MODIFY** | Add widget `<Sentry.ErrorBoundary>` around Sheet content |
| `app/_layout.tsx` | **MODIFY** | Add `captureException` in OTA non-timeout catch branch |
| `app/(tabs)/collection/hooks/useDailyDraw.ts` | **MODIFY** | Add `captureException` in swallowed catch |
| `app/(tabs)/collection/utils/couponUtils.ts` | **MODIFY** | Add `captureException` for clipboard failure |
| `app/components/providers/DismissedStoresProvider.tsx` | **MODIFY** | Add `captureException` for AsyncStorage read/write failures |
| `app/(tabs)/statistics/history/index.tsx` | **MODIFY** | Add `captureException` for AsyncStorage save failure |
| `app/(tabs)/statistics/index.tsx` | **MODIFY** | Add `captureException` for Promise.all refresh failure |
| `app/components/PageHeader.tsx` | **MODIFY** | Add `captureException` for AsyncStorage write failure |
| `app/(tabs)/easyuse/[id]/index.tsx` | **MODIFY** | Add `captureException` for analytics + maps navigation failure |

### Mobile-Merchant-Frontend

| File | Change Type | What Changes |
|------|-------------|-------------|
| `app/components/ScreenErrorFallback.tsx` | **NEW** | Same as Mobile-Frontend |
| `app/components/WidgetErrorFallback.tsx` | **NEW** | Same as Mobile-Frontend |
| `app/(coupons)/index.tsx` | **MODIFY** | Add screen-level `<Sentry.ErrorBoundary>` |
| `app/(coupons)/[id].tsx` | **MODIFY** | Add screen-level `<Sentry.ErrorBoundary>` |
| `app/(profile)/index.tsx` | **MODIFY** | Add screen-level `<Sentry.ErrorBoundary>` |
| `app/components/LocationPicker.tsx` | **MODIFY** | Add widget `<Sentry.ErrorBoundary>` |
| Multiple try-catch blocks | **MODIFY** | Add `captureException` to qualifying unexpected-failure blocks |

---

## Classification Quick Reference

| Pattern | `captureException`? | Reason |
|---------|---------------------|--------|
| HTTP 401 → token refresh / auth redirect | ❌ No | Expected control flow |
| HTTP 404 on share token / coupon ID | ❌ No | Normal "not found" state |
| `isCancel(err)` from Axios | ❌ No | Deliberate abort |
| `UPDATE_CHECK_TIMEOUT` error | ❌ No | Known, explicitly handled timeout |
| QR JSON.parse failure | ❌ No | User input error (wrong QR) |
| Location permission denied | ❌ No | User choice |
| `Share.share()` rejection | ❌ No | User cancelled native dialog |
| Any backend validation error surfaced to user | ❌ No | Expected, handled gracefully |
| OTA update failure (non-timeout branch) | ✅ Yes | Unexpected system failure |
| AsyncStorage read/write failure | ✅ Yes | Unexpected platform failure, silent |
| Clipboard API failure | ✅ Yes | Platform failure, user unaware |
| Analytics endpoint failure | ✅ Yes | Silent unexpected failure |
| `Linking.openURL` maps navigation failure | ✅ Yes | Navigation failure, user unaware |

---

## Verification Steps

Run these checks after implementation to confirm all acceptance criteria are met.

### 1. Screen boundary — full-screen fallback (SC-001)
1. In `CollectionScreen`, temporarily add `throw new Error('test-boundary')` at the top of the return statement
2. Launch the app and navigate to the Collection tab
3. **Confirm**: Full-screen fallback with 重新載入 and 返回 buttons appears
4. **Confirm**: Tab bar remains visible and other tabs are navigable
5. **Confirm**: Tapping 重新載入 re-renders the screen
6. **Confirm**: Sentry dashboard shows one event tagged `boundary: collection-screen`, `boundary_type: screen`
7. Remove the test throw

### 2. Widget boundary — inline fallback (SC-002)
1. In `MapComponent`, temporarily add `throw new Error('test-map')` near the top of the component return
2. Navigate to the EasyUse tab (which renders the map)
3. **Confirm**: Only the map area shows the inline fallback message ("地圖暫時無法顯示")
4. **Confirm**: The rest of the EasyUse screen (coupon list, search bar) renders normally
5. **Confirm**: Sentry dashboard shows one event tagged `boundary: map-widget`, `boundary_type: widget`
6. Remove the test throw

### 3. Exception capture — unexpected failure (SC-003)
1. In `DismissedStoresProvider`, temporarily add `throw new Error('test-storage')` inside the `AsyncStorage.getItem` call
2. Launch the app
3. **Confirm**: App continues (handles gracefully)
4. **Confirm**: Sentry dashboard shows one event for the storage failure
5. Remove the test throw

### 4. Expected flow — no capture (SC-004)
1. Use Charles Proxy or similar to return a 401 on any API endpoint
2. **Confirm**: No new Sentry event is generated for the 401 handling
3. **Confirm**: The auth redirect behavior works as before

### 5. Console.error preserved (SC-005)
1. For each modified try-catch block, verify the original `console.error` call is still present alongside `captureException`
2. Check via `npm run lint` that no linting errors were introduced

### 6. No duplicate events (SC-006)
1. Trigger a render error in `CollectionScreen` (deliberate throw)
2. Check Sentry dashboard — confirm the error appears exactly once, not twice
3. **Key check**: The boundary captures it automatically; there should be no second event from a re-throw

---

## Code Pattern Reference

### Adding a screen-level boundary

```tsx
import * as Sentry from '@sentry/react-native';
import ScreenErrorFallback from '@/app/components/ScreenErrorFallback';

export default function CollectionScreen() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, componentStack, resetError }) => (
        <ScreenErrorFallback error={error} componentStack={componentStack} resetError={resetError} />
      )}
      beforeCapture={(scope) => {
        scope.setTag('boundary', 'collection-screen');
        scope.setTag('boundary_type', 'screen');
      }}
    >
      {/* existing screen content here */}
    </Sentry.ErrorBoundary>
  );
}
```

### Adding a widget-level boundary

```tsx
import * as Sentry from '@sentry/react-native';
import WidgetErrorFallback from '@/app/components/WidgetErrorFallback';

// Inside the screen that uses the widget:
<Sentry.ErrorBoundary
  fallback={<WidgetErrorFallback message="地圖暫時無法顯示" minHeight={200} />}
  beforeCapture={(scope) => {
    scope.setTag('boundary', 'map-widget');
    scope.setTag('boundary_type', 'widget');
  }}
>
  <MapComponent ... />
</Sentry.ErrorBoundary>
```

### Adding captureException to a try-catch

```typescript
import * as Sentry from '@sentry/react-native';

try {
  await AsyncStorage.setItem('key', value);
} catch (error) {
  console.error('Error saving dismissed stores:', error);  // existing — preserved
  Sentry.captureException(error, {                         // new — added after
    data: { context: 'DismissedStoresProvider.saveDismissedStores' },
  });
}
```
