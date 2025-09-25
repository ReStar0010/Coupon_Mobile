from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
import secrets

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from ..models import Coupon, CouponShareRequest, Log, StudentProfile, CouponTemplate
from ..serializers import ConsolidateCouponSerializer, RefreshRedeemCodeSerializer


@swagger_auto_schema(
    method='post',
    operation_description="Consolidate coupon with user's information",
    request_body=ConsolidateCouponSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny]) #FIXME - change to IsAuthenticated if needed
def merchant_consolidate_coupon(request):
    """
    Merchant consolidate coupon with user's information (Phone number...).
    """
    serializer = ConsolidateCouponSerializer(data=request.data)
    if serializer.is_valid():
        template_id = serializer.validated_data['template_id'] # type: ignore
        phone_number = serializer.validated_data['phone_number'] # type: ignore

        try:
            # Check if the phone_number can find the user
            user_profile = StudentProfile.objects.get(phone_number=phone_number)
            user = user_profile.user

            # Check if the template exists AND has quantity > 0
            coupon_template = CouponTemplate.objects.get(
                id=template_id, 
                is_active=True,  
                remaining_quantity__gt=0  
            )
            
            # Generate coupon and check if successful
            generated_coupon = coupon_template.generate_coupon(user)
            if not generated_coupon:
                return Response({
                    'error': 'Failed to generate coupon. Template may be out of stock.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Log the consolidation action
            Log.objects.create(
                user=user,
                action='consolidate_coupon',
            )

            return Response({
                'message': 'Coupon consolidated successfully',
                'coupon_name': generated_coupon.coupon_name,
                'remaining_quantity': coupon_template.remaining_quantity
            }, status=status.HTTP_201_CREATED)
            
        except StudentProfile.DoesNotExist:
            return Response({
                'error': 'User with this phone number does not exist.'
            }, status=status.HTTP_404_NOT_FOUND)
            
        except CouponTemplate.DoesNotExist:
            return Response({
                'error': 'Coupon template does not exist, is not active, or is out of stock.'
            }, status=status.HTTP_404_NOT_FOUND)
            
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@swagger_auto_schema(
        method='post',
        operation_description="Refresh the redeem code of a coupon template",
        request_body=RefreshRedeemCodeSerializer,
)
@api_view(['POST'])
@permission_classes([AllowAny]) #FIXME - @permission_classes([IsAuthenticated])
def refresh_redeem_code(request):
    """
    Refresh the redeem code of CouponTemplate
    """
    serializer = RefreshRedeemCodeSerializer(data=request.data)
    if serializer.is_valid():
        template_id = serializer.validated_data['template_id']
        new_redeem_code = serializer.validated_data['new_redeem_code']

        try:
            coupon_template = CouponTemplate.objects.get(id=template_id)
            coupon_template.template_redeem_code = new_redeem_code
            coupon_template.save()

            return Response({
                'message': 'Redeem code refreshed successfully',
                'new_redeem_code': new_redeem_code
            }, status=status.HTTP_200_OK)

        except CouponTemplate.DoesNotExist:
            return Response({
                'error': 'Coupon template does not exist.'
            }, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)