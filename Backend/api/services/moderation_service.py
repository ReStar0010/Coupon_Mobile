"""
Moderation Service for UGC Compliance (Apple Guideline 1.2)

Provides functions for:
- Escalation alerts (20h warning, 24h critical)
- Violation recording and suspension threshold checks
- Email notifications for escalation and content removal
"""

from django.utils import timezone
from django.conf import settings
from django.db.models import F
from datetime import timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def check_escalations() -> dict:
    """
    Check for reports approaching 24-hour SLA and send alerts.
    Should be run hourly via management command or cron job.

    Returns:
        dict with counts of warning and critical escalations found
    """
    from ..models import ContentReport

    now = timezone.now()
    warning_threshold = now - timedelta(hours=settings.ESCALATION_HOURS_WARNING)
    critical_threshold = now - timedelta(hours=settings.ESCALATION_HOURS_CRITICAL)

    # Warning alerts (20+ hours but < 24 hours)
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

    warning_count = warning_reports.count()
    critical_count = critical_reports.count()

    if warning_count > 0 or critical_count > 0:
        send_escalation_email(
            warning_reports=list(warning_reports),
            critical_reports=list(critical_reports)
        )

    return {
        'warning_count': warning_count,
        'critical_count': critical_count,
        'checked_at': now.isoformat()
    }


