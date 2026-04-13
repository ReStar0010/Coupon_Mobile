import json
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from api.models import Store, CouponTemplate
from pathlib import Path


DEBUG_LOG_PATH = Path('/Users/stanley/Github/Coupon_Mobile/.cursor/debug-f6c4a5.log')


def _debug_log(message, data, hypothesis_id, run_id='initial'):
    try:
        payload = {
            "sessionId": "f6c4a5",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": "Backend/api/views/web_v1/merchants.py:merchant_coupons",
            "message": message,
            "data": data,
            "timestamp": int(timezone.now().timestamp() * 1000),
        }
        with DEBUG_LOG_PATH.open('a', encoding='utf-8') as f:
            f.write(json.dumps(payload, ensure_ascii=False) + '\n')
    except Exception:
        pass


@api_view(['GET'])
@permission_classes([AllowAny])
def merchant_coupons(request, store_id):
    store = get_object_or_404(Store, id=store_id)
    now = timezone.now()
    # #region agent log
    _debug_log(
        "merchant_coupons.request",
        {
            "store_id": store.id,
            "now": now.isoformat(),
        },
        "H1",
    )
    # #endregion
    templates = CouponTemplate.objects.filter(
        store=store,
        is_active=True,
        show_in_desk_qrcode=True,
        remaining_quantity__gt=0,
        expiry_date__gt=now,
    ).order_by('expiry_date')
    # #region agent log
    _debug_log(
        "merchant_coupons.result",
        {
            "count": templates.count(),
            "template_snapshot": [
                {
                    "id": t.id,
                    "total_quantity": t.total_quantity,
                    "remaining_quantity": t.remaining_quantity,
                    "is_active": t.is_active,
                    "show_in_desk_qrcode": t.show_in_desk_qrcode,
                    "expired": bool(t.expiry_date and t.expiry_date <= now),
                }
                for t in CouponTemplate.objects.filter(store=store).order_by('id')[:20]
            ],
        },
        "H1",
    )
    # #endregion
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
