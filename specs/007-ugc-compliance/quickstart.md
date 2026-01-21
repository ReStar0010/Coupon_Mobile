# Quickstart: UGC Compliance for Apple Guideline 1.2

**Feature**: 007-ugc-compliance
**Date**: 2026-01-21
**Status**: Ready for Implementation

## Overview

This quickstart guide provides step-by-step instructions for implementing Apple App Store Guideline 1.2 UGC compliance features in the CouPro coupon platform.

---

## Prerequisites

### Backend Setup

```bash
# Navigate to backend directory
cd Backend

# Activate virtual environment (Windows)
.venv\Scripts\activate

# Or Unix/macOS
source .venv/bin/activate

# Verify Django is available
python manage.py --version
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd Mobile-Frontend

# Install dependencies if needed
npm install

# Verify Expo is available
npx expo --version
```

### Required Environment Variables

```env
# Backend (.env or settings.py)
RESEND_API_KEY=your_resend_api_key          # For escalation emails
ADMIN_EMAIL=admin@example.com                # Escalation alert recipient
CURRENT_EULA_VERSION=1.0.0                   # Current EULA version
```

---

## Implementation Phases

### Phase 1: Backend Models (Estimated: Core foundation)

1. **Add new models to `Backend/api/models.py`**
   - Copy model definitions from `data-model.md`
   - Add imports for `ContentType` and `GenericForeignKey`
   - Add choice tuples for report reasons, statuses, etc.

2. **Create and apply migration**
   ```bash
   python manage.py makemigrations api --name ugc_compliance_models
   python manage.py migrate
   ```

3. **Register models in `Backend/api/admin.py`**
   ```python
   from .models import ContentReport, BlockedMerchant, EULAAcceptance, ModerationAction, ViolationRecord

   admin.site.register(ContentReport)
   admin.site.register(BlockedMerchant)
   admin.site.register(EULAAcceptance)
   admin.site.register(ModerationAction)
   admin.site.register(ViolationRecord)
   ```

### Phase 2: Backend Serializers

1. **Add serializers to `Backend/api/serializers.py`**

   ```python
   # ContentReport serializers
   class ContentReportCreateSerializer(serializers.Serializer):
       reason = serializers.ChoiceField(choices=REPORT_REASONS)
       details = serializers.CharField(required=False, allow_blank=True, max_length=1000)

   class ContentReportSerializer(serializers.ModelSerializer):
       reason_display = serializers.CharField(source='get_reason_display', read_only=True)

       class Meta:
           model = ContentReport
           fields = ['id', 'reason', 'reason_display', 'status', 'created_at']

   # BlockedMerchant serializers
   class BlockedMerchantSerializer(serializers.ModelSerializer):
       store_name = serializers.CharField(source='store.name', read_only=True)

       class Meta:
           model = BlockedMerchant
           fields = ['id', 'store_id', 'store_name', 'created_at']

   # EULAAcceptance serializers
   class EULAAcceptSerializer(serializers.Serializer):
       version = serializers.CharField(max_length=20)
       agreed = serializers.BooleanField()
   ```

### Phase 3: Backend Views

1. **Create `Backend/api/views/content_moderation.py`**
   - `ReportContentView` (POST /api/content/{type}/{id}/report/)
   - `UserReportsView` (GET /api/user/reports/)
   - `ReportStatusView` (GET /api/content/{type}/{id}/report/status/)
   - `BlockMerchantView` (POST /api/user/blocked-merchants/)
   - `UnblockMerchantView` (DELETE /api/user/blocked-merchants/{id}/)
   - `BlockedMerchantsListView` (GET /api/user/blocked-merchants/)

2. **Create `Backend/api/views/eula_acceptance.py`**
   - `EULAStatusView` (GET /api/merchant/eula/status/)
   - `EULAAcceptView` (POST /api/merchant/eula/accept/)
   - `EULAContentView` (GET /api/merchant/eula/content/)
   - `ContentGuidelinesView` (GET /api/content-guidelines/)
   - `PrivacyPolicyView` (GET /api/privacy-policy/)

