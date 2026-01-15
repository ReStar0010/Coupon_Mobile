# Feature Specification: App Store Compliance Fixes

**Feature Branch**: `001-appstore-compliance-fixes`
**Created**: 2026-01-15
**Status**: Draft
**Input**: User description: "I need to fix issues so that I can upload Mobile-Merchant-Frontend app : Guideline 5.1.1 - Legal - Privacy - Data Collection and Storage"

## Clarifications

### Session 2026-01-15

- Q: How should the system handle merchant-issued coupons when the merchant deletes their account, especially if customers still have unredeemed coupons? → A: Keep coupons valid, anonymize merchant data, inform user before deletion
- Q: What confirmation mechanism should be used for the account deletion process? → A: Password re-entry required
- Q: How should the system handle network failures during the account deletion process? → A: Mark account for deletion, automatically retry on reconnection, show status to user
- Q: What should the app do when a merchant attempts to upload a photo but photo library access is denied? → A: Show dialog explaining why access is needed, with button to open iOS Settings directly to the app's permission page
- Q: What should happen when a merchant attempts to delete their account but has outstanding financial obligations or pending transactions? → A: Allow deletion after displaying warning about outstanding obligations and their consequences

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clear Photo Library Permission Understanding (Priority: P1)

When a merchant needs to upload a photo (such as a business logo, product image, or promotional material), they must understand exactly why the app needs access to their photo library and how their photos will be used. The current generic permission message does not provide sufficient clarity, violating Apple's guidelines.

**Why this priority**: This is blocking the app from being published on the App Store. Without this fix, the app cannot be distributed to users. Apple specifically flagged this as a rejection reason.

**Independent Test**: Can be fully tested by triggering the photo library permission prompt on a fresh app installation and verifying the purpose string clearly explains: (1) why photo access is needed, (2) what specific photo will be used for, and (3) an example of the usage (e.g., "to upload your business logo to your merchant profile").

**Acceptance Scenarios**:

1. **Given** a merchant opens the app for the first time and navigates to a feature requiring photo access, **When** the system requests photo library permission, **Then** the permission dialog displays a clear, specific purpose string that explains why access is needed and provides a concrete example of usage
2. **Given** a merchant is reviewing the app's privacy settings in iOS Settings, **When** they view the photo library permission, **Then** they see the same clear, descriptive purpose string explaining the app's photo usage
3. **Given** a merchant denies photo library access initially, **When** they later attempt to upload a photo, **Then** the app displays a dialog explaining why photo access is needed (referencing the purpose string) with a button that opens iOS Settings directly to the app's permission page

---

### User Story 2 - Account Deletion Access (Priority: P1)

Merchants who have created an account must be able to initiate and complete account deletion directly from within the app. This gives users control over their personal data and complies with Apple's data privacy requirements. Account deletion must be permanent (not just deactivation) and all associated data must be removed.

**Why this priority**: This is a mandatory App Store requirement for apps that support account creation. The app is currently rejected because this functionality is missing. This is equally critical as the photo library issue.

**Independent Test**: Can be fully tested by creating a test merchant account, navigating to the account deletion feature, completing the deletion process, and verifying: (1) the account can no longer be used to log in, (2) the merchant's data is removed from the system, and (3) the process can be completed entirely within the app without requiring external customer service contact.

**Acceptance Scenarios**:

1. **Given** a logged-in merchant navigates to their account settings, **When** they look for account management options, **Then** they see a clearly labeled "Delete Account" or "刪除帳號" option
2. **Given** a merchant initiates account deletion, **When** they confirm their intent to delete the account, **Then** the system displays a clear warning about data permanence, lists any data that will be retained (e.g., active coupons), and requires password re-entry for final confirmation
3. **Given** a merchant confirms account deletion, **When** the deletion process completes, **Then** the account is permanently deleted, all associated data is removed, the merchant is logged out, and they cannot log back in with the deleted credentials
4. **Given** a merchant completes account deletion, **When** they attempt to register again with the same email or phone number, **Then** the system allows them to create a new account (the old account data does not block registration)
5. **Given** a merchant has linked data (such as active coupons, business profiles, or transaction history), **When** they delete their account, **Then** the system displays a warning listing which data will be retained (active coupons remain valid with anonymized merchant info; customers can still redeem them), requires the merchant to acknowledge this before proceeding, and anonymizes the merchant's personal information in retained records

---

### Edge Cases

- When a merchant attempts to delete their account while they have active/unredeemed coupons, the system retains coupons as valid, anonymizes merchant data, and warns the merchant before deletion that customers will still be able to redeem their coupons
- When a merchant has outstanding financial obligations or pending transactions, the system allows account deletion after displaying a warning about the obligations and their consequences (e.g., inability to access refunds, loss of transaction history), requiring acknowledgment before proceeding
- If network connection fails during account deletion, the system marks the account for deletion, automatically retries when connection is restored, and displays a status indicator to the merchant (e.g., "Account deletion in progress...")
- The system prevents accidental account deletion by requiring password re-entry as the final confirmation step after displaying data retention warnings
- When a merchant attempts to upload a photo but has denied photo library access, the app displays a dialog explaining why photo access is needed (matching the purpose string) with a button labeled "Open Settings" that deep links directly to the app's permission page in iOS Settings
- How does the system handle photo upload attempts when the selected photo exceeds size limits or is in an unsupported format?

