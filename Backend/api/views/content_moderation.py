"""
Content Moderation Views for UGC Compliance (Apple Guideline 1.2)

Provides endpoints for:
- Content reporting (User Story 1)
- Merchant blocking (User Story 2)
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from django.conf import settings
from datetime import timedelta

from ..models import (
    ContentReport, BlockedMerchant, Store, Coupon,
    REPORT_REASONS
)
from ..serializers import (
    ContentReportCreateSerializer, ContentReportSerializer,
    BlockedMerchantCreateSerializer, BlockedMerchantSerializer
)


# =============================================================================
# User Story 1: Content Reporting
# =============================================================================

class ReportContentView(APIView):
    """
    POST /api/content/{content_type}/{content_id}/report/

    Submit a report for inappropriate content (coupon or store).
    Includes duplicate prevention within 24-hour window.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, content_type: str, content_id: int):
        # Validate content type
        if content_type not in ['coupon', 'store']:
            return Response(
                {'error': '無效的內容類型'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate request data
        serializer = ContentReportCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Get the content object
        try:
            if content_type == 'coupon':
                content_obj = Coupon.objects.get(id=content_id)
                ct = ContentType.objects.get_for_model(Coupon)
            else:
                content_obj = Store.objects.get(id=content_id)
                ct = ContentType.objects.get_for_model(Store)
        except (Coupon.DoesNotExist, Store.DoesNotExist):
            return Response(
                {'error': '找不到該內容'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Prevent reporting own content (if store has owner)
        if content_type == 'store' and content_obj.owner == request.user:
            return Response(
                {'error': '您無法檢舉自己的商店'},
                status=status.HTTP_400_BAD_REQUEST
            )
        elif content_type == 'coupon' and content_obj.store.owner == request.user:
            return Response(
                {'error': '您無法檢舉自己的優惠券'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for duplicate report within 24 hours
        duplicate_window = getattr(settings, 'REPORT_DUPLICATE_WINDOW_HOURS', 24)
        cutoff_time = timezone.now() - timedelta(hours=duplicate_window)

        existing_report = ContentReport.objects.filter(
            reporter=request.user,
            content_type=ct,
            object_id=content_id,
            created_at__gte=cutoff_time
        ).first()

        if existing_report:
            return Response(
                {
                    'error': '您已在過去 24 小時內檢舉過此內容',
                    'existing_report_id': existing_report.id,
                    'can_report_again_at': (existing_report.created_at + timedelta(hours=duplicate_window)).isoformat()
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the report
        report = ContentReport.objects.create(
            reporter=request.user,
            content_type=ct,
            object_id=content_id,
            reason=serializer.validated_data['reason'],
            details=serializer.validated_data.get('details', '')
        )

        response_serializer = ContentReportSerializer(report)
        return Response(
            {
                'message': '檢舉已提交，感謝您的回報',
                'report': response_serializer.data
            },
            status=status.HTTP_201_CREATED
        )


class ReportStatusView(APIView):
    """
    GET /api/content/{content_type}/{content_id}/report/status/

    Check if the current user has reported this content.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, content_type: str, content_id: int):
        if content_type not in ['coupon', 'store']:
            return Response(
                {'error': '無效的內容類型'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get content type
        if content_type == 'coupon':
            ct = ContentType.objects.get_for_model(Coupon)
        else:
            ct = ContentType.objects.get_for_model(Store)

        # Check for recent report
        duplicate_window = getattr(settings, 'REPORT_DUPLICATE_WINDOW_HOURS', 24)
        cutoff_time = timezone.now() - timedelta(hours=duplicate_window)

        recent_report = ContentReport.objects.filter(
            reporter=request.user,
            content_type=ct,
            object_id=content_id,
            created_at__gte=cutoff_time
        ).first()

        if recent_report:
            return Response({
                'has_reported': True,
                'can_report_again': False,
                'report_id': recent_report.id,
                'reported_at': recent_report.created_at,
                'can_report_again_at': (recent_report.created_at + timedelta(hours=duplicate_window)).isoformat()
            })

        # Check for any past report (not within window)
        any_report = ContentReport.objects.filter(
            reporter=request.user,
            content_type=ct,
            object_id=content_id
        ).exists()

        return Response({
            'has_reported': any_report,
            'can_report_again': True,
            'report_id': None,
            'reported_at': None,
            'can_report_again_at': None
        })


class UserReportsView(APIView):
    """
    GET /api/user/reports/

    List all reports submitted by the current user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        reports = ContentReport.objects.filter(
            reporter=request.user
        ).select_related('content_type').order_by('-created_at')

        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        start = (page - 1) * page_size
        end = start + page_size

        total_count = reports.count()
        paginated_reports = reports[start:end]

        serializer = ContentReportSerializer(paginated_reports, many=True)

        return Response({
            'results': serializer.data,
            'total': total_count,
            'page': page,
            'page_size': page_size,
            'has_next': end < total_count
        })


# =============================================================================
# User Story 2: Merchant Blocking
# =============================================================================

class BlockMerchantView(APIView):
    """
    POST /api/user/blocked-merchants/

    Block a merchant store.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = BlockedMerchantCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        store_id = serializer.validated_data['store_id']

        # Check if store exists
        try:
            store = Store.objects.get(id=store_id)
        except Store.DoesNotExist:
            return Response(
                {'error': '找不到該商店'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Prevent blocking own store
        if store.owner == request.user:
            return Response(
                {'error': '您無法封鎖自己的商店'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already blocked
        if BlockedMerchant.objects.filter(user=request.user, store=store).exists():
            return Response(
                {'error': '您已封鎖此商店'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create block
        blocked = BlockedMerchant.objects.create(
            user=request.user,
            store=store
        )

        response_serializer = BlockedMerchantSerializer(blocked)
        return Response(
            {
                'message': '已封鎖該商店',
                'blocked_merchant': response_serializer.data
            },
            status=status.HTTP_201_CREATED
        )


class UnblockMerchantView(APIView):
    """
    DELETE /api/user/blocked-merchants/{store_id}/

    Unblock a merchant store.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, store_id: int):
        try:
            blocked = BlockedMerchant.objects.get(
                user=request.user,
                store_id=store_id
            )
            blocked.delete()
            return Response(
                {'message': '已解除封鎖'},
                status=status.HTTP_200_OK
            )
        except BlockedMerchant.DoesNotExist:
            return Response(
                {'error': '找不到該封鎖記錄'},
                status=status.HTTP_404_NOT_FOUND
            )


class BlockedMerchantsListView(APIView):
    """
    GET /api/user/blocked-merchants/

    List all blocked merchants for the current user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blocked = BlockedMerchant.objects.filter(
            user=request.user
        ).select_related('store').order_by('-created_at')

        serializer = BlockedMerchantSerializer(blocked, many=True)

        return Response({
            'results': serializer.data,
            'total': blocked.count()
        })


class BlockStatusView(APIView):
    """
    GET /api/store/{store_id}/block-status/

    Check if the current user has blocked this store.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, store_id: int):
        is_blocked = BlockedMerchant.objects.filter(
            user=request.user,
            store_id=store_id
        ).exists()

        return Response({
            'is_blocked': is_blocked,
            'store_id': store_id
        })


# =============================================================================
# Helper function for filtering blocked merchants in other views
# =============================================================================

def get_blocked_store_ids(user) -> list:
    """
    Get list of store IDs blocked by a user.
    Use this in other views to filter out blocked content.

    Usage in views:
        blocked_ids = get_blocked_store_ids(request.user)
        queryset = queryset.exclude(store_id__in=blocked_ids)
    """
    if not user.is_authenticated:
        return []

    return list(
        BlockedMerchant.objects.filter(user=user).values_list('store_id', flat=True)
    )
