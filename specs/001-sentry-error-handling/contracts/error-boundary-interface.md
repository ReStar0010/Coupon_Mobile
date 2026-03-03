# Error Boundary Interface Contract

**Feature**: 001-sentry-error-handling

No REST API changes are introduced. This document defines the component interface contracts for new components and the usage contract for `Sentry.ErrorBoundary`.

---

## ScreenErrorFallback

```typescript
// app/components/ScreenErrorFallback.tsx (both frontends)
import { useRouter } from 'expo-router';
import { View, Text, YStack, Button } from 'tamagui';

interface ScreenErrorFallbackProps {
  error: Error;
  componentStack: string | null;
  resetError: () => void;
}
```

**Rendering contract**:
- Renders full-screen (`flex={1}`) centered layout
- Primary button: `重新載入` — calls `resetError()`
- Secondary button: `返回` — calls `router.back()`
- MUST NOT import from any screen modules or context providers
- MUST use only `tamagui` primitives and `expo-router` for navigation
- MUST render completely in isolation (it may be shown when the app's context tree is broken)

---

## WidgetErrorFallback

```typescript
// app/components/WidgetErrorFallback.tsx (both frontends)
import { View, Text } from 'tamagui';

interface WidgetErrorFallbackProps {
  message: string;     // localized message, e.g. "地圖暫時無法顯示"
  minHeight?: number;  // defaults to 120, matches approximate widget height
}
```

**Rendering contract**:
- Renders an inline block (`width="100%"`, `minHeight={minHeight ?? 120}`)
- Background: `#f5f5f5`, border: `1px solid #e0e0e0`, `borderRadius={8}`
- Centered text: `message` prop, `fontSize={13}`, `color="#999999"`
- NO retry button (FR-010)
- NO automatic boundary reset

---

## Sentry.ErrorBoundary Usage Contract (screen-level)

```typescript
import * as Sentry from '@sentry/react-native';
import ScreenErrorFallback from '@/app/components/ScreenErrorFallback';

// Wraps the screen component's entire return value:
export default function MyScreen() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, componentStack, resetError }) => (
        <ScreenErrorFallback
          error={error}
          componentStack={componentStack}
          resetError={resetError}
        />
      )}
      beforeCapture={(scope) => {
        scope.setTag('boundary', '<boundary-name>');   // e.g. 'collection-screen'
        scope.setTag('boundary_type', 'screen');
      }}
    >
      {/* existing screen content */}
    </Sentry.ErrorBoundary>
  );
}
```

**Contract rules**:
- `beforeCapture` MUST set `boundary` and `boundary_type` tags
- `onError` MUST NOT call `captureException` — the boundary already captures automatically
- The boundary wraps the outermost JSX returned by the screen component
- The boundary MUST NOT be placed in a layout file — it belongs in the individual screen file

---

## Sentry.ErrorBoundary Usage Contract (widget-level)

```typescript
import * as Sentry from '@sentry/react-native';
import WidgetErrorFallback from '@/app/components/WidgetErrorFallback';

// Wraps only the widget subcomponent, leaving surrounding screen intact:
function MyScreen() {
  return (
    <View>
      {/* ... surrounding screen content — NOT inside the boundary */}
      <Sentry.ErrorBoundary
        fallback={<WidgetErrorFallback message="地圖暫時無法顯示" minHeight={200} />}
        beforeCapture={(scope) => {
          scope.setTag('boundary', 'map-widget');
          scope.setTag('boundary_type', 'widget');
        }}
      >
        <MapComponent />
      </Sentry.ErrorBoundary>
      {/* ... remaining screen content — NOT inside the boundary */}
    </View>
  );
}
```

**Contract rules**:
- The boundary wraps ONLY the widget component, not the surrounding screen
- `fallback` is a static ReactNode (not a render function) for widget boundaries — no reset action needed
- `beforeCapture` MUST set `boundary` (widget name) and `boundary_type: 'widget'` tags

---

## captureException Call Contract

```typescript
// Pattern: add AFTER existing console.error, NEVER remove existing logging
try {
  await someUnexpectedOperation();
} catch (error) {
  console.error('existing log message', error);  // PRESERVE — do not remove
  Sentry.captureException(error, {               // ADD after existing log
    data: {
      context: 'brief-description-of-operation',
    },
  });
}
```

**Contract rules**:
1. `captureException` is ALWAYS placed after any existing `console.error` or `console.warn` call (FR-007)
2. `captureException` is NEVER added to catch blocks that re-throw the error (FR-008)
3. `captureException` is NEVER added to expected control flow blocks: 401 auth, validation errors, auth redirects, known timeouts, user cancellations (FR-006)
4. `captureException` is NEVER added inside a `Sentry.ErrorBoundary`'s `onError` callback (already captured by the boundary)
5. `captureException` is NEVER added to catch blocks inside render functions (covered by the wrapping boundary)

---

## Boundary Name Registry

| Boundary name | Type | Location |
|---------------|------|----------|
| `collection-screen` | screen | Mobile-Frontend `app/(tabs)/collection/index.tsx` |
| `easyuse-screen` | screen | Mobile-Frontend `app/(tabs)/easyuse/index.tsx` |
| `statistics-screen` | screen | Mobile-Frontend `app/(tabs)/statistics/index.tsx` |
| `map-widget` | widget | Mobile-Frontend `app/components/MapComponent.tsx` |
| `qr-claim-screen` | screen | Mobile-Frontend `app/(tabs)/easyuse/qr-claim.tsx` |
| `daily-draw-widget` | widget | Mobile-Frontend `app/(tabs)/collection/components/DailyDrawModal.tsx` |
| `coupon-list-screen` | screen | Mobile-Merchant-Frontend `app/(coupons)/index.tsx` |
| `coupon-detail-screen` | screen | Mobile-Merchant-Frontend `app/(coupons)/[id].tsx` |
| `profile-screen` | screen | Mobile-Merchant-Frontend `app/(profile)/index.tsx` |
| `location-picker-widget` | widget | Mobile-Merchant-Frontend `app/components/LocationPicker.tsx` |