3. **Create `Backend/api/views/admin_moderation.py`**
   - `ModerationQueueView` (GET /api/admin/moderation/queue/)
   - `ReportDetailView` (GET /api/admin/moderation/reports/{id}/)
   - `ModerationActionView` (POST /api/admin/moderation/reports/{id}/action/)
   - `EscalatedReportsView` (GET /api/admin/moderation/escalations/)
   - `MerchantViolationsView` (GET /api/admin/moderation/merchants/{id}/violations/)

4. **Update `Backend/Backend/urls.py`**
   ```python
   # Content Moderation
   path('api/content/<str:content_type>/<int:content_id>/report/', ReportContentView.as_view()),
   path('api/content/<str:content_type>/<int:content_id>/report/status/', ReportStatusView.as_view()),
   path('api/user/reports/', UserReportsView.as_view()),
   path('api/user/blocked-merchants/', BlockedMerchantsListView.as_view()),
   path('api/user/blocked-merchants/<int:store_id>/', UnblockMerchantView.as_view()),
   path('api/store/<int:store_id>/block-status/', BlockStatusView.as_view()),

   # EULA
   path('api/merchant/eula/status/', EULAStatusView.as_view()),
   path('api/merchant/eula/accept/', EULAAcceptView.as_view()),
   path('api/merchant/eula/content/', EULAContentView.as_view()),
   path('api/content-guidelines/', ContentGuidelinesView.as_view()),
   path('api/privacy-policy/', PrivacyPolicyView.as_view()),

   # Admin Moderation
   path('api/admin/moderation/queue/', ModerationQueueView.as_view()),
   path('api/admin/moderation/reports/<int:report_id>/', ReportDetailView.as_view()),
   path('api/admin/moderation/reports/<int:report_id>/action/', ModerationActionView.as_view()),
   path('api/admin/moderation/escalations/', EscalatedReportsView.as_view()),
   path('api/admin/moderation/merchants/<int:merchant_id>/violations/', MerchantViolationsView.as_view()),
   path('api/admin/moderation/stats/', ModerationStatsView.as_view()),
   ```

### Phase 4: Backend Services

1. **Create `Backend/api/services/moderation_service.py`**

   ```python
   from django.utils import timezone
   from datetime import timedelta
   import resend
   from ..models import ContentReport, ViolationRecord, ModerationAction

   def check_escalations():
       """Check for reports approaching 24-hour SLA and send alerts."""
       now = timezone.now()
       warning_threshold = now - timedelta(hours=20)
       critical_threshold = now - timedelta(hours=24)

       # Warning alerts (20+ hours)
       warning_reports = ContentReport.objects.filter(
           status='pending',
           created_at__lte=warning_threshold,
           created_at__gt=critical_threshold
       )

       # Critical alerts (24+ hours)
       critical_reports = ContentReport.objects.filter(
           status='pending',
           created_at__lte=critical_threshold
       )

       if warning_reports.exists() or critical_reports.exists():
           send_escalation_email(warning_reports, critical_reports)

   def record_violation(merchant, report, action):
       """Record a violation and check suspension threshold."""
       from ..models import MerchantProfile

       ViolationRecord.objects.create(
           merchant=merchant,
           report=report,
           action=action,
           violation_type='content_removed'
       )

       profile = MerchantProfile.objects.get(user=merchant)
       profile.violation_count += 1

       if profile.violation_count >= 10 and not profile.suspension_flagged:
           profile.suspension_flagged = True
           profile.suspension_flagged_at = timezone.now()

       profile.save()
   ```

2. **Create management command for cleanup**

   Create `Backend/api/management/commands/cleanup_old_reports.py`:
   ```python
   from django.core.management.base import BaseCommand
   from django.utils import timezone
   from datetime import timedelta
   from api.models import ContentReport

   class Command(BaseCommand):
       help = 'Clean up resolved content reports older than 7 days'

       def handle(self, *args, **options):
           cutoff = timezone.now() - timedelta(days=7)
           deleted, _ = ContentReport.objects.filter(
               status__in=['reviewed', 'dismissed'],
               reviewed_at__lte=cutoff
           ).delete()
           self.stdout.write(f'Deleted {deleted} old reports')
   ```

### Phase 5: Frontend - Consumer App Screens

