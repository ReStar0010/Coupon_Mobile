# Quickstart: Navigation Refactor Implementation

**Feature Branch**: `008-navigation-refactor`
**Date**: 2026-02-03

This guide provides step-by-step instructions for implementing the Expo Router tab navigation refactor.

---

## Prerequisites

```bash
cd Mobile-Frontend
npm install  # Ensure all dependencies are installed
```

Verify Expo Router version (should be ~6.0.22):
```bash
npm list expo-router
```

---

## Phase 1: Create Directory Structure

Create the new navigation group directories:

```bash
# Create (tabs) group with subdirectories
mkdir -p "app/(tabs)/easyuse"
mkdir -p "app/(tabs)/collection"
mkdir -p "app/(tabs)/statistics/history"

# Create (auth) group
mkdir -p "app/(auth)"

# Create options-menu (outside tabs)
mkdir -p "app/options-menu/phone-settings"
mkdir -p "app/options-menu/blocked-merchants"
mkdir -p "app/options-menu/contact-us"
mkdir -p "app/options-menu/feedback"
mkdir -p "app/options-menu/help-support"
mkdir -p "app/options-menu/privacy-policy"
mkdir -p "app/options-menu/terms"
mkdir -p "app/options-menu/user-data"

# Create navigation components directory
mkdir -p "app/components/navigation"
```

---

## Phase 2: Create Layout Files

### 2.1 Tab Navigator Layout

Create `app/(tabs)/_layout.tsx`:

```typescript
import { Tabs, useSegments } from 'expo-router';
import { Home, StretchHorizontal, BarChart2 } from 'lucide-react-native';

export default function TabLayout() {
  const segments = useSegments();

  // Hide tab bar when navigating to nested screens
  // e.g., ['(tabs)', 'easyuse', '[id]'] has length 3 = nested
  const hideTabBar = segments.length > 2;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffad31',
        tabBarInactiveTintColor: '#a8a8a8',
        tabBarStyle: hideTabBar ? { display: 'none' } : {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
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

### 2.2 EasyUse Stack Layout

Create `app/(tabs)/easyuse/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function EasyUseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="qr-claim" />
      <Stack.Screen name="unified-redeem" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
```

### 2.3 Statistics Stack Layout

Create `app/(tabs)/statistics/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function StatisticsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
    </Stack>
  );
}
```

### 2.4 Auth Stack Layout

Create `app/(auth)/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
```

### 2.5 Options Menu Stack Layout

Create `app/options-menu/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function OptionsMenuLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="phone-settings" />
      <Stack.Screen name="blocked-merchants" />
      <Stack.Screen name="contact-us" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="help-support" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="user-data" />
    </Stack>
  );
}
```

### 2.6 Update Root Layout

Modify `app/_layout.tsx`:

```typescript
import '../tamagui-web.css';

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import { config } from '../tamagui.config';
import ThemeProvider from './components/providers/ThemeProvider';
import AuthProvider from './components/providers/SessionProvider';
import AuthOrchestrator from './components/providers/AuthOrchestrator';
import ToastProvider from './components/providers/ToastProvider';
import DismissedStoresProvider from './components/providers/DismissedStoresProvider';
import BlockedMerchantsProvider from './components/providers/BlockedMerchantsProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <PortalProvider shouldAddRootHost>
          <ThemeProvider>
            <DismissedStoresProvider>
              <BlockedMerchantsProvider>
                <AuthProvider>
                  <AuthOrchestrator>
                    <ToastProvider>
                      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="options-menu" />
                      </Stack>
                      <StatusBar style="auto" />
                    </ToastProvider>
                  </AuthOrchestrator>
                </AuthProvider>
              </BlockedMerchantsProvider>
            </DismissedStoresProvider>
          </ThemeProvider>
        </PortalProvider>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
```

---

## Phase 3: Create Loading Spinner

Create `app/components/navigation/TabLoadingSpinner.tsx`:

```typescript
import { Spinner, YStack } from 'tamagui';

export function TabLoadingSpinner() {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" bg="$background">
      <Spinner size="large" color="#ffad31" />
    </YStack>
  );
}

export default TabLoadingSpinner;
```

---

## Phase 4: Move Screen Files

### 4.1 Move EasyUse Screens

```bash
# Move main files
mv app/EasyUse/index.tsx "app/(tabs)/easyuse/index.tsx"
mv app/EasyUse/qr-claim.tsx "app/(tabs)/easyuse/qr-claim.tsx"

