"""
Views for consumer (student) account deletion (App Store Guideline 5.1.1 compliance).
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import check_password
from django.utils import timezone
from django.db import transaction

from api.models import (
    StudentProfile, Coupon, CouponRedemption,
    AccountDeletionLog, CompletedGoal, BlockedMerchant, ContentReport
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def consumer_pre_delete_check(request):
    """
    Check consumer account deletion prerequisites and return warnings.

    GET /api/account/pre-delete-check/
    """
    user = request.user

    # Count user's held coupons
    held_coupons_count = Coupon.objects.filter(current_holder=user).count()

    # Count redemption history
    total_redemptions = CouponRedemption.objects.filter(user=user).count()

    # Build warnings
    warnings = []

    if held_coupons_count > 0:
        warnings.append({
            'code': 'HELD_COUPONS',
            'message': f'您目前持有 {held_coupons_count} 張優惠券，刪除帳號後將無法再使用。',
            'severity': 'warning'
        })

    warnings.append({
        'code': 'DATA_LOSS',
        'message': '刪除帳號後，您的個人資料、優惠券、使用紀錄將永久刪除且無法復原。',
        'severity': 'critical'
    })

    data_summary = {
        'held_coupons_count': held_coupons_count,
        'total_redemptions': total_redemptions,
    }

    return Response({
        'can_delete': True,
        'warnings': warnings,
        'data_summary': data_summary
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def consumer_delete_account(request):
    """
    Delete consumer account with password verification.

    POST /api/account/delete/

    Request body:
        {
            "password": "user_password",
            "acknowledgments": ["DATA_LOSS"]
        }
    """
    user = request.user

    password = request.data.get('password')
    acknowledgments = request.data.get('acknowledgments', [])

    if not password:
        return Response(
            {'error': '請輸入密碼'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify password
    if not check_password(password, user.password):
        return Response(
            {'error': '密碼錯誤', 'code': 'INVALID_PASSWORD'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify acknowledgments
    if 'DATA_LOSS' not in acknowledgments:
        return Response(
            {'error': '請確認您已了解刪除帳號的後果'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        with transaction.atomic():
            initiated_at = timezone.now()
            user_email = user.email
            user_id = user.id

            # Create deletion log
            deletion_log = AccountDeletionLog.objects.create(
                deleted_user_email=user_email,
                deleted_user_id=user_id,
                deletion_reason='user_requested',
                stores_anonymized=0,
                coupons_preserved=0,
                initiated_at=initiated_at,
                completed_at=timezone.now(),
                status='completed',
                retry_count=0
            )

            # Try to blacklist JWT tokens
            try:
                from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
                if hasattr(OutstandingToken, 'objects'):
                    OutstandingToken.objects.filter(user=user).delete()
            except (ImportError, AttributeError):
                pass

            # Delete user (CASCADE handles StudentProfile, related data)
            # Coupon foreign keys use SET_NULL so coupons are preserved
            user.delete()

            return Response({
                'success': True,
                'message': '您的帳號已成功刪除。感謝您使用 CouPro。',
                'deleted_at': deletion_log.completed_at.isoformat()
            }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Consumer account deletion error: {str(e)}")

        try:
            AccountDeletionLog.objects.create(
                deleted_user_email=user.email,
                deleted_user_id=user.id,
                deletion_reason='user_requested',
                stores_anonymized=0,
                coupons_preserved=0,
                initiated_at=timezone.now(),
                status='failed',
                retry_count=0
            )
        except:
            pass

        return Response(
            {'error': '刪除帳號時發生錯誤，請稍後再試'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
