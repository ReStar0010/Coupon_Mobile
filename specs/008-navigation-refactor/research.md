# Research: Navigation Refactor with Expo Router Tabs

**Feature Branch**: `008-navigation-refactor`
**Date**: 2026-02-03

## Research Summary

This document captures the research findings for implementing Expo Router native tab navigation to replace the current custom TabsFooter component.

---

## 1. Expo Router Tabs API (v6.0.22)

### Decision
Use Expo Router's `(tabs)` group with native `Tabs` component from `expo-router`.

### Rationale
- Expo Router ~6.0.22 supports native tab navigation via the `(tabs)` directory naming convention
- Uses React Navigation's bottom tab navigator under the hood with full native performance
- File-based routing automatically generates tab screens from directory structure
- Provides built-in support for tab icons, badges, and active state management

### Implementation Pattern

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Home, StretchHorizontal, BarChart2 } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffad31',
        tabBarInactiveTintColor: '#a8a8a8',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="easyuse"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => <StretchHorizontal color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistics',
          tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Custom TabsFooter (current) | No native performance, no state preservation, manual management overhead |
| React Navigation standalone | Expo Router already wraps React Navigation with better file-based routing integration |
| Material Top Tabs | Not appropriate for primary navigation; bottom tabs are standard for mobile apps |

---

## 2. Lazy Loading Implementation

### Decision
Use Expo Router's built-in `lazy` screen option combined with React Suspense for loading fallback UI.

### Rationale
- Expo Router/React Navigation supports `lazy: true` option per screen natively
- No additional code splitting configuration needed - router handles it automatically
- Suspense boundaries provide clean loading state management
- Reduces initial bundle load and memory usage on app startup

### Implementation Pattern

```typescript
// app/(tabs)/_layout.tsx - Enable lazy loading per tab
<Tabs.Screen
  name="collection"
  options={{
    lazy: true,  // Tab content loads only when first visited
  }}
/>

// Alternative: Suspense wrapper in screen file
// app/(tabs)/collection/index.tsx
import { Suspense, lazy } from 'react';
import { TabLoadingSpinner } from '../../components/navigation/TabLoadingSpinner';

const CollectionContent = lazy(() => import('./CollectionContent'));

export default function CollectionScreen() {
  return (
    <Suspense fallback={<TabLoadingSpinner />}>
      <CollectionContent />
    </Suspense>
  );
}
```

### Loading Spinner Component

```typescript
// app/components/navigation/TabLoadingSpinner.tsx
import { Spinner, YStack } from 'tamagui';

export function TabLoadingSpinner() {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" bg="$background">
      <Spinner size="large" color="#ffad31" />
    </YStack>
  );
}
```

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| React.lazy() with manual imports | Redundant - Expo Router's `lazy` option handles code splitting |
| No lazy loading | Violates spec requirement FR-003; degrades startup performance |
| Third-party lazy loaders | Unnecessary complexity when native solution exists |

---

## 3. State Preservation Strategy

### Decision
Use React Navigation's default `unmountOnBlur: false` combined with `freezeOnBlur: true` for memory optimization.

### Rationale
- Expo Router tabs preserve component state by default (screens remain mounted when switching tabs)
- `freezeOnBlur: true` freezes inactive tabs to reduce re-renders and memory consumption
- Complex state (filters, scroll position) is automatically preserved through mounted components
- No additional state management library needed for basic preservation

### Implementation Pattern

```typescript
// app/(tabs)/_layout.tsx
<Tabs
  screenOptions={{
    unmountOnBlur: false,  // Keep screens mounted (this is the default)
    freezeOnBlur: true,    // Freeze inactive tabs to save resources
  }}
>
  {/* Tab screens */}
</Tabs>
```

### Advanced State Preservation

For components with scroll position or complex filters:

```typescript
// Example: Preserving scroll position in Collection
import { useRef } from 'react';
import { ScrollView } from 'react-native';

export default function CollectionScreen() {
  const scrollRef = useRef<ScrollView>(null);
  // Scroll position automatically preserved because component stays mounted

  return (
    <ScrollView ref={scrollRef}>
      {/* Content */}
    </ScrollView>
  );
}
```

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Unmount on blur | Loses state - opposite of spec requirement FR-004 |
| AsyncStorage persistence | Overkill for session state; adds unnecessary complexity |
| External state library (zustand, Redux) | Not needed for navigation state - React Navigation handles it |

---

## 4. Tab Bar Visibility Control

### Decision
Use `useSegments()` hook to detect nested routes and dynamically hide tab bar via `tabBarStyle`.

### Rationale
- Centralized control in single layout file rather than per-screen options
- Segment array length indicates navigation depth: `['(tabs)', 'easyuse']` vs `['(tabs)', 'easyuse', '[id]']`
- More maintainable than setting `tabBarVisible` on every nested screen
- Works with dynamic routes and deep linking

### Implementation Pattern

```typescript
// app/(tabs)/_layout.tsx
import { Tabs, useSegments } from 'expo-router';

export default function TabLayout() {
  const segments = useSegments();

  // Hide tab bar when navigating beyond tab root screens
  // segments: ['(tabs)', 'easyuse'] = root (show)
  // segments: ['(tabs)', 'easyuse', '[id]'] = nested (hide)
  const hideTabBar = segments.length > 2;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: hideTabBar ? { display: 'none' } : undefined,
        headerShown: false,
      }}
    >
      {/* Tab screens */}
    </Tabs>
  );
}
```

### Tab Stacks for Nested Navigation

```typescript
// app/(tabs)/easyuse/_layout.tsx
import { Stack } from 'expo-router';

export default function EasyUseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="qr-claim" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
```

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Per-screen tabBarVisible option | More verbose, requires repetition across many screens |
| Custom TabBar component | More complex than necessary; native TabBar with display toggle suffices |
| Always showing tab bar | Violates spec requirement FR-011 |

---

## 5. Deep Link Migration

### Decision
Rely on Expo Router's automatic file-based deep link generation with lowercase paths. Add redirects only if case-sensitivity issues arise.

### Rationale
- Expo Router generates routes automatically from file paths
- Path matching is case-insensitive on most platforms by default
- Lowercase directory names follow Expo Router conventions
- `expo-linking` is already installed and configured for `coupro://` scheme

### Deep Link Mapping

| Old Path | New Path | Notes |
|----------|----------|-------|
| `coupro://EasyUse` | `coupro://(tabs)/easyuse` | Or `coupro://easyuse` depending on config |
| `coupro://EasyUse/123` | `coupro://(tabs)/easyuse/123` | Dynamic route preserved |
| `coupro://Collection` | `coupro://(tabs)/collection` | |
| `coupro://Statistics` | `coupro://(tabs)/statistics` | |
| `coupro://OptionsMenu` | `coupro://options-menu` | Outside tabs group |
| `coupro://OptionsMenu/PhoneSettings` | `coupro://options-menu/phone-settings` | Lowercase |

### Implementation

```typescript
// app/_layout.tsx - Handle legacy paths if needed
import { Redirect, usePathname } from 'expo-router';

// Example redirect component for legacy support
function LegacyRedirect() {
  const pathname = usePathname();

  // Map legacy paths to new structure
  const redirectMap: Record<string, string> = {
    '/EasyUse': '/(tabs)/easyuse',
    '/Collection': '/(tabs)/collection',
    '/Statistics': '/(tabs)/statistics',
    '/OptionsMenu': '/options-menu',
  };

  if (redirectMap[pathname]) {
    return <Redirect href={redirectMap[pathname]} />;
  }
  return null;
}
```

### app.json Configuration