1. **Create `Mobile-Frontend/app/services/contentReportAPI.ts`**

   ```typescript
   import { fetchAPI } from '../utils/authAPI';

   export interface ContentReportRequest {
     reason: 'inappropriate' | 'misleading' | 'illegal' | 'spam' | 'other';
     details?: string;
   }

   export interface ContentReportResponse {
     id: number;
     reason: string;
     reason_display: string;
     status: string;
     created_at: string;
     message: string;
   }

   export async function submitReport(
     contentType: 'coupon' | 'store',
     contentId: number,
     data: ContentReportRequest
   ): Promise<ContentReportResponse> {
     return fetchAPI(`/content/${contentType}/${contentId}/report/`, {
       method: 'POST',
       body: JSON.stringify(data),
     });
   }

   export async function checkReportStatus(
     contentType: 'coupon' | 'store',
     contentId: number
   ): Promise<{ has_reported: boolean; can_report_again: boolean }> {
     return fetchAPI(`/content/${contentType}/${contentId}/report/status/`);
   }
   ```

2. **Create `Mobile-Frontend/app/services/blockListAPI.ts`**

   ```typescript
   import { fetchAPI } from '../utils/authAPI';

   export interface BlockedMerchant {
     id: number;
     store: { id: number; name: string; image_url?: string };
     created_at: string;
   }

   export async function getBlockedMerchants(): Promise<BlockedMerchant[]> {
     const response = await fetchAPI('/user/blocked-merchants/');
     return response.results;
   }

   export async function blockMerchant(storeId: number): Promise<void> {
     await fetchAPI('/user/blocked-merchants/', {
       method: 'POST',
       body: JSON.stringify({ store_id: storeId }),
     });
   }

   export async function unblockMerchant(storeId: number): Promise<void> {
     await fetchAPI(`/user/blocked-merchants/${storeId}/`, {
       method: 'DELETE',
     });
   }
   ```

3. **Create `Mobile-Frontend/app/components/ReportModal.tsx`**

   ```typescript
   import React, { useState } from 'react';
   import { Sheet, YStack, XStack, Text, Button, RadioGroup, TextArea } from 'tamagui';
   import { submitReport, ContentReportRequest } from '../services/contentReportAPI';

   interface ReportModalProps {
     visible: boolean;
     onClose: () => void;
     contentType: 'coupon' | 'store';
     contentId: number;
     onSuccess: () => void;
   }

   const REPORT_REASONS = [
     { value: 'inappropriate', label: '不當內容' },
     { value: 'misleading', label: '誤導資訊' },
     { value: 'illegal', label: '違法商品' },
     { value: 'spam', label: '垃圾訊息' },
     { value: 'other', label: '其他' },
   ];

   export const ReportModal: React.FC<ReportModalProps> = ({
     visible, onClose, contentType, contentId, onSuccess
   }) => {
     const [reason, setReason] = useState<string>('');
     const [details, setDetails] = useState('');
     const [loading, setLoading] = useState(false);

     const handleSubmit = async () => {
       if (!reason) return;
       setLoading(true);
       try {
         await submitReport(contentType, contentId, {
           reason: reason as ContentReportRequest['reason'],
           details,
         });
         onSuccess();
         onClose();
       } catch (error) {
         // Handle error
       } finally {
         setLoading(false);
       }
     };

     return (
       <Sheet modal open={visible} onOpenChange={onClose}>
         {/* Modal content */}
       </Sheet>
     );
   };
   ```

4. **Create `Mobile-Frontend/app/OptionsMenu/BlockedMerchants/index.tsx`**

5. **Create `Mobile-Frontend/app/OptionsMenu/HelpSupport/index.tsx`**

6. **Create `Mobile-Frontend/app/OptionsMenu/PrivacyPolicy/index.tsx`**

### Phase 6: Frontend - Merchant App Screens

1. **Create `Mobile-Frontend/app/services/eulaAPI.ts`**

   ```typescript
   import { fetchAPI } from '../utils/authAPI';

   export interface EULAStatus {
     has_accepted: boolean;
     accepted_version: string | null;
     current_version: string;
     needs_acceptance: boolean;
   }

   export async function getEULAStatus(): Promise<EULAStatus> {
     return fetchAPI('/merchant/eula/status/');
   }

   export async function acceptEULA(version: string): Promise<void> {
     await fetchAPI('/merchant/eula/accept/', {
       method: 'POST',
       body: JSON.stringify({ version, agreed: true }),
     });
   }

   export async function getEULAContent(): Promise<{
     version: string;
     content: string;
     content_guidelines: string;
   }> {
     return fetchAPI('/merchant/eula/content/');
   }
   ```

