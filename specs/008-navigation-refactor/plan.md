# Implementation Plan: Navigation Refactor with Expo Router Tabs

**Branch**: `008-navigation-refactor` | **Date**: 2026-02-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-navigation-refactor/spec.md`

## Summary

Refactor Mobile-Frontend navigation from a custom manual TabsFooter component with flat Stack routing to Expo Router's native tab navigation. Implement lazy loading for tab screens, state preservation between tab switches, hierarchical push navigation for OptionsMenu, and proper tab bar visibility management. This is a **frontend-only** refactor with no backend changes.

## Technical Context

**Language/Version**: TypeScript (strict mode), React 19.1.0, React Native 0.81.5
**Primary Dependencies**: Expo ~54.0.32, expo-router ~6.0.22, Tamagui ^1.136.6, react-native-reanimated ~4.1.1
**Storage**: N/A (navigation refactor only)
**Testing**: Manual testing (no existing test framework configured)
**Target Platform**: iOS 15+, Android (API 21+)
**Project Type**: Mobile
**Performance Goals**: Cold start <3s on 4G, tab switch <300ms perceived, 20% startup time reduction
**Constraints**: <100ms interaction response, offline navigation support, maintain all existing deep links
**Scale/Scope**: 3 tab screens + OptionsMenu hierarchy (~10 screens total)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Mobile-First Design** | ✅ PASS | Native tab navigation improves touch UX; lazy loading improves performance; all changes target mobile platforms |
| **II. API-Driven & Type-Safe Architecture** | ✅ PASS | No API changes; TypeScript strict mode maintained; navigation types will be properly defined |
| **III. Quality Assurance** | ⚠️ PARTIAL | No existing test framework; manual testing required; this is a frontend-only refactor with no critical paths affected |

**Gate Status**: PASS - All critical principles satisfied. Navigation refactor aligns with mobile-first design and doesn't introduce API changes.

## Project Structure

### Documentation (this feature)

```text
specs/008-navigation-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A - no data model changes)
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (N/A - no API contracts)
```

### Source Code (repository root)

```text
Mobile-Frontend/
├── app/
│   ├── _layout.tsx                 # Root layout (modified for tabs)
│   ├── index.tsx                   # Auth redirect (unchanged)
│   ├── (auth)/                     # Auth screens group (NEW)
│   │   ├── _layout.tsx             # Auth stack layout
│   │   ├── login.tsx               # Login screen (moved)
│   │   └── reset-password.tsx      # Reset password (moved)
│   ├── (tabs)/                     # Tab screens group (NEW)
│   │   ├── _layout.tsx             # Tab navigator config (NEW)
│   │   ├── easyuse/                # EasyUse tab (restructured)
│   │   │   ├── _layout.tsx         # EasyUse stack
│   │   │   ├── index.tsx           # Main screen (lazy)
│   │   │   ├── qr-claim.tsx        # QR scanner
│   │   │   └── [id]/               # Coupon detail
│   │   ├── collection/             # Collection tab (restructured)
│   │   │   └── index.tsx           # Main screen (lazy)
│   │   └── statistics/             # Statistics tab (restructured)
│   │       ├── _layout.tsx         # Statistics stack
│   │       ├── index.tsx           # Main screen (lazy)
│   │       └── history/            # History sub-navigation
│   ├── options-menu/               # Hierarchical menu (restructured)
│   │   ├── _layout.tsx             # OptionsMenu stack
│   │   ├── index.tsx               # Main menu
│   │   └── [sub-screens]/          # Phone settings, etc.
│   └── components/
│       ├── TabsFooter.tsx          # DEPRECATED (to be removed)
│       ├── shared/
│       │   └── AppHeader.tsx       # Add OptionsMenu button
│       └── navigation/             # NEW navigation components
│           └── TabLoadingSpinner.tsx
├── package.json
└── app.json
```

**Structure Decision**: Mobile app with Expo Router file-based routing. Introducing `(tabs)` group for native tab navigation and `(auth)` group for authentication flows. OptionsMenu remains outside tabs as hierarchical push navigation.

## Complexity Tracking

No constitution violations to justify.

---

## Phase 0: Research

### Research Tasks

Based on Technical Context, the following areas need research:

1. **Expo Router Tabs API (v6.0.22)** - Native tab navigation implementation
2. **Lazy Loading Patterns** - React.lazy vs Expo Router built-in lazy loading
3. **State Preservation** - Tab state management across switches
4. **Tab Bar Hiding** - Hiding tab bar on hierarchical screens
5. **Deep Link Migration** - Ensuring existing deep links work with new structure

### Research Findings

#### 1. Expo Router Tabs Implementation

**Decision**: Use Expo Router's `(tabs)` group with native `Tabs` component

**Rationale**:
- Expo Router ~6.0.22 supports native tab navigation via `(tabs)` directory convention
- Uses React Navigation's bottom tab navigator under the hood
- File-based routing automatically generates tab screens from directory structure

**Implementation Pattern**:
```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#ffad31',
      tabBarInactiveTintColor: '#a8a8a8',
      headerShown: false
    }}>
      <Tabs.Screen name="easyuse" options={{ title: 'Home', tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="collection" options={{ title: 'Collection', tabBarIcon: CollectionIcon }} />
      <Tabs.Screen name="statistics" options={{ title: 'Statistics', tabBarIcon: StatsIcon }} />
    </Tabs>
  );
}
```

**Alternatives Considered**:
- Custom TabsFooter (current): Rejected - no native performance, no state preservation, manual management
- React Navigation standalone: Rejected - Expo Router already wraps React Navigation with better file-based routing

#### 2. Lazy Loading Implementation

**Decision**: Use Expo Router's built-in lazy loading + React Suspense fallback

**Rationale**:
- Expo Router/React Navigation supports `lazy: true` option per screen
- Combined with React Suspense boundary for loading states
- No need for manual React.lazy() - the router handles code splitting

**Implementation Pattern**:
```typescript
// app/(tabs)/_layout.tsx
<Tabs.Screen
  name="collection"
  options={{
    lazy: true,  // Don't load until first visit
  }}
