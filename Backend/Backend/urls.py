from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from api.views.authentication import (
    register, login, logout, user_info, verify_email, request_email_verification,
    forgot_password, reset_password, refresh_token,
    verify_merchant_email, resend_merchant_verification, redirect_verify_email, redirect_reset_password
)
from api.views.coupon_views import get_store_coupons, get_exclusive_coupons, get_coupon_detail, redeem_coupon, validate_unified_redemption_code
from api.views.platform_voucher_views import (
    redeem_platform_voucher,
    platform_voucher_list,
    platform_voucher_detail,
    share_platform_voucher,
    get_platform_voucher_share,
    accept_platform_voucher_share,
    share_platform_voucher_public,
    my_public_voucher_shares,
    merchant_redeem_voucher,
)
from api.views.sharing_views import (
    share_coupon,
    get_share_request,
    accept_share_request,
    share_coupon_public,
    get_my_public_shares,
    withdraw_public_share,
    collection_landing,
    claim_landing,
    apple_app_site_association,
    assetlinks_json,
)
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
from api.views.phone_otp import (
    send_otp, verify_otp,
    send_registration_otp, verify_registration_otp,
    send_password_reset_otp, verify_password_reset_otp
)
from api.views.qr_claim import generate_qr_session, invalidate_qr_session, claim_coupon_via_qr
from api.views.account_deletion import pre_delete_check, delete_account, get_deletion_status
from api.views.consumer_account_deletion import consumer_pre_delete_check, consumer_delete_account
from api.views.content_moderation import (
    ReportContentView, ReportStatusView, UserReportsView,
    BlockMerchantView, UnblockMerchantView, BlockedMerchantsListView, BlockStatusView
)
from api.views.eula_acceptance import (
    EULAStatusView, EULAAcceptView, EULAContentView,
    ContentGuidelinesView, PrivacyPolicyView
)
from api.views.admin_moderation import (
    ModerationQueueView, ReportDetailView, ModerationActionView,
    EscalatedReportsView, MerchantViolationsView, ModerationStatsView
)
from api.views.load_test import load_test_verify_consistency, load_test_reset

import logging

from django.http import HttpResponse, JsonResponse
from django.db import connection
from django.urls import re_path

logger = logging.getLogger(__name__)

from rest_framework import permissions
from django.urls import path, re_path
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

def trigger_sentry_error(request):
    raise Exception("This is a test error")

