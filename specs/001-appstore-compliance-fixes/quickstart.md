# Quickstart: App Store Compliance Fixes

**Feature**: 001-appstore-compliance-fixes
**Date**: 2026-01-15

## Prerequisites

- Python 3.10+ with virtual environment activated
- Node.js 18+ for frontend
- Backend server running locally
- Expo development environment configured

## Implementation Order

Complete these tasks in sequence:

### 1. Photo Library Permission String (Frontend Only)

**Files to modify**:
- `Mobile-Merchant-Frontend/app.json`

**Steps**:

1. Add expo-image-picker plugin configuration to app.json:

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

2. Rebuild the app (permission strings require native build):
```bash
cd Mobile-Merchant-Frontend
npx expo prebuild --clean
```

**Verification**:
- Fresh install on iOS device/simulator
- Navigate to profile edit or coupon creation
- Verify permission dialog shows the custom message

---

### 2. Permission Denied Dialog (Frontend)

**Files to create**:
- `Mobile-Merchant-Frontend/components/ui/PermissionDeniedModal.tsx`

**Files to modify**:
- `Mobile-Merchant-Frontend/app/(profile)/edit.tsx`
- `Mobile-Merchant-Frontend/app/(coupons)/edit.tsx`

**Implementation**:

```typescript
// components/ui/PermissionDeniedModal.tsx
import { AlertDialog, Button, XStack, YStack } from 'tamagui';
import { Linking } from 'react-native';

interface PermissionDeniedModalProps {
  open: boolean;
  onClose: () => void;
  permissionType: 'photos' | 'camera';
}

export function PermissionDeniedModal({ open, onClose, permissionType }: PermissionDeniedModalProps) {
  const messages = {
    photos: {
      title: '需要照片權限',
      description: 'CouPro 需要存取您的照片，以便讓您上傳商店標誌、商品圖片或優惠券圖片至您的商家資料。請在設定中開啟此權限。',
    },
    camera: {
      title: '需要相機權限',
      description: '...',
    },
  };

  const openSettings = () => {
    Linking.openSettings();
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay />
        <AlertDialog.Content>
          <YStack gap="$3">
            <AlertDialog.Title>{messages[permissionType].title}</AlertDialog.Title>
            <AlertDialog.Description>
              {messages[permissionType].description}
            </AlertDialog.Description>
            <XStack gap="$3" justifyContent="flex-end">
              <AlertDialog.Cancel asChild>
                <Button variant="outlined" onPress={onClose}>取消</Button>
              </AlertDialog.Cancel>
              <Button onPress={openSettings}>開啟設定</Button>
            </XStack>
          </YStack>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  );
}
```

**Verification**:
- Deny photo permission on first request
- Try to upload photo again
- Verify dialog appears with "開啟設定" button
- Verify button opens iOS Settings to app page

---

### 3. Backend: Account Deletion Endpoint

**Files to create**:
- `Backend/api/views/account_deletion.py`
- `Backend/api/tests/test_account_deletion.py`

**Files to modify**:
- `Backend/api/models.py` (Store.owner field)
- `Backend/api/serializers.py`
- `Backend/Backend/urls.py`

**Steps**:

1. **Create migration for Store.owner**:
```bash
cd Backend
.venv/Scripts/activate
```

Modify `models.py`:
```python
# Change Store.owner from CASCADE to SET_NULL
owner = models.ForeignKey(
    User,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='owned_stores'
)
```

Create and apply migration:
```bash
python manage.py makemigrations api --name account_deletion_support
python manage.py migrate
```

2. **Create serializer**:
```python
# api/serializers.py
class AccountDeletionSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=True)
    acknowledgments = serializers.ListField(
        child=serializers.CharField(),
        required=True
    )
```

3. **Create view** (see contracts for full API spec)

4. **Add URL**:
```python
# Backend/urls.py
from api.views.account_deletion import pre_delete_check, delete_account

urlpatterns += [
    path('api/merchant/account/pre-delete-check/', pre_delete_check),
    path('api/merchant/account/delete/', delete_account),
]
```

**Verification**:
```bash
python manage.py test api.tests.test_account_deletion
```

---

### 4. Frontend: Account Deletion UI

**Files to create**:
- `Mobile-Merchant-Frontend/app/(profile)/delete-account.tsx`

**Files to modify**:
- `Mobile-Merchant-Frontend/app/(profile)/index.tsx`
- `Mobile-Merchant-Frontend/utils/api.ts`

**Implementation flow**:

1. Add "刪除帳號" button to profile screen (index.tsx)
2. Create delete-account.tsx with multi-step flow:
   - Step 1: Show warnings from pre-delete-check API
   - Step 2: Require acknowledgment checkboxes
   - Step 3: Password entry
   - Step 4: Final confirmation
   - Step 5: Success/logout

**Verification**:
- Navigate to profile settings
- Find "刪除帳號" option
- Complete deletion flow
- Verify logout and cannot re-login

---

## Testing Checklist

### Photo Library Permission

- [ ] Fresh install shows custom permission message
- [ ] Permission message includes specific example (上傳商店標誌)
- [ ] Denied permission shows dialog with settings link
- [ ] Settings link opens correct app settings page
- [ ] After granting in settings, photo upload works

### Account Deletion

- [ ] "刪除帳號" visible in profile/settings
- [ ] Pre-delete check shows active coupon count
- [ ] Warnings display correctly (Chinese)
- [ ] Wrong password rejected with error
- [ ] Correct password allows deletion
- [ ] After deletion: logged out immediately
- [ ] After deletion: cannot log in again
- [ ] After deletion: active coupons still redeemable (test via customer app)
- [ ] After deletion: store shows as "已刪除的商家"

### Edge Cases

- [ ] Network failure during deletion: retry mechanism works
- [ ] User can re-register with same email after deletion
- [ ] Multiple stores handled correctly

## Common Issues

### Permission string not showing

Expo permission strings require a native rebuild:
```bash
npx expo prebuild --clean
npx expo run:ios
```
OTA updates cannot change permission strings.

### Migration conflicts

If Store.owner migration fails due to existing data:
```sql
-- First, no stores should have owner=NULL in normal operation
-- The migration should succeed; if not, check for orphaned stores
```

### Token invalidation

Account deletion must blacklist all refresh tokens:
```python
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

# In delete_account view, before User.delete():
OutstandingToken.objects.filter(user=user).delete()
```

## Next Steps

After implementation, run:
1. Full test suite: `python manage.py test`
2. TypeScript check: `npm run typecheck`
3. Manual testing on iOS device
4. Submit to App Store for review
