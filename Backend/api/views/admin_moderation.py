"""
Admin Moderation Views
UGC Compliance (Apple Guideline 1.2) - User Story 4

Provides endpoints for admin moderation dashboard:
- ModerationQueueView: Get pending reports queue
- ReportDetailView: Get detailed report information
- ModerationActionView: Take action on a report (approve/remove/suspend)
- EscalatedReportsView: Get reports past 20h threshold
- MerchantViolationsView: Get merchant violation history
- ModerationStatsView: Get dashboard overview statistics
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from django.utils import timezone
from django.db.models import Q, Count, F
from django.contrib.contenttypes.models import ContentType
from datetime import timedelta
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from ..models import (
    ContentReport,
    ModerationAction,
    ViolationRecord,
    User,
    MerchantProfile,
    Coupon,
    Store,
)
from ..serializers import (
    ContentReportSerializer,
    ModerationActionSerializer,
    ViolationRecordSerializer,
)
from ..services.moderation_service import record_violation


# ============================================
# Moderation Queue View
# ============================================

class ModerationQueueView(APIView):
    """
    Get moderation queue with filtering and sorting.
    Admin only.
    """
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_description="Get pending content reports queue for moderation",
        manual_parameters=[
            openapi.Parameter('status', openapi.IN_QUERY, description="Filter by status (pending/reviewed/dismissed)", type=openapi.TYPE_STRING),
            openapi.Parameter('sort', openapi.IN_QUERY, description="Sort by: created_at, -created_at (default: oldest first)", type=openapi.TYPE_STRING),
            openapi.Parameter('escalated', openapi.IN_QUERY, description="Filter for escalated reports (past 20h)", type=openapi.TYPE_BOOLEAN),
        ],
        responses={
            200: openapi.Response(
                description="Moderation queue list",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'count': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'results': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_OBJECT)),
                    }
                )
            )
        }
    )
    def get(self, request):
        # Query parameters
        status_filter = request.query_params.get('status', 'pending')
        sort_by = request.query_params.get('sort', 'created_at')  # Oldest first by default
        escalated_only = request.query_params.get('escalated', 'false').lower() == 'true'

        # Base queryset
        queryset = ContentReport.objects.select_related(
            'reporter', 'reviewed_by', 'content_type'
        ).all()

        # Status filter
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Escalated filter (20+ hours old)
        if escalated_only:
            escalation_threshold = timezone.now() - timedelta(hours=20)
            queryset = queryset.filter(created_at__lte=escalation_threshold)

        # Sort
        if sort_by in ['created_at', '-created_at']:
            queryset = queryset.order_by(sort_by)
        else:
            queryset = queryset.order_by('created_at')  # Default

        # Serialize with additional fields
        results = []
        for report in queryset:
            # Get content object
            content_object = report.content_object
            content_data = None
            if content_object:
                if isinstance(content_object, Coupon):
                    content_data = {
                        'type': 'coupon',
                        'id': content_object.id,
                        'title': content_object.title,
                        'store_name': content_object.store.name if content_object.store else None,
                        'merchant_id': content_object.store.owner.id if content_object.store and content_object.store.owner else None,
                    }
                elif isinstance(content_object, Store):
                    content_data = {
                        'type': 'store',
                        'id': content_object.id,
                        'name': content_object.name,
                        'merchant_id': content_object.owner.id if content_object.owner else None,
                    }

            # Calculate hours since report
            hours_since_report = (timezone.now() - report.created_at).total_seconds() / 3600

            results.append({
                'id': report.id,
                'reporter': {
                    'id': report.reporter.id,
                    'username': report.reporter.username,
                },
                'content': content_data,
                'reason': report.reason,
                'reason_display': report.get_reason_display(),
                'details': report.details,
                'status': report.status,
                'status_display': report.get_status_display(),
                'created_at': report.created_at.isoformat(),
                'hours_since_report': round(hours_since_report, 1),
                'is_escalated': hours_since_report >= 20,
                'reviewed_at': report.reviewed_at.isoformat() if report.reviewed_at else None,
                'reviewed_by': {
                    'id': report.reviewed_by.id,
                    'username': report.reviewed_by.username,
                } if report.reviewed_by else None,
            })

        return Response({
            'count': queryset.count(),
            'results': results,
        })


# ============================================
# Report Detail View
# ============================================

class ReportDetailView(APIView):
    """
    Get detailed information for a single report.
    Admin only.
    """
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_description="Get detailed report information including content and merchant data",
        responses={
            200: openapi.Response(description="Report details"),
            404: openapi.Response(description="Report not found"),
        }
    )
    def get(self, request, report_id):
        try:
            report = ContentReport.objects.select_related(
                'reporter', 'reviewed_by', 'content_type'
            ).get(id=report_id)
        except ContentReport.DoesNotExist:
            return Response({'error': '報告不存在'}, status=status.HTTP_404_NOT_FOUND)

        # Get content object
        content_object = report.content_object
        content_data = None
        merchant_data = None

        if content_object:
            if isinstance(content_object, Coupon):
                merchant = content_object.store.owner if content_object.store else None
                content_data = {
                    'type': 'coupon',
                    'id': content_object.id,
                    'title': content_object.title,
                    'description': content_object.description,
                    'image_url': content_object.image_url,
                    'store_name': content_object.store.name if content_object.store else None,
                    'created_at': content_object.created_at.isoformat(),
                }
            elif isinstance(content_object, Store):
                merchant = content_object.owner
                content_data = {
                    'type': 'store',
                    'id': content_object.id,
                    'name': content_object.name,
                    'description': content_object.description,
                    'image_url': content_object.image_url,
                    'created_at': content_object.created_at.isoformat(),
                }

            # Get merchant data
            if merchant:
                try:
                    profile = MerchantProfile.objects.get(user=merchant)
                    merchant_data = {
                        'id': merchant.id,
                        'username': merchant.username,
                        'email': merchant.email,
                        'violation_count': profile.violation_count,
                        'suspension_flagged': profile.suspension_flagged,
                    }
                except MerchantProfile.DoesNotExist:
                    merchant_data = {
                        'id': merchant.id,
                        'username': merchant.username,
                        'email': merchant.email,
                    }

        # Get moderation actions for this report
        actions = ModerationAction.objects.filter(report=report).select_related('admin')
        action_list = [{
            'id': action.id,
            'action': action.action,
            'action_display': action.get_action_display(),
            'admin': action.admin.username,
            'notes': action.notes,
            'created_at': action.created_at.isoformat(),
        } for action in actions]

        # Calculate hours since report
        hours_since_report = (timezone.now() - report.created_at).total_seconds() / 3600

        return Response({
            'id': report.id,
            'reporter': {
                'id': report.reporter.id,
                'username': report.reporter.username,
                'email': report.reporter.email,
            },
            'content': content_data,
            'merchant': merchant_data,
            'reason': report.reason,
            'reason_display': report.get_reason_display(),
            'details': report.details,
            'status': report.status,
            'status_display': report.get_status_display(),
            'created_at': report.created_at.isoformat(),
            'hours_since_report': round(hours_since_report, 1),
            'is_escalated': hours_since_report >= 20,
            'reviewed_at': report.reviewed_at.isoformat() if report.reviewed_at else None,
            'reviewed_by': {
                'id': report.reviewed_by.id,
                'username': report.reviewed_by.username,
            } if report.reviewed_by else None,
            'actions': action_list,
        })


# ============================================
# Moderation Action View
# ============================================

class ModerationActionView(APIView):
    """
    Take moderation action on a report.
    Admin only.
    """
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_description="Take action on a report: approve (dismiss), remove content, or suspend merchant",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['action'],
            properties={
                'action': openapi.Schema(type=openapi.TYPE_STRING, enum=['approve', 'remove', 'suspend'], description='Action to take'),
                'notes': openapi.Schema(type=openapi.TYPE_STRING, description='Admin notes/justification'),
            }
        ),
        responses={
            200: openapi.Response(description="Action taken successfully"),
            400: openapi.Response(description="Bad request - invalid action or report already processed"),
            404: openapi.Response(description="Report not found"),
        }
    )
    def post(self, request, report_id):
        try:
            report = ContentReport.objects.select_related('content_type').get(id=report_id)
        except ContentReport.DoesNotExist:
            return Response({'error': '報告不存在'}, status=status.HTTP_404_NOT_FOUND)

        # Check if report is still pending
        if report.status != 'pending':
            return Response(
                {'error': '此報告已被處理'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get action
        action_type = request.data.get('action')
        notes = request.data.get('notes', '')

        if action_type not in ['approve', 'remove', 'suspend']:
            return Response(
                {'error': '無效的操作類型'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get content object
        content_object = report.content_object
        if not content_object:
            return Response(
                {'error': '無法找到報告的內容'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determine merchant
        merchant = None
        if isinstance(content_object, Coupon):
            merchant = content_object.store.owner if content_object.store else None
        elif isinstance(content_object, Store):
            merchant = content_object.owner

        if not merchant:
            return Response(
                {'error': '無法找到商家'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Take action
        if action_type == 'approve':
            # Dismiss report - no action on content
            report.status = 'dismissed'
            report.reviewed_at = timezone.now()
            report.reviewed_by = request.user
            report.save()

            # Create moderation action record
            ModerationAction.objects.create(
                report=report,
                admin=request.user,
                action='approve',
                notes=notes,
            )

            return Response({
                'message': '報告已核准（駁回）',
                'report_id': report.id,
                'status': report.status,
            })

        elif action_type == 'remove':
            # Remove content (hide it)
            if isinstance(content_object, Coupon):
                content_object.is_active = False
                content_object.save()
            elif isinstance(content_object, Store):
                content_object.is_active = False
                content_object.save()

            # Update report
            report.status = 'reviewed'
            report.reviewed_at = timezone.now()
            report.reviewed_by = request.user
            report.save()

            # Create moderation action record
            moderation_action = ModerationAction.objects.create(
                report=report,
                admin=request.user,
                action='remove',
                notes=notes,
            )

            # Record violation
            record_violation(merchant, report, moderation_action)

            return Response({
                'message': '內容已移除，違規已記錄',
                'report_id': report.id,
                'status': report.status,
                'merchant_id': merchant.id,
            })

        elif action_type == 'suspend':
            # Suspend merchant account (flag for suspension)
            try:
                profile = MerchantProfile.objects.get(user=merchant)
                profile.suspension_flagged = True
                profile.suspension_flagged_at = timezone.now()
                profile.save()
            except MerchantProfile.DoesNotExist:
                return Response(
                    {'error': '商家資料不存在'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update report
            report.status = 'reviewed'
            report.reviewed_at = timezone.now()
            report.reviewed_by = request.user
            report.save()

            # Create moderation action record
            moderation_action = ModerationAction.objects.create(
                report=report,
                admin=request.user,
                action='suspend',
                notes=notes,
            )

            # Record violation with suspension type
            ViolationRecord.objects.create(
                merchant=merchant,
                report=report,
                action=moderation_action,
                violation_type='account_suspended',
                notes=notes,
            )

            return Response({
                'message': '商家帳號已標記為暫停',
                'report_id': report.id,
                'status': report.status,
                'merchant_id': merchant.id,
            })


# ============================================
# Escalated Reports View
# ============================================

class EscalatedReportsView(APIView):
    """
    Get reports past 20-hour threshold (escalated).
    Admin only.
    """
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_description="Get reports that are past 20-hour threshold (escalated)",
        responses={
            200: openapi.Response(description="Escalated reports list"),
        }
    )
    def get(self, request):
        # Get reports past 20 hours
        warning_threshold = timezone.now() - timedelta(hours=20)
        critical_threshold = timezone.now() - timedelta(hours=24)

        warning_reports = ContentReport.objects.filter(
            status='pending',
            created_at__lte=warning_threshold,
            created_at__gt=critical_threshold
        ).select_related('reporter', 'content_type')

        critical_reports = ContentReport.objects.filter(
            status='pending',
            created_at__lte=critical_threshold
        ).select_related('reporter', 'content_type')

        def serialize_report(report):
            hours_since_report = (timezone.now() - report.created_at).total_seconds() / 3600
            content_object = report.content_object
            content_data = None

            if content_object:
                if isinstance(content_object, Coupon):
                    content_data = {
                        'type': 'coupon',
                        'id': content_object.id,
                        'title': content_object.title,
                    }
                elif isinstance(content_object, Store):
                    content_data = {
                        'type': 'store',
                        'id': content_object.id,
                        'name': content_object.name,
                    }

            return {
                'id': report.id,
                'content': content_data,
                'reason': report.reason,
                'reason_display': report.get_reason_display(),
                'created_at': report.created_at.isoformat(),
                'hours_since_report': round(hours_since_report, 1),
            }

        return Response({
            'warning': [serialize_report(r) for r in warning_reports],
            'critical': [serialize_report(r) for r in critical_reports],
            'warning_count': warning_reports.count(),
            'critical_count': critical_reports.count(),
        })


# ============================================
# Merchant Violations View
# ============================================

class MerchantViolationsView(APIView):
    """
    Get violation history for a merchant.
    Admin only.
    """
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_description="Get merchant's violation history",
        responses={
            200: openapi.Response(description="Merchant violations list"),
            404: openapi.Response(description="Merchant not found"),
        }
    )
    def get(self, request, merchant_id):
        try:
            merchant = User.objects.get(id=merchant_id)
        except User.DoesNotExist:
            return Response({'error': '商家不存在'}, status=status.HTTP_404_NOT_FOUND)

        # Get merchant profile
        try:
            profile = MerchantProfile.objects.get(user=merchant)
        except MerchantProfile.DoesNotExist:
            profile = None

        # Get violations
        violations = ViolationRecord.objects.filter(merchant=merchant).select_related(
            'report', 'action', 'action__admin'
        ).order_by('-created_at')

        violation_list = []
        for violation in violations:
            violation_list.append({
                'id': violation.id,
                'violation_type': violation.violation_type,
                'violation_type_display': violation.get_violation_type_display(),
                'created_at': violation.created_at.isoformat(),
                'notes': violation.notes,
                'report_id': violation.report.id if violation.report else None,
                'action': {
                    'action': violation.action.action,
                    'action_display': violation.action.get_action_display(),
                    'admin': violation.action.admin.username,
                } if violation.action else None,
            })

        return Response({
            'merchant': {
                'id': merchant.id,
                'username': merchant.username,
                'email': merchant.email,
            },
            'profile': {
                'violation_count': profile.violation_count if profile else 0,
                'suspension_flagged': profile.suspension_flagged if profile else False,
                'suspension_flagged_at': profile.suspension_flagged_at.isoformat() if profile and profile.suspension_flagged_at else None,
            } if profile else None,
            'violations': violation_list,
            'total_violations': violations.count(),
        })


# ============================================
# Moderation Stats View
# ============================================

class ModerationStatsView(APIView):
    """
    Get dashboard overview statistics.
    Admin only.
    """
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_description="Get moderation dashboard overview statistics",
        responses={
            200: openapi.Response(description="Dashboard statistics"),
        }
    )
    def get(self, request):
        # Count reports by status
        pending_count = ContentReport.objects.filter(status='pending').count()
        reviewed_count = ContentReport.objects.filter(status='reviewed').count()
        dismissed_count = ContentReport.objects.filter(status='dismissed').count()

        # Escalated reports (20+ hours)
        escalation_threshold = timezone.now() - timedelta(hours=20)
        escalated_count = ContentReport.objects.filter(
            status='pending',
            created_at__lte=escalation_threshold
        ).count()

        # Critical reports (24+ hours)
        critical_threshold = timezone.now() - timedelta(hours=24)
        critical_count = ContentReport.objects.filter(
            status='pending',
            created_at__lte=critical_threshold
        ).count()

        # Merchants flagged for suspension
        flagged_merchants = MerchantProfile.objects.filter(suspension_flagged=True).count()

        # Average response time for reviewed reports (in hours)
        reviewed_reports = ContentReport.objects.filter(
            status__in=['reviewed', 'dismissed'],
            reviewed_at__isnull=False
        )
        avg_response_hours = None
        if reviewed_reports.exists():
            total_seconds = sum([
                (report.reviewed_at - report.created_at).total_seconds()
                for report in reviewed_reports
            ])
            avg_response_hours = round(total_seconds / reviewed_reports.count() / 3600, 1)

        return Response({
            'pending': pending_count,
            'reviewed': reviewed_count,
            'dismissed': dismissed_count,
            'escalated': escalated_count,
            'critical': critical_count,
            'flagged_merchants': flagged_merchants,
            'average_response_hours': avg_response_hours,
        })