/>

// Each screen wrapped with Suspense in its file
export default function CollectionScreen() {
  return (
    <Suspense fallback={<TabLoadingSpinner />}>
      <CollectionContent />
    </Suspense>
  );
}
```

**Alternatives Considered**:
- React.lazy() manual imports: Rejected - Expo Router already handles this with `lazy` option
- No lazy loading: Rejected - spec requirement FR-003

#### 3. State Preservation Strategy

**Decision**: Use React Navigation's default unmountOnBlur=false + custom state context

**Rationale**:
- Expo Router tabs preserve state by default (screens not unmounted on tab switch)
- For complex state (filters, scroll position), use React Context or zustand
- `freezeOnBlur: true` can freeze inactive tabs to reduce memory

**Implementation Pattern**:
```typescript
// app/(tabs)/_layout.tsx
<Tabs screenOptions={{
  unmountOnBlur: false,  // Keep screens mounted (default)
  freezeOnBlur: true,    // Freeze inactive tabs to save resources
}}>
```

**Alternatives Considered**:
- Unmount on blur: Rejected - loses state, opposite of spec requirement FR-004
- AsyncStorage persistence: Overkill for session state preservation

#### 4. Tab Bar Visibility Control

**Decision**: Use Stack navigator with `tabBarStyle: { display: 'none' }` for nested screens

**Rationale**:
- Expo Router allows nested Stack navigators within tabs
- Parent tab bar hidden via `tabBarStyle` or `tabBarVisible` options
- Alternative: Use `Slot` with custom layout hiding logic

**Implementation Pattern**:
```typescript
// Option A: Stack within tab hides parent tab bar
// app/(tabs)/easyuse/_layout.tsx
import { Stack } from 'expo-router';

export default function EasyUseLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
          // This hides the tab bar when this screen is active
        }}
      />
    </Stack>
  );
}

// Option B: Hide tab bar for specific routes in tabs layout
// app/(tabs)/_layout.tsx
import { useSegments } from 'expo-router';

