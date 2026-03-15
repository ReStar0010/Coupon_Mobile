"""
Views for merchant account deletion (App Store Guideline 5.1.1 compliance).
"""
import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import DatabaseError, transaction

logger = logging.getLogger(__name__)

from api.models import (
    Store, MerchantProfile, CouponTemplate, Coupon,
    AccountDeletionLog, CouponRedemption
)
from api.serializers import AccountDeletionSerializer, PreDeleteCheckSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pre_delete_check(request):
    """
    Check account deletion prerequisites and return warnings.
    
    GET /api/merchant/account/pre-delete-check/
    
    Returns:
        200: Pre-deletion check result with warnings and data summary
        401: Not authenticated
        403: Not a merchant account
    """
    user = request.user
    
    # Verify user is a merchant
    if not user.groups.filter(name='Merchant').exists():
        return Response(
            {'error': '只有商家帳號可以使用此功能'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Count stores
    stores = Store.objects.filter(owner=user)
    stores_count = stores.count()
    
    # Count active coupons across all merchant's stores
    active_coupons_count = 0
    for store in stores:
        # Count coupons that haven't expired and are still valid
        templates = CouponTemplate.objects.filter(
            store=store,
            is_active=True,
            expiry_date__gte=timezone.now()
        )
        for template in templates:
            # Count coupons from this template that exist
            active_coupons_count += Coupon.objects.filter(template=template).count()
    
    # Count total redemptions
    total_redemptions = 0
    for store in stores:
        total_redemptions += CouponRedemption.objects.filter(
            coupon__store=store
        ).count()
    
    # Build warnings
    warnings = []
    
    if active_coupons_count > 0:
        warnings.append({
            'code': 'ACTIVE_COUPONS',
            'message': f'您目前有 {active_coupons_count} 張優惠券仍可被顧客兌換。刪除帳號後,這些優惠券仍然有效,但您的商家資訊將被匿名化。',
            'severity': 'warning'
        })
    
    # Always warn about data loss
    warnings.append({
        'code': 'DATA_LOSS',
        'message': '刪除帳號後,您的個人資料將永久刪除且無法復原。商店資訊將被匿名化以保留有效優惠券。',
        'severity': 'critical'
    })
    
    if stores_count > 1:
        warnings.append({
            'code': 'MULTIPLE_STORES',
            'message': f'您擁有 {stores_count} 家商店,所有商店資訊都將被匿名化。',
            'severity': 'info'
        })
    
    # Build data summary
    data_summary = {
        'active_coupons_count': active_coupons_count,
        'stores_count': stores_count,
        'total_redemptions': total_redemptions,
        'pending_transactions': 0  # Not tracking pending transactions currently
    }
    
    return Response({
        'can_delete': True,
        'warnings': warnings,
        'data_summary': data_summary
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """
    Delete merchant account with password verification and data anonymization.
    
    POST /api/merchant/account/delete/
    
    Request body:
        {
            "password": "user_password",
            "acknowledgments": ["ACTIVE_COUPONS", "DATA_LOSS"]
        }
    
    Returns:
        200: Account successfully deleted
        400: Invalid password or missing acknowledgments
        401: Not authenticated
        403: Not a merchant account
        500: Server error during deletion
    """
    user = request.user
    
    # Verify user is a merchant
    if not user.groups.filter(name='Merchant').exists():
        return Response(
            {'error': '只有商家帳號可以使用此功能'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Validate request data
    serializer = AccountDeletionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    password = serializer.validated_data['password']
    acknowledgments = serializer.validated_data['acknowledgments']
    
    # Verify password
    if not check_password(password, user.password):
        return Response(
            {'error': '密碼錯誤', 'code': 'INVALID_PASSWORD'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verify acknowledgments (at least DATA_LOSS should be acknowledged)
    if 'DATA_LOSS' not in acknowledgments:
        return Response(
            {'error': '請確認您已了解刪除帳號的後果'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Begin deletion process
    try:
        with transaction.atomic():
            initiated_at = timezone.now()
            
            # Store user info before deletion
            user_email = user.email
            user_id = user.id
            
            # Count stores and coupons before anonymization
            stores = Store.objects.filter(owner=user)
            stores_count = stores.count()
            
            # Count coupons that will be preserved
            coupons_preserved = 0
            for store in stores:
                templates = CouponTemplate.objects.filter(store=store)
                for template in templates:
                    coupons_preserved += Coupon.objects.filter(template=template).count()
            
            # Anonymize stores (to preserve valid coupons)
            for store in stores:
                store.name = '已刪除的商家'
                store.address = ''
                store.lat = None
                store.lng = None
                store.image_url = None
                store.unified_redeem_code = None
                store.owner = None  # SET_NULL will preserve the store
                store.save()
            
            # Create deletion log
            deletion_log = AccountDeletionLog.objects.create(
                deleted_user_email=user_email,
                deleted_user_id=user_id,
                deletion_reason='user_requested',
                stores_anonymized=stores_count,
                coupons_preserved=coupons_preserved,
                initiated_at=initiated_at,
                completed_at=timezone.now(),
                status='completed',
                retry_count=0
            )
            
            # Delete user (CASCADE will delete MerchantProfile, QRCodeSession, etc.)
            # Note: Token blacklist should be handled here if using JWT
            try:
                from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
                if hasattr(OutstandingToken, 'objects'):
                    OutstandingToken.objects.filter(user=user).delete()
            except (ImportError, AttributeError):
                pass  # Token blacklist not installed or not available
            
            user.delete()
            
            return Response({
                'success': True,
                'message': '您的帳號已成功刪除。感謝您使用 CouPro。',
                'deleted_at': deletion_log.completed_at.isoformat()
            }, status=status.HTTP_200_OK)
            
    except (DatabaseError, OSError) as e:
        # Log error and return failure
        logger.error("Account deletion error: %s", e, exc_info=True)
        
        # Create failed deletion log if possible
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
        except Exception as log_exc:
            logger.warning("Failed to create deletion audit log: %s", log_exc)

        return Response(
            {'error': '刪除帳號時發生錯誤,請稍後再試'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_deletion_status(request):
    """
    Check if there's a pending deletion for the current user.
    Used for network failure recovery.
    
    GET /api/merchant/account/deletion-status/
    
    Returns:
        200: Deletion status (none, pending, completed, failed)
        401: Not authenticated
    """
    user = request.user
    
    # Check for deletion log
    deletion_log = AccountDeletionLog.objects.filter(
        deleted_user_id=user.id
    ).order_by('-initiated_at').first()
    
    if not deletion_log:
        return Response({
            'status': 'none'
        }, status=status.HTTP_200_OK)
    
    response_data = {
        'status': deletion_log.status,
        'initiated_at': deletion_log.initiated_at.isoformat() if deletion_log.initiated_at else None,
    }
    
    if deletion_log.completed_at:
        response_data['completed_at'] = deletion_log.completed_at.isoformat()
    
    if deletion_log.status == 'failed':
        response_data['error'] = '帳號刪除失敗,請重試'
    
    return Response(response_data, status=status.HTTP_200_OK)

