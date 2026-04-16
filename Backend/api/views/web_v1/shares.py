from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from api.models import CouponShareRequest


@api_view(['GET'])
@permission_classes([AllowAny])
def share_detail(request, share_token):
    share = get_object_or_404(CouponShareRequest, token=share_token)
    coupon = share.coupon
    template = coupon.template
    return Response({
        'coupon_id': coupon.id,
        'coupon_name': coupon.coupon_name,
        'coupon_detail': coupon.coupon_detail,
        'important_notes': coupon.important_notes,
        'image_url': coupon.image_url,
        'expiry_date': coupon.expiry_date,
        'estimated_savings': str(coupon.estimated_savings) if coupon.estimated_savings else None,
        'template_id': template.id if template else None,
        'status': share.status,
        'is_public': share.is_public,
        'store': {
            'id': coupon.store.id,
            'name': coupon.store.name,
        },
    })
