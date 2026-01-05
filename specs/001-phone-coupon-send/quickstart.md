# Quickstart: Phone-Based Coupon Send

**Date**: 2026-01-05
**Branch**: `001-phone-coupon-send`

## Overview

This document provides implementation guidance for the phone-based coupon send feature. It covers the key implementation points, code patterns, and testing approach.

---

## Prerequisites

- Python 3.10+ with Django 5.2
- Node.js 18+ with Expo CLI
- Access to Backend, Mobile-Frontend, and Mobile-Merchant-Frontend codebases

---

## Implementation Order

### Phase 1: Backend Changes

> **⚠️ IMPORTANT**: Before running any backend commands, activate the Python virtual environment:
>
> ```bash
> .venv\Scripts\activate  # Windows
> # or
> source .venv/bin/activate  # macOS/Linux
> ```

1. **Add `pending_phone_number` field to Coupon model**

   ```bash
   cd Backend
   python manage.py makemigrations api --name add_coupon_pending_phone_number
   python manage.py migrate
   ```

2. **Update `merchant_consolidate_coupon` view**

   - File: `Backend/api/views/merchant_coupon.py`
   - Change permission from `AllowAny` to `IsAuthenticated`
   - Add logic to create pending coupons for unregistered phones

3. **Add user phone endpoints**

   - File: `Backend/api/views/user_profile.py` (add new functions)
   - File: `Backend/Backend/urls.py` (add routes)
   - Endpoints: GET/PUT/DELETE `/api/user/phone/`

4. **Add pending coupon assignment helper**
   - File: `Backend/api/views/user_profile.py`
   - Function: `assign_pending_coupons(user, phone_number)`

### Phase 2: User App Changes

5. **Add phone settings screen**

   - File: `Mobile-Frontend/app/OptionsMenu/PhoneSettings/index.tsx` (new)
   - Add navigation from `Mobile-Frontend/app/OptionsMenu/index.tsx`

6. **Add API methods**
   - File: `Mobile-Frontend/app/utils/authAPI.ts`
   - Methods: `getUserPhone()`, `updateUserPhone()`, `deleteUserPhone()`

### Phase 3: Merchant App Changes

7. **Update coupon redemption screen**

   - File: `Mobile-Merchant-Frontend/app/(coupons)/[id].tsx`
   - Add "Send Coupon" button alongside existing redemption functionality

8. **Add API method**
   - File: `Mobile-Merchant-Frontend/utils/api.ts`
   - Method: `consolidateCoupon(templateId, phoneNumber)`

---

## Key Code Snippets

### Backend: Phone Validation Helper

```python
# Backend/api/utils.py (or inline in views)
import re

TAIWAN_MOBILE_REGEX = re.compile(r'^09\d{8}$')

def validate_phone_number(phone: str) -> str:
    """Validate and normalize Taiwan mobile phone number."""
    # Remove spaces, dashes, parentheses
    normalized = re.sub(r'[\s\-\(\)]', '', phone)

    if not TAIWAN_MOBILE_REGEX.match(normalized):
        raise ValueError("Invalid phone number format. Must be Taiwan mobile (09XXXXXXXX)")

    return normalized

def mask_phone_number(phone: str) -> str:
    """Mask phone number for display: 0912345678 -> 0912****78"""
    if not phone or len(phone) < 6:
        return phone
    return f"{phone[:4]}{'*' * (len(phone) - 6)}{phone[-2:]}"
```

### Backend: Extended Consolidate Coupon