export default function TabLayout() {
  const segments = useSegments();
  const hideTabBar = segments.length > 2; // Nested beyond tab root

  return (
    <Tabs screenOptions={{
      tabBarStyle: hideTabBar ? { display: 'none' } : undefined,
    }}>
      ...
    </Tabs>
  );
}
```

**Decision**: Use Option B (segment-based hiding) for centralized control, combined with Stack layouts in tabs for proper back navigation.

**Alternatives Considered**:
- Per-screen tabBarVisible: More verbose, requires repetition
- Custom TabBar component: More complex than needed

#### 5. Deep Link Migration

**Decision**: Expo Router handles deep links automatically via file structure; add linking config for legacy paths

**Rationale**:
- Expo Router generates routes from file paths automatically
- Need to configure redirects for any changed paths (e.g., `/EasyUse` → `/easyuse`)
- `expo-linking` already installed for URL scheme handling

**Implementation Pattern**:
```typescript
// app/_layout.tsx - Add redirect handling
import { Redirect } from 'expo-router';

// Legacy path handling (if needed)
// Or configure in app.json experiments.typedRoutes
```

**Current Deep Links**:
- `coupro://EasyUse` → `/(tabs)/easyuse`
- `coupro://EasyUse/[id]` → `/(tabs)/easyuse/[id]`
- `coupro://Collection` → `/(tabs)/collection`
- `coupro://Statistics` → `/(tabs)/statistics`
- `coupro://OptionsMenu/*` → `/options-menu/*`

**Migration Strategy**: Use lowercase paths in new structure; Expo Router's path matching is case-insensitive by default on most platforms. Add explicit redirects if case sensitivity is an issue.

**Alternatives Considered**:
- Keep exact old paths: Rejected - Expo Router conventions prefer lowercase
- Full linking config override: Overkill - automatic file-based routing suffices

#### 6. Options Menu Access Pattern

**Decision**: Add OptionsMenu button to AppHeader component, navigate via `router.push('/options-menu')`

**Rationale**:
- OptionsMenu is hierarchical, not a tab - should open on top of any screen
- Consistent button placement in header (top-right) across all screens
- Uses standard push navigation for proper back stack

**Implementation Pattern**:
```typescript
// app/components/shared/AppHeader.tsx
import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';

export function AppHeader({ showOptionsButton = true }) {
  return (
    <XStack>
      {/* ... existing header content */}
      {showOptionsButton && (
        <TouchableOpacity onPress={() => router.push('/options-menu')}>
          <Settings color="#333" size={24} />
        </TouchableOpacity>
      )}
    </XStack>
  );
}
```

#### 7. Tab Icon Selection

**Decision**: Reuse existing Lucide icons from TabsFooter

**Current Icons** (from `TabsFooter.tsx`):
- Home: `Home` icon → EasyUse tab
- Collection: `StretchHorizontal` icon → Collection tab
- Statistics: `BarChart2` icon → Statistics tab

**Active Color**: `#ffad31` (yellow)
**Inactive Color**: `#a8a8a8` (gray)

---

## Phase 1: Design & Contracts

### Data Model

**N/A** - This is a navigation refactor with no data model changes. All existing data structures remain unchanged.

### API Contracts

**N/A** - This is a frontend-only refactor with no API changes.

### Navigation Architecture

#### Route Structure

```
/ (index.tsx - redirect to auth or tabs)
├── (auth)/
│   ├── login
│   └── reset-password
├── (tabs)/
│   ├── easyuse/
│   │   ├── index (root)
│   │   ├── qr-claim
│   │   ├── unified-redeem/
│   │   └── [id]/
│   │       ├── index (detail)
│   │       └── redeem/
│   ├── collection/
│   │   └── index (root)
│   └── statistics/
│       ├── index (root)
│       └── history/
│           ├── index
│           └── [id]/
└── options-menu/
    ├── index (root)
    ├── phone-settings/
    ├── blocked-merchants/
    ├── contact-us/
    ├── feedback/
    ├── help-support/
    ├── privacy-policy/
    ├── terms/
    └── user-data/
```

#### Navigation Components

| Component | Type | Purpose |
|-----------|------|---------|
| `app/_layout.tsx` | Root Stack | Wraps auth, tabs groups |
| `app/(auth)/_layout.tsx` | Stack | Auth flow screens |
| `app/(tabs)/_layout.tsx` | Tabs | Bottom tab navigator |
| `app/(tabs)/easyuse/_layout.tsx` | Stack | EasyUse internal navigation |
| `app/(tabs)/statistics/_layout.tsx` | Stack | Statistics internal navigation |
| `app/options-menu/_layout.tsx` | Stack | OptionsMenu hierarchy |

#### Tab Bar Behavior

