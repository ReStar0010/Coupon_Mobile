# Research: App Store Compliance Fixes

**Feature**: 001-appstore-compliance-fixes
**Date**: 2026-01-15
**Status**: Complete

## Research Areas

### 1. iOS Photo Library Permission Purpose String

**Question**: How to configure a clear, specific purpose string for photo library access in Expo/React Native?

**Decision**: Use expo-image-picker config plugin in app.json with `photosPermission` property

**Rationale**:

- The expo-image-picker plugin directly sets `NSPhotoLibraryUsageDescription` in Info.plist
- Config plugin approach is cleaner than manual infoPlist configuration
- Changes are applied at build time (cannot update OTA)

**Implementation**:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "CouPro 需要存取您的照片，以便讓您上傳商店標誌、商品圖片或優惠券圖片至您的商家資料。"
        }
      ]
    ]
  }
}
```

**Alternative Considered**: Manual infoPlist configuration

```json
{
  "ios": {
    "infoPlist": {
      "NSPhotoLibraryUsageDescription": "..."
    }
  }
}
```

Rejected because expo-image-picker config plugin is the recommended approach and provides cleaner separation.

**Sources**:

- [Expo ImagePicker Documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [Expo Permissions Guide](https://docs.expo.dev/guides/permissions/)

---

### 2. Permission Denied Dialog with Settings Link

**Question**: How to open iOS app settings when user has denied photo library permission?

**Decision**: Use `Linking.openSettings()` from react-native

**Rationale**:

- Handles platform logic automatically (iOS and Android)
- Preferred approach in Expo managed and bare workflows
- Cleaner than platform-specific URL scheme checks
- No additional dependencies required

**Implementation**:

```typescript
import { Linking } from "react-native";

const openAppSettings = () => {
  Linking.openSettings();
};
```

**Alternative Considered**: `Linking.openURL('app-settings:')`
Rejected because `Linking.openSettings()` handles the platform logic for you and is significantly cleaner than writing platform-specific checks for URL schemes.

**Sources**:

- [React Native Linking Documentation](https://reactnative.dev/docs/linking)
- [Expo Linking Documentation](https://docs.expo.dev/versions/latest/sdk/linking/)

---

### 3. Apple Account Deletion Requirements (Guideline 5.1.1)

**Question**: What are the specific requirements for App Store compliance on account deletion?

**Decision**: Implement full in-app account deletion with password confirmation

**Requirements Summary**:

1. **Easy to Find**: Account deletion must be discoverable in account settings
2. **Full Deletion**: Temporary disable/deactivation is NOT sufficient - must be permanent
3. **In-App Process**: Cannot require phone calls, emails, or external support flows (not a highly regulated industry)
4. **All Users**: Must work for all users regardless of location (Taiwan focus)
5. **Personal Data Removal**: Must delete or anonymize personal data

**Rationale**:

- CouPro is not in a highly regulated industry (not banking, healthcare, gambling, etc.)
- Therefore, the ENTIRE deletion process must be completable within the app
- Password re-entry provides security against accidental/unauthorized deletion

**Sources**:

- [Apple Developer: Account Deletion Requirement](https://developer.apple.com/news/?id=12m75xbj)
- [Offering Account Deletion in Your App](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

---

### 4. Django Account Deletion Strategy

**Question**: How to handle merchant account deletion while preserving active coupons?

**Decision**: Anonymize merchant data rather than cascade delete

**Rationale**:

- Active coupons must remain valid for customers to redeem
- Direct cascade delete would remove all Store → CouponTemplate → Coupon records
- Anonymization preserves data integrity while removing PII

**Implementation Strategy**:

1. **Before User Deletion**:

   - Anonymize `Store.name` → "已刪除的商家" (Deleted Merchant)
   - Anonymize `Store.address` → null or generic value
   - Clear `Store.unified_redeem_code` (unique constraint, cannot reuse)
   - Clear `MerchantProfile.phone`, `contact_person`, `contact_info`
   - Optionally log deletion event for audit

2. **User Deletion**:

   - After anonymization, delete Django User (which CASCADE deletes):
     - MerchantProfile
     - PasswordResetProfile
     - QRCodeSession, QRCodeClaim (merchant-created sessions)
   - **Note**: Coupon fields (`original_owner`, `last_holder`, `current_holder`) reference STUDENT users, not merchants. These fields remain unchanged during merchant deletion.

3. **Data Preserved**:
   - Store (anonymized)
   - CouponTemplate (valid for existing coupons)
   - Coupon records (redeemable by customers)
   - CouponRedemption records (historical)

**Alternative Considered**: django-safedelete soft delete
Rejected because Apple requires PERMANENT deletion, not soft delete. Anonymization is the middle ground.

**Sources**:

- [Django GDPR Assist Documentation](https://django-gdpr-assist.readthedocs.io/en/latest/anonymising.html)
- [Soft Deletes in Django](https://dev.to/bikramjeetsingh/soft-deletes-in-django-a9j)

---

### 5. Password Verification Pattern

**Question**: How to verify password before account deletion?

**Decision**: Use Django's `check_password()` in new API endpoint

**Implementation**:

```python
from django.contrib.auth.hashers import check_password

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    password = request.data.get('password')
    if not check_password(password, request.user.password):
        return Response({'error': 'Invalid password'}, status=400)
    # ... proceed with deletion
```

**Rationale**:

- Pattern already used in Backend authentication.py login flow
- Consistent with existing codebase security patterns

---

### 6. Network Failure Handling

**Question**: How to handle network failures during account deletion?

**Decision**: Mark account for pending deletion, retry on reconnection

**Implementation**:

- Add `deletion_pending` status field or `pending_deletion_at` timestamp
- Frontend shows "Account deletion in progress..." status
- Backend processes pending deletions on reconnection or via scheduled task

**Alternative Considered**: Synchronous deletion only
Rejected because spec requires handling network failures gracefully.

---

## Resolved Clarifications

All technical unknowns from the spec have been resolved through research:

| Unknown                                                   | Resolution                                              |
| --------------------------------------------------------- | ------------------------------------------------------- |
| How to set iOS permission purpose string in Expo          | expo-image-picker config plugin with `photosPermission` |
| How to link to app settings from denied permission dialog | `Linking.openSettings()`                                |
| How to delete account while keeping coupons valid         | Anonymize Store/MerchantProfile before User deletion    |
| Password verification method                              | `django.contrib.auth.hashers.check_password()`          |
| Network failure handling                                  | Pending deletion status with retry mechanism            |

## Next Steps

Proceed to Phase 1: Design & Contracts

- Create data-model.md with AccountDeletionStatus entity
- Generate API contracts for deletion endpoint
- Create quickstart.md for implementation guidance