2. **Create EULA gate in merchant upload flow**

   Modify the existing upload component to check EULA status before allowing upload.

### Phase 7: Testing

1. **Create `Backend/tests/test_ugc_compliance.py`**

   ```python
   from django.test import TestCase
   from django.contrib.auth.models import User
   from rest_framework.test import APIClient
   from api.models import Store, Coupon, ContentReport, BlockedMerchant

   class ContentReportTests(TestCase):
       def setUp(self):
           self.client = APIClient()
           self.user = User.objects.create_user('testuser', 'test@example.com', 'password')
           # Create test store and coupon

       def test_submit_report_success(self):
           self.client.force_authenticate(user=self.user)
           response = self.client.post('/api/content/coupon/1/report/', {
               'reason': 'inappropriate'
           })
           self.assertEqual(response.status_code, 201)

       def test_duplicate_report_prevention(self):
           # Submit first report
           # Try to submit again within 24 hours
           # Assert 400 response
           pass

   class BlockedMerchantTests(TestCase):
       def test_block_merchant_success(self):
           pass

       def test_blocked_content_filtered(self):
           pass

   class EULAAcceptanceTests(TestCase):
       def test_eula_required_before_upload(self):
           pass
   ```

2. **Run tests**
   ```bash
   python manage.py test api.tests.test_ugc_compliance
   ```

---

## Verification Checklist

### Backend Verification

- [ ] Models created and migrated
- [ ] All API endpoints return correct responses
- [ ] Duplicate report prevention works (24-hour window)
- [ ] Blocked merchant content filtered from queries
- [ ] EULA acceptance blocks uploads if not accepted
- [ ] Admin moderation actions work correctly
- [ ] Violation counter increments properly
- [ ] Escalation email sends at 20-hour mark

### Frontend Verification

- [ ] Report button visible on coupon detail page
- [ ] Report button visible on store profile page
- [ ] Report modal shows all reason options
- [ ] Report submission shows success message
- [ ] Block merchant button works
- [ ] Blocked merchants list shows in settings
- [ ] Unblock works and content reappears
- [ ] EULA modal appears before first upload
- [ ] Privacy policy accessible without login
- [ ] Help/Support page shows contact info

### Apple Compliance Verification

- [ ] SC-001: 100% of merchant content has visible report buttons
- [ ] SC-002: Reports can be reviewed within 24 hours (admin flow works)
- [ ] SC-003: Report flow completes in < 30 seconds
- [ ] SC-004: Block merchant in 2 taps
- [ ] SC-005: Privacy Policy accessible within 2 taps
- [ ] SC-006: EULA shown before first merchant upload
- [ ] SC-007: Support contact info visible with working links

---

## Common Issues & Solutions

### Issue: Generic foreign key not working

```python
# Ensure ContentType is imported correctly
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

# When creating report, get ContentType properly
content_type = ContentType.objects.get_for_model(Coupon)
```

### Issue: Block filtering not applied

```python
# Ensure blocked stores filter is applied to all relevant queries
def get_queryset(self):
    queryset = super().get_queryset()
    if self.request.user.is_authenticated:
        blocked = BlockedMerchant.objects.filter(
            user=self.request.user
        ).values_list('store_id', flat=True)
        queryset = queryset.exclude(store_id__in=list(blocked))
    return queryset
```

### Issue: EULA not blocking uploads

```python
# Check EULA status in upload view
def post(self, request):
    from django.conf import settings

    has_valid_eula = EULAAcceptance.objects.filter(
        merchant=request.user,
        version=settings.CURRENT_EULA_VERSION
    ).exists()

    if not has_valid_eula:
        return Response(
            {'error': '請先接受使用條款'},
            status=status.HTTP_403_FORBIDDEN
        )
    # Continue with upload
```

---

## Next Steps

After completing implementation:

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Create feature branch commits
3. Run full test suite
4. Submit for code review
5. Deploy to staging for QA testing
6. Submit app update to Apple for review
