from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from api.models import CouponTemplate


@api_view(['GET'])
@permission_classes([AllowAny])
def coupon_detail(request, template_id):
    t = get_object_or_404(CouponTemplate, id=template_id, is_active=True)
    return Response({
        'id': t.id,
        'coupon_name': t.coupon_name,
        'coupon_detail': t.coupon_detail,
        'important_notes': t.important_notes,
        'image_url': t.image_url,
        'expiry_date': t.expiry_date,
        'estimated_savings': str(t.estimated_savings) if t.estimated_savings else None,
        'store': {
            'id': t.store.id,
            'name': t.store.name,
            'image_url': t.store.image_url,
        },
    })
