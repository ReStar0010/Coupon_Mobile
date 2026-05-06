from django.urls import path
from api.views.merchant_coupon import (
    merchant_consolidate_coupon, refresh_redeem_code,
    list_coupon_templates, get_coupon_template, create_coupon_template,
    update_coupon_template, delete_coupon_template, merchant_redeem, upload_image,
    get_template_analytics, generate_unified_redemption_code_view,
)
from api.views.merchant_profile import (
    get_merchant_profile, update_merchant_profile, get_merchant_statistics,
)
from api.views.qr_claim import generate_qr_session, invalidate_qr_session
from api.views.account_deletion import pre_delete_check, delete_account, get_deletion_status
from api.views.platform_voucher_views import merchant_redeem_voucher
from api.views.eula_acceptance import EULAStatusView, EULAAcceptView, EULAContentView

app_name = 'merchants'

urlpatterns = [
    # Coupon template CRUD
    path('merchant/coupon-templates/', list_coupon_templates, name='list_coupon_templates'),
    path('merchant/coupon-templates/<int:id>/', get_coupon_template, name='get_coupon_template'),
    path('merchant/coupon-templates/create/', create_coupon_template, name='create_coupon_template'),
    path('merchant/coupon-templates/<int:id>/update/', update_coupon_template, name='update_coupon_template'),
    path('merchant/coupon-templates/<int:id>/delete/', delete_coupon_template, name='delete_coupon_template'),
    path('merchant/coupon-templates/<int:id>/analytics/', get_template_analytics, name='get_template_analytics'),

    # Merchant coupon operations
    path('merchant/consolidate-coupon/', merchant_consolidate_coupon, name='merchant_consolidate_coupon'),
    path('merchant/refresh_redeem_code/', refresh_redeem_code, name='refresh_redeem_code'),
    path('merchant/redeem/', merchant_redeem, name='merchant_redeem'),

    # Unified redemption
    path('merchant/unified-redemption/generate/', generate_unified_redemption_code_view, name='generate_unified_redemption_code'),

    # Merchant profile
    path('merchant/profile/', get_merchant_profile, name='get_merchant_profile'),
    path('merchant/profile/update/', update_merchant_profile, name='update_merchant_profile'),
    path('merchant/statistics/', get_merchant_statistics, name='get_merchant_statistics'),

    # Merchant account deletion (App Store compliance)
    path('merchant/account/pre-delete-check/', pre_delete_check, name='pre_delete_check'),
    path('merchant/account/delete/', delete_account, name='delete_account'),
    path('merchant/account/deletion-status/', get_deletion_status, name='get_deletion_status'),

    # Image upload
    path('merchant/upload-image/', upload_image, name='upload_image'),

    # QR session management
    path('merchant/qr-session/generate/', generate_qr_session, name='generate_qr_session'),
    path('merchant/qr-session/<int:session_id>/invalidate/', invalidate_qr_session, name='invalidate_qr_session'),

    # Voucher redemption by merchant
    path('merchant/redeem-voucher/', merchant_redeem_voucher, name='merchant_redeem_voucher'),

    # EULA
    path('merchant/eula/status/', EULAStatusView.as_view(), name='eula_status'),
    path('merchant/eula/accept/', EULAAcceptView.as_view(), name='eula_accept'),
    path('merchant/eula/content/', EULAContentView.as_view(), name='eula_content'),
]
