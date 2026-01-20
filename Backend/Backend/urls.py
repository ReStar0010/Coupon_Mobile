from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from api.views.authentication import (
    register, login, logout, user_info, verify_email, forgot_password, reset_password, refresh_token,
    verify_merchant_email, resend_merchant_verification
)
from api.views.coupon_views import get_store_coupons, get_exclusive_coupons, get_coupon_detail, redeem_coupon, validate_unified_redemption_code
from api.views.sharing_views import share_coupon, get_share_request, accept_share_request, share_coupon_public, get_my_public_shares
from api.views.user_profile import (user_statistics, set_savings_goal, reset_savings_goal, 
                                  coupon_history, coupon_history_detail, completed_goals, add_completed_goal,
                                  user_phone)
from api.views.daily_draw import get_daily_draw_templates, draw_coupon, draw_history, get_last_draw_time
from api.views.merchant_coupon import (
    merchant_consolidate_coupon, refresh_redeem_code,
    list_coupon_templates, get_coupon_template, create_coupon_template,
    update_coupon_template, delete_coupon_template, merchant_redeem, upload_image,
    get_template_analytics, get_all_tags, generate_unified_redemption_code_view
)
from api.views.merchant_profile import (
    get_merchant_profile, update_merchant_profile, get_merchant_statistics
)
from api.views.events import track_template_view
from api.views.phone_otp import send_otp, verify_otp
from api.views.qr_claim import generate_qr_session, invalidate_qr_session, claim_coupon_via_qr
from api.views.account_deletion import pre_delete_check, delete_account, get_deletion_status

from django.http import HttpResponse
from django.urls import re_path

from rest_framework import permissions
from django.urls import path, re_path
from drf_yasg.views import get_schema_view
from drf_yasg import openapi