```python
# Backend/api/views/merchant_coupon.py

@api_view(['POST'])
@permission_classes([IsAuthenticated])  # CHANGED from AllowAny
def merchant_consolidate_coupon(request):
    serializer = ConsolidateCouponSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    template_id = serializer.validated_data['template_id']
    phone_number = validate_phone_number(serializer.validated_data['phone_number'])

    # Verify merchant owns this template
    store = get_merchant_store(request.user)
    if not store:
        return Response({'error': 'No store found for this merchant.'},
                       status=status.HTTP_404_NOT_FOUND)

    try:
        template = CouponTemplate.objects.get(
            id=template_id,
            store=store,  # ADDED: ownership check
            is_active=True,
            remaining_quantity__gt=0
        )
    except CouponTemplate.DoesNotExist:
        return Response({'error': 'Coupon template not found or not available.'},
                       status=status.HTTP_404_NOT_FOUND)

    # Try to find registered user
    try:
        user_profile = StudentProfile.objects.get(phone_number=phone_number)
        # Registered user - assign immediately
        coupon = template.generate_coupon(user_profile.user)
        coupon.acquisition_method = 'consolidate'
        coupon.save()

        return Response({
            'message': 'Coupon consolidated successfully',
            'coupon_name': coupon.coupon_name,
            'remaining_quantity': template.remaining_quantity,
            'recipient_status': 'registered'
        }, status=status.HTTP_201_CREATED)

    except StudentProfile.DoesNotExist:
        # Unregistered phone - create pending coupon
        coupon = Coupon.objects.create(
            store=template.store,
            template=template,
            coupon_name=template.coupon_name,
            coupon_detail=template.coupon_detail,
            important_notes=template.important_notes,
            start_date=template.start_date,
            expiry_date=template.expiry_date,
            image_url=template.image_url,
            coupon_type='exclusive',
            estimated_savings=template.estimated_savings,
            acquisition_method='consolidate',
            pending_phone_number=phone_number,
            current_holder=None,
            original_owner=None,
        )
        coupon.tags.set(template.tags.all())

        # Decrement template quantity
        template.remaining_quantity -= 1
        if template.remaining_quantity <= 0:
            template.is_active = False
        template.save()

        return Response({
            'message': 'Coupon created as pending. Will be assigned when user registers.',
            'coupon_name': coupon.coupon_name,
            'remaining_quantity': template.remaining_quantity,
            'recipient_status': 'pending',
            'pending_phone': mask_phone_number(phone_number)
        }, status=status.HTTP_200_OK)
```

### Backend: User Phone Endpoints

```python
# Backend/api/views/user_profile.py

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_phone(request):
    """Get user's registered phone number."""
    try:
        profile = request.user.student_profile
        return Response({
            'phone_number': profile.phone_number,
            'phone_number_masked': mask_phone_number(profile.phone_number) if profile.phone_number else None,
            'has_phone': bool(profile.phone_number)
        })
    except StudentProfile.DoesNotExist:
        return Response({
            'phone_number': None,
            'phone_number_masked': None,
            'has_phone': False
        })

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_user_phone(request):
    """Register or update user's phone number."""
    phone_number = request.data.get('phone_number', '').strip()

    try:
        phone_number = validate_phone_number(phone_number)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # Check uniqueness
    if StudentProfile.objects.filter(phone_number=phone_number).exclude(user=request.user).exists():
        return Response({
            'error': 'This phone number is already registered to another account'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Update profile
    profile, _ = StudentProfile.objects.get_or_create(user=request.user)
    profile.phone_number = phone_number
    profile.save()

    # Assign pending coupons
    claimed_count = assign_pending_coupons(request.user, phone_number)

    return Response({
        'message': 'Phone number updated successfully',
        'phone_number_masked': mask_phone_number(phone_number),
        'pending_coupons_claimed': claimed_count
    })

def assign_pending_coupons(user, phone_number):
    """Assign all pending coupons for a phone number to the user."""
    pending_coupons = Coupon.objects.filter(
        pending_phone_number=phone_number,
        current_holder__isnull=True,
        expiry_date__gt=timezone.now()
    )

    count = 0
    for coupon in pending_coupons:
        coupon.current_holder = user
        coupon.original_owner = user
        coupon.pending_phone_number = None
        coupon.save()
        count += 1

        # Log the assignment
        Log.objects.create(
            user=user,
            coupon=coupon,
            action='pending_coupon_claimed'
        )

    return count
```

### Frontend: User Phone Settings Screen

