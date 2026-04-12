from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from api.models import WebRedemption, CouponRedemption, StudentProfile
from api.utils import validate_phone_number

POINTS_THRESHOLD = 3


@api_view(['POST'])
@permission_classes([AllowAny])
def points_lookup(request):
    raw_phone = request.data.get('phone_number', '').strip()
    session_token = request.data.get('session_token', '').strip()

    if not raw_phone:
        return Response({'error': '請輸入手機號碼'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        phone_number = validate_phone_number(raw_phone)
    except ValueError:
        return Response(
            {'error': '手機號碼格式不正確，請輸入有效的台灣手機號碼（09 開頭共 10 碼）。'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Link current redemption to phone if not already linked
    if session_token:
        WebRedemption.objects.filter(
            session_token=session_token,
            phone_number__isnull=True,
        ).update(phone_number=phone_number)

    # Count web redemptions for this phone
    web_count = WebRedemption.objects.filter(phone_number=phone_number).count()

    # Count existing app redemptions for this phone (if a registered user exists)
    app_count = 0
    try:
        profile = StudentProfile.objects.get(phone_number=phone_number)
        app_count = CouponRedemption.objects.filter(user=profile.user).count()
    except StudentProfile.DoesNotExist:
        pass

    total = web_count + app_count
    return Response({
        'phone_number': phone_number,
        'total_points': total,
        'threshold_reached': total >= POINTS_THRESHOLD,
    })
