import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password
from django.utils import timezone
from django.conf import settings
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from ...serializers import LoginSerializer, PhoneLoginSerializer
from ...models import StudentProfile, MerchantProfile
from ...exceptions import (
    CouProAPIException,
    EmailNotVerified,
    MerchantApplicationPending,
    MerchantApplicationRejected,
    WrongClientTypeMerchant,
    WrongClientTypeUser,
    InvalidCredentials,
    PhoneNotRegistered,
    RefreshTokenMissing,
    RefreshTokenInvalid,
)

logger = logging.getLogger(__name__)


@swagger_auto_schema(
    methods=['post'],
    request_body=LoginSerializer,
    operation_description="User login endpoint",
    responses={
        200: openapi.Response(
            description="Login successful",
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'user_id': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'access_token': openapi.Schema(type=openapi.TYPE_STRING),
                    'refresh_token': openapi.Schema(type=openapi.TYPE_STRING),
                    'token_type': openapi.Schema(type=openapi.TYPE_STRING),
                    'expires_in': openapi.Schema(type=openapi.TYPE_INTEGER),
                }
            )
        ),
        400: "Bad request - missing or invalid client_type",
        401: "帳號或密碼錯誤",
        403: "wrong_client_type - account type does not match client (use other app)",
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    # Use PhoneLoginSerializer to support both phone and email login.
    # raise_exception=True → ValidationError → couPro_exception_handler returns { error_code, developer_message, context }
    serializer = PhoneLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    validated = serializer.validated_data

    phone_number = validated.get('phone_number')
    email = validated.get('email')
    password = validated['password']
    client_type = validated['client_type']

    try:
        # Find user by phone_number OR email
        if phone_number:
            # Phone-based login: look up via StudentProfile.phone_number
            profile = StudentProfile.objects.filter(phone_number=phone_number).first()
            if not profile:
                raise PhoneNotRegistered(developer_message="此電話號碼尚未註冊")

            # Check phone_verified for phone-registered users
            if not profile.phone_verified:
                raise EmailNotVerified(developer_message="請先完成手機號碼驗證")

            user = profile.user
        else:
            # Email-based login: original logic (find user by email)
            user = User.objects.get(email=email)

        # Check verification status via the profile
        try:
            # Check if the user has a student profile
            if hasattr(user, 'student_profile'):
                profile = user.student_profile
                # For phone-based login, phone_verified is checked above
                # For email-based login, check email verification
                if email and not profile.verified:
                    raise EmailNotVerified(developer_message="請先完成信箱驗證")
            # If the user doesn't have a student profile (e.g., is a merchant or admin), skip verification check
        except StudentProfile.DoesNotExist:
            # This case should ideally not happen for student users after registration changes
            logger.warning("StudentProfile not found for user %s during login", getattr(user, 'email', user.username))
            # For now, let's allow login if profile is missing, assuming they might be non-student users

        # Check merchant verification status (cache result to avoid second DB query below)
        is_merchant = user.groups.filter(name='Merchant').exists()
        if is_merchant:
            try:
                merchant_profile = MerchantProfile.objects.get(user=user)
                if not merchant_profile.verified:
                    raise EmailNotVerified(
                        developer_message="請先驗證您的電子郵件",
                        context={"email": user.email},
                    )
                if merchant_profile.application_status == 'pending':
                    raise MerchantApplicationPending(
                        developer_message="您的商家申請正在審核中。\n如有疑問，歡迎私訊我們的信箱 coupro707@gmail.com，或到粉絲專頁聯絡我們。",
                        context={"email": user.email},
                    )
                if merchant_profile.application_status == 'rejected':
                    raise MerchantApplicationRejected(
                        developer_message="您的商家申請已被拒絕。\n如有疑問，歡迎私訊我們的信箱 coupro707@gmail.com，或到粉絲專頁聯絡我們。",
                        context={"email": user.email},
                    )
            except MerchantProfile.DoesNotExist:
                logger.warning("MerchantProfile not found for merchant user %s", user.email)
                # Allow login if profile is missing (shouldn't happen in normal flow)

        if check_password(password, user.password):
            # Enforce client_type vs account type: merchant account only on merchant app, user only on user app
            if client_type == 'merchant' and not is_merchant:
                raise WrongClientTypeMerchant(developer_message="此帳號為一般使用者，請使用使用者端 App 登入")
            if client_type == 'user' and is_merchant:
                raise WrongClientTypeUser(developer_message="此帳號為商家帳號，請使用商家端 App 登入")

            # Generate both access and refresh tokens
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            # Set the last logged in time for this student profile
            if hasattr(user, 'student_profile'):
                user.student_profile.last_logged_in = timezone.now()
                user.student_profile.save()

            response = Response({
                "message": "Login successful",
                "user_id": user.id,  # type: ignore
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()
            })

            return response
        else:  # 密碼錯誤
            raise InvalidCredentials(developer_message="帳號或密碼錯誤")
    except User.DoesNotExist:
        raise InvalidCredentials(developer_message="帳號不存在")


