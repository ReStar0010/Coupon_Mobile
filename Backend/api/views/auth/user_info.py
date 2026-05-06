import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...models import StudentProfile, MerchantProfile

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_info(request):
    """
    獲取用戶資訊的 API，需要身份驗證
    用於測試認證是否正常工作
    """
    user = request.user
    verified_status = False  # Default
    is_merchant = user.groups.filter(name='Merchant').exists()

    # Get verification status from student profile if it exists
    if hasattr(user, 'student_profile'):
        try:
            verified_status = user.student_profile.verified
        except StudentProfile.DoesNotExist:
            pass  # Should not happen if profile is created on registration
    # Merchants/Admins might not have a StudentProfile, verification logic might differ
    elif is_merchant or user.is_superuser:
        verified_status = True  # Assume merchants/admins are verified by default or through another process

    response_data = {
        "id": user.id,
        "email": user.email,
        "verified": verified_status,  # Use status from profile or default
        "is_merchant": is_merchant,
        "message": "你已成功登入並通過身份驗證",
        "date_joined": user.date_joined
    }

    # Add merchant-specific information if user is a merchant
    if is_merchant:
        try:
            merchant_profile = user.merchant_profile
            stores = user.owned_stores.all()
            response_data['merchant_profile'] = {
                'phone': merchant_profile.phone,
                'contact_person': merchant_profile.contact_person,
                'contact_info': merchant_profile.contact_info,
            }
            if stores.exists():
                store = stores.first()  # Get first store
                response_data['store'] = {
                    'id': store.id,
                    'name': store.name,
                    'address': store.address,
                    'lat': store.lat,
                    'lng': store.lng,
                    'business_hours': store.business_hours,
                }
        except MerchantProfile.DoesNotExist:
            pass

    return Response(response_data)
