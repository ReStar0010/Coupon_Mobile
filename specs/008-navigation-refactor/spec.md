# Feature Specification: Navigation Refactor with Expo Router Tabs

**Feature Branch**: `008-navigation-refactor`
**Created**: 2026-02-03
**Status**: Draft
**Input**: User description: "Refactor the file structure of Mobile-Frontend so that the navigation uses expo router's tab navigation for sibling pages and router.push for hierarchical pages. The sibling pages are EasyUse, Collection, OptionsMenu. Keep OptionsMenu as hierarchical pages since it can be accessed from any page with a button on the top right. Also use lazy load to prevent initial loading overhead to increase UX."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seamless Tab Navigation Between Main Screens (Priority: P1)

As a user, I want to navigate between the main app sections (EasyUse, Collection) using bottom tabs so that I can quickly switch between discovering coupons and viewing my collection without losing my place in each section.

**Why this priority**: Tab navigation is the core navigation pattern that affects every user session. Without proper tab navigation, users cannot efficiently use the app's primary features.

**Independent Test**: Can be fully tested by tapping tab icons and verifying each section loads while preserving state when switching back. Delivers immediate value as the primary navigation method.

**Acceptance Scenarios**:

1. **Given** I am on the EasyUse screen, **When** I tap the Collection tab icon, **Then** the Collection screen displays immediately and the tab indicator shows Collection as active
2. **Given** I am on the Collection screen with filters applied, **When** I tap the EasyUse tab and then return to Collection, **Then** my previously applied filters are still active (state preservation)
3. **Given** the app is freshly launched, **When** I tap the Collection tab before EasyUse has fully loaded all data, **Then** Collection loads independently without waiting for EasyUse

---

### User Story 2 - Quick Access to Options Menu from Any Screen (Priority: P1)

As a user, I want to access the Options Menu from any screen via a consistent button in the top-right corner so that I can quickly access settings, help, and account options without navigating away from my current workflow.

**Why this priority**: Options Menu accessibility is essential for user account management, help access, and app settings. It must work consistently across all screens.

**Independent Test**: Can be tested by navigating to any screen and tapping the Options button, verifying the menu opens and closes properly. Delivers value as the universal settings access point.

**Acceptance Scenarios**:

1. **Given** I am on any screen (EasyUse, Collection, or nested pages), **When** I tap the Options button in the top-right corner, **Then** the Options Menu screen opens as a hierarchical push navigation
2. **Given** I am in the Options Menu, **When** I tap a menu item (e.g., PhoneSettings), **Then** that sub-screen opens with proper back navigation to Options Menu
3. **Given** I am deep in Options Menu (e.g., PhoneSettings), **When** I tap back multiple times or use swipe-back gesture, **Then** I return through each level back to my original screen

---

### User Story 3 - Fast App Startup with Lazy Loading (Priority: P2)

As a user, I want the app to start quickly and show me usable content immediately so that I don't have to wait for all screens to load before I can start using the app.

**Why this priority**: Startup performance directly impacts user retention and satisfaction. Lazy loading prevents unnecessary resource usage and improves perceived performance.

**Independent Test**: Can be tested by measuring cold start time and verifying only the initial screen loads on startup. Delivers value through improved startup experience.

**Acceptance Scenarios**:

1. **Given** I open the app for the first time after force-closing, **When** the app launches, **Then** only the initial tab (EasyUse) is loaded and rendered
2. **Given** the app is running with only EasyUse loaded, **When** I have not yet visited Collection, **Then** the Collection screen's components and data are not loaded in memory
3. **Given** I tap on the Collection tab for the first time, **When** the screen begins loading, **Then** I see a loading indicator while the screen initializes, followed by the full content

---

### User Story 4 - Consistent Navigation Patterns Throughout App (Priority: P2)

As a user, I want navigation to behave predictably throughout the app so that I always know how to go back, switch sections, or access menus without confusion.

**Why this priority**: Consistent navigation patterns reduce cognitive load and make the app intuitive. Users should never be surprised by navigation behavior.

**Independent Test**: Can be tested by navigating through various paths and verifying back button/gesture behavior is consistent. Delivers value through predictable UX.

**Acceptance Scenarios**:

