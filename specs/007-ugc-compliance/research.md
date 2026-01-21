# Research: UGC Compliance for Apple Guideline 1.2

**Feature**: 007-ugc-compliance
**Date**: 2026-01-21
**Status**: Complete

## Overview

This document captures research findings for implementing Apple App Store Guideline 1.2 compliance for User-Generated Content (UGC) in the CouPro coupon platform.

---

## 1. Apple Guideline 1.2 Requirements

### Decision
Implement all six required UGC compliance features as specified by Apple:
1. Content filtering/moderation system
2. Report mechanism for objectionable content
3. Block users feature
4. Contact information for support
5. EULA/Terms acceptance before posting
6. Timely response to moderation requests (24-hour SLA)

### Rationale
- Apple's Guideline 1.2 is explicit about these requirements
- Apps with UGC must demonstrate ability to moderate content
- Non-compliance results in app rejection or removal
- The 24-hour response SLA is industry standard for moderation

### Alternatives Considered
- **Disable UGC entirely**: Rejected - merchant content (coupons, logos) is core to business model
- **Third-party moderation service**: Rejected - adds complexity and cost for MVP; can be evaluated later
- **AI-only content filtering**: Rejected - Apple requires human moderation capability; AI can supplement but not replace

---

## 2. Content Report System Design

### Decision
Implement a database-backed report system with:
- `ContentReport` model storing reporter, content reference (polymorphic via `content_type` and `object_id`), reason, status, timestamps
- Predefined reason categories: `inappropriate`, `misleading`, `illegal`, `spam`, `other`
- Optional free-text field for additional details
- Duplicate prevention: 24-hour cooldown per user per content item

### Rationale
- Django's `ContentType` framework enables generic foreign keys for reporting different content types (coupons, stores)
- Predefined categories speed up reporting and simplify moderation triage
- 24-hour duplicate prevention prevents spam without blocking legitimate re-reports
- Status tracking (`pending`, `reviewed`, `dismissed`) enables workflow management

### Alternatives Considered
- **Separate tables per content type**: Rejected - violates DRY, complicates aggregation
- **External reporting service (Zendesk)**: Rejected - over-engineering for MVP; adds external dependency
- **Anonymous reports**: Rejected - enables abuse; Apple requires accountability

### Implementation Pattern
Follow existing `Log` model pattern:
```python
class ContentReport(models.Model):
    reporter = models.ForeignKey(User, on_delete=models.CASCADE)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    reason = models.CharField(max_length=20, choices=REPORT_REASONS)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True)
```

---

## 3. Merchant Blocking System Design

### Decision
Implement block list with:
- `BlockedMerchant` model: consumer (ForeignKey) → store (ForeignKey)
- Query-level filtering: Exclude blocked stores from all feed/search queries
- Preserve claimed coupons: Blocking affects discovery only, not existing relationships

### Rationale
- User-to-store blocking (not user-to-user) aligns with app's merchant-centric model
- Query-level filtering ensures consistency across all content surfaces
- Preserving claimed coupons matches user expectations and avoids value loss

### Alternatives Considered
- **Application-level filtering**: Rejected - inconsistent, performance overhead, easy to miss surfaces
- **Soft-hide (reduce visibility)**: Rejected - Apple requires complete hiding of blocked content
- **Block user account entirely**: Rejected - too aggressive; merchants may have multiple stores

### Implementation Pattern
Follow existing `DismissedStoresProvider` pattern on frontend:
```typescript
// BlockedMerchantsProvider.tsx
const [blockedStoreIds, setBlockedStoreIds] = useState<Set<number>>(new Set());
// Fetch from API on mount, update via context methods
```

Backend filtering:
```python
# In views that return coupons/stores
blocked_stores = BlockedMerchant.objects.filter(user=request.user).values_list('store_id', flat=True)
queryset = queryset.exclude(store_id__in=blocked_stores)
```

---

## 4. EULA Acceptance Flow Design

