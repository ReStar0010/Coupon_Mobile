import logging
import secrets

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.contrib.auth.models import User, Group
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from ...serializers import MerchantRegisterSerializer
from ...models import StudentProfile, MerchantProfile, Store
from ...exceptions import EmailAlreadyExists, EmailAlreadyRegisteredAsMerchant
from .email_helpers import send_verification_email, send_merchant_verification_email

logger = logging.getLogger(__name__)


@swagger_auto_schema(
        method='post',
        operation_description="register a new account (student or merchant)",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'email': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_EMAIL),
                'password': openapi.Schema(type=openapi.TYPE_STRING),
                'user_type': openapi.Schema(type=openapi.TYPE_STRING, enum=['student', 'merchant'], description='Type of user to register'),
                # Merchant-specific fields
                'phone': openapi.Schema(type=openapi.TYPE_STRING),
                'contact_person': openapi.Schema(type=openapi.TYPE_STRING),
                'contact_info': openapi.Schema(type=openapi.TYPE_STRING),
                'store_name': openapi.Schema(type=openapi.TYPE_STRING),
                'store_address': openapi.Schema(type=openapi.TYPE_STRING),
                'store_lat': openapi.Schema(type=openapi.TYPE_NUMBER),
                'store_lng': openapi.Schema(type=openapi.TYPE_NUMBER),
                'business_hours': openapi.Schema(type=openapi.TYPE_STRING),
            },
            required=['email', 'password', 'user_type']
        ),
)
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Register a new user account. Supports both student and merchant registration.
    For merchant registration, additional fields are required.
    """
    data = request.data
    email = data.get('email')
    password = data.get('password')
    user_type = data.get('user_type', 'student')  # Default to student

    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    existing_user = User.objects.filter(username=email).first()
    if existing_user:
        # Consumer app registration with an email that is already a merchant account
        if user_type == 'student' and MerchantProfile.objects.filter(user=existing_user).exists():
            raise EmailAlreadyRegisteredAsMerchant(
                developer_message="此信箱已用於商家帳號，請使用商家 App 登入或使用其他信箱註冊。"
            )
        raise EmailAlreadyExists(developer_message="Email already exists")

    if user_type == 'merchant':
        # Validate FIRST before any DB writes
        merchant_serializer = MerchantRegisterSerializer(data=data)
        if not merchant_serializer.is_valid():
            logger.warning("Merchant registration validation errors: %s", merchant_serializer.errors)
            return Response({'errors': merchant_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        validated_data = merchant_serializer.validated_data

        # Only create user AFTER validation passes
        user = User(email=email, username=email)
        user.set_password(password)
        user.save()

        # Add user to Merchant group
        try:
            merchant_group = Group.objects.get(name='Merchant')
            user.groups.add(merchant_group)
        except Group.DoesNotExist:
            # Create Merchant group if it doesn't exist
            merchant_group = Group.objects.create(name='Merchant')
            user.groups.add(merchant_group)

        # Create MerchantProfile
        merchant_profile = MerchantProfile.objects.create(
            user=user,
            phone=validated_data['phone'],
            contact_person=validated_data['contact_person'],
            contact_info=validated_data.get('contact_info') or ''
        )

        # Create Store
        Store.objects.create(
            owner=user,
            name=validated_data['store_name'],
            address=validated_data['store_address'],
            lat=validated_data['store_lat'],
            lng=validated_data['store_lng'],
            business_hours=validated_data.get('business_hours', '')
        )

        # Generate verification token and send email
        token = merchant_profile.generate_verification_token()
        try:
            send_merchant_verification_email(email, token)
        except Exception as email_error:
            # Log the error but don't fail registration
            logger.warning("Verification email failed but account created: %s", email_error)
            # Still return success, but note that email may not have been sent
            return Response({
                'message': '申請已送出！但驗證郵件發送失敗，請稍後重新申請驗證郵件。完成驗證後，我們會在審核通過後開通您的商家權限。',
                'user_id': user.id,
                'email': email,
                'verification_required': True,
                'user_type': 'merchant',
                'email_sent': False,
                'email_error': str(email_error)
            }, status=status.HTTP_201_CREATED)

        return Response({
            'message': '商家申請已送出！驗證郵件已發送到您的信箱，請先完成信箱驗證；審核通過後即可登入商家平台。',
            'user_id': user.id,
            'email': email,
            'verification_required': True,
            'user_type': 'merchant'
        }, status=status.HTTP_201_CREATED)
    else:
        # Student registration (existing logic)
        password = request.data.get('password', '')
        if len(password) < 8:
            return Response(
                {'error': '密碼長度至少需要8個字元'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create user
        user = User(email=email, username=email)
        user.set_password(password)
        user.save()

        # Generate verification token
        token = secrets.token_urlsafe(32)

        # Create StudentProfile with the token and verified=False
        StudentProfile.objects.create(user=user, email_verification_token=token, verified=False)

        # Send verification email
        send_verification_email(email, token)

        return Response({'message': 'User registered successfully. Please check your email to verify.'}, status=status.HTTP_201_CREATED)