# Move directories (preserve internal structure)
mv app/EasyUse/unified-redeem "app/(tabs)/easyuse/"
mv "app/EasyUse/[id]" "app/(tabs)/easyuse/"

# Move any remaining subdirectories/components
# (check for components, hooks, utils folders)
```

### 4.2 Move Collection Screens

```bash
mv app/Collection/index.tsx "app/(tabs)/collection/index.tsx"

# Move subdirectories
mv app/Collection/components "app/(tabs)/collection/"
mv app/Collection/hooks "app/(tabs)/collection/"
mv app/Collection/utils "app/(tabs)/collection/"
mv app/Collection/Gift.tsx "app/(tabs)/collection/"
```

### 4.3 Move Statistics Screens

```bash
mv app/Statistics/index.tsx "app/(tabs)/statistics/index.tsx"

# Move History subnavigation
mv app/Statistics/History "app/(tabs)/statistics/history"

# Move subdirectories
mv app/Statistics/components "app/(tabs)/statistics/"
mv app/Statistics/hooks "app/(tabs)/statistics/"
```

### 4.4 Move Options Menu Screens

```bash
mv app/OptionsMenu/index.tsx app/options-menu/index.tsx

# Move sub-screens (adjust names to lowercase/kebab-case)
mv app/OptionsMenu/PhoneSettings app/options-menu/phone-settings
mv app/OptionsMenu/BlockedMerchants app/options-menu/blocked-merchants
mv app/OptionsMenu/ContactUs app/options-menu/contact-us
mv app/OptionsMenu/FeedBack app/options-menu/feedback
mv app/OptionsMenu/HelpSupport app/options-menu/help-support
mv app/OptionsMenu/PrivacyPolicy app/options-menu/privacy-policy
mv app/OptionsMenu/Terms app/options-menu/terms
mv app/OptionsMenu/UserData app/options-menu/user-data
```

### 4.5 Move Auth Screens

```bash
mv app/Login/index.tsx "app/(auth)/login.tsx"
mv app/Login/components "app/(auth)/login-components"

mv app/ResetPassword/index.tsx "app/(auth)/reset-password.tsx"
mv app/ResetPassword/components "app/(auth)/reset-password-components"
```

---

## Phase 5: Update Import Paths

After moving files, update relative imports in each file. Common patterns:

### From `app/(tabs)/easyuse/index.tsx`:
```typescript
// Old
import TabsFooter from '../components/TabsFooter';
import MapComponent from '../components/MapComponent';

// New
import MapComponent from '../../components/MapComponent';
// Remove TabsFooter import entirely
```

### From `app/(tabs)/collection/index.tsx`:
```typescript
// Old
import TabsFooter from '../components/TabsFooter';
import AppHeader from '../components/shared/AppHeader';

// New
import AppHeader from '../../components/shared/AppHeader';
// Remove TabsFooter import entirely
```

### General import path changes:
- `../components/` → `../../components/`
- `../services/` → `../../services/`
- `../utils/` → `../../utils/`
- `./components/` → stays the same (local to screen)
- `./hooks/` → stays the same (local to screen)

---

## Phase 6: Update Navigation Calls

Search and replace navigation paths throughout the codebase:

| Old Path | New Path |
|----------|----------|
| `router.push('/EasyUse')` | `router.push('/(tabs)/easyuse')` |
| `router.push('/Collection')` | `router.push('/(tabs)/collection')` |
| `router.push('/Statistics')` | `router.push('/(tabs)/statistics')` |
| `router.push('/OptionsMenu')` | `router.push('/options-menu')` |
| `router.push('/OptionsMenu/PhoneSettings')` | `router.push('/options-menu/phone-settings')` |
| `router.push('/Login')` | `router.push('/(auth)/login')` |
| `router.replace('/EasyUse')` | `router.replace('/(tabs)/easyuse')` |
| `router.replace('/Login')` | `router.replace('/(auth)/login')` |

### Files to update:
- `app/index.tsx` - auth redirect logic
- `app/components/providers/AuthOrchestrator.tsx` - auth state navigation
- All screen files that use `router.push()` or `router.replace()`
- Any component that navigates to other screens

---

## Phase 7: Remove TabsFooter

### 7.1 Remove TabsFooter from Screens

In each tab screen (`easyuse/index.tsx`, `collection/index.tsx`, `statistics/index.tsx`):

```typescript
// Remove this import
import TabsFooter from '../components/TabsFooter';