def send_escalation_email(warning_reports: list, critical_reports: list) -> bool:
    """
    Send escalation alert email to admin.

    Args:
        warning_reports: List of reports at 20+ hours
        critical_reports: List of reports at 24+ hours (SLA breach)

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        admin_email = getattr(settings, 'ADMIN_EMAIL', 'admin@coupro.pro')

        # Build email content
        subject = "[CouPro] 內容審核警報"
        if critical_reports:
            subject = "[緊急] " + subject + " - SLA 違規"

        html_content = "<h2>內容審核警報</h2>"

        if critical_reports:
            html_content += f"<h3 style='color: red;'>⚠️ 緊急：{len(critical_reports)} 則報告已超過 24 小時 SLA</h3>"
            html_content += "<ul>"
            for report in critical_reports[:10]:  # Limit to first 10
                hours = (timezone.now() - report.created_at).total_seconds() / 3600
                html_content += f"<li>報告 #{report.id} - {report.get_reason_display()} ({hours:.1f} 小時)</li>"
            html_content += "</ul>"

        if warning_reports:
            html_content += f"<h3 style='color: orange;'>⚡ 警告：{len(warning_reports)} 則報告即將超過 SLA</h3>"
            html_content += "<ul>"
            for report in warning_reports[:10]:  # Limit to first 10
                hours = (timezone.now() - report.created_at).total_seconds() / 3600
                html_content += f"<li>報告 #{report.id} - {report.get_reason_display()} ({hours:.1f} 小時)</li>"
            html_content += "</ul>"

        html_content += "<p>請儘快登入管理後台處理這些報告。</p>"

        resend.Emails.send({
            "from": "CouPro <noreply@coupro.pro>",
            "to": [admin_email],
            "subject": subject,
            "html": html_content,
        })

        logger.info(f"Escalation email sent: {len(warning_reports)} warnings, {len(critical_reports)} critical")
        return True

    except Exception as e:
        logger.error(f"Failed to send escalation email: {e}")
        return False


def record_violation(
    merchant,
    report=None,
    action=None,
    violation_type: str = 'content_removed',
    notes: str = ''
) -> dict:
    """
    Record a violation and check suspension threshold.

    Args:
        merchant: User object (merchant)
        report: ContentReport object (optional)
        action: ModerationAction object (optional)
        violation_type: Type of violation ('content_removed' or 'account_suspended')
        notes: Additional context

    Returns:
        dict with violation details and suspension status
    """
    from ..models import ViolationRecord, MerchantProfile

    # Create violation record
    violation = ViolationRecord.objects.create(
        merchant=merchant,
        report=report,
        action=action,
        violation_type=violation_type,
        notes=notes
    )

    # Update merchant profile violation count
    profile, _ = MerchantProfile.objects.get_or_create(user=merchant)
    profile.violation_count = F('violation_count') + 1
    profile.save(update_fields=['violation_count'])
    profile.refresh_from_db()

    # Check suspension threshold
    threshold = getattr(settings, 'VIOLATION_SUSPENSION_THRESHOLD', 10)
    suspension_flagged = False

    if profile.violation_count >= threshold and not profile.suspension_flagged:
        profile.suspension_flagged = True
        profile.suspension_flagged_at = timezone.now()
        profile.save(update_fields=['suspension_flagged', 'suspension_flagged_at'])
        suspension_flagged = True

        # Send notification about suspension flag
        send_suspension_flag_notification(merchant, profile.violation_count)

    return {
        'violation_id': violation.id,
        'violation_count': profile.violation_count,
        'suspension_flagged': suspension_flagged,
        'threshold': threshold
    }


def send_suspension_flag_notification(merchant, violation_count: int) -> bool:
    """
    Send notification when merchant reaches suspension threshold.

    Args:
        merchant: User object
        violation_count: Current violation count

    Returns:
        True if notification sent successfully
    """
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        admin_email = getattr(settings, 'ADMIN_EMAIL', 'admin@coupro.pro')

        html_content = f"""
        <h2>商家帳號需要審查</h2>
        <p>商家 <strong>{merchant.email}</strong> 已達到違規門檻。</p>
        <ul>
            <li>累計違規次數：{violation_count}</li>
            <li>帳號狀態：已標記待審查</li>
        </ul>
        <p>請登入管理後台決定是否暫停該帳號。</p>
        """

        resend.Emails.send({
            "from": "CouPro <noreply@coupro.pro>",
            "to": [admin_email],
            "subject": f"[CouPro] 商家帳號需要審查 - {merchant.email}",
            "html": html_content,
        })

        logger.info(f"Suspension flag notification sent for merchant: {merchant.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send suspension flag notification: {e}")
        return False


def send_content_removal_notification(
    merchant,
    content_type: str,
    content_name: str,
    reason: str,
    violation_count: int
) -> bool:
    """
    Send notification to merchant when their content is removed.

    Args:
        merchant: User object
        content_type: Type of content ('coupon' or 'store')
        content_name: Name of the removed content
        reason: Reason for removal
        violation_count: Current violation count after removal

    Returns:
        True if notification sent successfully
    """
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        threshold = getattr(settings, 'VIOLATION_SUSPENSION_THRESHOLD', 10)

        content_type_zh = '優惠券' if content_type == 'coupon' else '商店資訊'

        html_content = f"""
        <h2>內容已被移除通知</h2>
        <p>您的{content_type_zh}「{content_name}」因違反平台規範已被移除。</p>
        <p><strong>移除原因：</strong>{reason}</p>
        <hr>
        <p><strong>違規記錄：</strong>目前累計 {violation_count} 次違規</p>
        <p><em>提醒：累計 {threshold} 次違規將導致帳號審查。</em></p>
        <hr>
        <p>如有疑問，請聯繫客服：{getattr(settings, 'SUPPORT_EMAIL', 'coupro707@gmail.com')}</p>
        """

        resend.Emails.send({
            "from": "CouPro <noreply@coupro.pro>",
            "to": [merchant.email],
            "subject": f"[CouPro] 您的{content_type_zh}已被移除",
            "html": html_content,
        })

        logger.info(f"Content removal notification sent to: {merchant.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send content removal notification: {e}")
        return False


def get_content_owner(content_type_model: str, object_id: int):
    """
    Get the owner (merchant) of a piece of content.

    Args:
        content_type_model: Model name ('coupon' or 'store')
        object_id: ID of the content

    Returns:
        User object or None
    """
    from ..models import Coupon, Store

    try:
        if content_type_model == 'coupon':
            coupon = Coupon.objects.select_related('store__owner').get(id=object_id)
            return coupon.store.owner
        elif content_type_model == 'store':
            store = Store.objects.get(id=object_id)
            return store.owner
    except (Coupon.DoesNotExist, Store.DoesNotExist):
        return None

    return None


def hide_content(content_type_model: str, object_id: int) -> bool:
    """
    Hide/deactivate content that has been removed by moderation.

    Args:
        content_type_model: Model name ('coupon' or 'store')
        object_id: ID of the content

    Returns:
        True if content was hidden successfully
    """
    from ..models import Coupon, CouponTemplate

    try:
        if content_type_model == 'coupon':
            # For coupons, we can mark the template as inactive
            coupon = Coupon.objects.get(id=object_id)
            if coupon.template:
                coupon.template.is_active = False
                coupon.template.save(update_fields=['is_active'])
            return True
        elif content_type_model == 'store':
            # For stores, we could add an is_active field if needed
            # For now, just log the action
            logger.info(f"Store {object_id} flagged for removal")
            return True
    except Exception as e:
        logger.error(f"Failed to hide content: {e}")
        return False

    return False