| Context | Tab Bar Visible | Reason |
|---------|-----------------|--------|
| Tab root screens (easyuse, collection, statistics index) | Yes | Primary navigation |
| Nested screens within tabs ([id], history/[id]) | No | FR-011 requirement |
| OptionsMenu and children | No | Hierarchical navigation |
| Auth screens (login, reset-password) | No | Not part of main app |

#### Loading States

**Tab Loading Spinner** (FR-008):
- Centered spinner on tab background color
- Shows on first access of lazy-loaded tab
- Duration: until screen content renders

```typescript
// app/components/navigation/TabLoadingSpinner.tsx
import { Spinner, YStack } from 'tamagui';

export function TabLoadingSpinner() {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" bg="$background">
      <Spinner size="large" color="$primary" />
    </YStack>
  );
}
```

---

## Quickstart

### Prerequisites

```bash
cd Mobile-Frontend
npm install  # Ensure dependencies are up to date
```

### File Changes Summary

**Files to Create**:
1. `app/(auth)/_layout.tsx` - Auth stack layout
2. `app/(auth)/login.tsx` - Move from `app/Login/index.tsx`
3. `app/(auth)/reset-password.tsx` - Move from `app/ResetPassword/index.tsx`
4. `app/(tabs)/_layout.tsx` - Tab navigator configuration
5. `app/(tabs)/easyuse/_layout.tsx` - EasyUse stack layout
6. `app/(tabs)/statistics/_layout.tsx` - Statistics stack layout
7. `app/options-menu/_layout.tsx` - OptionsMenu stack layout
8. `app/components/navigation/TabLoadingSpinner.tsx` - Loading spinner

**Files to Move/Rename**:
- `app/EasyUse/*` → `app/(tabs)/easyuse/*`
- `app/Collection/*` → `app/(tabs)/collection/*`
- `app/Statistics/*` → `app/(tabs)/statistics/*`
- `app/OptionsMenu/*` → `app/options-menu/*`
- `app/Login/*` → `app/(auth)/login/*`
- `app/ResetPassword/*` → `app/(auth)/reset-password/*`

**Files to Modify**:
- `app/_layout.tsx` - Update root navigation structure
- `app/components/shared/AppHeader.tsx` - Add OptionsMenu button
- All screen files - Remove TabsFooter imports and usage
- All navigation calls - Update path references (e.g., `/EasyUse` → `/(tabs)/easyuse`)

**Files to Delete**:
- `app/components/TabsFooter.tsx` - Replaced by native tabs

### Migration Steps

1. **Create directory structure** - Set up `(auth)`, `(tabs)`, `options-menu` directories
2. **Create layout files** - Add `_layout.tsx` for each navigation group
3. **Move screen files** - Relocate screens to new directories
4. **Update imports** - Fix relative import paths in moved files
5. **Update navigation calls** - Change all `router.push('/EasyUse')` to `router.push('/(tabs)/easyuse')` etc.
6. **Remove TabsFooter** - Delete component and remove from all screens
7. **Add OptionsMenu button** - Update AppHeader with settings button
8. **Add loading spinner** - Create and integrate lazy loading UI
9. **Test all navigation paths** - Verify tabs, back navigation, deep links

### Verification Checklist

- [ ] App launches to EasyUse tab
- [ ] Tab switching works (EasyUse ↔ Collection ↔ Statistics)
- [ ] Tab state preserved when switching back
- [ ] Collection tab lazy loads on first visit
- [ ] Loading spinner shows during lazy load
- [ ] OptionsMenu opens from any screen
- [ ] Back navigation works through OptionsMenu hierarchy
- [ ] Tab bar hidden on detail screens
- [ ] Tab bar hidden on OptionsMenu screens
- [ ] Tapping active tab returns to root
- [ ] Deep links work: `coupro://easyuse`, `coupro://collection`, etc.
- [ ] Swipe back gesture works on hierarchical screens

---

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Mobile-First Design** | ✅ PASS | Native tab navigation, lazy loading, <300ms perceived navigation |
| **II. API-Driven & Type-Safe** | ✅ PASS | No API changes; TypeScript types for navigation preserved |
| **III. Quality Assurance** | ⚠️ PARTIAL | Manual testing plan defined; no automated tests (pre-existing limitation) |

**Final Gate Status**: PASS - Ready for task generation.