1. **Given** I am on a detail screen within EasyUse (e.g., coupon details), **When** I use back navigation, **Then** I return to the EasyUse list/map view (not to another tab)
2. **Given** I navigate: EasyUse → Coupon Details → Options Menu → PhoneSettings, **When** I tap back, **Then** I go back to Options Menu (hierarchical), and subsequent backs eventually return me to Coupon Details
3. **Given** I am on any screen, **When** I tap a tab icon, **Then** I navigate to that tab's root screen (not a nested screen within that tab)

---

### Edge Cases

- What happens when a user rapidly taps between tabs? The app should handle rapid navigation without crashes or visual glitches
- How does the system handle navigation when the user has poor network connectivity? Navigation should work offline; only data loading should show appropriate states
- What happens if a user deep-links into a nested screen? The correct tab should be selected and the navigation stack properly initialized
- How does the system handle the Statistics screen which is currently in tabs but not mentioned in the new structure? Statistics should remain as a third tab alongside EasyUse and Collection

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement Expo Router's native tab navigation for the main screens (EasyUse, Collection, and Statistics)
- **FR-002**: System MUST use hierarchical push navigation (router.push) for the Options Menu and all its sub-screens
- **FR-003**: System MUST implement lazy loading for tab screens so only the active tab is loaded initially
- **FR-004**: System MUST preserve screen state when switching between tabs (e.g., scroll position, applied filters, form inputs)
- **FR-005**: System MUST display a consistent Options Menu access button in the header across all main screens
- **FR-006**: System MUST maintain proper back navigation stack for hierarchical screens (Options Menu and its children)
- **FR-007**: System MUST support swipe-back gesture for hierarchical navigation on supported platforms
- **FR-008**: System MUST show a centered spinner on the tab's background color when a tab is accessed for the first time (lazy load indicator)
- **FR-009**: System MUST restructure the file system to follow Expo Router's (tabs) group convention
- **FR-010**: System MUST ensure all existing deep links and navigation paths continue to work after refactoring
- **FR-011**: System MUST hide the bottom tab bar when navigating to any hierarchical screen (Options Menu, coupon details, redemption flows, etc.)
- **FR-012**: System MUST return to the tab's root screen (pop to top of stack) when a user taps the icon of the currently active tab while on a nested screen

### Key Entities

- **Tab Screen**: A top-level sibling screen accessible via the bottom tab bar (EasyUse, Collection, Statistics)
- **Hierarchical Screen**: A screen that opens on top of the current screen and supports back navigation (Options Menu and all its sub-screens)
- **Tab Navigator**: The Expo Router tabs group that manages switching between sibling screens
- **Navigation Stack**: The hierarchical history of screens for back navigation within each tab

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: App cold start time (time to interactive on initial screen) is reduced by at least 20% compared to current implementation
- **SC-002**: Users can switch between tabs in under 300ms (perceived navigation time)
- **SC-003**: Memory usage on app startup is reduced by not pre-loading inactive tab screens
- **SC-004**: 100% of existing navigation paths and deep links continue to function correctly after refactoring
- **SC-005**: Users can access Options Menu from any screen with exactly one tap
- **SC-006**: Back navigation returns users to their expected previous screen 100% of the time
- **SC-007**: Tab state (filters, scroll position) is preserved when users switch tabs and return

## Clarifications

### Session 2026-02-03

- Q: When navigating to hierarchical screens (Options Menu, coupon details), should the tab bar be visible? → A: Hide tab bar on all hierarchical screens
- Q: What loading indicator should display when a lazy-loaded tab is first accessed? → A: Centered spinner on the tab's background color (minimal)
- Q: When on a nested screen within a tab, what happens when tapping that tab's icon? → A: Return to the tab's root screen (pop to top of stack)

## Assumptions

- The Statistics screen will remain as a third tab alongside EasyUse and Collection (maintaining current 3-tab structure)
- The current custom TabsFooter component will be replaced with Expo Router's native tab navigation
- Existing screen components (EasyUse/index.tsx, Collection/index.tsx, etc.) will be preserved and moved to the new file structure
- React.lazy or Expo Router's built-in lazy loading will be used for implementing lazy loading
- The Options Menu button will be added to the shared header component (AppHeader) rather than duplicated in each screen
- Deep link handling will be managed by Expo Router's linking configuration
