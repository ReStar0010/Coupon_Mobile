from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from api.models import WebRedemption, CouponRedemption, StudentProfile

POINTS_THRESHOLD = 3


@api_view(['POST'])
@permission_classes([AllowAny])
def points_lookup(request):
    phone_number = request.data.get('phone_number', '').strip()
    session_token = request.data.get('session_token', '').strip()

    if not phone_number:
        return Response({'error': '請輸入手機號碼'}, status=status.HTTP_400_BAD_REQUEST)

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