// Remove TabsFooter component from JSX
// Old:
<View>
  {/* Screen content */}
  <TabsFooter
    activeTab="home"
    onHomePress={() => router.push('/EasyUse')}
    onCollectionPress={() => router.push('/Collection')}
    onStatisticsPress={() => router.push('/Statistics')}
  />
</View>

// New:
<View>
  {/* Screen content only - no TabsFooter */}
</View>
```

### 7.2 Delete TabsFooter Component

```bash
rm app/components/TabsFooter.tsx
```

---

## Phase 8: Update AppHeader for Options Menu

Modify `app/components/shared/AppHeader.tsx` to add the Options Menu button:

```typescript
import { TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Settings, ChevronLeft } from 'lucide-react-native';
import { XStack, Text } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AppHeaderProps {
  title?: string;
  showOptionsButton?: boolean;
  showBackButton?: boolean;
  rightElement?: React.ReactNode;
}

export default function AppHeader({
  title,
  showOptionsButton = true,
  showBackButton = false,
  rightElement,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      paddingHorizontal="$4"
      paddingTop={insets.top + 8}
      paddingBottom="$3"
      bg="$background"
    >
      {/* Left side */}
      <View style={{ width: 40 }}>
        {showBackButton && (
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft color="#333" size={28} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title && (
          <Text fontSize="$6" fontWeight="600" color="$color">
            {title}
          </Text>
        )}
      </View>

      {/* Right side */}
      <View style={{ width: 40, alignItems: 'flex-end' }}>
        {rightElement ? (
          rightElement
        ) : showOptionsButton ? (
          <TouchableOpacity
            onPress={() => router.push('/options-menu')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Settings color="#333" size={24} />
          </TouchableOpacity>
        ) : null}
      </View>
    </XStack>
  );
}
```

---

## Phase 9: Clean Up Old Directories

After verifying the app works with the new structure:

```bash
# Remove old directories (only after testing!)
rm -rf app/EasyUse
rm -rf app/Collection
rm -rf app/Statistics
rm -rf app/OptionsMenu
rm -rf app/Login
rm -rf app/ResetPassword
```

---

## Verification Checklist

Test each item before proceeding to the next phase:

### Navigation
- [ ] App launches successfully
- [ ] Initial screen is EasyUse tab (when authenticated)
- [ ] Initial screen is Login (when not authenticated)

### Tab Switching
- [ ] Tap Collection tab → navigates to Collection
- [ ] Tap Statistics tab → navigates to Statistics
- [ ] Tap EasyUse tab → returns to EasyUse
- [ ] Tab indicator shows correct active tab

### State Preservation
- [ ] Apply filter in Collection → switch to EasyUse → return to Collection → filter still applied
- [ ] Scroll down in Statistics → switch tab → return → scroll position preserved

### Lazy Loading
- [ ] On first app launch, only EasyUse content loads
- [ ] First tap on Collection shows loading spinner briefly
- [ ] Collection content appears after loading

### Tab Bar Visibility
- [ ] Tab bar visible on main tab screens
- [ ] Tab bar hidden on coupon detail pages (`/easyuse/[id]`)
- [ ] Tab bar hidden on all Options Menu screens
- [ ] Tab bar hidden on History detail (`/statistics/history/[id]`)

### Options Menu
- [ ] Settings button visible in header on all main screens
- [ ] Tap Settings → Options Menu opens
- [ ] Navigate to PhoneSettings → back returns to Options Menu
- [ ] Multiple backs return to original screen

### Back Navigation
- [ ] Swipe back gesture works on iOS
- [ ] Hardware back button works on Android
- [ ] Back from detail page returns to list (not different tab)

### Deep Links (test with Expo Go or dev build)
- [ ] `coupro://easyuse` opens EasyUse tab
- [ ] `coupro://collection` opens Collection tab
- [ ] `coupro://options-menu` opens Options Menu

---

## Troubleshooting

### "Unable to resolve module" errors
- Check that all import paths were updated correctly
- Verify files were moved to correct locations
- Clear Metro bundler cache: `npx expo start -c`

### Tab bar not showing
- Verify `app/(tabs)/_layout.tsx` exists and exports default function
- Check that screen files are in correct subdirectories

### Navigation not working
- Ensure route paths match file structure exactly
- Check for typos in `router.push()` calls
- Verify `_layout.tsx` files exist in each navigation group

### Lazy loading not working
- Add `lazy: true` to Tabs screenOptions
- Wrap screen content in Suspense with fallback component
