from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from ..models import CouponTemplate, Coupon
import logging

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def track_template_view(request):
    """
    Track when a user views a coupon detail page (template-level tracking).
    Called by Mobile-Frontend when entering coupon detail page.
    """
    data = request.data
    template_id = data.get('template_id')
    coupon_id = data.get('coupon_id')
    lat = data.get('lat')
    lng = data.get('lng')
    
    # template_id is required
    if template_id is None:
        return Response({
            'error': 'template_id is required.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Verify template exists
    try:
        template = CouponTemplate.objects.get(id=template_id)
    except CouponTemplate.DoesNotExist:
        return Response({
            'error': 'Template not found.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Verify coupon exists if provided
    coupon = None
    if coupon_id:
        try:
            coupon = Coupon.objects.get(id=coupon_id)
            # Verify coupon belongs to the template
            if coupon.template_id != template_id:
                return Response({
                    'error': 'Coupon does not belong to the specified template.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Coupon.DoesNotExist:
            # Coupon not found, but we can still log the template view
            pass
    
    # Get user if authenticated
    user = request.user if request.user.is_authenticated else None
    
    # Create log entry
    logger.info(
        "Template view tracked",
        extra={
            "user_id": user.id if user else None,
            "username": user.username if user else None,
            "email": user.email if user else None,
            "action": "template_view",
            "template_id": template.id,
            "template_name": template.coupon_name,
            "coupon_id": coupon.id if coupon else None,
            "coupon_name": coupon.coupon_name if coupon else None,
            "coupon_detail": coupon.coupon_detail if coupon else None,
            "coupon_type": coupon.coupon_type if coupon else None,
            "store_name": coupon.store.name if coupon else None,
            "lat": lat,
            "lng": lng,
        }
    )

    return Response({
        'message': 'Template view tracked successfully'
    }, status=status.HTTP_201_CREATED)