```tsx
// Mobile-Frontend/app/OptionsMenu/PhoneSettings/index.tsx

import React, { useState, useEffect } from "react";
import { Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { YStack, XStack, H4, Input, Button, Text, Card } from "tamagui";
import { ChevronLeft, Phone } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchAPI } from "../../utils/authAPI";

export default function PhoneSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPhone();
  }, []);

  const loadPhone = async () => {
    try {
      const response = await fetchAPI("/user/phone/");
      const data = response.data;
      setPhone(data.phone_number || "");
      setMaskedPhone(data.phone_number_masked);
    } catch (error) {
      console.error("Failed to load phone:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePhone = async () => {
    if (!phone.match(/^09\d{8}$/)) {
      Alert.alert("格式錯誤", "請輸入有效的台灣手機號碼（09開頭，共10碼）");
      return;
    }

    setSaving(true);
    try {
      const response = await fetchAPI("/user/phone/", {
        method: "PUT",
        data: { phone_number: phone },
      });
      const data = response.data;

      setMaskedPhone(data.phone_number_masked);

      if (data.pending_coupons_claimed > 0) {
        Alert.alert(
          "設定成功",
          `手機號碼已儲存，您有 ${data.pending_coupons_claimed} 張優惠券已自動領取！`
        );
      } else {
        Alert.alert("設定成功", "手機號碼已儲存");
      }
    } catch (error: any) {
      Alert.alert("錯誤", error.message || "儲存手機號碼失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack
        flex={1}
        px="$4"
        py="$6"
        gap="$4"
        style={{ paddingTop: insets.top + 10 }}
      >
        <XStack gap="$3" alignItems="center">
          <ChevronLeft size={24} onPress={() => router.back()} />
          <H4 fontWeight="bold">手機號碼</H4>
        </XStack>

        <Card bordered p="$4">
          <YStack gap="$4">
            <Text color="$gray10">
              註冊您的手機號碼，即可接收商家直接發送的優惠券。
            </Text>

            <Input
              placeholder="0912345678"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />

            {maskedPhone && (
              <Text color="$gray11" fontSize="$2">
                目前已註冊：{maskedPhone}
              </Text>
            )}

            <Button
              onPress={savePhone}
              disabled={saving || !phone}
              bg={saving ? "$gray5" : "#ffad31"}
            >
              {saving ? "儲存中..." : "儲存手機號碼"}
            </Button>
          </YStack>
        </Card>
      </YStack>
    </>
  );
}
```

### Frontend: Merchant Consolidate API

```typescript
// Mobile-Merchant-Frontend/utils/api.ts

// Add to merchantAPI object:
consolidateCoupon: async (templateId: number, phoneNumber: string) => {
  const response = await fetchAPI('/merchant/consolidate-coupon/', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      phone_number: phoneNumber,
    }),
  });
  return parseResponse<{
    message: string;
    coupon_name: string;
    remaining_quantity: number;
    recipient_status: 'registered' | 'pending';
    pending_phone?: string;
  }>(response);
},
```

---

## Testing Checklist

### Backend Tests

```python
# Backend/api/tests.py

class PhoneConsolidateTests(TestCase):
    def test_consolidate_to_registered_user(self):
        """Coupon sent to registered phone is immediately assigned."""
        pass

    def test_consolidate_to_unregistered_phone(self):
        """Coupon sent to unregistered phone creates pending coupon."""
        pass

    def test_pending_coupon_assigned_on_registration(self):
        """Pending coupons are assigned when user registers phone."""
        pass

    def test_expired_pending_coupon_not_assigned(self):
        """Expired pending coupons are not assigned."""
        pass

    def test_phone_validation_rejects_invalid_format(self):
        """Invalid phone formats are rejected."""
        pass

    def test_phone_uniqueness_enforced(self):
        """Cannot register phone already used by another user."""
        pass

    def test_merchant_must_own_template(self):
        """Merchant can only send from their own templates."""
        pass

    def test_requires_authentication(self):
        """Consolidate endpoint requires authentication."""
        pass
```

### Manual Test Scenarios

1. **User registers phone number**

   - Navigate to Settings > Phone Number
   - Enter valid phone (09XXXXXXXX)
   - Verify phone is saved and displayed masked

2. **Merchant sends coupon to registered user**

   - Select coupon template
   - Enter registered user's phone
   - Confirm coupon appears in user's collection

3. **Merchant sends coupon to unregistered phone**

   - Enter unregistered phone number
   - Confirm "pending" status message
   - New user registers with that phone
   - Confirm coupon appears in their collection

4. **Phone uniqueness**
   - Try to register phone already used by another user
   - Confirm error message

---

## Deployment Notes

1. **Run migrations before deploying new code**

   ```bash
   # First activate venv (if not already activated)
   .venv\Scripts\activate  # Windows
   # or
   source .venv/bin/activate  # macOS/Linux

   # Then run migrations
   python manage.py migrate
   ```

2. **No data backfill required** - new field is nullable

3. **Monitor for errors** in consolidate-coupon endpoint after auth change

4. **Update API documentation** in Swagger/Redoc