```json
{
  "expo": {
    "scheme": ["coupro"],
    "ios": {
      "associatedDomains": ["applinks:coupro.pro"]
    }
  }
}
```

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Keep exact old paths (PascalCase) | Against Expo Router conventions; harder to maintain |
| Full linking config override | Overkill - automatic file-based routing is sufficient |
| No migration strategy | Would break existing deep links from external sources |

---

## 6. Options Menu Access Pattern

### Decision
Add a consistent OptionsMenu button to the shared AppHeader component, using `router.push('/options-menu')` for hierarchical navigation.

### Rationale
- OptionsMenu is hierarchical, not a tab - should push on top of current screen
- Consistent button placement in header (top-right) across all screens per spec FR-005
- Standard push navigation maintains proper back stack
- Single source of truth for navigation to options

### Implementation Pattern

```typescript
// app/components/shared/AppHeader.tsx
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { XStack, Text } from 'tamagui';

interface AppHeaderProps {
  title?: string;
  showOptionsButton?: boolean;
  showBackButton?: boolean;
}

export default function AppHeader({
  title,
  showOptionsButton = true,
  showBackButton = false,
}: AppHeaderProps) {
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$3"
      bg="$background"
    >
      {/* Left side - back button or spacer */}
      {showBackButton ? (
        <TouchableOpacity onPress={() => router.back()}>
          {/* Back icon */}
        </TouchableOpacity>
      ) : (
        <XStack width={24} /> {/* Spacer for alignment */}
      )}

      {/* Center - title */}
      {title && <Text fontSize="$6" fontWeight="bold">{title}</Text>}

      {/* Right side - options button */}
      {showOptionsButton ? (
        <TouchableOpacity
          onPress={() => router.push('/options-menu')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Settings color="#333" size={24} />
        </TouchableOpacity>
      ) : (
        <XStack width={24} /> {/* Spacer for alignment */}
      )}
    </XStack>
  );
}
```

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Options as a fourth tab | Not suitable - options menu is hierarchical, not peer content |
| Floating action button | Inconsistent with app design; header placement is standard |
| Different icons per screen | Confusing UX; consistent icon (Settings/gear) is clearer |

---

## 7. Tab Icon and Styling

### Decision
Reuse existing Lucide icons from the current TabsFooter component with the same color scheme.

### Current Design (Preserved)

| Tab | Icon | Lucide Component |
|-----|------|------------------|
| EasyUse (Home) | House | `Home` |
| Collection | Horizontal lines | `StretchHorizontal` |
| Statistics | Bar chart | `BarChart2` |

### Colors

- **Active**: `#ffad31` (yellow/orange)
- **Inactive**: `#a8a8a8` (gray)
- **Background**: White (`#ffffff`)

### Tab Bar Styling

```typescript
// app/(tabs)/_layout.tsx
<Tabs
  screenOptions={{
    tabBarActiveTintColor: '#ffad31',
    tabBarInactiveTintColor: '#a8a8a8',
    tabBarStyle: {
      backgroundColor: '#ffffff',
      borderTopWidth: 0,
      elevation: 8,           // Android shadow
      shadowColor: '#000',    // iOS shadow
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      paddingBottom: 8,
      paddingTop: 8,
      height: 60,
    },
    tabBarLabelStyle: {
      fontSize: 12,
    },
  }}
>
```

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| Tab Navigation | Expo Router `(tabs)` group with native `Tabs` component |
| Lazy Loading | Built-in `lazy: true` option + Suspense fallback |
| State Preservation | Default `unmountOnBlur: false` + `freezeOnBlur: true` |
| Tab Bar Hiding | `useSegments()` hook with dynamic `tabBarStyle` |
| Deep Links | Automatic file-based routing with lowercase paths |
| Options Menu | AppHeader button with `router.push('/options-menu')` |
| Icons/Colors | Reuse existing Lucide icons and color scheme |

All NEEDS CLARIFICATION items from Technical Context have been resolved. Ready for Phase 1 design.