### Decision
Implement EULA gate with:
- `EULAAcceptance` model: merchant (ForeignKey), version accepted, timestamp, IP address
- Check before upload: Intercept first upload attempt, require acceptance
- Version tracking: Re-prompt when EULA version increments
- Content guidelines embedded in EULA modal

### Rationale
- Explicit checkbox interaction ("I Agree") required by Apple
- Version tracking enables policy updates without re-prompting for minor changes
- IP address logging provides audit trail for disputes

### Alternatives Considered
- **Implicit acceptance at registration**: Rejected - Apple requires explicit consent before UGC posting
- **External EULA service (termly.io)**: Rejected - adds dependency; simple text display sufficient
- **PDF download requirement**: Rejected - poor mobile UX; in-app scrollable text preferred

### Implementation Pattern
Follow existing `MerchantProfile` verification pattern:
```python
class EULAAcceptance(models.Model):
    merchant = models.ForeignKey(User, on_delete=models.CASCADE)
    version = models.CharField(max_length=20)
    accepted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField()

    class Meta:
        unique_together = ['merchant', 'version']
```

Frontend check before upload:
```typescript
const hasAcceptedEULA = await checkEULAAcceptance();
if (!hasAcceptedEULA || eulaVersion !== currentVersion) {
  showEULAModal();
}
```

---

## 5. Moderation Dashboard Design

### Decision
Implement admin moderation via:
- Django REST Framework endpoints with `IsAdminUser` permission
- Queue-based workflow: pending reports sorted by age (oldest first)
- Actions: approve (dismiss report), remove (hide content), suspend (flag merchant)
- Escalation alerts: Email via Resend API at 20h and 24h marks

### Rationale
- API-based dashboard enables future web admin UI without mobile app changes
- Age-sorted queue ensures 24-hour SLA compliance
- Three action types cover all moderation outcomes
- Email alerts leverage existing Resend integration

### Alternatives Considered
- **Django Admin only**: Rejected - limited customization, no mobile-friendly option
- **Slack integration for alerts**: Rejected - adds dependency; email sufficient for MVP
- **Real-time WebSocket updates**: Rejected - over-engineering; polling sufficient for moderation cadence

### Implementation Pattern
```python
# admin_moderation.py
class ModerationQueueView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        pending = ContentReport.objects.filter(status='pending').order_by('created_at')
        # Include hours_since_report for SLA tracking
```

Escalation cron job or management command:
```python
# python manage.py check_escalations (run hourly via cron)
stale_reports = ContentReport.objects.filter(
    status='pending',
    created_at__lte=timezone.now() - timedelta(hours=20)
)
for report in stale_reports:
    send_escalation_email(report)
```

---

## 6. Data Retention Policy

### Decision
Implement 1-week retention for resolved reports and inactive block records:
- Resolved reports (status != 'pending'): Delete after 7 days
- Block records with no activity: Keep indefinitely (user preference)
- Moderation actions: Retain indefinitely for audit trail

### Rationale
- Spec requirement: "auto-delete resolved content reports... after 1 week"
- Block records represent ongoing user preference, not temporary state
- Moderation actions needed for pattern detection and legal compliance

### Alternatives Considered
- **No automatic deletion**: Rejected - violates spec requirement
- **Immediate deletion on resolution**: Rejected - loses audit capability for disputes
- **User-triggered deletion**: Rejected - adds complexity; automated cleanup sufficient

### Implementation Pattern
Management command for cleanup:
```python
# python manage.py cleanup_old_reports (run daily via cron)
ContentReport.objects.filter(
    status__in=['reviewed', 'dismissed'],
    reviewed_at__lte=timezone.now() - timedelta(days=7)
).delete()
```

---

## 7. Violation Tracking System

### Decision
Implement violation tracking with:
- `ViolationRecord` model: merchant, report reference, action taken, timestamp
- Threshold: 10 violations triggers suspension review flag
- Counter on `MerchantProfile`: `violation_count` field for quick access

### Rationale
- Spec requirement: "10 violations triggers suspension review"
- Denormalized count enables efficient threshold checks
- Full violation history enables pattern analysis and appeals