@swagger_auto_schema(
    method='post',
    operation_description="User logout endpoint",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'refresh_token': openapi.Schema(
                type=openapi.TYPE_STRING,
                description='Refresh token to blacklist (optional)'
            )
        }
    ),
    responses={
        200: openapi.Response(
            description="Logout successful",
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'note': openapi.Schema(type=openapi.TYPE_STRING),
                }
            )
        )
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])  # 需要認證才能登出
def logout(request):
    """
    登出 API - 客戶端應該刪除儲存的 tokens
    """
    try:
        # 如果要實現 token blacklist，可以在這裡加入
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()  # 將 refresh token 加入黑名單
                logger.info("Token blacklisted successfully")
            except TokenError:
                pass  # Token 已經無效或過期，忽略錯誤

        return Response({
            "message": "已成功登出",
            "note": "請從客戶端移除所有儲存的 tokens"
        })
    except Exception as e:
        return Response({
            "error": "登出時發生錯誤",
            "detail": str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@swagger_auto_schema(
    method='post',
    operation_description="Refresh access token using refresh token",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['refresh_token'],
        properties={
            'refresh_token': openapi.Schema(
                type=openapi.TYPE_STRING,
                description='Valid refresh token'
            )
        }
    ),
    responses={
        200: openapi.Response(
            description="Token refreshed successfully",
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                    'access_token': openapi.Schema(type=openapi.TYPE_STRING),
                    'refresh_token': openapi.Schema(type=openapi.TYPE_STRING),
                    'token_type': openapi.Schema(type=openapi.TYPE_STRING),
                    'expires_in': openapi.Schema(type=openapi.TYPE_INTEGER),
                }
            )
        ),
        401: "Invalid or expired refresh token"
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """
    刷新 JWT token 的 API
    當 access token 過期時，使用此 endpoint 獲取新的 access token
    """
    try:
        # Get the refresh token from request body instead of cookies
        refresh_token_value = request.data.get('refresh_token')

        if not refresh_token_value:
            raise RefreshTokenMissing(developer_message="No refresh token provided")

        # Validate and use the refresh token to get a new access token
        try:
            refresh = RefreshToken(refresh_token_value)
        except TokenError:
            raise RefreshTokenInvalid(developer_message="Invalid or expired refresh token. Please log in again.")

        access_token = str(refresh.access_token)
        new_refresh_token = refresh_token_value  # Default: keep the same refresh token

        # Check if refresh token rotation is enabled
        if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
            if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION', False):
                try:
                    refresh.blacklist()
                except Exception as blacklist_exc:
                    logger.warning("Failed to blacklist token during rotation: %s", blacklist_exc)

            # Create a new refresh token
            token_user_id = refresh.payload.get('user_id')
            if not token_user_id:
                raise RefreshTokenInvalid(developer_message="Invalid refresh token")

            try:
                user = User.objects.get(id=token_user_id)
                new_refresh = RefreshToken.for_user(user)
                new_refresh_token = str(new_refresh)
            except User.DoesNotExist:
                return Response({
                    "error": "User not found"
                }, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            "message": "Token refreshed successfully",
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "Bearer",
            "expires_in": int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        })

    except CouProAPIException:
        raise
    except Exception as e:
        logger.warning("Token refresh error: %s", e)
        raise RefreshTokenInvalid(developer_message="Invalid or expired refresh token")