## Requirements *(mandatory)*

### Functional Requirements

**Photo Library Permission:**

- **FR-001**: System MUST display a purpose string for photo library access that clearly explains why the app needs access to photos
- **FR-002**: System MUST include a specific example in the purpose string (e.g., "to upload your business logo" or "to add product images to your coupon listings")
- **FR-003**: Purpose string MUST be descriptive enough to pass Apple's App Store review guidelines (must not be generic like "App needs photo access")
- **FR-004**: System MUST use consistent purpose strings across all photo library access requests within the app
- **FR-005**: System MUST display a dialog when photo access is denied explaining why access is needed (consistent with purpose string) and provide an "Open Settings" button that deep links directly to the app's permission page in iOS Settings

**Account Deletion:**

- **FR-006**: System MUST provide an in-app option to initiate account deletion that is easily discoverable in account settings
- **FR-007**: Account deletion MUST permanently remove the account (temporary deactivation is insufficient)
- **FR-008**: System MUST display a clear warning before account deletion explaining that the action is permanent and data will be lost
- **FR-009**: System MUST require password re-entry as the final confirmation step to prevent accidental deletion
- **FR-010**: System MUST complete the account deletion process entirely within the app without requiring external customer service contact (phone calls, emails)
- **FR-011**: System MUST remove all merchant personal data upon account deletion, including profile information, authentication credentials, and preferences
- **FR-012**: System MUST retain active/unredeemed coupons when merchant deletes account, anonymize merchant personal information in coupon records, and display a pre-deletion warning listing what data will be retained and why (customer protection)
- **FR-013**: System MUST log out the merchant immediately after successful account deletion
- **FR-014**: System MUST prevent login with deleted account credentials
- **FR-015**: System MUST allow merchants to create new accounts using email/phone numbers from previously deleted accounts
- **FR-016**: If merchant has outstanding financial obligations or pending transactions when attempting deletion, system MUST display a warning listing the obligations and consequences (e.g., loss of access to transaction history, inability to receive refunds), require merchant acknowledgment, then allow deletion to proceed
- **FR-017**: If network connection fails during account deletion, system MUST mark the account for deletion (status: pending deletion), automatically retry the deletion when connection is restored, and display a status indicator to the merchant

### Key Entities

- **Merchant Account**: Represents the merchant user's account containing authentication credentials (email, phone, password), profile information (business name, contact details), and account status (active, pending deletion, deleted)
- **Photo Library Purpose String**: Configuration value that stores the human-readable explanation shown to users when requesting photo library access
- **Account Deletion Request**: Tracks the deletion process including timestamp, confirmation status, completion status, and associated data cleanup tasks

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The app successfully passes Apple App Store review without privacy-related rejections (specifically Guideline 5.1.1)
- **SC-002**: 100% of photo library permission requests display a clear, specific purpose string that explains usage with a concrete example
- **SC-003**: Merchants can discover and access the account deletion feature within 30 seconds of navigating to account settings
- **SC-004**: Merchants can complete the entire account deletion process within the app in under 3 minutes without requiring customer service contact
- **SC-005**: 100% of account deletion attempts that receive user confirmation successfully remove the account and all required associated data
- **SC-006**: Deleted accounts cannot be used to log in within 5 seconds of deletion completion

## Assumptions

- The app currently has photo library access functionality implemented; only the purpose string needs updating (not implementing photo upload from scratch)
- The backend API can handle account deletion requests and has appropriate endpoints or can be extended to support deletion
- There are no legal or regulatory requirements in the target markets (Taiwan) that would prevent permanent account deletion or require data retention beyond what's needed for business operations
- The app uses standard Expo/React Native APIs for photo library access (expo-image-picker or similar)
- Merchants do not have complex financial settlements or legal obligations that would require special account closure procedures beyond simple confirmation
- The Mobile-Merchant-Frontend app is a separate codebase from the mobile customer app, and this specification only addresses the merchant app compliance issues

## Dependencies

- Expo/React Native photo library permission APIs (expo-image-picker or native modules)
- Backend API endpoint for account deletion (may need to be created or extended)
- iOS app.json or Info.plist configuration for permission purpose strings
- Backend database schema that supports marking accounts as deleted and cascading data removal

## Out of Scope

- Changes to the customer-facing mobile app (Coupon_Mobile) - this spec only addresses Mobile-Merchant-Frontend
- Account recovery or "undo" functionality after deletion (permanent deletion is required)
- Data export functionality (unless Apple requires this for compliance - currently not mentioned in the rejection notice)
- Account suspension or temporary deactivation features (Apple requires permanent deletion option)
- Implementing photo upload functionality from scratch (assumes this already exists and only the purpose string needs improvement)
- Changes to backend data retention policies for business/legal reasons beyond account deletion compliance