### Alternatives Considered
- **Count violations on-the-fly**: Rejected - performance overhead on every check
- **Auto-suspend at threshold**: Rejected - spec says "review" not auto-suspend; human decision required
- **Rolling window (e.g., 3 in 90 days)**: Rejected - not specified; keep simple for MVP

### Implementation Pattern
```python
class ViolationRecord(models.Model):
    merchant = models.ForeignKey(User, on_delete=models.CASCADE)
    report = models.ForeignKey(ContentReport, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=20)  # 'content_removed', 'suspended'
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

# In moderation action handler:
ViolationRecord.objects.create(merchant=content.owner, report=report, action='content_removed')
MerchantProfile.objects.filter(user=content.owner).update(
    violation_count=F('violation_count') + 1
)
if merchant.violation_count >= 10:
    # Flag for suspension review
```

---

## 8. Frontend Component Strategy

### Decision
Implement reusable components:
- `ReportButton`: Shared across coupon detail and store profile screens
- `ReportModal`: Reason selection + optional details
- `BlockButton`: Integrated into store profile header
- `EULAModal`: Full-screen modal with scroll-to-bottom detection

### Rationale
- Component reuse ensures consistent UX across surfaces
- Modular design enables future extension to new content types
- Modal patterns match existing app conventions

### Alternatives Considered
- **Inline forms**: Rejected - clutters primary screens; modal focus preferred
- **Separate reporting app/screen**: Rejected - adds friction; in-context reporting preferred
- **Bottom sheet for quick actions**: Considered - may use for block confirmation

### Implementation Pattern
Follow existing `ShareModal.tsx` pattern:
```typescript
// ReportModal.tsx
interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'coupon' | 'store';
  contentId: number;
}

const ReportModal: React.FC<ReportModalProps> = ({ visible, onClose, contentType, contentId }) => {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  // ...
};
```

---

## 9. Privacy & Support Information

### Decision
Implement accessible privacy and support sections:
- Privacy Policy: Static screen accessible from login page and settings
- Help/Support: Screen with email contact and support URL
- No authentication required for privacy policy viewing

### Rationale
- Apple requirement: Privacy policy accessible without login
- Spec requirements: SC-005, FR-012, FR-013, FR-014
- Email contact via existing support address

### Alternatives Considered
- **External privacy policy link only**: Rejected - poor UX; in-app display preferred
- **Chat support integration**: Rejected - over-engineering for MVP
- **FAQ database**: Rejected - not required; simple contact info sufficient

### Implementation Pattern
```typescript
// PrivacyPolicy/index.tsx
// No auth check needed - accessible to all users
const PrivacyPolicyScreen: React.FC = () => {
  return (
    <ScrollView>
      <Text>{PRIVACY_POLICY_TEXT}</Text>
    </ScrollView>
  );
};
```

---

## 10. Testing Strategy

### Decision
Implement comprehensive test coverage:
- **Unit tests**: Report creation, duplicate prevention, violation counting
- **Integration tests**: Full report→moderation→action flow
- **Contract tests**: All new API endpoints
- **Frontend tests**: Component rendering, modal interactions

### Rationale
- Constitution Principle III requires critical path testing
- Report flow is critical for compliance
- Moderation actions affect merchant accounts - must be reliable

### Test Cases
1. Consumer can submit report with reason
2. Consumer cannot submit duplicate report within 24 hours
3. Consumer can block/unblock merchant
4. Blocked merchant content hidden from feed
5. Merchant must accept EULA before first upload
6. Merchant not re-prompted after accepting current EULA version
7. Admin can view pending reports queue
8. Admin can approve/remove/suspend on report
9. 10 violations triggers suspension review flag
10. Escalation email sent at 20-hour mark

---

## Summary

All research areas resolved. No "NEEDS CLARIFICATION" items remain. The implementation will:

1. Use Django's `ContentType` framework for polymorphic content reporting
2. Follow existing codebase patterns for models, views, and frontend components
3. Leverage existing Resend API integration for escalation emails
4. Implement management commands for data retention and escalation checks
5. Maintain Chinese UI text throughout frontend
6. Ensure full test coverage for critical compliance paths