def health_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ok", "db": "ok"})
    except Exception as e:
        logger.error("Health check database query failed: %s", e, exc_info=True)
        return JsonResponse({"status": "error", "db": str(e)}, status=503)


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

    # test sentry error
    path('api/test-sentry/', trigger_sentry_error, name='trigger_sentry_error'),

    # Coupon endpoints
    path('api/store-coupons/', get_store_coupons),  # Type A (store) coupons - 隨取及用
    path('api/exclusive-coupons/', get_exclusive_coupons),  # Type B (exclusive) coupons - 專屬優惠
    path('api/coupons/<int:id>/', get_coupon_detail),  # 單一 coupon 詳細頁面 API
    path('api/redeem/<int:id>/', redeem_coupon),
    
    # Unified redemption endpoints
    path('api/unified-redemption/<str:code>/', validate_unified_redemption_code, name='validate_unified_redemption_code'),
    # Platform voucher (011)
    path('api/platform-vouchers/', platform_voucher_list, name='platform_voucher_list'),
    path('api/platform-vouchers/<int:pk>/', platform_voucher_detail, name='platform_voucher_detail'),
    path('api/platform-voucher/<int:voucher_id>/redeem/', redeem_platform_voucher, name='redeem_platform_voucher'),
    path('api/platform-voucher/<int:voucher_id>/share/', share_platform_voucher, name='share_platform_voucher'),
    path('api/platform-voucher/<int:voucher_id>/share-public/', share_platform_voucher_public, name='share_platform_voucher_public'),
    path('api/platform-voucher/share/<str:token>/', get_platform_voucher_share, name='get_platform_voucher_share'),
    path('api/platform-voucher/share/<str:token>/accept/', accept_platform_voucher_share, name='accept_platform_voucher_share'),
    path('api/my-public-voucher-shares/', my_public_voucher_shares, name='my_public_voucher_shares'),
    path('api/merchant/redeem-voucher/', merchant_redeem_voucher, name='merchant_redeem_voucher'),
    
    # Event tracking endpoints
    path('api/events/template-view/', track_template_view, name='track_template_view'),

    # Daily draw endpoints
    path('api/daily-draw-templates/', get_daily_draw_templates, name='daily_draw_templates'),
    path('api/coupon/daily-draw/', draw_coupon, name='daily_draw'),
    path('api/coupon/draw-history/', draw_history, name='draw_history'),
    path('api/last-draw/', get_last_draw_time, name='get_last_draw_time'),

    # Universal Link fallback pages (https://api.coupro.pro/collection/<token>)
    path('collection/<str:token>/', collection_landing, name='collection_landing'),
    path('claim/<str:token>/', claim_landing, name='claim_landing'),
    path('cl/<str:token>/', claim_landing, name='claim_landing_short'),
    # iOS/Android verification (https://api.coupro.pro/.well-known/...)
    path('.well-known/apple-app-site-association', apple_app_site_association, name='apple_app_site_association'),
    path('.well-known/assetlinks.json', assetlinks_json, name='assetlinks_json'),

    # Coupon sharing endpoints
    path('api/coupon/<int:coupon_id>/share/', share_coupon, name='share_coupon'),
    path('api/coupon/<int:coupon_id>/share-public/', share_coupon_public, name='share_coupon_public'),
    path('api/coupon/share/<str:token>/', get_share_request, name='get_share_request'),
    path('api/coupon/share/<str:token>/accept/', accept_share_request, name='accept_share_request'),
    path('api/my-public-shares/', get_my_public_shares, name='get_my_public_shares'),
    path('api/coupon/share-public/<int:share_id>/withdraw/', withdraw_public_share, name='withdraw_public_share'),

    # Authentication endpoints    
    path('api/register/', register),
    path('api/login/', login),
    path('api/logout/', logout),
    path('api/token/refresh/', refresh_token, name='token_refresh'),  # Token refresh API
    path('api/verify-email/', verify_email),
    path('api/email-settings/send-verification/', request_email_verification, name='request_email_verification'),

    # Merchant verification endpoints
    path('api/merchant/verify-email/', verify_merchant_email, name='verify_merchant_email'),
    path('api/merchant/resend-verification/', resend_merchant_verification, name='resend_merchant_verification'),

    # Deep link redirect endpoints (for clickable email links)
    path('api/merchant/redirect/verify-email', redirect_verify_email, name='redirect_verify_email'),
    path('api/merchant/redirect/reset-password', redirect_reset_password, name='redirect_reset_password'),

    # Password reset endpoints (email-based)
    path('api/forgot-password/', forgot_password, name='forgot_password'),
    path('api/reset-password/', reset_password, name='reset_password'),
    
    # Phone-based registration endpoints
    path('api/register/send-otp/', send_registration_otp, name='send_registration_otp'),
    path('api/register/verify-otp/', verify_registration_otp, name='verify_registration_otp'),
    
    # Phone-based password reset endpoints
    path('api/forgot-password/phone/send-otp/', send_password_reset_otp, name='send_password_reset_otp'),
    path('api/forgot-password/phone/reset/', verify_password_reset_otp, name='verify_password_reset_otp'),

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

    # Consumer account deletion (App Store compliance)
    path('api/account/pre-delete-check/', consumer_pre_delete_check, name='consumer_pre_delete_check'),
    path('api/account/delete/', consumer_delete_account, name='consumer_delete_account'),
    
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

    # Health check endpoint for Render zero-downtime deploys
    path('api/health/', health_check, name='health_check'),
    path('api/load-test/verify-consistency/', load_test_verify_consistency),
    path('api/load-test/reset/', load_test_reset),

    # UGC Compliance: Content Reporting (User Story 1)
    path('api/content/<str:content_type>/<int:content_id>/report/', ReportContentView.as_view(), name='report_content'),
    path('api/content/<str:content_type>/<int:content_id>/report/status/', ReportStatusView.as_view(), name='report_status'),
    path('api/user/reports/', UserReportsView.as_view(), name='user_reports'),

    # UGC Compliance: Merchant Blocking (User Story 2)
    path('api/user/blocked-merchants/', BlockedMerchantsListView.as_view(), name='blocked_merchants_list'),
    path('api/user/blocked-merchants/add/', BlockMerchantView.as_view(), name='block_merchant'),
    path('api/user/blocked-merchants/<int:store_id>/', UnblockMerchantView.as_view(), name='unblock_merchant'),
    path('api/store/<int:store_id>/block-status/', BlockStatusView.as_view(), name='block_status'),

    # UGC Compliance: EULA Acceptance (User Story 3)
    path('api/merchant/eula/status/', EULAStatusView.as_view(), name='eula_status'),
    path('api/merchant/eula/accept/', EULAAcceptView.as_view(), name='eula_accept'),
    path('api/merchant/eula/content/', EULAContentView.as_view(), name='eula_content'),

    # UGC Compliance: Public Legal Content (User Story 5)
    path('api/content-guidelines/', ContentGuidelinesView.as_view(), name='content_guidelines'),
    path('api/privacy-policy/', PrivacyPolicyView.as_view(), name='privacy_policy'),

    # UGC Compliance: Admin Moderation Dashboard (User Story 4)
    path('api/admin/moderation/queue/', ModerationQueueView.as_view(), name='moderation_queue'),
    path('api/admin/moderation/reports/<int:report_id>/', ReportDetailView.as_view(), name='report_detail'),
    path('api/admin/moderation/reports/<int:report_id>/action/', ModerationActionView.as_view(), name='moderation_action'),
    path('api/admin/moderation/escalations/', EscalatedReportsView.as_view(), name='escalated_reports'),
    path('api/admin/moderation/merchants/<int:merchant_id>/violations/', MerchantViolationsView.as_view(), name='merchant_violations'),
    path('api/admin/moderation/stats/', ModerationStatsView.as_view(), name='moderation_stats'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)