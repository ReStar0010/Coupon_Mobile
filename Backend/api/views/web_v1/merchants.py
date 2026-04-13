from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from api.models import Store, CouponTemplate


@api_view(['GET'])
@permission_classes([AllowAny])
def merchant_coupons(request, store_id):
    store = get_object_or_404(Store, id=store_id)
    now = timezone.now()
    templates = CouponTemplate.objects.filter(
        store=store,
        is_active=True,
        show_in_desk_qrcode=True,
        remaining_quantity__gt=0,
        expiry_date__gt=now,
    ).order_by('expiry_date')
    return Response({
        'store': {
            'id': store.id,
            'name': store.name,
            'image_url': store.image_url,
            'address': store.address,
        },
        'coupons': [
            {
                'id': t.id,
                'coupon_name': t.coupon_name,
                'coupon_detail': t.coupon_detail,
                'image_url': t.image_url,
                'expiry_date': t.expiry_date,
                'estimated_savings': str(t.estimated_savings) if t.estimated_savings else None,
            }
            for t in templates
        ],
    })