schema_view = get_schema_view(
   openapi.Info(
      title="Snippets API",
      default_version='v1',
      description="Test description",
      terms_of_service="https://www.google.com/policies/terms/",
      contact=openapi.Contact(email="contact@snippets.local"),
      license=openapi.License(name="BSD License"),
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Swagger documentation
    re_path(r'^swagger(?P<format>\.json|\.yaml)$',schema_view.without_ui(cache_timeout=0),name='schema-json'),
    re_path(r'^swagger/$',schema_view.with_ui('swagger', cache_timeout=0),name='schema-swagger-ui'),
    re_path(r'^redoc/$',schema_view.with_ui('redoc', cache_timeout=0),name='schema-redoc'),

    # Coupon endpoints
    path('api/store-coupons/', get_store_coupons),  # Type A (store) coupons - 隨取及用
    path('api/exclusive-coupons/', get_exclusive_coupons),  # Type B (exclusive) coupons - 專屬優惠
    path('api/coupons/<int:id>/', get_coupon_detail),  # 單一 coupon 詳細頁面 API
    path('api/redeem/<int:id>/', redeem_coupon),
    
    # Unified redemption endpoints
    path('api/unified-redemption/<str:code>/', validate_unified_redemption_code, name='validate_unified_redemption_code'),
    
    # Event tracking endpoints
    path('api/events/template-view/', track_template_view, name='track_template_view'),

    # Daily draw endpoints
    path('api/daily-draw-templates/', get_daily_draw_templates, name='daily_draw_templates'),
    path('api/coupon/daily-draw/', draw_coupon, name='daily_draw'),
    path('api/coupon/draw-history/', draw_history, name='draw_history'),
    path('api/last-draw/', get_last_draw_time, name='get_last_draw_time'),

    # Coupon sharing endpoints
    path('api/coupon/<int:coupon_id>/share/', share_coupon, name='share_coupon'),
    path('api/coupon/<int:coupon_id>/share-public/', share_coupon_public, name='share_coupon_public'),
    path('api/coupon/share/<str:token>/', get_share_request, name='get_share_request'),
    path('api/coupon/share/<str:token>/accept/', accept_share_request, name='accept_share_request'),
    path('api/my-public-shares/', get_my_public_shares, name='get_my_public_shares'),

    # Authentication endpoints    
    path('api/register/', register),
    path('api/login/', login),
    path('api/logout/', logout),
    path('api/token/refresh/', refresh_token, name='token_refresh'),  # Token refresh API
    path('api/verify-email/', verify_email),
    
    # Merchant verification endpoints
    path('api/merchant/verify-email/', verify_merchant_email, name='verify_merchant_email'),
    path('api/merchant/resend-verification/', resend_merchant_verification, name='resend_merchant_verification'),

    # Password reset endpoints
    path('api/forgot-password/', forgot_password, name='forgot_password'),
    path('api/reset-password/', reset_password, name='reset_password'),

    # User statistics endpoints
    path('api/user-statistics/', user_statistics, name='user_statistics'),
    path('api/set-savings-goal/', set_savings_goal, name='set_savings_goal'),
    path('api/completed-goals/', completed_goals, name='completed_goals'),
    path('api/add-completed-goal/', add_completed_goal, name='add_completed_goal'),    # Daily draw endpoints
    path('api/reset-savings-goal/', reset_savings_goal, name='reset_savings_goal'),
    path('api/user-info/', user_info),

    # User phone endpoints (phone-based coupon send feature)
    # Phone OTP verification endpoints
    path('api/phone-otp/send/', send_otp, name='send_otp'),
    path('api/phone-otp/verify/', verify_otp, name='verify_otp'),
    path('api/user/phone/', user_phone, name='user_phone'),

    # Coupon history endpoints
    path('api/coupon-history/', coupon_history, name='coupon_history'),
    path('api/coupon-history/<int:id>/', coupon_history_detail, name='coupon_history_detail'),

    # Merchant coupon template operations
    path('api/merchant/coupon-templates/', list_coupon_templates, name='list_coupon_templates'),
    path('api/merchant/coupon-templates/<int:id>/', get_coupon_template, name='get_coupon_template'),
    path('api/merchant/coupon-templates/create/', create_coupon_template, name='create_coupon_template'),
    path('api/merchant/coupon-templates/<int:id>/update/', update_coupon_template, name='update_coupon_template'),
    path('api/merchant/coupon-templates/<int:id>/delete/', delete_coupon_template, name='delete_coupon_template'),
    path('api/merchant/coupon-templates/<int:id>/analytics/', get_template_analytics, name='get_template_analytics'),
    
    # Merchant coupon operations
    path('api/merchant/consolidate-coupon/', merchant_consolidate_coupon ,name='merchant_consolidate_coupon'),
    path('api/merchant/refresh_redeem_code/', refresh_redeem_code, name='refresh_redeem_code'),
    path('api/merchant/redeem/', merchant_redeem, name='merchant_redeem'),
    
    # Unified redemption operations
    path('api/merchant/unified-redemption/generate/', generate_unified_redemption_code_view, name='generate_unified_redemption_code'),
    
    # Merchant profile operations
    path('api/merchant/profile/', get_merchant_profile, name='get_merchant_profile'),
    path('api/merchant/profile/update/', update_merchant_profile, name='update_merchant_profile'),
    path('api/merchant/statistics/', get_merchant_statistics, name='get_merchant_statistics'),
    
    # Merchant account deletion (App Store compliance)
    path('api/merchant/account/pre-delete-check/', pre_delete_check, name='pre_delete_check'),
    path('api/merchant/account/delete/', delete_account, name='delete_account'),
    path('api/merchant/account/deletion-status/', get_deletion_status, name='get_deletion_status'),
    
    # Merchant image upload
    path('api/merchant/upload-image/', upload_image, name='upload_image'),
    
    # Tags endpoint
    path('api/tags/', get_all_tags, name='get_all_tags'),
    
    # QR code claim endpoints
    path('api/merchant/qr-session/generate/', generate_qr_session, name='generate_qr_session'),
    path('api/merchant/qr-session/<int:session_id>/invalidate/', invalidate_qr_session, name='invalidate_qr_session'),
    path('api/qr-claim/claim/', claim_coupon_via_qr, name='claim_coupon_via_qr'),

    # Ping from cron-job.org to keep the server alive
    path('api/ping/', lambda request: HttpResponse("Pong!")),  # Ping endpoint for cron-job.org
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)